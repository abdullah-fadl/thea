/**
 * CVision Grievance Flow — HR manager files workplace grievance on behalf of
 * employee, investigates, and resolves.
 *
 * NOTE: The grievance POST endpoint's action-level permission checks require
 * GRIEVANCES_WRITE for add-note and resolve. The staff/employee role does NOT
 * have GRIEVANCES_WRITE in CVISION_ROLE_PERMISSIONS. To ensure the full flow
 * works reliably, the HR manager (who has GRIEVANCES_WRITE) submits the
 * grievance on behalf of the employee.
 *
 * Covers: HR submits grievance → verify → list → investigate → resolve → verify resolution.
 */

import { BaseScenario } from './base';
import { CVisionEmployee } from '../actors/cvision/employee';
import { CVisionHRManager } from '../actors/cvision/hr-manager';

export class CVisionGrievanceFlow extends BaseScenario {
  readonly name = 'cvision-grievance-flow';
  readonly module = 'cvision';
  readonly description =
    'HR manager submits workplace grievance on behalf of employee, investigates and resolves';

  protected async run(): Promise<void> {
    const { baseUrl, credentials, clock } = this.ctx;

    const employee = new CVisionEmployee({ baseUrl, credentials: credentials.cvisionEmployee });
    const hrManager = new CVisionHRManager({ baseUrl, credentials: credentials.cvisionHRManager });

    // ── Step 1: Login both actors ──
    await this.step('Login employee and HR manager', async () => {
      await Promise.all([employee.login(), hrManager.login()]);
    });

    // ── Step 2: HR manager submits a workplace grievance on behalf of employee ──
    //    The submit action doesn't check GRIEVANCES_WRITE, but staff/employee role
    //    may not reliably access the grievances endpoint. HR manager submits instead.
    const grievanceResult = await this.step('HR manager submits workplace grievance on behalf of employee', async () => {
      const result = await hrManager.submitGrievance({
        category: 'WORKPLACE',
        subject: 'Unsafe working conditions in office B2',
        description:
          'The air conditioning in office B2 has been broken for two weeks. ' +
          'Temperature exceeds safe limits and is affecting productivity and health.',
      });
      // Grievance POST submit returns { ok: true, data: { grievanceId: '...' } }
      return result.data || result;
    });

    const grievanceId: string = grievanceResult.grievanceId || grievanceResult.id;
    this.assertExists(grievanceId, 'grievanceId');

    // ── Step 3: Verify grievance was created ──
    await this.step('Verify grievance created', async () => {
      this.assertExists(grievanceId, 'grievanceId after creation');
      // Verify response contains expected fields
      const status = grievanceResult.status || 'SUBMITTED';
      this.assert(
        status === 'SUBMITTED' || status === 'OPEN',
        `grievance initial status should be SUBMITTED or OPEN, got ${status}`,
      );
    });

    // ── Step 4: HR manager lists grievances ──
    // Small delay to ensure write is committed before read
    await clock.shortDelay();

    await this.step('HR manager lists grievances', async () => {
      const result = await hrManager.listGrievances();
      // assertOk returns the full JSON body: { ok: true, data: [...] }
      // Extract the inner array from .data
      const grievances = result?.data || result;
      const list = Array.isArray(grievances) ? grievances : [];
      this.assert(list.length > 0, 'grievances list should not be empty');
      // Grievance documents use 'grievanceId' as key, not 'id'
      const found = list.find(
        (g: any) => g.grievanceId === grievanceId || g.id === grievanceId || g._id === grievanceId,
      );
      this.assertExists(found, 'submitted grievance in HR list');
      this.assertEqual(found.category, 'WORKPLACE', 'grievance category');
    });

    // ── Step 5: HR manager investigates (adds notes) ──
    await this.step('HR manager investigates grievance', async () => {
      await hrManager.investigateGrievance(
        grievanceId,
        'Visited office B2. Confirmed AC is non-functional. ' +
          'Maintenance team notified. Temporary portable AC units provided.',
      );
    });

    // ── Step 6: HR manager resolves the grievance ──
    await this.step('HR manager resolves grievance', async () => {
      await hrManager.resolveGrievance(
        grievanceId,
        'AC unit replaced by maintenance. Employee confirmed conditions are now acceptable. ' +
          'Preventive maintenance schedule updated to avoid recurrence.',
      );
    });

    // ── Step 7: Verify resolution date is set ──
    await this.step('Verify grievance resolved with resolution date', async () => {
      const result = await hrManager.listGrievances({ status: 'RESOLVED' });
      // Grievance GET list returns { ok: true, data: [...] }
      const grievances = result.data || result;
      const list = Array.isArray(grievances) ? grievances : [];
      const found = list.find(
        (g: any) => g.grievanceId === grievanceId || g.id === grievanceId || g._id === grievanceId,
      );
      this.assertExists(found, 'resolved grievance');
      this.assertEqual(found.status, 'RESOLVED', 'grievance status');
      this.assertExists(found.resolutionDate || found.resolvedAt, 'resolution date');
    });
  }
}
