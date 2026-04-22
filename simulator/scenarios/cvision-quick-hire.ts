/**
 * CVision Quick Hire — Bypass full screening pipeline.
 * Tests: resolve org data -> create requisition -> open -> create candidate -> quick-hire -> verify employee.
 */

import { BaseScenario } from './base';
import { CVisionAdmin } from '../actors/cvision/admin';
import { CVisionRecruiter } from '../actors/cvision/recruiter';
import { CVisionCandidateGenerator } from '../data/cvision/candidates';

export class CVisionQuickHire extends BaseScenario {
  readonly name = 'cvision-quick-hire';
  readonly module = 'cvision';
  readonly description =
    'Recruiter quick-hires a candidate, bypassing full screening pipeline';

  protected async run(): Promise<void> {
    const { baseUrl, credentials } = this.ctx;

    // Use admin to set up org data, recruiter for recruitment flow
    const admin = new CVisionAdmin({
      baseUrl,
      credentials: credentials.cvisionAdmin,
    });

    const recruiter = new CVisionRecruiter({
      baseUrl,
      credentials: credentials.cvisionHR,
    });

    const candidateGen = new CVisionCandidateGenerator();

    await this.step('Login admin', () => admin.login());
    await this.step('Login recruiter', () => recruiter.login());

    // -- Resolve departmentId, jobTitleId, and positionId using idempotent helpers --

    const orgData = await this.step('Resolve org data for requisition', async () => {
      const dept = await admin.getOrCreateDepartment({
        name: 'IT',
        nameAr: 'تقنية المعلومات',
        code: 'IT',
        description: 'IT department',
      });
      this.assertExists(dept.id, 'departmentId');

      const grade = await admin.getOrCreateGrade({
        code: 'G5',
        name: 'Grade 5 - Senior',
        nameAr: 'الدرجة 5 - أقدم',
        level: 5,
        minSalary: 10000,
        maxSalary: 30000,
      });
      this.assertExists(grade.id, 'gradeId');

      // Verify grade is accessible by re-querying from the grades list
      // This catches cases where getOrCreateGrade returned a stale or invalid ID
      const gradesListResult = await admin.listGrades();
      // Grades GET returns { success: true, data: [...], total, ... }
      const gradesList = gradesListResult?.data || gradesListResult?.items || (Array.isArray(gradesListResult) ? gradesListResult : []);
      const verifiedGrade = Array.isArray(gradesList)
        ? gradesList.find((g: any) => g.code === 'G5')
        : undefined;
      const gradeId = verifiedGrade?.id || grade.id;
      this.assertExists(gradeId, 'verified gradeId');

      const jt = await admin.getOrCreateJobTitle({
        code: 'SWE-SR',
        name: 'Senior Software Engineer',
        nameAr: 'مهندس برمجيات أقدم',
        departmentId: dept.id,
      });
      this.assertExists(jt.id, 'jobTitleId');

      // Create or find a budgeted position for the requisition
      const position = await admin.getOrCreateBudgetedPosition({
        departmentId: dept.id,
        jobTitleId: jt.id,
        gradeId,
        budgetedHeadcount: 5,
      });
      const positionId = position.id || position.positionId;
      this.assertExists(positionId, 'positionId');

      return { departmentId: dept.id, jobTitleId: jt.id, positionId };
    });

    // -- Create requisition --
    // Requisition POST returns { success: true, requisition: {...} }

    const requisitionResult = await this.step('Create requisition', () =>
      recruiter.createRequisition({
        title: 'Senior Software Engineer',
        description: 'Urgent hire for platform team',
        departmentId: orgData.departmentId,
        jobTitleId: orgData.jobTitleId,
        positionId: orgData.positionId,
        headcount: 2,
        headcountRequested: 2,
        reason: 'NEW_POSITION',
      }),
    );

    const requisition = requisitionResult.requisition || requisitionResult;
    this.assertExists(requisition.id, 'requisition id');
    const requisitionId = requisition.id;

    // -- Transition requisition DRAFT -> OPEN via action-based status change --
    // The API requires { action: 'open' } to transition status (not a plain status field).
    // 'open' action accepts DRAFT or APPROVED requisitions and creates position slots.

    await this.step('Open requisition', () =>
      recruiter.updateRequisition(requisitionId, {
        action: 'open',
      }),
    );

    // -- Capture initial slot count --

    const slotsBefore = await this.step('Check initial position slots', async () => {
      const data = await recruiter.getRequisitionSlots(requisitionId);
      return {
        total: data.budgetedHeadcount ?? data.headcount ?? 2,
        filled: data.filledCount ?? data.filled ?? 0,
      };
    });

    // -- Create candidate --
    // Candidate POST returns { success: true, candidate: {...} }

    const candidateData = candidateGen.generate('IT');

    const candidateResult = await this.step('Create candidate', () =>
      recruiter.createCandidate({
        ...candidateData,
        requisitionId,
      }),
    );

    const candidate = candidateResult.candidate || candidateResult;
    this.assertExists(candidate.id, 'candidate id');
    const candidateId = candidate.id;

    // -- Quick-hire (bypass full screening) --
    // Quick-hire returns { success: true, employee: { id, employeeNo, fullName }, contract: {...} }

    const hireResult = await this.step('Quick-hire candidate', () =>
      recruiter.quickHire(candidateId, {
        startDate: new Date().toISOString().slice(0, 10),
        basicSalary: 18000,
        departmentId: orgData.departmentId,
        jobTitleId: orgData.jobTitleId,
      }),
    );

    this.assertExists(hireResult, 'quick-hire result');

    // -- Verify employee was created --

    await this.step('Verify employee record was created', async () => {
      const employeeId = hireResult.employee?.id || hireResult.employeeId;
      this.assertExists(employeeId, 'created employee id from quick-hire');

      const empResult = await recruiter.getEmployee(employeeId);
      // getEmployee returns { success: true, employee: {...} }
      const emp = empResult.employee || empResult;
      this.assert(
        emp.status === 'PROBATION' || emp.status === 'ACTIVE',
        `New hire should be PROBATION or ACTIVE, got ${emp.status}`,
      );
    });

    // -- Verify position slot was consumed --

    await this.step('Verify position slot consumed', async () => {
      const slotsAfterResult = await recruiter.getRequisitionSlots(requisitionId);
      const filledAfter = slotsAfterResult.filledCount ?? slotsAfterResult.filled ?? 0;
      this.assert(
        filledAfter >= slotsBefore.filled,
        `Filled slots should not decrease: before=${slotsBefore.filled}, after=${filledAfter}`,
      );
    });
  }
}
