/**
 * OPD Follow-Up — Return visit with updated problem list.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { NotesGenerator } from '../data/notes';
import { DiagnosisGenerator } from '../data/diagnoses';

export class OpdFollowUp extends BaseScenario {
  readonly name = 'opd-follow-up';
  readonly module = 'opd';
  readonly description = 'Return visit with problem list update';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const notesGen = new NotesGenerator();
    const diagGen = new DiagnosisGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), nurse.login(), doctor.login()]);
    });

    // Register patient
    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));
    state.trackPatient({ id: patientResult.id, mrn: patientResult.mrn, name: `${patient.firstName} ${patient.lastName}` });

    // First visit
    const visit1 = await this.step('First visit walk-in', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });

    await this.step('First visit — nurse + doctor + discharge', async () => {
      await nurse.updateFlowState(visit1.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(visit1.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(visit1.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(visit1.encounterCoreId, 'IN_DOCTOR');
      await doctor.writeVisitNotes(visit1.encounterCoreId, {
        chiefComplaint: 'Hypertension follow-up',
        hpiText: 'Patient with known HTN',
        assessment: 'Hypertension — controlled',
        plan: 'Continue current medications. Follow-up in 2 weeks.',
        diagnoses: [diagGen.random()],
      });
      await doctor.setDisposition(visit1.encounterCoreId, { type: 'DISCHARGE', instructions: 'Follow-up in 2 weeks' });
    });

    await clock.shortDelay();

    // Second visit (follow-up)
    const visit2 = await this.step('Follow-up walk-in', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });

    state.trackEncounter({ id: visit2.encounterCoreId, patientId: patientResult.id, type: 'OPD' });

    await this.step('Follow-up — nurse + doctor + discharge', async () => {
      await nurse.updateFlowState(visit2.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(visit2.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(visit2.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(visit2.encounterCoreId, 'IN_DOCTOR');
      await doctor.writeVisitNotes(visit2.encounterCoreId, {
        chiefComplaint: 'Follow-up visit',
        hpiText: 'Returning for scheduled follow-up. BP improved.',
        assessment: 'Hypertension — improving on current regimen',
        plan: 'Continue same plan. Next follow-up in 1 month.',
        diagnoses: diagGen.randomN(1),
      });
      await doctor.setDisposition(visit2.encounterCoreId, { type: 'DISCHARGE', instructions: 'Follow-up in 1 month' });
    });

    // Verify patient has visit history
    await this.step('Verify patient visit count', async () => {
      const visitsRes = await doctor.get<{ count: number }>(`/api/patients/${patientResult.id}/visits/count`);
      const visits = doctor.assertOk(visitsRes, 'Get visit count');
      this.assert((visits.count || 0) >= 1, 'Patient should have at least 1 visit recorded');
    });
  }
}
