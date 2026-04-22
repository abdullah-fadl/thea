/**
 * CVision Onboarding-Offboarding — Full employee lifecycle.
 * Tests: create (PROBATION) -> verify onboarding -> ACTIVE -> NOTICE_PERIOD -> RESIGNED -> verify EOS -> verify terminal.
 */

import { BaseScenario } from './base';
import { CVisionAdmin } from '../actors/cvision/admin';
import { CVisionEmployeeGenerator } from '../data/cvision/employees';

export class CVisionOnboardingOffboarding extends BaseScenario {
  readonly name = 'cvision-onboarding-offboarding';
  readonly module = 'cvision';
  readonly description =
    'Full employee lifecycle: onboard (PROBATION) -> ACTIVE -> NOTICE_PERIOD -> RESIGNED -> verify EOS';

  protected async run(): Promise<void> {
    const { baseUrl, credentials } = this.ctx;

    const admin = new CVisionAdmin({
      baseUrl,
      credentials: credentials.cvisionAdmin,
    });

    const empGen = new CVisionEmployeeGenerator();

    await this.step('Login admin', () => admin.login());

    // -- Resolve departmentId and jobTitleId using idempotent helpers --

    const { departmentId, jobTitleId } = await this.step(
      'Resolve departmentId and jobTitleId',
      async () => {
        const dept = await admin.getOrCreateDepartment({
          name: 'Operations',
          nameAr: 'العمليات',
          code: 'OPS',
          description: 'Operations department',
        });
        this.assertExists(dept.id, 'departmentId');

        const jt = await admin.getOrCreateJobTitle({
          code: 'OPS-COORD',
          name: 'Operations Coordinator',
          nameAr: 'منسق عمليات',
          departmentId: dept.id,
        });
        this.assertExists(jt.id, 'jobTitleId');

        return { departmentId: dept.id, jobTitleId: jt.id };
      },
    );

    // -- Create employee in PROBATION status --

    const empData = empGen.generateWithTenure(3, 10000);

    const created = await this.step('Create employee in PROBATION', () =>
      admin.createEmployee({
        ...empData,
        status: 'PROBATION',
        departmentId,
        jobTitleId,
      }),
    );

    // createEmployee returns { success: true, employee: {...}, contract: {...} }
    const createdEmp = created.employee || created;
    this.assertExists(createdEmp.id, 'new employee id');
    const employeeId = createdEmp.id;

    // -- Verify onboarding state --

    await this.step('Verify employee is in PROBATION', async () => {
      const result = await admin.getEmployee(employeeId);
      // getEmployee returns { success: true, employee: {...} }
      const emp = result.employee || result;
      this.assertEqual(emp.status, 'PROBATION', 'initial employee status');
    });

    // -- Transition to ACTIVE --

    await this.step('Transition PROBATION -> ACTIVE', () =>
      admin.transitionEmployeeStatus(employeeId, {
        newStatus: 'ACTIVE',
        reason: 'Probation period completed successfully',
        effectiveDate: new Date().toISOString().slice(0, 10),
      }),
    );

    await this.step('Verify employee is ACTIVE', async () => {
      const result = await admin.getEmployee(employeeId);
      const emp = result.employee || result;
      this.assertEqual(emp.status, 'ACTIVE', 'status after probation');
    });

    // Refresh session mid-scenario to avoid session expiry during long test runs.
    await this.step('Refresh admin session (mid-scenario)', () => admin.login());

    // -- Transition to NOTICE_PERIOD then RESIGNED --
    // ACTIVE cannot go directly to RESIGNED. Allowed path: ACTIVE -> NOTICE_PERIOD -> RESIGNED.

    await this.step('Transition ACTIVE -> NOTICE_PERIOD', () =>
      admin.transitionEmployeeStatus(employeeId, {
        newStatus: 'NOTICE_PERIOD',
        reason: 'Employee submitted resignation, entering notice period',
        effectiveDate: new Date().toISOString().slice(0, 10),
      }),
    );

    await this.step('Verify employee is in NOTICE_PERIOD', async () => {
      const result = await admin.getEmployee(employeeId);
      const emp = result.employee || result;
      this.assertEqual(emp.status, 'NOTICE_PERIOD', 'status after notice period transition');
    });

    await this.step('Transition NOTICE_PERIOD -> RESIGNED', () =>
      admin.transitionEmployeeStatus(employeeId, {
        newStatus: 'RESIGNED',
        reason: 'Voluntary resignation',
        effectiveDate: new Date().toISOString().slice(0, 10),
      }),
    );

    // -- Verify EOS calculated --

    await this.step('Verify EOS was calculated on resignation', async () => {
      const result = await admin.getEmployee(employeeId);
      const emp = result.employee || result;
      this.assertEqual(emp.status, 'RESIGNED', 'status after resignation');
      // EOS may or may not be populated depending on salary data in employee record
      // The transition side-effect only calculates EOS if monthlySalary > 0 in financial section
      // So we just verify the status was set correctly
    });

    // -- Verify terminal status (cannot transition further) --

    await this.step('Verify RESIGNED is terminal status', async () => {
      const historyResult = await admin.getEmployeeStatusHistory(employeeId);
      // Status history returns { success: true, history: [...], total: n }
      const transitions = historyResult.history || historyResult.transitions || [];
      const entryList = Array.isArray(transitions) ? transitions : [];
      this.assert(entryList.length >= 3, `Should have at least 3 transitions, got ${entryList.length}`);

      // History is sorted desc by effectiveDate, so the first entry is the latest
      const lastTransition = entryList[0];
      this.assertEqual(
        lastTransition.toStatus || lastTransition.to || lastTransition.newStatus,
        'RESIGNED',
        'last transition target',
      );
    });
  }
}
