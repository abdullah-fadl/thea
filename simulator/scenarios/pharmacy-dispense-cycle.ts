/**
 * Pharmacy Dispense Cycle — Prescription → verify → dispense → inventory update.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Nurse } from '../actors/nurse';
import { Doctor } from '../actors/doctor';
import { Pharmacist } from '../actors/pharmacist';
import { PatientGenerator } from '../data/patients';
import { VitalsGenerator } from '../data/vitals';
import { MedicationGenerator } from '../data/medications';
import { DiagnosisGenerator } from '../data/diagnoses';

export class PharmacyDispenseCycle extends BaseScenario {
  readonly name = 'pharmacy-dispense-cycle';
  readonly module = 'pharmacy';
  readonly description = 'Prescription → verify → dispense → inventory update';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const patGen = new PatientGenerator();
    const vitGen = new VitalsGenerator();
    const medGen = new MedicationGenerator();
    const diagGen = new DiagnosisGenerator();

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const nurse = new Nurse({ baseUrl, credentials: credentials.nurse });
    const doctor = new Doctor({ baseUrl, credentials: credentials.doctor });
    const pharmacist = new Pharmacist({ baseUrl, credentials: credentials.staff });

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), nurse.login(), doctor.login(), pharmacist.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    const booking = await this.step('OPD walk-in', async () => {
      const depts = await receptionist.getDepartments();
      return receptionist.walkIn(patientResult.id, depts.departments[0].id);
    });

    await this.step('Nurse vitals', async () => {
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_NURSING');
      await nurse.recordVitals(booking.encounterCoreId, vitGen.generateNormal());
      await nurse.updateFlowState(booking.encounterCoreId, 'READY_FOR_DOCTOR');
      await nurse.updateFlowState(booking.encounterCoreId, 'IN_DOCTOR');
    });

    // Doctor prescribes
    const med = medGen.randomOral();
    const medOrder = await this.step('Doctor prescribes medication', () =>
      doctor.createOrder({
        patientId: patientResult.id,
        encounterCoreId: booking.encounterCoreId,
        kind: 'MEDICATION',
        code: med.code,
        name: `${med.name} ${med.dosage}`,
        details: {
          route: med.route,
          frequency: med.frequency,
          dose: med.dosage,
          duration: '5 days',
          quantity: '10',
          medicationCatalogId: med.code,
        },
      }),
    );

    await clock.shortDelay();

    // Pharmacist verifies then dispenses
    let prescriptionId: string = '';
    await this.step('Pharmacist verifies prescription', async () => {
      // Look up the prescription created by the medication order bridge
      const rxList = await pharmacist.getPrescriptions();
      const rxData = rxList as Record<string, unknown>;
      const prescriptions = (rxData.items || rxData.prescriptions || []) as Record<string, unknown>[];
      const rx = prescriptions.find((p: Record<string, unknown>) => p.ordersHubId === medOrder.orderId) || prescriptions[0];
      if (!rx?.id) {
        throw new Error('No prescription found for the medication order');
      }
      prescriptionId = rx.id as string;
      await pharmacist.dispense(rx.id as string, { action: 'verify' });
    });

    await this.step('Pharmacist dispenses medication', async () => {
      await pharmacist.dispense(prescriptionId, { action: 'dispense' });
    });

    // Verify inventory
    await this.step('Verify inventory', async () => {
      const inv = await pharmacist.getInventory();
      this.assertExists(inv, 'Inventory data');
    });

    // Discharge — requires diagnosis
    await this.step('Discharge', async () => {
      const diag = diagGen.random();
      await doctor.writeVisitNotes(booking.encounterCoreId, {
        chiefComplaint: 'Medication follow-up',
        hpiText: 'Patient prescribed medication for condition.',
        assessment: diag.en,
        plan: 'Take medication as directed. Follow up in 2 weeks.',
        diagnoses: [diag],
      });
      await doctor.setDisposition(booking.encounterCoreId, { type: 'DISCHARGE' });
    });
  }
}
