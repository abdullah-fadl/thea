/**
 * IPD Bed Transfer — Transfer between wards/units.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { ErNurse } from '../actors/erNurse';
import { ErDoctor } from '../actors/erDoctor';
import { IpdNurse } from '../actors/ipdNurse';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';

export class IpdBedTransfer extends BaseScenario {
  readonly name = 'ipd-bed-transfer';
  readonly module = 'ipd';
  readonly description = 'Transfer between wards/units';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const erNurse = new ErNurse({ baseUrl, credentials: credentials.nurse });
    const erDoctor = new ErDoctor({ baseUrl, credentials: credentials.doctor });
    const ipdNurse = new IpdNurse({ baseUrl, credentials: credentials.nurse });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), erNurse.login(), erDoctor.login(), ipdNurse.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    const erReg = await this.step('ER → admit', async () => {
      const reg = await receptionist.erRegisterKnown(patientResult.id, 'Post-surgical observation');
      const triageVitals = vitGen.generateErTriage();
      await erNurse.saveTriage(reg.encounterId, {
        vitals: triageVitals,
        triageLevel: 2,
        chiefComplaint: 'Post-surgical',
      });
      await erNurse.finishTriage(reg.encounterId, {
        vitals: triageVitals,
        chiefComplaint: 'Post-surgical',
      });
      await erDoctor.setDisposition(reg.encounterId, { type: 'ADMIT', destination: 'WARD' });
      return reg;
    });

    const doctorUserId = await erDoctor.getUserId();
    const episode = await this.step('IPD admission', () =>
      ipdNurse.createFromEncounter(erReg.encounterId, {
        serviceUnit: 'WARD',
        admittingDoctorUserId: doctorUserId,
      }),
    );

    // Get available beds for transfer
    await this.step('Transfer bed', async () => {
      const beds = await ipdNurse.getAvailableBeds();
      if (beds.beds && beds.beds.length >= 2) {
        // First assign bed
        await ipdNurse.assignBed(episode.episodeId, beds.beds[0].id);
        await clock.shortDelay();
        // Then transfer to another
        await ipdNurse.transferBed(episode.episodeId, beds.beds[1].id, 'Need private room for isolation');
      }
    });

    await this.step('Verify episode after transfer', async () => {
      const ep = await ipdNurse.getEpisode(episode.episodeId);
      this.assertExists(ep, 'IPD episode after transfer');
    });
  }
}
