/**
 * CVision Hire Full Cycle — Requisition -> candidates -> screening ->
 * interview -> offer -> hire -> verify employee created.
 */

import { BaseScenario } from './base';
import { CVisionAdmin } from '../actors/cvision/admin';
import { CVisionRecruiter } from '../actors/cvision/recruiter';
import { CVisionCandidateGenerator } from '../data/cvision/candidates';

export class CVisionHireFullCycle extends BaseScenario {
  readonly name = 'cvision-hire-full-cycle';
  readonly module = 'cvision';
  readonly description =
    'Full recruitment cycle: requisition -> screen -> interview -> offer -> hire';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const candidateGen = new CVisionCandidateGenerator();

    // 1. Login recruiter + admin
    const recruiter = new CVisionRecruiter({ baseUrl, credentials: credentials.cvisionHR });
    const admin = new CVisionAdmin({ baseUrl, credentials: credentials.cvisionAdmin });

    await this.step('Login recruiter and admin', async () => {
      await Promise.all([recruiter.login(), admin.login()]);
    });

    // 2. Get a department and resolve org data for requisition
    const orgData = await this.step('Resolve org data for requisition', async () => {
      const dept = await admin.getOrCreateDepartment({
        name: 'Engineering',
        nameAr: 'الهندسة',
        code: 'ENG',
        description: 'Engineering department',
      });
      this.assertExists(dept.id, 'departmentId');

      const grade = await admin.getOrCreateGrade({
        code: 'G3',
        name: 'Grade 3 - Mid',
        nameAr: 'الدرجة 3 - متوسط',
        level: 3,
        minSalary: 8000,
        maxSalary: 25000,
      });
      this.assertExists(grade.id, 'gradeId');

      const jt = await admin.getOrCreateJobTitle({
        code: 'SWE',
        name: 'Software Engineer',
        nameAr: 'مهندس برمجيات',
        departmentId: dept.id,
      });
      this.assertExists(jt.id, 'jobTitleId');

      const position = await admin.getOrCreateBudgetedPosition({
        departmentId: dept.id,
        jobTitleId: jt.id,
        gradeId: grade.id,
        budgetedHeadcount: 5,
      });
      const positionId = position.id || position.positionId;
      this.assertExists(positionId, 'positionId');

      return { departmentId: dept.id, jobTitleId: jt.id, positionId, gradeId: grade.id };
    });

    const department = { id: orgData.departmentId };

    // 3. Create requisition
    const requisition = await this.step('Create requisition', async () => {
      return recruiter.createRequisition({
        title: 'Software Engineer',
        departmentId: orgData.departmentId,
        jobTitleId: orgData.jobTitleId,
        positionId: orgData.positionId,
        headcount: 1,
        headcountRequested: 1,
        reason: 'NEW_POSITION',
        description: 'Need a senior full-stack engineer for the platform team.',
        skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
        experienceYears: { min: 3, max: 10 },
        salaryRange: { min: 15000, max: 30000, currency: 'SAR' },
      });
    });

    const req = requisition.requisition || requisition;
    this.assertExists(req.id, 'requisition.id');
    state.trackCVisionRequisition({
      id: req.id,
      requisitionNumber: req.requisitionNumber,
      departmentId: department.id,
      title: 'Software Engineer',
    });

    // 4. Transition requisition DRAFT -> OPEN via action-based status change
    // The API requires { action: 'open' } to transition status (not a plain status field).
    // 'open' action accepts DRAFT or APPROVED requisitions and creates position slots.
    await this.step('Open requisition', async () => {
      return recruiter.updateRequisition(req.id, { action: 'open' });
    });

    await clock.shortDelay();

    // 5. Create 3 candidates
    const candidateIds: string[] = [];
    const candidates = candidateGen.generateN(3, 'IT');

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const result = await this.step(`Create candidate ${i + 1}: ${c.fullName}`, async () => {
        return recruiter.createCandidate({
          ...c,
          requisitionId: req.id,
        });
      });
      const candidateId = result.candidate?.id ?? result.id;
      this.assertExists(candidateId, `candidate ${i + 1} id`);
      candidateIds.push(candidateId);
    }

    this.assert(candidateIds.length === 3, 'Expected 3 candidates created');

    // 6. Screen candidate 1 (pass, score 85)
    await this.step('Screen candidate 1 (pass, score 85)', async () => {
      return recruiter.screenCandidate(candidateIds[0], {
        score: 85,
        notes: 'Strong TypeScript background, excellent communication skills.',
      });
    });

    // 7. Screen candidate 2 (pass, score 70)
    await this.step('Screen candidate 2 (pass, score 70)', async () => {
      return recruiter.screenCandidate(candidateIds[1], {
        score: 70,
        notes: 'Meets minimum requirements, good potential.',
      });
    });

    await clock.shortDelay();

    // 8. Schedule interview for candidate 1 (highest score)
    await this.step('Schedule interview for candidate 1', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      // API expects: type (lowercase enum), scheduledDate, scheduledTime (separate),
      // duration (not durationMinutes), interviewers (required, min 1), notes (not interviewerNotes)
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');

      return recruiter.scheduleInterview(candidateIds[0], {
        type: 'technical',
        scheduledDate: `${year}-${month}-${day}`,
        scheduledTime: '10:00',
        duration: 60,
        interviewers: [credentials.cvisionHR.email],
        notes: 'Focus on system design and TypeScript proficiency.',
      });
    });

    await clock.shortDelay();

    // 9. Create offer for candidate 1
    const offer = await this.step('Create offer for candidate 1', async () => {
      const startDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const expiryDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      return recruiter.createOffer(candidateIds[0], {
        basicSalary: 22000,
        housingAllowance: 5500,
        transportAllowance: 2200,
        startDate,
        expiryDate,
        contractType: 'full_time',
        probationPeriod: 90,
      });
    });

    this.assertExists(offer, 'offer');

    // 10. Get requisition slots to find a VACANT slot for hiring
    const vacantSlotId = await this.step('Find vacant slot for hiring', async () => {
      const slotsResponse = await recruiter.getRequisitionSlots(req.id);
      this.assertExists(slotsResponse, 'requisition slots');

      // The API returns { slots: [...] } or { data: [...] } or an array
      const slots: any[] =
        slotsResponse?.slots ?? slotsResponse?.data ?? (Array.isArray(slotsResponse) ? slotsResponse : []);
      this.assert(slots.length > 0, 'Expected at least 1 position slot');

      const vacant = slots.find((s: any) => s.status === 'VACANT');
      this.assertExists(vacant, 'a VACANT slot');

      // The slots endpoint returns { slotId, status, ... } (slotId, not id)
      return vacant.slotId || vacant.id;
    });

    // 11. Hire candidate 1 — API requires slotId (UUID of a VACANT position slot)
    const hireResult = await this.step('Hire candidate 1', async () => {
      return recruiter.hireCandidate(candidateIds[0], {
        slotId: vacantSlotId,
        startDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        basicSalary: 22000,
        housingAllowance: 5500,
        transportAllowance: 2200,
      });
    });

    const hire = hireResult.employee || hireResult;
    this.assertExists(hire, 'hire result');

    // 12. Verify employee was created
    await this.step('Verify employee was created from hire', async () => {
      const employeeId = hire.employeeId || hire.id;
      this.assertExists(employeeId, 'hired employee id');

      const empResponse = await admin.getEmployee(employeeId);
      const employee = empResponse.employee || empResponse;
      this.assertExists(employee, 'hired employee record');

      state.trackCVisionEmployee({
        id: employeeId,
        employeeNo: employee.employeeNo || employee.employeeNumber || '',
        name: candidates[0].fullName,
        departmentId: department.id,
        status: 'PROBATION',
      });
    });
  }
}
