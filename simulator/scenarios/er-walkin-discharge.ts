/**
 * ER Walk-in Discharge — ER walk-in → triage → treat → discharge.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { ErNurse } from '../actors/erNurse';
import { ErDoctor } from '../actors/erDoctor';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { NotesGenerator } from '../data/notes';

export class ErWalkinDischarge extends BaseScenario {
  readonly name = 'er-walkin-discharge';
  readonly module = 'er';
  readonly description = 'ER walk-in → triage → treat → discharge';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const notesGen = new NotesGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const erNurse = new ErNurse({ baseUrl, credentials: credentials.nurse });
    const erDoctor = new ErDoctor({ baseUrl, credentials: credentials.doctor });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), erNurse.login(), erDoctor.login()]);
    });

    // Register patient
    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));
    state.trackPatient({ id: patientResult.id, mrn: patientResult.mrn, name: `${patient.firstName} ${patient.lastName}` });

    // ER registration
    const complaint = notesGen.randomErComplaint();
    const erReg = await this.step('ER registration', () =>
      receptionist.erRegisterKnown(patientResult.id, complaint),
    );
    state.trackEncounter({ id: erReg.encounterId, patientId: patientResult.id, type: 'ER' });

    // Triage
    await this.step('Triage assessment', async () => {
      const vitals = vitGen.generateErTriage();
      await erNurse.saveTriage(erReg.encounterId, {
        vitals,
        triageLevel: 3,
        chiefComplaint: complaint,
      });
      await erNurse.finishTriage(erReg.encounterId, {
        vitals,
        chiefComplaint: complaint,
      });
    });

    // Bed assignment
    await this.step('Assign ER bed', async () => {
      await erNurse.assignBed(erReg.encounterId);
    });

    await clock.shortDelay();

    // Doctor assessment
    await this.step('Doctor assessment', async () => {
      await erDoctor.writeNotes(erReg.encounterId, {
        assessment: notesGen.randomAssessment(),
        plan: notesGen.randomPlan(),
      });
    });

    await clock.doctorDelay();

    // Discharge
    await this.step('ER discharge', async () => {
      await erDoctor.setDisposition(erReg.encounterId, { type: 'DISCHARGE' });
    });

    // Verify
    await this.step('Verify ER encounter', async () => {
      const enc = await erNurse.getEncounter(erReg.encounterId);
      this.assertExists(enc, 'ER encounter');
    });
  }
}
