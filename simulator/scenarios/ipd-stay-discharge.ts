/**
 * IPD Stay Discharge — Admission → rounds → MAR → discharge.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { ErNurse } from '../actors/erNurse';
import { ErDoctor } from '../actors/erDoctor';
import { IpdNurse } from '../actors/ipdNurse';
import { Doctor } from '../actors/doctor';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';

export class IpdStayDischarge extends BaseScenario {
  readonly name = 'ipd-stay-discharge';
  readonly module = 'ipd';
  readonly description = 'Admission → rounds → MAR → discharge';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const erNurse = new ErNurse({ baseUrl, credentials: credentials.nurse });
    const erDoctor = new ErDoctor({ baseUrl, credentials: credentials.doctor });
    const ipdNurse = new IpdNurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), erNurse.login(), erDoctor.login(), ipdNurse.login(), doctor.login()]);
    });

    // Register + ER + admit
    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));
    state.trackPatient({ id: patientResult.id, mrn: patientResult.mrn, name: `${patient.firstName} ${patient.lastName}` });

    const erReg = await this.step('ER registration', () =>
      receptionist.erRegisterKnown(patientResult.id, 'Pneumonia requiring IV antibiotics'),
    );

    await this.step('Triage + admit disposition', async () => {
      const triageVitals = vitGen.generateErTriage();
      await erNurse.saveTriage(erReg.encounterId, {
        vitals: triageVitals,
        triageLevel: 2,
        chiefComplaint: 'Pneumonia',
      });
      await erNurse.finishTriage(erReg.encounterId, {
        vitals: triageVitals,
        chiefComplaint: 'Pneumonia',
      });
      await erDoctor.setDisposition(erReg.encounterId, { type: 'ADMIT', destination: 'WARD' });
    });

    // IPD admission
    const doctorUserId = await erDoctor.getUserId();
    const episode = await this.step('IPD admission', async () => {
      return ipdNurse.createFromEncounter(erReg.encounterId, {
        serviceUnit: 'WARD',
        admittingDoctorUserId: doctorUserId,
      });
    });

    // Nursing progress during stay
    await this.step('Day 1 — nursing progress', async () => {
      await ipdNurse.nursingProgress(episode.episodeId, 'Patient settled. IV antibiotics started. Vitals stable.');
      await ipdNurse.recordVitals(episode.episodeId, vitGen.generateNormal());
    });

    await clock.patientWait();

    await this.step('Day 2 — nursing progress', async () => {
      await ipdNurse.nursingProgress(episode.episodeId, 'Improving. Temp normalized. Tolerating oral intake.');
      await ipdNurse.recordVitals(episode.episodeId, vitGen.generateNormal());
    });

    // Doctor orders discharge
    await this.step('Doctor orders discharge', async () => {
      await doctor.createOrder({
        patientId: patientResult.id,
        encounterCoreId: erReg.encounterCoreId,
        kind: 'MEDICATION',
        code: 'AMOX500',
        name: 'Amoxicillin 500mg — discharge prescription',
      });
    });

    await this.step('Verify IPD episode', async () => {
      const ep = await ipdNurse.getEpisode(episode.episodeId);
      this.assertExists(ep, 'IPD episode');
    });
  }
}
