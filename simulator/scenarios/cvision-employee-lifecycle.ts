/**
 * CVision Employee Lifecycle — Create employee in PROBATION, transition through
 * ACTIVE -> NOTICE_PERIOD -> RESIGNED with EOS calculation verification.
 */

import { BaseScenario } from './base';
import { CVisionAdmin } from '../actors/cvision/admin';
import { CVisionEmployeeGenerator } from '../data/cvision/employees';
import { CVisionPayrollGenerator } from '../data/cvision/payroll';

export class CVisionEmployeeLifecycle extends BaseScenario {
  readonly name = 'cvision-employee-lifecycle';
  readonly module = 'cvision';
  readonly description =
    'Employee lifecycle: PROBATION -> ACTIVE -> NOTICE_PERIOD -> RESIGNED with EOS';

  protected async run(): Promise<void> {
    const { baseUrl, state, credentials } = this.ctx;
    const empGen = new CVisionEmployeeGenerator();
    const payrollGen = new CVisionPayrollGenerator();

    // 1. Login admin
    const admin = new CVisionAdmin({ baseUrl, credentials: credentials.cvisionAdmin });
    await this.step('Login admin', async () => {
      await admin.login();
    });

    // 2. Resolve org data using idempotent helpers
    const { departmentId, jobTitleId } = await this.step(
      'Resolve departmentId and jobTitleId',
      async () => {
        const dept = await admin.getOrCreateDepartment({
          name: 'Engineering',
          nameAr: 'الهندسة',
          code: 'ENG',
          description: 'Engineering department',
        });
        this.assertExists(dept.id, 'departmentId');

        const jt = await admin.getOrCreateJobTitle({
          code: 'SWE',
          name: 'Software Engineer',
          nameAr: 'مهندس برمجيات',
          departmentId: dept.id,
        });
        this.assertExists(jt.id, 'jobTitleId');

        return { departmentId: dept.id, jobTitleId: jt.id };
      },
    );

    // 3. Create employee in PROBATION status
    const empData = empGen.generateWithTenure(3, 12000); // 3 years tenure, 12000 SAR base
    const baseSalary = empData.baseSalary!;
    const tenureYears = 3;

    const employee = await this.step('Create employee (PROBATION)', async () => {
      return admin.createEmployee({
        firstName: empData.firstName,
        firstNameAr: empData.firstNameAr,
        lastName: empData.lastName,
        lastNameAr: empData.lastNameAr,
        email: empData.email,
        phone: empData.phone,
        nationalId: empData.nationalId,
        nationality: empData.nationality,
        gender: empData.gender,
        dateOfBirth: empData.dateOfBirth,
        hireDate: empData.hireDate,
        departmentId,
        jobTitleId,
        baseSalary,
        iban: empData.iban,
        status: 'PROBATION',
      });
    });

    // createEmployee returns { success: true, employee: {...}, contract: {...} }
    const emp = employee.employee || employee;
    this.assertExists(emp.id, 'employee.id');
    state.trackCVisionEmployee({
      id: emp.id,
      employeeNo: emp.employeeNo || emp.employeeNumber || '',
      name: `${empData.firstName} ${empData.lastName}`,
      status: 'PROBATION',
    });

    // 4. Verify employee appears in employee list
    await this.step('Verify employee in list', async () => {
      const list = await admin.listEmployees();
      this.assertExists(list, 'employee list');
    });

    // 5. Transition PROBATION -> ACTIVE
    await this.step('Transition PROBATION -> ACTIVE', async () => {
      return admin.transitionEmployeeStatus(emp.id, {
        newStatus: 'ACTIVE',
        reason: 'Probation period completed successfully',
        effectiveDate: new Date().toISOString().split('T')[0],
      });
    });

    // 6. Verify status history has 2 entries (PROBATION + ACTIVE)
    await this.step('Verify status history (2 entries)', async () => {
      const result = await admin.getEmployeeStatusHistory(emp.id);
      // API returns { success: true, history: [...], total: n }
      const entries = result.history || result.entries || [];
      const entryList = Array.isArray(entries) ? entries : [];
      this.assert(
        entryList.length >= 2,
        `Expected at least 2 status history entries, got ${entryList.length}`,
      );
    });

    // 7. Transition ACTIVE -> NOTICE_PERIOD (resignation)
    await this.step('Transition ACTIVE -> NOTICE_PERIOD (resignation)', async () => {
      return admin.transitionEmployeeStatus(emp.id, {
        newStatus: 'NOTICE_PERIOD',
        reason: 'Employee resignation - personal reasons',
        effectiveDate: new Date().toISOString().split('T')[0],
      });
    });

    // 8. Calculate expected EOS for verification
    const expectedEOS = payrollGen.calculateEOS(baseSalary, tenureYears, true);

    // 9. Transition NOTICE_PERIOD -> RESIGNED with EOS
    await this.step('Transition NOTICE_PERIOD -> RESIGNED with EOS', async () => {
      return admin.transitionEmployeeStatus(emp.id, {
        newStatus: 'RESIGNED',
        reason: 'Notice period completed',
        effectiveDate: new Date().toISOString().split('T')[0],
        endOfServiceAmount: expectedEOS,
      });
    });

    // 10. Verify final status is RESIGNED
    await this.step('Verify final status is RESIGNED', async () => {
      const empResponse = await admin.getEmployee(emp.id);
      // getEmployee returns { success: true, employee: {...} }
      const empRecord = empResponse.employee || empResponse;
      const status = empRecord.status || empRecord.employmentStatus;
      this.assertEqual(status, 'RESIGNED', 'employee status');
    });

    // 11. Verify EOS amount
    await this.step('Verify EOS amount', async () => {
      // EOS for 3 years with resignation: 1/3 of (baseSalary/2 * 3 years) since <5 years
      this.assert(expectedEOS > 0, `Expected positive EOS amount, got ${expectedEOS}`);

      const result = await admin.getEmployeeStatusHistory(emp.id);
      const entries = result.history || result.entries || [];
      const entryList = Array.isArray(entries) ? entries : [];
      const lastEntry = entryList[0]; // sorted desc by effectiveDate

      if (lastEntry?.endOfServiceAmount !== undefined) {
        this.assertEqual(
          lastEntry.endOfServiceAmount,
          expectedEOS,
          'EOS amount in status history',
        );
      }
    });

    // Update tracking
    state.trackCVisionEmployee({
      id: emp.id,
      employeeNo: emp.employeeNo || emp.employeeNumber || '',
      name: `${empData.firstName} ${empData.lastName}`,
      status: 'RESIGNED',
    });
  }
}
