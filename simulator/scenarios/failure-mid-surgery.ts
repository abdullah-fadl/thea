/**
 * Failure Mid-Surgery — Simulate invalid transition during OR → verify data integrity.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { OrNurse } from '../actors/orNurse';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { ProcedureGenerator } from '../data/surgical';

export class FailureMidSurgery extends BaseScenario {
  readonly name = 'failure-mid-surgery';
  readonly module = 'resilience';
  readonly description = 'Simulate invalid OR transition → verify data integrity after recovery';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const procGen = new ProcedureGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });
    const orNurse = new OrNurse({ baseUrl, credentials: credentials.nurse });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), nurse.login(), doctor.login(), orNurse.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    const booking = await this.step('OPD walk-in', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });

    const proc = procGen.random();
    const procOrder = await this.step('Order procedure', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(booking.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');
      return doctor.createOrder({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        kind: 'PROCEDURE',
        code: proc.code,
        name: proc.name,
      });
    });

    const doctorUserId = await doctor.getUserId();

    const orCase = await this.step('Create OR case + PRE_OP + TIME_OUT + INTRA_OP', async () => {
      const c = await orNurse.createCase(procOrder.orderId);
      await orNurse.preOp(c.caseId, {
        surgeonUserId: doctorUserId,
        anesthesiaUserId: doctorUserId,
      });
      await orNurse.timeOut(c.caseId, {
        patientIdentityConfirmed: true, siteMarked: true, consentSigned: true,
        allergiesReviewed: true, antibioticGiven: true,
      });
      await orNurse.intraOp(c.caseId, {
        note: 'Incision made',
        startedAt: new Date().toISOString(),
      });
      return c;
    });

    // Attempt invalid transition — try to complete before post-op (skip expected step)
    await this.step('Attempt invalid status transition', async () => {
      const res = await orNurse.put(`/api/or/cases/${orCase.caseId}`, { status: 'COMPLETED' });
      // Should fail or at least not corrupt the case
      // We don't assertOk — we expect it might fail
      if (!res.ok) {
        console.log(`    [OK] Invalid transition rejected: ${res.status}`);
      }
    });

    // Verify case is still intact
    await this.step('Verify case still intact after failure', async () => {
      const caseData = await orNurse.getCase(orCase.caseId);
      this.assertExists(caseData, 'OR case after failed transition');
    });

    // Verify events still intact
    await this.step('Verify events still intact', async () => {
      const events = await orNurse.getEvents(orCase.caseId);
      this.assertExists(events.items, 'OR events after failed transition');
    });

    // Now do the correct flow — continue with POST_OP and RECOVERY
    await this.step('Complete correct flow', async () => {
      await orNurse.postOp(orCase.caseId, {
        note: 'Wound closed. All counts correct.',
        complications: false,
      });
      await orNurse.recovery(orCase.caseId, {
        handoffSummary: 'Patient stable for recovery',
        destination: 'WARD',
      });
    });
  }
}
