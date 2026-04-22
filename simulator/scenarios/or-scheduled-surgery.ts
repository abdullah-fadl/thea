/**
 * OR Scheduled Surgery — Pre-op → time-out → surgery → PACU → recovery.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { OrNurse } from '../actors/orNurse';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { ProcedureGenerator } from '../data/surgical';
import { NotesGenerator } from '../data/notes';
import { DiagnosisGenerator } from '../data/diagnoses';

export class OrScheduledSurgery extends BaseScenario {
  readonly name = 'or-scheduled-surgery';
  readonly module = 'or';
  readonly description = 'Pre-op → time-out → surgery → PACU → recovery';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const procGen = new ProcedureGenerator();
    const notesGen = new NotesGenerator();
    const diagGen = new DiagnosisGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });
    const orNurse = new OrNurse({ baseUrl, credentials: credentials.nurse });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), nurse.login(), doctor.login(), orNurse.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    // OPD visit → procedure order
    const booking = await this.step('OPD walk-in', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });

    const proc = procGen.random();
    const procOrder = await this.step('Doctor orders procedure', async () => {
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
        priority: 'ROUTINE',
        details: { estimatedDuration: proc.duration },
      });
    });

    const doctorUserId = await doctor.getUserId();

    // OR case from order
    const orCase = await this.step('Create OR case', async () => {
      return orNurse.createCase(procOrder.orderId);
    });

    // PRE_OP
    await this.step('PRE_OP checklist', async () => {
      await orNurse.preOp(orCase.caseId, {
        surgeonUserId: doctorUserId,
        anesthesiaUserId: doctorUserId,
      });
    });

    // WHO time-out
    await this.step('WHO time-out checklist', async () => {
      await orNurse.timeOut(orCase.caseId, {
        patientIdentityConfirmed: true,
        siteMarked: true,
        consentSigned: true,
        allergiesReviewed: true,
        antibioticGiven: true,
      });
    });

    // INTRA_OP
    await this.step('Surgical events — intra-op', async () => {
      await orNurse.intraOp(orCase.caseId, {
        note: `${proc.name} performed — incision, procedure, closure`,
        startedAt: new Date().toISOString(),
      });
      await clock.shortDelay();
    });

    // POST_OP
    await this.step('Post-op notes', async () => {
      await orNurse.postOp(orCase.caseId, {
        note: 'Wound closed. Sponges: 10/10, Instruments: 15/15, Needles: 3/3 — all correct',
        complications: false,
      });
    });

    // RECOVERY
    await this.step('Recovery + PACU transfer', async () => {
      await orNurse.recovery(orCase.caseId, {
        handoffSummary: 'Patient stable, transferred to PACU for recovery',
        destination: 'WARD',
      });
    });

    // Verify
    await this.step('Verify OR case events', async () => {
      const events = await orNurse.getEvents(orCase.caseId);
      this.assertExists(events.items, 'OR events');
    });
  }
}
