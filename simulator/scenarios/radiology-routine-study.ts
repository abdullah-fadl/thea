/**
 * Radiology Routine Study — Order → schedule → perform → report → verify.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { Radiologist } from '../actors/radiologist';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { RadiologyExamGenerator } from '../data/radiology-exams';
import { DiagnosisGenerator } from '../data/diagnoses';

export class RadiologyRoutineStudy extends BaseScenario {
  readonly name = 'radiology-routine-study';
  readonly module = 'radiology';
  readonly description = 'Order → schedule → perform → report → verify';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const radGen = new RadiologyExamGenerator();
    const diagGen = new DiagnosisGenerator();

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

    // Doctor orders radiology
    const exam = radGen.xray();
    const radOrder = await this.step('Order radiology exam', async () => {
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
      });
    });

    await clock.labDelay();

    // Radiologist processes
    await this.step('Save radiology report', async () => {
      await radiologist.saveReport({
        orderId: radOrder.orderId,
        findings: 'No acute cardiopulmonary process. Heart size normal. Lungs clear.',
        impression: 'Normal chest X-ray. No acute findings.',
        isCritical: false,
      });
    });

    await this.step('Verify radiology report', async () => {
      const reports = await radiologist.getReports();
      this.assertExists(reports.reports, 'Radiology reports');
    });

    // Discharge — requires diagnosis first
    await this.step('Discharge', async () => {
      const diag = diagGen.random();
      await doctor.writeVisitNotes(booking.encounterCoreId, {
        chiefComplaint: 'Imaging follow-up',
        hpiText: 'Patient underwent routine imaging study.',
        assessment: diag.en,
        plan: 'Follow up as needed',
        diagnoses: [diag],
      });
      await doctor.setDisposition(booking.encounterCoreId, { type: 'DISCHARGE' });
    });
  }
}
