/**
 * CVision Training Enrollment — Create course, enroll employee, complete training.
 * Tests the full training lifecycle: create -> enroll -> verify -> complete -> verify.
 *
 * Response format notes:
 * - Training API returns { ok: true, data: {...} }
 * - After BaseActor.assertOk(), the result is the full JSON body:
 *   { ok: true, data: { courseId, title, ... } }
 * - So nested data lives at `.data` of the assertOk result.
 */

import { BaseScenario } from './base';
import { CVisionAdmin } from '../actors/cvision/admin';
import { CVisionEmployee } from '../actors/cvision/employee';

export class CVisionTrainingEnrollment extends BaseScenario {
  readonly name = 'cvision-training-enrollment';
  readonly module = 'cvision';
  readonly description =
    'Create mandatory training course, enroll employee, complete with score';

  protected async run(): Promise<void> {
    const { baseUrl, credentials } = this.ctx;

    const admin = new CVisionAdmin({
      baseUrl,
      credentials: credentials.cvisionAdmin,
    });

    const employee = new CVisionEmployee({
      baseUrl,
      credentials: credentials.cvisionEmployee,
    });

    await this.step('Login admin', () => admin.login());
    await this.step('Login employee', () => employee.login());

    // ── Resolve an employee ID for enrollment ──

    const employeeId = await this.step('Resolve employee ID for enrollment', async () => {
      const empList = await admin.listEmployees({ limit: '50' });
      // Employees GET returns { success: true, data: [...], total, ... }
      // assertOk returns the full JSON body, so we need to extract the data array
      const items = empList?.data || empList?.items || empList?.employees || (Array.isArray(empList) ? empList : []);
      this.assert(Array.isArray(items) && items.length > 0, 'Should have employees');
      const activeEmp = items.find(
        (e: any) => e.status === 'ACTIVE' || e.status === 'active' || e.status === 'PROBATION',
      );
      const id = activeEmp?.id || activeEmp?.employeeId || items[0]?.id;
      this.assertExists(id, 'employee id from list');
      return id;
    });

    // ── Create a mandatory training course ──
    // createTrainingCourse posts { action: 'create-course', ...data }
    // API returns { ok: true, data: { courseId, title, ... } }
    // After assertOk, we get { ok: true, data: { courseId, title, ... } }
    // The actual course object is nested under .data

    const courseResult = await this.step('Create mandatory training course', () =>
      admin.createTrainingCourse({
        title: 'Workplace Safety Orientation',
        titleAr: 'التوجيه بسلامة بيئة العمل',
        type: 'MANDATORY',
        duration: 8,
        description: 'Annual mandatory workplace safety training',
        category: 'SAFETY',
      }),
    );

    // courseResult is { ok: true, data: { courseId, title, ... } }
    // Try nested .data first (training API format), then top-level (fallback)
    const courseData = courseResult.data || courseResult;
    const courseId = courseData.courseId || courseResult.courseId;
    this.assertExists(courseId, 'training course id');

    // ── Enroll employee in the course ──
    // Training API: POST with action=enroll, courseId, employeeId
    // Returns { ok: true, enrolled: N } — no enrollment ID

    const enrollment = await this.step('Enroll employee in training course', async () => {
      const res = await admin.post<any>('/api/cvision/training', {
        action: 'enroll',
        courseId,
        employeeId,
      });
      return admin.assertOk(res, 'enroll employee');
    });

    // enrollment is { ok: true, enrolled: 1 } or { ok: true, enrolled: 0, message: 'Already enrolled' }
    this.assertExists(enrollment, 'enrollment result');
    // enrolled count should be >= 0 (0 means already enrolled which is fine for idempotency)
    this.assert(
      enrollment.enrolled >= 0 || enrollment.ok === true,
      'enrollment should succeed',
    );

    // ── Verify enrollment status ──
    // GET /api/cvision/training?action=get&id=<courseId>
    // Returns { ok: true, data: { ...course, enrollments: [...], enrolledCount } }
    // After assertOk: { ok: true, data: { ...course, enrollments: [...] } }

    await this.step('Verify enrollment status is ENROLLED', async () => {
      const res = await admin.get<any>('/api/cvision/training', {
        action: 'get',
        id: courseId,
      });
      const result = admin.assertOk(res, 'get course with enrollments');
      // Unwrap nested data: result is { ok: true, data: { enrollments: [...], ... } }
      const inner = result.data || result;
      const enrollments = inner.enrollments || result.enrollments || [];
      this.assert(enrollments.length > 0, 'Should have at least one enrollment');

      const found = enrollments.find(
        (e: any) => e.employeeId === employeeId,
      );
      this.assertExists(found, 'enrollment for our employee');
      this.assertEqual(
        found.status,
        'ENROLLED',
        'enrollment status after creation',
      );
    });

    // ── Complete training with score ──
    // POST with action=complete, courseId, employeeId, score
    // Returns { ok: true, passed: true/false }

    await this.step('Complete training with passing score', async () => {
      const res = await admin.post<any>('/api/cvision/training', {
        action: 'complete',
        courseId,
        employeeId,
        score: 92,
        attendancePercent: 100,
      });
      admin.assertOk(res, 'complete training');
    });

    // ── Verify completion ──

    await this.step('Verify training completion recorded', async () => {
      const res = await admin.get<any>('/api/cvision/training', {
        action: 'get',
        id: courseId,
      });
      const result = admin.assertOk(res, 'get enrollments after completion');
      // Unwrap nested data
      const inner = result.data || result;
      const enrollments = inner.enrollments || result.enrollments || [];
      this.assert(enrollments.length > 0, 'Should still have enrollment');

      const found = enrollments.find(
        (e: any) => e.employeeId === employeeId,
      );
      this.assertExists(found, 'enrollment for our employee after completion');
      this.assertEqual(
        found.status,
        'COMPLETED',
        'enrollment status after completion',
      );
      this.assert(
        (found.score ?? 0) >= 60,
        `Score should be passing (>=60), got ${found.score}`,
      );
    });
  }
}
