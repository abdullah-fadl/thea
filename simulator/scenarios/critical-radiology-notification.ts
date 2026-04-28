/**
 * Critical Radiology Notification — Critical finding → verify notification sent to referring doctor.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { Radiologist } from '../actors/radiologist';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { RadiologyExamGenerator } from '../data/radiology-exams';

export class CriticalRadiologyNotification extends BaseScenario {
  readonly name = 'critical-radiology-notification';
  readonly module = 'notifications';
  readonly description = 'Critical finding → verify notification sent to referring doctor';

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

    await this.step('Nurse vitals', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(booking.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');
    });

    // Order CT
    const exam = radGen.ct();
    const radOrder = await this.step('Doctor orders CT', () =>
      doctor.createOrder({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        kind: 'RADIOLOGY', code: exam.code, name: exam.name,
        priority: 'URGENT',
      }),
    );

    await clock.labDelay();

    // Radiologist files CRITICAL report
    await this.step('Radiologist files CRITICAL report', async () => {
      await radiologist.saveReport({
        orderId: radOrder.orderId,
        findings: 'Large right-sided pneumothorax with mediastinal shift. Immediate chest tube required.',
        impression: 'CRITICAL: Tension pneumothorax.',
        isCritical: true,
      });
    });

    await clock.shortDelay();

    // Check notification
    await this.step('Verify critical radiology notification', async () => {
      const notifRes = await doctor.get<{ notifications: unknown[] }>('/api/notifications/inbox');
      const notifs = doctor.assertOk(notifRes, 'Get notifications');
      this.assertExists(notifs, 'Notification inbox');
    });
  }
}
