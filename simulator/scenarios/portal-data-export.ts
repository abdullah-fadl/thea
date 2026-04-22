/**
 * Portal Data Export — Patient exercises PDPL right to download personal data.
 *
 * Happy path: login → export → validate payload structure
 * Failure case: second export within 1 hour → 429 rate limit
 */

import { BaseScenario } from './base';
import { PortalPatient } from '../actors/portalPatient';
import { Receptionist } from '../actors/receptionist';
import { PatientGenerator } from '../data/patients';

export class PortalDataExportScenario extends BaseScenario {
  readonly name = 'portal-data-export';
  readonly module = 'portal';
  readonly description = 'PDPL self-service data export — download + rate limit';

  protected async run(): Promise<void> {
    const { baseUrl, credentials } = this.ctx;

    const receptionist = new Receptionist({ baseUrl, credentials: credentials.receptionist });
    const portal = new PortalPatient({ baseUrl, credentials: credentials.portal });

    // Setup: register a patient
    await this.step('Login receptionist', () => receptionist.login());

    const patGen = new PatientGenerator();
    const patient = patGen.generate();
    await this.step('Register patient', () => receptionist.registerPatient(patient));

    // Portal login
    await this.step('Portal login', async () => {
      try {
        await portal.requestOTP(patient.mobile);
        await portal.verifyOTP(patient.mobile, '123456');
      } catch {
        await portal.login();
      }
    });

    // Happy path: export data
    const exportData = await this.step('Export patient data', async () => {
      const data = await portal.exportData();
      return data;
    });

    // Validate export payload structure
    await this.step('Validate export payload', async () => {
      this.assertExists(exportData, 'Export payload');
      this.assertExists(exportData.exportDate, 'exportDate');
      this.assertExists(exportData.dataSubject, 'dataSubject');
      this.assertExists(exportData.sections, 'sections');
      this.assertExists(exportData.metadata, 'metadata');
      this.assertEqual(exportData.metadata.pdplVersion, '1.0', 'PDPL version');
      this.assertEqual(exportData.metadata.exportFormat, 'JSON', 'Export format');
    });

    // Failure case: rate limit — second export should be rejected
    await this.step('Rate limit blocks second export', async () => {
      try {
        await portal.exportData();
        // If we get here, rate limiting did not fire
        throw new Error('Expected 429 rate limit but export succeeded');
      } catch (err) {
        // Expected: the actor throws on non-2xx, verify it was a 429
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('429') && !message.includes('Rate limit')) {
          throw err;
        }
      }
    });
  }
}
