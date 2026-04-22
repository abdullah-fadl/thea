/**
 * Billing Cash Visit — Charge events → invoice → cash payment.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { BillingClerk } from '../actors/billingClerk';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { DiagnosisGenerator } from '../data/diagnoses';

export class BillingCashVisit extends BaseScenario {
  readonly name = 'billing-cash-visit';
  readonly module = 'billing';
  readonly description = 'Charge events → invoice → cash payment';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const diagGen = new DiagnosisGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });
    const billing = new BillingClerk({ baseUrl, credentials: credentials.staff });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), nurse.login(), doctor.login(), billing.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    const booking = await this.step('OPD walk-in', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });

    // Quick visit — must include diagnosis before discharge
    await this.step('Quick visit', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(booking.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');

      // Write diagnosis (required before discharge)
      const diag = diagGen.random();
      await doctor.writeVisitNotes(booking.encounterCoreId, {
        chiefComplaint: 'Follow-up visit',
        hpiText: 'Patient presenting for routine follow-up.',
        assessment: diag.en,
        plan: 'Continue current management',
        diagnoses: [diag],
      });
    });

    // Billing — must happen BEFORE discharge (which closes the encounter)
    await this.step('Record consultation charge', async () => {
      await billing.recordCharge({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        code: 'CONSULT',
        description: 'OPD Consultation',
        amount: 200,
      });
    });

    // Set payer context before locking (must happen while unlocked)
    await this.step('Set payer context (cash)', async () => {
      await billing.setPayerContext({
        encounterCoreId: booking.encounterCoreId,
        mode: 'CASH',
      });
    });

    // Discharge after billing charges recorded
    await this.step('Discharge patient', async () => {
      await doctor.setDisposition(booking.encounterCoreId, { type: 'DISCHARGE' });
    });

    // Lock → post → pay (required billing workflow)
    await this.step('Lock and post billing', async () => {
      await billing.lockBilling(booking.encounterCoreId);
      await billing.postBilling(booking.encounterCoreId);
    });

    await this.step('Record cash payment', async () => {
      await billing.recordPayment({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        amount: 200,
        method: 'CASH',
      });
    });

    // Verify
    await this.step('Verify charge summary', async () => {
      const summary = await billing.getChargeSummary({ encounterCoreId: booking.encounterCoreId });
      this.assertExists(summary, 'Charge summary');
    });
  }
}
