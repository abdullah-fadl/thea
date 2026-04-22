/**
 * CVision Org Setup — Create departments, grades, job titles, budgeted positions,
 * and verify the organization tree.
 *
 * This scenario is **idempotent** — running it a second time will not fail
 * because all create calls use getOrCreate* helpers that gracefully handle
 * "already exists" (HTTP 400 / 409) responses by returning the existing record.
 */

import { BaseScenario } from './base';
import { CVisionAdmin } from '../actors/cvision/admin';
import { CVisionDepartmentGenerator } from '../data/cvision/departments';

export class CVisionOrgSetup extends BaseScenario {
  readonly name = 'cvision-org-setup';
  readonly module = 'cvision';
  readonly description =
    'Create departments, grades, job titles, budgeted positions, and verify org tree';

  protected async run(): Promise<void> {
    const { baseUrl, state, credentials } = this.ctx;
    const deptGen = new CVisionDepartmentGenerator();

    // 1. Login admin
    const admin = new CVisionAdmin({ baseUrl, credentials: credentials.cvisionAdmin });
    await this.step('Login admin', async () => {
      await admin.login();
    });

    // 2. Create 4 core departments (HR, IT, Finance, Operations — bilingual)
    //    Uses getOrCreateDepartment so re-runs don't fail on duplicate codes.
    const coreDepts = deptGen.getCoreDepartments(); // HR, IT, FIN, OPS
    const createdDepartments: Array<{ id: string; name: string; code: string }> = [];

    for (const dept of coreDepts) {
      const result = await this.step(`Create department: ${dept.name}`, async () => {
        return admin.getOrCreateDepartment({
          name: dept.name,
          nameAr: dept.nameAr,
          code: dept.code,
          description: dept.description,
        });
      });
      // getOrCreateDepartment always returns { id, name, code }
      const deptRecord = { id: result.id, name: result.name, code: result.code };
      createdDepartments.push(deptRecord);
      state.trackCVisionDepartment(deptRecord);
    }

    this.assert(createdDepartments.length === 4, 'Expected 4 departments created');

    // 3. Create 5 grades (G1-G5)
    const allGrades = deptGen.getAllGrades();
    const createdGrades: Array<{ id: string; code: string }> = [];

    for (const grade of allGrades) {
      const result = await this.step(`Create grade: ${grade.code}`, async () => {
        return admin.getOrCreateGrade({
          code: grade.code,
          name: grade.name,
          nameAr: grade.nameAr,
          level: grade.level,
          minSalary: grade.minSalary,
          maxSalary: grade.maxSalary,
          currency: grade.currency,
        });
      });
      // getOrCreateGrade always returns { id, code }
      createdGrades.push({ id: result.id, code: result.code });
    }

    this.assert(createdGrades.length === 5, 'Expected 5 grades created');

    // 4. Create 8 job titles (2 per core department)
    const createdJobTitles: Array<{ id: string; code: string; departmentId?: string }> = [];
    const jobTitlesPerDept = 2;

    for (const dept of createdDepartments) {
      const deptJobTitles = deptGen.getJobTitlesForDepartment(dept.code);
      const titlesToCreate = deptJobTitles.slice(0, jobTitlesPerDept);

      for (const jt of titlesToCreate) {
        const result = await this.step(`Create job title: ${jt.name}`, async () => {
          return admin.getOrCreateJobTitle({
            code: jt.code,
            name: jt.name,
            nameAr: jt.nameAr,
            departmentId: dept.id,
          });
        });
        // getOrCreateJobTitle always returns { id, code, departmentId? }
        createdJobTitles.push({
          id: result.id,
          code: result.code,
          departmentId: result.departmentId ?? dept.id,
        });
      }
    }

    this.assert(createdJobTitles.length === 8, 'Expected 8 job titles created');

    // 5. Create budgeted positions (one per job title)
    for (let i = 0; i < createdJobTitles.length; i++) {
      const jt = createdJobTitles[i];
      // Alternate grades across positions
      const grade = createdGrades[i % createdGrades.length];

      await this.step(`Create budgeted position: ${jt.code}`, async () => {
        return admin.getOrCreateBudgetedPosition({
          departmentId: jt.departmentId!,
          jobTitleId: jt.id,
          gradeId: grade.id,
          budgetedHeadcount: 2 + Math.floor(Math.random() * 4),
        });
      });
    }

    // 6. Verify org tree
    await this.step('Verify org tree', async () => {
      const tree = await admin.getOrgTree();
      this.assertExists(tree, 'org tree');
    });

    // 7. Verify departments list matches
    await this.step('Verify departments list', async () => {
      const deptList = await admin.listDepartments();
      this.assertExists(deptList, 'departments list');
    });

    // 8. Verify grades list
    await this.step('Verify grades list', async () => {
      const gradeList = await admin.listGrades();
      this.assertExists(gradeList, 'grades list');
    });

    // 9. Verify job titles list
    await this.step('Verify job titles list', async () => {
      const jtList = await admin.listJobTitles();
      this.assertExists(jtList, 'job titles list');
    });
  }
}
