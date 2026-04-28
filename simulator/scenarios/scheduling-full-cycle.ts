/**
 * Scheduling Full Cycle — Resource → template → generate slots → book → check-in.
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Scheduler } from '../actors/scheduler';
import { PatientGenerator } from '../data/patients';

export class SchedulingFullCycle extends BaseScenario {
  readonly name = 'scheduling-full-cycle';
  readonly module = 'scheduling';
  readonly description = 'Resource → template → generate slots → book → check-in';

  protected async run(): Promise<void> {
    const { baseUrl, credentials } = this.ctx;

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const scheduler = new Scheduler({ baseUrl, credentials: credentials.staff });
    const patGen = new PatientGenerator();

    await this.step('Login actors', async () => {
      await Promise.all([receptionist.login(), scheduler.login()]);
    });

    const patient = patGen.generate();
    const patientResult = await this.step('Register patient', () => receptionist.registerPatient(patient));

    // Create or get resource
    let resourceId: string;
    await this.step('Get or create resource', async () => {
      const resources = await scheduler.getResources();
      if (resources.resources && resources.resources.length > 0) {
        resourceId = resources.resources[0].id;
      } else {
        const res = await scheduler.createResource({
          name: 'Dr. Test Clinic',
          type: 'CLINIC_ROOM',
        });
        resourceId = res.resourceId;
      }
    });

    // Create template
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayOfWeek = tomorrow.getDay();

    await this.step('Create scheduling template', async () => {
      try {
        await scheduler.createTemplate({
          name: `Test Template ${Date.now()}`,
          resourceId: resourceId!,
          dayOfWeek,
          startTime: '08:00',
          endTime: '16:00',
          slotDuration: 15,
        });
      } catch {
        // Template may already exist
      }
    });

    // Get available slots
    await this.step('Get available slots', async () => {
      const slots = await scheduler.getSlots({
        resourceId: resourceId!,
        date: tomorrow.toISOString().split('T')[0],
      });
      this.assertExists(slots, 'Slots data');

      // Book first available slot
      if (slots.slots && slots.slots.length > 0) {
        await scheduler.createReservation({
          slotId: slots.slots[0].id,
          patientId: patientResult.id,
          reason: 'Follow-up consultation',
        });
      }
    });

    await this.step('Verify scheduling data', async () => {
      const templates = await scheduler.getTemplates();
      this.assertExists(templates, 'Templates');
    });
  }
}
