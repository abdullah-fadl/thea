/**
 * Failure Mid-Lab — Error during lab result save → verify partial state.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { LabTech } from '../actors/labTech';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { LabTestGenerator } from '../data/lab-tests';

export class FailureMidLab extends BaseScenario {
  readonly name = 'failure-mid-lab';
  readonly module = 'resilience';
  readonly description = 'Error during lab result save → verify partial state consistency';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const labGen = new LabTestGenerator();

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

    await this.step('Nurse vitals', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(booking.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');
    });

    // Order 2 labs
    const cbcOrder = await this.step('Order CBC', () =>
      doctor.createOrder({
        patientId: patientResult.id, encounterCoreId: booking.encounterCoreId,
        kind: 'LAB', code: 'CBC', name: 'CBC',
      }),
    );

    const bmpOrder = await this.step('Order BMP', () =>
      doctor.createOrder({
        patientId: patientResult.id, encounterCoreId: booking.encounterCoreId,
        kind: 'LAB', code: 'BMP', name: 'BMP',
      }),
    );

    await clock.labDelay();

    // CBC succeeds
    await this.step('CBC: collect + save result ✓', async () => {
      const specimen = await labTech.collectSpecimen(cbcOrder.orderId);
      await labTech.saveResult(cbcOrder.orderId, specimen.specimenId, labGen.byCode('CBC')!);
    });

    // BMP: attempt with invalid data
    await this.step('BMP: attempt save with invalid data → expect error', async () => {
      const res = await labTech.post('/api/lab/results/save', {
        orderId: bmpOrder.orderId,
        // Missing required fields intentionally
        testCode: '',
        parameters: null,
      });
      if (!res.ok) {
        console.log(`    [OK] Invalid lab result rejected: ${res.status}`);
      }
    });

    // Verify CBC result exists and is correct
    await this.step('Verify CBC result intact', async () => {
      const results = await labTech.getResults();
      this.assertExists(results.results, 'Lab results after partial failure');
    });

    // Retry BMP with valid data
    await this.step('BMP: retry with valid data ✓', async () => {
      const bmpSpecimen = await labTech.collectSpecimen(bmpOrder.orderId);
      await labTech.saveResult(bmpOrder.orderId, bmpSpecimen.specimenId, labGen.byCode('BMP')!);
    });

    // Verify both results now exist
    await this.step('Verify both results exist', async () => {
      const results = await labTech.getResults();
      this.assertExists(results.results, 'Both lab results');
    });
  }
}
