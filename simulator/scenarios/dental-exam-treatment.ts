/**
 * Dental Exam Treatment — Chart exam → treatment plan → procedure.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Dentist } from '../actors/dentist';
import { PatientGenerator } from '../data/patients';
import { DentalGenerator } from '../data/dental';

export class DentalExamTreatment extends BaseScenario {
  readonly name = 'dental-exam-treatment';
  readonly module = 'dental';
  readonly description = 'Chart exam → treatment plan → procedure';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const dentalGen = new DentalGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const dentist = new Dentist({ baseUrl, credentials: credentials.doctor });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), dentist.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    // Chart exam — record conditions
    const conditions = dentalGen.randomConditions(4);
    await this.step('Dental chart exam', async () => {
      await dentist.updateChart(patientResult.id, conditions);
    });

    // Verify chart
    await this.step('Verify dental chart', async () => {
      const chart = await dentist.getChart(patientResult.id);
      this.assertExists(chart, 'Dental chart');
    });

    // Treatment plan
    const proc = dentalGen.randomProcedure();
    const tooth = dentalGen.randomTooth();
    await this.step('Create treatment plan', async () => {
      await dentist.updateTreatment(patientResult.id, [
        {
          tooth,
          procedure: proc.name,
          code: proc.code,
          fee: proc.fee,
          status: 'PLANNED',
        },
      ]);
    });

    // Verify treatment
    await this.step('Verify treatment plan', async () => {
      const treatment = await dentist.getTreatment(patientResult.id);
      this.assertExists(treatment, 'Dental treatment');
    });
  }
}
