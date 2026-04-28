/**
 * Lab Full Cycle — Order → collection → result → ack.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { LabTech } from '../actors/labTech';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { LabTestGenerator } from '../data/lab-tests';
import { DiagnosisGenerator } from '../data/diagnoses';

export class LabFullCycle extends BaseScenario {
  readonly name = 'lab-full-cycle';
  readonly module = 'lab';
  readonly description = 'Order → collection → result → ack';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const labGen = new LabTestGenerator();
    const diagGen = new DiagnosisGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });
    const labTech = new LabTech({ baseUrl, credentials: credentials.staff });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), nurse.login(), doctor.login(), labTech.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    const booking = await this.step('OPD walk-in', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });

    // Multiple lab orders
    await this.step('Nurse vitals', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(booking.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');
    });

    const cbcOrder = await this.step('Order CBC', () =>
      doctor.createOrder({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        kind: 'LAB',
        code: 'CBC',
        name: 'Complete Blood Count',
      }),
    );

    const bmpOrder = await this.step('Order BMP', () =>
      doctor.createOrder({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        kind: 'LAB',
        code: 'BMP',
        name: 'Basic Metabolic Panel',
      }),
    );

    await clock.labDelay();

    // Lab processes both
    const cbcSpecimen = await this.step('Collect CBC specimen', () => labTech.collectSpecimen(cbcOrder.orderId));
    const bmpSpecimen = await this.step('Collect BMP specimen', () => labTech.collectSpecimen(bmpOrder.orderId));

    await clock.labDelay();

    await this.step('Save CBC result', () => labTech.saveResult(cbcOrder.orderId, cbcSpecimen.specimenId, labGen.byCode('CBC')!));
    await this.step('Save BMP result', () => labTech.saveResult(bmpOrder.orderId, bmpSpecimen.specimenId, labGen.byCode('BMP')!));

    // Verify lab results exist
    await this.step('Verify lab results', async () => {
      const results = await labTech.getResults();
      this.assertExists(results.results, 'Lab results');
    });

    // Discharge — requires diagnosis
    await this.step('Discharge', async () => {
      const diag = diagGen.random();
      await doctor.writeVisitNotes(booking.encounterCoreId, {
        chiefComplaint: 'Lab follow-up',
        hpiText: 'Patient underwent routine lab tests.',
        assessment: diag.en,
        plan: 'Follow up as needed based on lab results.',
        diagnoses: [diag],
      });
      await doctor.setDisposition(booking.encounterCoreId, { type: 'DISCHARGE' });
    });
  }
}
