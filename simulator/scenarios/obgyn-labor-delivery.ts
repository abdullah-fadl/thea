/**
 * OB/GYN Labor & Delivery — Admit → partogram → delivery → newborn → postpartum.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { ObgynDoctor } from '../actors/obgynDoctor';
import { PatientGenerator } from '../data/patients';
import { ObstetricGenerator } from '../data/obstetric';

export class ObgynLaborDelivery extends BaseScenario {
  readonly name = 'obgyn-labor-delivery';
  readonly module = 'obgyn';
  readonly description = 'Admit → partogram → delivery → newborn → postpartum';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const obsGen = new ObstetricGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const obgynDoctor = new ObgynDoctor({ baseUrl, credentials: credentials.doctor });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), obgynDoctor.login()]);
    });

    // Register pregnant patient
    const patient = patGen.generatePregnant();
    const patientResult = await this.step('Register pregnant patient', () =>
      receptionist.registerPatient(patient),
    );
    state.trackPatient({ id: patientResult.id, mrn: patientResult.mrn, name: `${patient.firstName} ${patient.lastName}` });

    // Admit to labor
    const obsData = obsGen.generate();
    const laborResult = await this.step('Admit to labor', async () => {
      return obgynDoctor.admitToLabor(patientResult.id, obsData);
    });

    // Partogram observations
    await this.step('Partogram — early labor', async () => {
      await obgynDoctor.updatePartogram(patientResult.id, {
        cervixDilation: 4,
        contractionFreq: 3,
        fetalHeartRate: 140,
        descentLevel: -2,
      });
    });

    await clock.patientWait();

    await this.step('Partogram — active labor', async () => {
      await obgynDoctor.updatePartogram(patientResult.id, {
        cervixDilation: 7,
        contractionFreq: 4,
        fetalHeartRate: 145,
        descentLevel: 0,
      });
    });

    await clock.patientWait();

    await this.step('Partogram — transition', async () => {
      await obgynDoctor.updatePartogram(patientResult.id, {
        cervixDilation: 10,
        contractionFreq: 5,
        fetalHeartRate: 150,
        descentLevel: 2,
      });
    });

    // Delivery
    await this.step('Record delivery', async () => {
      const lr = laborResult as Record<string, unknown>;
      const episodeId: string = (lr?.episode as any)?.id || lr?.id;
      await obgynDoctor.recordDelivery(patientResult.id, {
        mode: 'SVD',
        time: new Date().toISOString(),
        outcome: 'LIVE_BIRTH',
        episodeId,
      });
    });

    // Verify
    await this.step('Verify labor record', async () => {
      const status = await obgynDoctor.getLaborStatus(patientResult.id);
      this.assertExists(status, 'Labor status');
    });
  }
}
