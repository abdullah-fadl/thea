/**
 * ICU Admission — ER → admit → ICU → SOFA → ventilator → transfer out.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { ErNurse } from '../actors/erNurse';
import { ErDoctor } from '../actors/erDoctor';
import { IpdNurse } from '../actors/ipdNurse';
import { IcuDoctor } from '../actors/icuDoctor';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';

export class IcuAdmission extends BaseScenario {
  readonly name = 'icu-admission';
  readonly module = 'icu';
  readonly description = 'ER → ICU admit → SOFA → ventilator → transfer out';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const erNurse = new ErNurse({ baseUrl, credentials: credentials.nurse });
    const erDoctor = new ErDoctor({ baseUrl, credentials: credentials.doctor });
    const ipdNurse = new IpdNurse({ baseUrl, credentials: credentials.nurse });
    const icuDoctor = new IcuDoctor({ baseUrl, credentials: credentials.doctor });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), erNurse.login(), erDoctor.login(), ipdNurse.login(), icuDoctor.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    // ER with critical vitals
    const erReg = await this.step('ER registration — critical', () =>
      receptionist.erRegisterKnown(patientResult.id, 'Respiratory failure, SPO2 85%'),
    );

    await this.step('Critical triage', async () => {
      const vitals = vitGen.generateErTriageCritical();
      await erNurse.saveTriage(erReg.encounterId, {
        vitals,
        triageLevel: 1,
        chiefComplaint: 'Respiratory failure',
      });
      await erNurse.finishTriage(erReg.encounterId, {
        vitals,
        chiefComplaint: 'Respiratory failure',
      });
    });

    await this.step('Admit to ICU disposition', async () => {
      await erDoctor.setDisposition(erReg.encounterId, {
        type: 'ADMIT',
        destination: 'ICU',
        admitUnit: 'MICU',
      });
    });

    // Create IPD episode first, then ICU admit
    const doctorUserId = await erDoctor.getUserId();
    const episode = await this.step('Create IPD episode', () =>
      ipdNurse.createFromEncounter(erReg.encounterId, {
        serviceUnit: 'MICU',
        admittingDoctorUserId: doctorUserId,
      }),
    );

    await this.step('ICU admit', async () => {
      await icuDoctor.admit(episode.episodeId, {
        reason: 'Acute respiratory failure requiring mechanical ventilation',
        sourceUnit: 'ER',
      });
    });

    // SOFA score
    await this.step('Record initial SOFA score', async () => {
      await icuDoctor.recordSOFA(episode.episodeId, {
        respiratory: 3,
        cardiovascular: 4,
        cns: 2,
        renal: 1,
        liver: 0,
        coagulation: 0,
      });
    });

    // Ventilator check
    await this.step('Ventilator check', async () => {
      await icuDoctor.ventilatorCheck(episode.episodeId, {
        mode: 'SIMV',
        fiO2: 60,
        peep: 8,
        tidalVolume: 450,
        respiratoryRate: 16,
      });
    });

    await clock.patientWait();

    // Follow-up SOFA (improving)
    await this.step('Follow-up SOFA — improving', async () => {
      await icuDoctor.recordSOFA(episode.episodeId, {
        respiratory: 2,
        cardiovascular: 2,
        cns: 1,
        renal: 0,
        liver: 0,
        coagulation: 0,
      });
    });

    // Handover is required before ICU transfer
    await this.step('Create and finalize handover', async () => {
      const handover = await icuDoctor.createHandover({
        episodeId: episode.episodeId,
        toRole: 'nurse',
        summary: 'Patient improving, ready for ward transfer. Weaned off ventilator, vitals stable.',
      });
      await icuDoctor.finalizeHandover(handover.handoverId);
    });

    // Transfer out
    await this.step('Transfer out of ICU', async () => {
      await icuDoctor.transfer(episode.episodeId, 'WARD');
    });

    // Verify
    await this.step('Verify ICU events', async () => {
      const events = await icuDoctor.getEvents(episode.episodeId);
      this.assertExists(events.items, 'ICU events');
    });
  }
}
