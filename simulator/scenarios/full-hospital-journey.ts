/**
 * Full Hospital Journey — OPD → ER → IPD → ICU → OR → discharge (full path).
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { ErNurse } from '../actors/erNurse';
import { ErDoctor } from '../actors/erDoctor';
import { IpdNurse } from '../actors/ipdNurse';
import { IcuDoctor } from '../actors/icuDoctor';
import { OrNurse } from '../actors/orNurse';
import { LabTech } from '../actors/labTech';
import { BillingClerk } from '../actors/billingClerk';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { NotesGenerator } from '../data/notes';
import { DiagnosisGenerator } from '../data/diagnoses';
import { ProcedureGenerator } from '../data/surgical';
import { LabTestGenerator } from '../data/lab-tests';

export class FullHospitalJourney extends BaseScenario {
  readonly name = 'full-hospital-journey';
  readonly module = 'cross';
  readonly description = 'OPD → ER → IPD → ICU → OR → discharge (full path)';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const notesGen = new NotesGenerator();
    const diagGen = new DiagnosisGenerator();
    const procGen = new ProcedureGenerator();
    const labGen = new LabTestGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });
    const erNurse = new ErNurse({ baseUrl, credentials: credentials.nurse });
    const erDoctor = new ErDoctor({ baseUrl, credentials: credentials.doctor });
    const ipdNurse = new IpdNurse({ baseUrl, credentials: credentials.nurse });
    const icuDoctor = new IcuDoctor({ baseUrl, credentials: credentials.doctor });
    const orNurse = new OrNurse({ baseUrl, credentials: credentials.nurse });
    const labTech = new LabTech({ baseUrl, credentials: credentials.staff });
    const billing = new BillingClerk({ baseUrl, credentials: credentials.staff });

    await this.step('Login all actors', async () => {
      await Promise.all([
        receptionist.login(), nurse.login(), doctor.login(),
        erNurse.login(), erDoctor.login(), ipdNurse.login(),
        icuDoctor.login(), orNurse.login(), labTech.login(), billing.login(),
      ]);
    });

    // 1. OPD visit → referred to ER
    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    const booking = await this.step('OPD walk-in', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });

    await this.step('OPD visit — doctor refers to ER', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(booking.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');
      await doctor.writeVisitNotes(booking.encounterCoreId, {
        chiefComplaint: 'Severe abdominal pain',
        hpiText: 'Acute onset, guarding present',
        assessment: 'Possible acute abdomen — needs urgent surgical evaluation',
        plan: 'Refer to ER for urgent workup',
        diagnoses: diagGen.randomN(1),
      });
    });

    // 2. ER evaluation
    // erReg.encounterId = ER encounter UUID (for ER-specific APIs)
    // erReg.encounterCoreId = encounterCore UUID (for orders hub, billing, etc.)
    const erReg = await this.step('ER registration', () =>
      receptionist.erRegisterKnown(patientResult.id, 'Acute abdomen — referred from OPD'),
    );

    await this.step('ER triage', async () => {
      const erVitals = vitGen.generateErTriageCritical();
      await erNurse.saveTriage(erReg.encounterId, {
        vitals: erVitals,
        triageLevel: 2,
        chiefComplaint: 'Acute abdomen',
      });
      await erNurse.finishTriage(erReg.encounterId, {
        vitals: erVitals,
        chiefComplaint: 'Acute abdomen',
      });
      await erNurse.assignBed(erReg.encounterId);
    });

    // ER labs
    const erLabOrder = await this.step('ER lab orders', () =>
      erDoctor.createOrder(erReg.encounterId, {
        kind: 'LAB', code: 'CBC', name: 'CBC — STAT',
        priority: 'STAT',
      }),
    );

    await clock.labDelay();

    await this.step('Lab results', async () => {
      const specimen = await labTech.collectSpecimen(erLabOrder.orderId);
      const cbcTest = labGen.byCode('CBC')!;
      await labTech.saveResult(erLabOrder.orderId, specimen.specimenId, cbcTest);
    });

    // 3. Admit to IPD → ICU
    await this.step('ER disposition → admit', () =>
      erDoctor.setDisposition(erReg.encounterId, { type: 'ADMIT', destination: 'ICU' }),
    );

    const doctorUserId = await erDoctor.getUserId();
    const episode = await this.step('IPD admission', () =>
      ipdNurse.createFromEncounter(erReg.encounterCoreId, {
        serviceUnit: 'ICU',
        admittingDoctorUserId: doctorUserId,
      }),
    );

    await this.step('ICU admit + SOFA', async () => {
      await icuDoctor.admit(episode.episodeId, { reason: 'Acute abdomen — pre-op ICU', sourceUnit: 'ER' });
      await icuDoctor.recordSOFA(episode.episodeId, {
        respiratory: 1, cardiovascular: 2, cns: 0, renal: 0, liver: 1, coagulation: 0,
      });
    });

    // 4. OR — surgery
    const proc = procGen.random();
    const procOrder = await this.step('Order surgical procedure', () =>
      doctor.createOrder({
        patientId: patientResult.id,
        encounterCoreId: erReg.encounterCoreId,
        kind: 'PROCEDURE',
        code: proc.code,
        name: proc.name,
        priority: 'URGENT',
      }),
    );

    const orCase = await this.step('Create OR case + surgical workflow', async () => {
      const c = await orNurse.createCase(procOrder.orderId);
      // Step 1: PRE_OP
      await orNurse.preOp(c.caseId, {
        surgeonUserId: doctorUserId,
        anesthesiaUserId: doctorUserId,
      });
      // Step 2: TIME_OUT
      await orNurse.timeOut(c.caseId, {
        patientIdentityConfirmed: true, siteMarked: true, consentSigned: true,
        allergiesReviewed: true, antibioticGiven: true,
      });
      // Step 3: INTRA_OP
      await orNurse.intraOp(c.caseId, {
        note: `${proc.name} — Incision made, procedure performed`,
        startedAt: new Date().toISOString(),
      });
      await clock.shortDelay();
      // Step 4: POST_OP
      await orNurse.postOp(c.caseId, {
        note: 'Wound closed, no complications',
        complications: false,
      });
      // Step 5: RECOVERY
      await orNurse.recovery(c.caseId, {
        handoffSummary: 'Patient stable, transferred to ward for post-op care',
        destination: 'WARD',
      });
      return c;
    });

    // 5. Post-op → discharge
    await this.step('Post-op nursing', async () => {
      await ipdNurse.nursingProgress(episode.episodeId, 'Post-op: stable. Vitals monitored q15 min.');
      await ipdNurse.recordVitals(episode.episodeId, vitGen.generateNormal());
    });

    // 6. Billing — record charges (payment is OPD-only, so verify charge summary only)
    await this.step('Record charges', async () => {
      await billing.recordCharge({
        patientId: patientResult.id,
        encounterCoreId: erReg.encounterCoreId,
        code: proc.code,
        description: proc.name,
        amount: 5000,
      });
    });

    // Verify
    await this.step('Verify full journey data', async () => {
      const ep = await ipdNurse.getEpisode(episode.episodeId);
      this.assertExists(ep, 'IPD episode');
      const events = await orNurse.getEvents(orCase.caseId);
      this.assertExists(events.items, 'OR events');
    });
  }
}
