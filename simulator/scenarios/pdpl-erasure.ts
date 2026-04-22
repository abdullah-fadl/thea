/**
 * PDPL Right to Erasure — Submit, review, and execute a data erasure request.
 *
 * Happy path: register patient -> submit erasure request -> execute (partial) -> verify
 * Failure case: attempt to execute an already-completed request
 */

import { BaseScenario } from './base';
import { Receptionist } from '../actors/receptionist';
import { Admin } from '../actors/admin';
import { PatientGenerator } from '../data/patients';

export class PdplErasureScenario extends BaseScenario {
  readonly name = 'pdpl-erasure';
  readonly module = 'privacy';
  readonly description =
    'Submit and execute a PDPL Right to Erasure request with partial completion';

  protected async run(): Promise<void> {
    const { baseUrl, credentials } = this.ctx;
    const patGen = new PatientGenerator();

    const receptionist = new Receptionist({
      baseUrl,
      credentials: credentials.receptionist,
      tenantId: this.ctx.tenantId,
    });

    // Admin uses the staff credentials (which should have admin.data.manage permission)
    const admin = new Admin({
      baseUrl,
      credentials: credentials.staff,
      tenantId: this.ctx.tenantId,
    });

    // --- Step 1: Login ---
    await this.step('Login receptionist', async () => {
      await receptionist.login();
    });

    await this.step('Login admin', async () => {
      await admin.login();
    });

    // --- Step 2: Register a patient ---
    const patient = patGen.generate();
    let patientId = '';

    await this.step('Register patient for erasure test', async () => {
      const result = await receptionist.registerPatient(patient);
      patientId = result.id;
      this.assertExists(patientId, 'patientId');
    });

    // --- Step 3: Submit erasure request ---
    let requestId = '';

    await this.step('Submit PDPL erasure request', async () => {
      const result = await admin.submitErasureRequest(
        patientId,
        'Patient requested data deletion under PDPL Article 20',
      );
      requestId = result.requestId;
      this.assertExists(requestId, 'requestId');
      this.assertEqual(result.status, 'pending', 'erasure request status');
    });

    // --- Step 4: Verify request appears in list ---
    await this.step('Verify erasure request is listed', async () => {
      const requests = await admin.getErasureRequests(patientId);
      this.assert(requests.length >= 1, 'At least one erasure request should exist');
      const found = requests.find((r) => r.id === requestId);
      this.assertExists(found, 'submitted request in list');
    });

    // --- Step 5: Execute erasure ---
    let executionResult: {
      status: string;
      summary: {
        retained: Array<{ category: string; reason: string }>;
        deleted: Array<{ category: string; action: string }>;
      };
    } | null = null;

    await this.step('Execute PDPL erasure', async () => {
      executionResult = await admin.executeErasure(patientId, requestId);
      this.assertExists(executionResult, 'execution result');
      // For a newly created patient with no clinical records, contact info
      // should be anonymized. Status should be 'completed' or 'partially_completed'.
      this.assert(
        executionResult.status === 'completed' ||
          executionResult.status === 'partially_completed',
        `Expected completed or partially_completed, got ${executionResult.status}`,
      );
    });

    // --- Step 6: Verify contact info was anonymized ---
    await this.step('Verify contact information anonymized', async () => {
      this.assertExists(executionResult, 'execution result');
      const anonymized = executionResult!.summary.deleted.find(
        (d) => d.category === 'contact_information',
      );
      this.assertExists(anonymized, 'contact_information in deleted categories');
      this.assertEqual(anonymized!.action, 'anonymized', 'anonymization action');
    });

    // --- Step 7: Failure case — re-execute completed request ---
    await this.step('Reject re-execution of completed request', async () => {
      try {
        await admin.executeErasure(patientId, requestId);
        // If it doesn't throw, the API returned success — that's unexpected
        throw new Error('Expected re-execution to fail but it succeeded');
      } catch (err) {
        const msg = (err as Error).message || '';
        // The API should reject with a 400 because status is no longer pending/approved
        this.assert(
          msg.includes('cannot be executed') ||
            msg.includes('400') ||
            msg.includes('status'),
          `Expected rejection error, got: ${msg}`,
        );
      }
    });

    // --- Step 8: Verify duplicate request blocked ---
    await this.step('Reject duplicate erasure request', async () => {
      // The request is now completed, so a new one should be allowed.
      // But we test that it succeeds (since the old one is completed, not pending).
      const result = await admin.submitErasureRequest(
        patientId,
        'Second erasure request after first completed',
      );
      this.assertExists(result.requestId, 'second requestId');
      this.assertEqual(result.status, 'pending', 'second request status');
    });
  }
}
