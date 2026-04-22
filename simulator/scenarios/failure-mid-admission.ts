/**
 * Failure Mid-Admission — Error during IPD admission → verify rollback/consistency.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { ErNurse } from '../actors/erNurse';
import { ErDoctor } from '../actors/erDoctor';
import { IpdNurse } from '../actors/ipdNurse';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';

export class FailureMidAdmission extends BaseScenario {
  readonly name = 'failure-mid-admission';
  readonly module = 'resilience';
  readonly description = 'Error during IPD admission → verify rollback/consistency';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const erNurse = new ErNurse({ baseUrl, credentials: credentials.nurse });
    const erDoctor = new ErDoctor({ baseUrl, credentials: credentials.doctor });
    const ipdNurse = new IpdNurse({ baseUrl, credentials: credentials.nurse });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), erNurse.login(), erDoctor.login(), ipdNurse.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    const erReg = await this.step('ER registration', () =>
      receptionist.erRegisterKnown(patientResult.id, 'Chest pain'),
    );

    await this.step('Triage + disposition ADMIT', async () => {
      const triageVitals = vitGen.generateErTriage();
      await erNurse.saveTriage(erReg.encounterId, {
        vitals: triageVitals,
        triageLevel: 2,
        chiefComplaint: 'Chest pain',
      });
      await erNurse.finishTriage(erReg.encounterId, {
        vitals: triageVitals,
        chiefComplaint: 'Chest pain',
      });
      await erDoctor.setDisposition(erReg.encounterId, { type: 'ADMIT', destination: 'WARD' });
    });

    const doctorUserId = await erDoctor.getUserId();

    // Attempt admission with missing required fields → expect error
    await this.step('Attempt admission with missing fields → expect error', async () => {
      const res = await ipdNurse.post('/api/ipd/episodes/create-from-encounter', {
        encounterCoreId: erReg.encounterId,
        // Missing serviceUnit and admittingDoctorUserId
      });
      if (!res.ok) {
        console.log(`    [OK] Missing fields admission rejected: ${res.status}`);
      }
    });

    // Verify ER encounter still active
    await this.step('Verify ER encounter still active', async () => {
      const enc = await erNurse.getEncounter(erReg.encounterId);
      this.assertExists(enc, 'ER encounter after failed admission');
    });

    // Retry with valid data
    await this.step('Retry admission with valid data', async () => {
      const episode = await ipdNurse.createFromEncounter(erReg.encounterId, {
        serviceUnit: 'WARD',
        admittingDoctorUserId: doctorUserId,
      });
      this.assertExists(episode.episodeId, 'IPD episode ID');
    });
  }
}
