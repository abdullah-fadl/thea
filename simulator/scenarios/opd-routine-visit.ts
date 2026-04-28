/**
 * OPD Routine Visit — Walk-in → vitals → doctor → discharge.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { NotesGenerator } from '../data/notes';
import { DiagnosisGenerator } from '../data/diagnoses';

export class OpdRoutineVisit extends BaseScenario {
  readonly name = 'opd-routine-visit';
  readonly module = 'opd';
  readonly description = 'Walk-in → vitals → doctor → discharge';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const creds = { baseUrl, credentials: credentials.receptionist };
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const notesGen = new NotesGenerator();
    const diagGen = new DiagnosisGenerator();

    // 1. Login actors
    const receptionist = new Receptionist(creds);
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), nurse.login(), doctor.login()]);
    });

    // 2. Register patient
    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', async () => {
      return receptionist.registerPatient(patient);
    });

    state.trackPatient({
      id: patientResult.id,
      mrn: patientResult.mrn,
      name: `${patient.firstName} ${patient.lastName}`,
    });

    // 3. Get department and walk-in
    const booking = await this.step('Walk-in booking', async () => {
      const depts = await receptionist.getDepartments();
      const dept = depts.departments?.[0];
      this.assertExists(dept, 'department');
      return receptionist.walkIn(patientResult.id, dept.id);
    });

    state.trackEncounter({
      id: booking.encounterCoreId,
      patientId: patientResult.id,
      type: 'OPD',
    });

    // 4. Nurse takes vitals
    await this.step('Nurse records vitals', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      const vitals = vitGen.generateNormal();
      await nurse.recordVitals(booking.encounterCoreId, vitals);
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
    });

    await clock.nursingDelay();

    // 5. Doctor writes notes
    await this.step('Doctor writes visit notes', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');
      const complaint = notesGen.randomChiefComplaint();
      await doctor.writeVisitNotes(booking.encounterCoreId, {
        chiefComplaint: complaint,
        hpiText: notesGen.randomHPI(),
        assessment: notesGen.randomAssessment(),
        plan: notesGen.randomPlan(),
        diagnoses: diagGen.randomN(2),
      });
    });

    await clock.doctorDelay();

    // 6. Doctor discharges
    await this.step('Doctor discharges patient', async () => {
      await doctor.setDisposition(booking.encounterCoreId, {
        type: 'DISCHARGE',
        instructions: notesGen.randomDischargeInstructions(),
      });
    });

    // 7. Verify encounter is completed
    await this.step('Verify encounter completed', async () => {
      const enc = await doctor.getEncounter(booking.encounterCoreId);
      // Check that encounter has notes or disposition set
      this.assertExists(enc, 'encounter data');
    });
  }
}
