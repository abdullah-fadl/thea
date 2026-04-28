/**
 * Radiology Critical Finding — Study with critical finding → escalation.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { Radiologist } from '../actors/radiologist';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { RadiologyExamGenerator } from '../data/radiology-exams';

export class RadiologyCriticalFinding extends BaseScenario {
  readonly name = 'radiology-critical-finding';
  readonly module = 'radiology';
  readonly description = 'Study with critical finding → escalation';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const radGen = new RadiologyExamGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });
    const radiologist = new Radiologist({ baseUrl, credentials: credentials.staff });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), nurse.login(), doctor.login(), radiologist.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    const booking = await this.step('OPD walk-in', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });

    const exam = radGen.ct();
    const radOrder = await this.step('Order CT scan', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(booking.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');

      return doctor.createOrder({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        kind: 'RADIOLOGY',
        code: exam.code,
        name: exam.name,
        priority: 'URGENT',
      });
    });

    await clock.labDelay();

    // Report with critical finding
    await this.step('Save report — CRITICAL', async () => {
      await radiologist.saveReport({
        orderId: radOrder.orderId,
        findings: 'Large right-sided pleural effusion with mediastinal shift. Possible tension pneumothorax.',
        impression: 'CRITICAL: Large pleural effusion with mediastinal shift. Urgent intervention required.',
        isCritical: true,
      });
    });

    await this.step('Verify report saved', async () => {
      const reports = await radiologist.getReports();
      this.assertExists(reports.reports, 'reports');
    });
  }
}
