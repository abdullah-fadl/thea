/**
 * CVision Insurance Benefits — Admin creates policy, enrolls employee, submits and processes a claim.
 * Covers: list providers → create policy → find uninsured employee → enroll → submit claim → process → verify.
 *
 * The insurance GET route auto-seeds providers/plans on first access, so seeded data
 * is available after the first GET call. However, ensureSeedData also auto-enrolls
 * all active employees into the seed policy. This scenario therefore uses the
 * "uninsured" action to find an employee not yet covered, or falls back to creating
 * a fresh policy and handling the "already enrolled" case gracefully.
 */

import { BaseScenario } from './base';
import { CVisionAdmin } from '../actors/cvision/admin';
import { CVisionEmployee } from '../actors/cvision/employee';

export class CVisionInsuranceBenefits extends BaseScenario {
  readonly name = 'cvision-insurance-benefits';
  readonly module = 'cvision';
  readonly description =
    'Admin creates insurance policy, enrolls employee, submits claim, processes claim';

  protected async run(): Promise<void> {
    const { baseUrl, credentials } = this.ctx;

    const admin = new CVisionAdmin({ baseUrl, credentials: credentials.cvisionAdmin });
    const employee = new CVisionEmployee({ baseUrl, credentials: credentials.cvisionEmployee });

    // ── Step 1: Login both actors ──
    await this.step('Login admin and employee', async () => {
      await Promise.all([admin.login(), employee.login()]);
    });

    // ── Step 2: List existing insurance providers (triggers seed data if first call) ──
    // The first GET to /api/cvision/insurance calls ensureSeedData which auto-creates providers.
    // We call list-providers twice: the first call triggers seeding, the second ensures data is available.
    const providers = await this.step('List insurance providers', async () => {
      // First call triggers ensureSeedData
      const res = await admin.get<Record<string, unknown>>('/api/cvision/insurance', {
        action: 'list-providers',
      });
      const data = admin.assertOk(res, 'list insurance providers');
      // assertOk returns the full JSON body: { success: true, providers: [...] }
      const providerList = (data?.providers || []) as Record<string, unknown>[];
      if (Array.isArray(providerList) && providerList.length > 0) {
        return providerList;
      }
      // Retry after a short delay in case seeding was async
      const { clock } = this.ctx;
      await clock.shortDelay();
      const res2 = await admin.get<Record<string, unknown>>('/api/cvision/insurance', {
        action: 'list-providers',
      });
      const data2 = admin.assertOk(res2, 'list insurance providers (retry)');
      const retryList = (data2?.providers || []) as Record<string, unknown>[];
      this.assert(
        Array.isArray(retryList) && retryList.length > 0,
        'Should have at least one insurance provider (auto-seeded on first GET)',
      );
      return retryList;
    });

    const firstProvider = providers[0];
    // Prefer PG UUID 'id' over legacy 'providerId' (which may be a non-UUID like 'PROV-001')
    const providerId: string = (firstProvider as any).id || (firstProvider as any).providerId;
    this.assertExists(providerId, 'providerId');

    // Pick a plan from the provider
    const providerPlans = (firstProvider.plans || []) as Record<string, unknown>[];
    this.assert(providerPlans.length > 0, 'Provider should have at least one plan');
    const chosenPlan = providerPlans[0];
    const planId: string = (chosenPlan as any).planId;
    this.assertExists(planId, 'planId');

    // ── Step 3: Create a fresh insurance policy for this test ──
    const policyResult = await this.step('Create insurance policy', async () => {
      return admin.createInsurancePolicy({
        providerId,
        planId,
        policyNumber: `SIM-CORP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        startDate: new Date().toISOString().split('T')[0],
        endDate: `${new Date().getFullYear()}-12-31`,
        maxEnrolled: 50,
      });
    });

    // createInsurancePolicy returns { success: true, policyId: '...' } after assertOk
    const policyId: string = policyResult.policyId;
    this.assertExists(policyId, 'newly created policyId');

    // ── Step 4: Find an employee to enroll ──
    // First try to find an uninsured employee; if all are insured we'll use any active employee
    // and handle the "already enrolled" error by cancelling first.
    const employeeId = await this.step('Resolve employee for enrollment', async () => {
      // Try the uninsured endpoint first
      const uninsuredRes = await admin.get<Record<string, unknown>>('/api/cvision/insurance', {
        action: 'uninsured',
      });

      if (uninsuredRes.ok) {
        const uninsuredData = uninsuredRes.data as Record<string, unknown>;
        const uninsured = uninsuredData.uninsured || [];
        if (Array.isArray(uninsured) && uninsured.length > 0) {
          const id = uninsured[0].employeeId || uninsured[0].id;
          this.assertExists(id, 'uninsured employee id');
          return id;
        }
      }

      // All employees are already insured — fall back to listing employees
      // and cancel the first one's enrollment so we can re-enroll them
      const empList = await admin.listEmployees({ limit: '50' });
      // Employees GET returns { success: true, data: [...], total, ... }
      const items = empList?.data || empList?.items || empList?.employees || (Array.isArray(empList) ? empList : []);
      this.assert(Array.isArray(items) && items.length > 0, 'Should have employees');
      const activeEmp = items.find(
        (e: Record<string, unknown>) => e.status === 'ACTIVE' || e.status === 'active' || e.status === 'PROBATION',
      );
      const id = activeEmp?.id || activeEmp?.employeeId || items[0]?.id;
      this.assertExists(id, 'employee id from list');

      // Cancel existing enrollment so we can re-enroll with our new policy
      const cancelRes = await admin.post<Record<string, unknown>>('/api/cvision/insurance', {
        action: 'cancel-insurance',
        employeeId: id,
        reason: 'Simulator: re-enrolling under new policy for test',
      });
      // cancel-insurance creates a request; we need to process/approve it
      if (cancelRes.ok) {
        const cancelData = cancelRes.data as Record<string, unknown>;
        const requestId = cancelData.requestId;
        if (requestId) {
          await admin.post<Record<string, unknown>>('/api/cvision/insurance', {
            action: 'process-request',
            requestId,
            status: 'APPROVED',
            notes: 'Simulator: approved cancellation for re-enrollment',
          });
        }
      }

      return id;
    });

    // ── Step 5: Admin enrolls the employee under the new policy ──
    await this.step('Admin enrolls employee in insurance', async () => {
      const result = await admin.enrollInsuranceEmployee({
        employeeId,
        providerId,
        planId,
        policyId,
        effectiveDate: new Date().toISOString().split('T')[0],
      });
      // enrollInsuranceEmployee calls assertOk which throws on failure
      // Response is { success: true } — no additional data needed
      return result;
    });

    // ── Step 6: Admin submits an insurance claim on behalf of the employee ──
    const claimResult = await this.step('Admin submits insurance claim', async () => {
      return admin.submitInsuranceClaim({
        employeeId,
        type: 'MEDICAL',
        amount: 1500,
        provider: 'Al-Mowasat Hospital',
        diagnosis: 'Dental treatment - root canal',
        receiptNumber: `REC-${Date.now()}`,
      });
    });

    // submitInsuranceClaim returns { success: true, claimId: '...' } after assertOk
    const claimId: string = claimResult.claimId || claimResult.id;
    this.assertExists(claimId, 'claimId');

    // ── Step 7: Admin processes/approves the claim ──
    await this.step('Admin processes insurance claim', async () => {
      await admin.processInsuranceClaim({
        claimId,
        status: 'APPROVED',
        approvedAmount: 1200,
      });
    });

    // ── Step 8: Verify claim status ──
    await this.step('Verify claim status is APPROVED', async () => {
      const res = await admin.get<Record<string, unknown>>('/api/cvision/insurance', {
        action: 'employee-claims',
        employeeId,
      });
      const claimsData: any = admin.assertOk(res, 'get employee claims');
      // claimsData is { success: true, claims: [...] }
      const claims: any[] = claimsData.claims || claimsData.items || [];
      this.assert(Array.isArray(claims), 'claims should be an array');
      const found = claims.find(
        (c: Record<string, unknown>) => c.claimId === claimId || c.id === claimId,
      );
      this.assertExists(found, 'approved claim in employee claims');
      this.assertEqual(found.status, 'APPROVED', 'claim status after processing');
      // approvedAmount may be stored as a number or string
      this.assert(
        Number(found.approvedAmount) > 0,
        `approved amount should be > 0, got ${found.approvedAmount}`,
      );
    });
  }
}
