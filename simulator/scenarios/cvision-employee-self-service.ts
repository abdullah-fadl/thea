/**
 * CVision Employee Self-Service — Employee accesses all self-service endpoints.
 * Covers: dashboard → profile → leave balance → submit leave → list leaves
 *       → payslips → attendance → documents → submit request → list requests
 *       → request letter → request training → OKRs
 *
 * All assertions are flexible: we verify API calls succeed (ok: true) without
 * failing on empty data (new employees may have no payslips, attendance, etc.).
 *
 * NOTE on response shapes:
 *   BaseActor.assertOk() returns ApiResult.data which is the FULL parsed JSON body.
 *   So actor methods return e.g. { ok: true, data: { employee, leaveBalance, ... } }.
 *   We access the inner payload via `.data` on the returned object.
 */

import { BaseScenario } from './base';
import { CVisionEmployee } from '../actors/cvision/employee';

export class CVisionEmployeeSelfService extends BaseScenario {
  readonly name = 'cvision-employee-self-service';
  readonly module = 'cvision';
  readonly description =
    'Employee exercises all self-service operations: dashboard, profile, leave, payslips, attendance, documents, requests, letters, training, OKRs';

  protected async run(): Promise<void> {
    const { baseUrl, credentials } = this.ctx;

    const employee = new CVisionEmployee({ baseUrl, credentials: credentials.cvisionEmployee });

    // ── Step 1: Login ──
    await this.step('Login employee', async () => {
      await employee.login();
    });

    // ── Step 2: Dashboard summary ──
    // GET /api/cvision/self-service (default action='dashboard')
    // Actor returns full body: { ok, data: { employee, leaveBalance, lastRequest, unreadNotifications } }
    await this.step('Get self-service dashboard', async () => {
      const body = await employee.getMyDashboard();
      this.assertExists(body, 'dashboard response');
      // The inner payload is at body.data
      const payload = body.data;
      this.assertExists(payload, 'dashboard data payload');
      this.assert(
        'employee' in payload && 'leaveBalance' in payload,
        'dashboard should contain employee and leaveBalance keys',
      );
    });

    // ── Step 3: Get own profile ──
    // GET /api/cvision/self-service?action=my-profile
    // Actor returns full body: { ok, data: <employee document or null> }
    await this.step('Get my profile', async () => {
      const body = await employee.getMyProfile();
      this.assertExists(body, 'profile response');
      // body.data may be null for unseeded employee — that is acceptable
      // assertOk already verified ok: true, so the endpoint itself works
      this.assert(body.ok === true, 'my-profile endpoint returned ok: true');
    });

    // ── Step 4: Get leave balance ──
    // getMyLeaveBalance() calls action=my-leaves and returns .balance (with fallback defaults)
    await this.step('Get leave balance', async () => {
      const balance = await employee.getMyLeaveBalance();
      this.assertExists(balance, 'leave balance');
      // Balance always has a value (real or default fallback)
      this.assert(
        typeof balance === 'object',
        'leave balance should be an object',
      );
    });

    // ── Step 5: Submit a leave request ──
    // POST /api/cvision/self-service { action: 'request-leave', ... }
    // Actor returns full body: { ok, data: { leaveId } }
    const leaveResult = await this.step('Submit leave request', async () => {
      const today = new Date();
      const startDate = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      const endDate = new Date(today.getTime() + 8 * 86400000).toISOString().slice(0, 10);
      const body = await employee.submitLeaveRequest({
        type: 'ANNUAL',
        startDate,
        endDate,
        days: 2,
        reason: 'Simulator test leave',
      });
      this.assertExists(body, 'leave request response');
      const payload = body.data || body;
      this.assertExists(payload.leaveId, 'leaveId in leave request response');
      return payload;
    });

    // ── Step 6: List my leaves ──
    // GET /api/cvision/self-service?action=my-leaves
    // Actor returns full body: { ok, data: { leaves: [...], balance: {...} } }
    await this.step('Get my leaves', async () => {
      const body = await employee.getMyLeaves();
      this.assertExists(body, 'my leaves response');
      const payload = body.data || body;
      this.assert(
        payload.leaves !== undefined && payload.balance !== undefined,
        'my-leaves response should have leaves and balance keys',
      );
      this.assert(Array.isArray(payload.leaves), 'leaves should be an array');
    });

    // ── Step 7: Get payslips ──
    // GET /api/cvision/self-service?action=my-payslips
    // Actor returns full body: { ok, data: <array> }
    await this.step('Get my payslips', async () => {
      const body = await employee.getMyPayslips();
      this.assertExists(body, 'payslips response');
      // body.data is an array (may be empty for new employees)
      const payslips = body.data !== undefined ? body.data : body;
      this.assert(
        payslips !== null && payslips !== undefined,
        'payslips data should be present (may be empty array)',
      );
    });

    // ── Step 8: Get attendance ──
    // GET /api/cvision/self-service?action=my-attendance
    // Actor returns full body: { ok, data: <array> }
    await this.step('Get my attendance', async () => {
      const body = await employee.getMyAttendance();
      this.assertExists(body, 'attendance response');
      const attendance = body.data !== undefined ? body.data : body;
      this.assert(
        attendance !== null && attendance !== undefined,
        'attendance data should be present',
      );
    });

    // ── Step 9: Get documents ──
    // GET /api/cvision/self-service?action=my-documents
    // Actor returns full body: { ok, data: <array> }
    await this.step('Get my documents', async () => {
      const body = await employee.getMyDocuments();
      this.assertExists(body, 'documents response');
      const docs = body.data !== undefined ? body.data : body;
      this.assert(
        docs !== null && docs !== undefined,
        'documents data should be present',
      );
    });

    // ── Step 10: Submit a general request ──
    // POST /api/cvision/self-service { action: 'request-general', subject, description }
    // Actor returns full body: { ok, data: { requestId } }
    await this.step('Submit general request', async () => {
      const body = await employee.submitRequest({
        subject: 'Simulator test request',
        description: 'Automated test from simulator scenario',
      });
      this.assertExists(body, 'general request response');
      const payload = body.data || body;
      this.assertExists(payload.requestId, 'requestId in general request response');
    });

    // ── Step 11: List my requests ──
    // GET /api/cvision/self-service?action=my-requests
    // Actor returns full body: { ok, data: <array> }
    await this.step('Get my requests', async () => {
      const body = await employee.getMyRequests();
      this.assertExists(body, 'requests response');
      const requests = body.data !== undefined ? body.data : body;
      this.assert(
        requests !== null && requests !== undefined,
        'requests data should be present',
      );
    });

    // ── Step 12: Request a letter ──
    // POST /api/cvision/self-service { action: 'request-letter', templateKey }
    // Actor returns full body: { ok, data: { letterId } }
    await this.step('Request salary certificate letter', async () => {
      const body = await employee.requestLetter('salary_certificate');
      this.assertExists(body, 'letter request response');
      const payload = body.data || body;
      this.assertExists(payload.letterId, 'letterId in letter response');
    });

    // ── Step 13: Request training enrollment ──
    // POST /api/cvision/self-service { action: 'request-training', courseId }
    // Actor returns full body: { ok: true } (no data field)
    await this.step('Request training enrollment', async () => {
      const body = await employee.requestTraining('SIM-COURSE-001');
      // The API returns { ok: true } with no data field — that is fine.
      // assertOk already verified ok: true via the actor.
      this.assertExists(body, 'training enrollment response');
      this.assert(body.ok === true, 'training enrollment succeeded');
    });

    // ── Step 14: Get OKRs ──
    // GET /api/cvision/okrs?action=my-okrs
    // Returns: { ok, okrs: [...] } — note: 'okrs' at root, not nested in 'data'
    await this.step('Get my OKRs', async () => {
      const body = await employee.getMyOKRs();
      this.assertExists(body, 'OKRs response');
      // body is { ok, okrs: [...] } — okrs may be empty array for new employees
      this.assert(body.ok === true, 'OKRs endpoint returned ok');
      const okrs = body.okrs;
      this.assert(
        okrs !== null && okrs !== undefined,
        'OKRs field should be present',
      );
    });

    // ── Final: Summary ──
    await this.step('All self-service operations completed', async () => {
      this.assert(true, 'employee self-service scenario passed all steps');
    });
  }
}
