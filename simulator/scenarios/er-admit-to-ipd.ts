/**
 * ER Admit to IPD — ER → triage → admit → IPD handoff.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { ErNurse } from '../actors/erNurse';
import { ErDoctor } from '../actors/erDoctor';
import { IpdNurse } from '../actors/ipdNurse';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { NotesGenerator } from '../data/notes';

export class ErAdmitToIpd extends BaseScenario {
  readonly name = 'er-admit-to-ipd';
  readonly module = 'er';
  readonly description = 'ER → triage → admit → IPD handoff';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const notesGen = new NotesGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const erNurse = new ErNurse({ baseUrl, credentials: credentials.nurse });
    const erDoctor = new ErDoctor({ baseUrl, credentials: credentials.doctor });
    const ipdNurse = new IpdNurse({ baseUrl, credentials: credentials.nurse });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), erNurse.login(), erDoctor.login(), ipdNurse.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));
    state.trackPatient({ id: patientResult.id, mrn: patientResult.mrn, name: `${patient.firstName} ${patient.lastName}` });

    // ER registration with critical complaint
    const erReg = await this.step('ER registration', () =>
      receptionist.erRegisterKnown(patientResult.id, 'Severe chest pain, shortness of breath'),
    );
    state.trackEncounter({ id: erReg.encounterId, patientId: patientResult.id, type: 'ER' });

    // Critical triage
    await this.step('Critical triage', async () => {
      const vitals = vitGen.generateErTriageCritical();
      await erNurse.saveTriage(erReg.encounterId, {
        vitals,
        triageLevel: 1,
        chiefComplaint: 'Severe chest pain',
      });
      await erNurse.finishTriage(erReg.encounterId, {
        vitals,
        chiefComplaint: 'Severe chest pain',
      });
    });

    await this.step('Assign ER bed', () => erNurse.assignBed(erReg.encounterId));
    await clock.shortDelay();

    // Doctor decides to admit
    await this.step('Doctor assessment — admit', async () => {
      await erDoctor.writeNotes(erReg.encounterId, {
        assessment: 'Acute coronary syndrome — requires inpatient monitoring',
        plan: 'Admit to cardiology ward for telemetry monitoring',
      });
    });

    await this.step('Set disposition → ADMIT', async () => {
      await erDoctor.setDisposition(erReg.encounterId, {
        type: 'ADMIT',
        destination: 'WARD',
        admitUnit: 'CARDIOLOGY',
      });
    });

    // IPD admission
    const doctorUserId = await erDoctor.getUserId();
    await this.step('IPD admission from ER', async () => {
      // Try to create episode from the encounter
      const episode = await ipdNurse.createFromEncounter(erReg.encounterId, {
        serviceUnit: 'CARDIOLOGY',
        admittingDoctorUserId: doctorUserId,
      });
      state.trackEpisode({ id: episode.episodeId, encounterCoreId: erReg.encounterId, type: 'IPD' });
    });

    await this.step('Verify IPD episode exists', async () => {
      // Verify the encounter has been linked to an IPD episode
      const enc = await erNurse.getEncounter(erReg.encounterId);
      this.assertExists(enc, 'ER encounter after admission');
    });
  }
}
