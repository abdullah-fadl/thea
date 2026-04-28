/**
 * ER Unknown Patient — Unknown patient → treat → identity match later.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { ErNurse } from '../actors/erNurse';
import { ErDoctor } from '../actors/erDoctor';
import { VitalsGenerator } from '../data/vitals';
import { NotesGenerator } from '../data/notes';
import { PatientGenerator } from '../data/patients';

export class ErUnknownPatient extends BaseScenario {
  readonly name = 'er-unknown-patient';
  readonly module = 'er';
  readonly description = 'Unknown patient → treat → identity match later';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const vitGen = new VitalsGenerator();
    const notesGen = new NotesGenerator();
    const patGen = new PatientGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const erNurse = new ErNurse({ baseUrl, credentials: credentials.nurse });
    const erDoctor = new ErDoctor({ baseUrl, credentials: credentials.doctor });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), erNurse.login(), erDoctor.login()]);
    });

    // Register unknown patient
    const erReg = await this.step('ER register unknown patient', () =>
      receptionist.erRegisterUnknown('Unconscious, brought by ambulance'),
    );
    state.trackEncounter({ id: erReg.encounterId, patientId: 'unknown', type: 'ER' });

    // Triage
    await this.step('Critical triage for unknown', async () => {
      const vitals = vitGen.generateErTriageCritical();
      await erNurse.saveTriage(erReg.encounterId, {
        vitals,
        triageLevel: 1,
        chiefComplaint: 'Unconscious, unknown identity',
      });
      await erNurse.finishTriage(erReg.encounterId, {
        vitals,
        chiefComplaint: 'Unconscious, unknown identity',
      });
    });

    await this.step('Assign ER bed', () => erNurse.assignBed(erReg.encounterId));
    await clock.shortDelay();

    // Doctor treats
    await this.step('Doctor assessment', async () => {
      await erDoctor.writeNotes(erReg.encounterId, {
        assessment: notesGen.randomAssessment(),
        plan: 'Stabilize and identify patient',
      });
    });

    // Register the real patient and link
    const patient = patGen.generate();
    await this.step('Register real patient + link', async () => {
      const patientResult = await receptionist.registerPatient(patient);
      state.trackPatient({ id: patientResult.id, mrn: patientResult.mrn, name: `${patient.firstName} ${patient.lastName}` });

      // Link unknown ER encounter to real patient
      const linkRes = await receptionist.post('/api/patients/link-er-unknown', {
        erEncounterId: erReg.encounterId,
        reason: 'Identity established after patient regained consciousness',
        identifiers: {
          nationalId: patient.nationalId,
        },
        firstName: patient.firstName,
        lastName: patient.lastName,
        gender: patient.gender,
        dob: patient.dob,
      });
      receptionist.assertOk(linkRes, 'Link unknown patient');
    });

    // Discharge
    await this.step('Discharge', async () => {
      await erDoctor.setDisposition(erReg.encounterId, { type: 'DISCHARGE' });
    });

    await this.step('Verify ER encounter', async () => {
      const enc = await erNurse.getEncounter(erReg.encounterId);
      this.assertExists(enc, 'ER encounter');
    });
  }
}
