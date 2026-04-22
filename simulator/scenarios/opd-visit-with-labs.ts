/**
 * OPD Visit With Labs — Walk-in → doctor → lab orders → results → discharge.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { LabTech } from '../actors/labTech';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { NotesGenerator } from '../data/notes';
import { DiagnosisGenerator } from '../data/diagnoses';
import { LabTestGenerator } from '../data/lab-tests';

export class OpdVisitWithLabs extends BaseScenario {
  readonly name = 'opd-visit-with-labs';
  readonly module = 'opd';
  readonly description = 'Walk-in → doctor → lab orders → results → discharge';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const notesGen = new NotesGenerator();
    const diagGen = new DiagnosisGenerator();
    const labGen = new LabTestGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });
    const labTech = new LabTech({ baseUrl, credentials: credentials.staff });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), nurse.login(), doctor.login(), labTech.login()]);
    });

    // Register + walk-in
    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));
    state.trackPatient({ id: patientResult.id, mrn: patientResult.mrn, name: `${patient.firstName} ${patient.lastName}` });

    const booking = await this.step('Walk-in booking', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });
    state.trackEncounter({ id: booking.encounterCoreId, patientId: patientResult.id, type: 'OPD' });

    // Nurse vitals
    await this.step('Nurse records vitals', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(booking.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
    });

    // Doctor initial assessment + lab orders
    const cbcOrder = await this.step('Doctor orders CBC', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');
      const complaint = notesGen.randomChiefComplaint();
      await doctor.writeVisitNotes(booking.encounterCoreId, {
        chiefComplaint: complaint,
        hpiText: notesGen.randomHPI(),
        assessment: 'Awaiting lab results',
        plan: 'Order CBC, review results',
        diagnoses: diagGen.randomN(1),
      });
      return doctor.createOrder({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        kind: 'LAB',
        code: 'CBC',
        name: 'Complete Blood Count',
      });
    });

    state.trackOrder({ id: cbcOrder.orderId, encounterCoreId: booking.encounterCoreId, kind: 'LAB', status: 'PENDING' });

    // Lab tech processes
    await clock.labDelay();

    const specimen = await this.step('Lab collects specimen', async () => {
      return labTech.collectSpecimen(cbcOrder.orderId);
    });

    await clock.labDelay();

    await this.step('Lab saves result', async () => {
      const cbc = labGen.byCode('CBC')!;
      await labTech.saveResult(cbcOrder.orderId, specimen.specimenId, cbc);
    });

    // Doctor reviews and discharges
    await this.step('Doctor reviews results and discharges', async () => {
      await doctor.setDisposition(booking.encounterCoreId, {
        type: 'DISCHARGE',
        instructions: notesGen.randomDischargeInstructions(),
      });
    });

    await this.step('Verify encounter data', async () => {
      const enc = await doctor.getEncounter(booking.encounterCoreId);
      this.assertExists(enc, 'encounter');
    });
  }
}
