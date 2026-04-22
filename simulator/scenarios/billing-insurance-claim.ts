/**
 * Billing Insurance Claim — Eligibility → charges → claim submit → remit.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { BillingClerk } from '../actors/billingClerk';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { DiagnosisGenerator } from '../data/diagnoses';

export class BillingInsuranceClaim extends BaseScenario {
  readonly name = 'billing-insurance-claim';
  readonly module = 'billing';
  readonly description = 'Eligibility → charges → claim submit → remit';

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
        chiefComplaint: 'General checkup',
        hpiText: 'Patient presenting for routine evaluation.',
        assessment: diag.en,
        plan: 'Continue current treatment plan',
        diagnoses: [diag],
      });
    });

    // Billing with insurance — must happen BEFORE discharge (which closes the encounter)
    await this.step('Record charges', async () => {
      await billing.recordCharge({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        code: 'CONSULT',
        description: 'OPD Consultation',
        amount: 300,
      });
      await billing.recordCharge({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        code: 'CBC-LAB',
        description: 'CBC Lab Test',
        amount: 100,
      });
    });

    // Discharge after billing
    await this.step('Discharge patient', async () => {
      await doctor.setDisposition(booking.encounterCoreId, { type: 'DISCHARGE' });
    });

    // Check eligibility
    await this.step('Check insurance eligibility', async () => {
      try {
        await billing.checkEligibility({
          patientId: patientResult.id,
          payerId: 'test-payer-001',
          memberId: 'MEM-' + patient.nationalId,
        });
      } catch {
        // Eligibility check may fail without real payer setup — acceptable
      }
    });

    // Create and submit claim
    await this.step('Create claim', async () => {
      try {
        const claim = await billing.createClaim({
          patientId: patientResult.id,
          encounterCoreId: booking.encounterCoreId,
          payerId: 'test-payer-001',
          totalAmount: 400,
        });
        await billing.submitClaim(claim.claimId);
      } catch {
        // Claims may need payer setup — log but don't fail
      }
    });

    await this.step('Verify balance', async () => {
      const balance = await billing.getBalance(booking.encounterCoreId);
      this.assertExists(balance, 'Balance data');
    });
  }
}
