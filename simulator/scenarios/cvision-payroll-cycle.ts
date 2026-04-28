/**
 * CVision Payroll Cycle — Create payroll profiles, run payroll, dry-run, approve,
 * export WPS, verify payslips and GOSI contributions.
 */

import { BaseScenario } from './base';
import { CVisionAdmin } from '../actors/cvision/admin';
import { CVisionPayrollAdmin } from '../actors/cvision/payroll-admin';
import { CVisionPayrollGenerator } from '../data/cvision/payroll';
import { CVisionEmployeeGenerator } from '../data/cvision/employees';

export class CVisionPayrollCycle extends BaseScenario {
  readonly name = 'cvision-payroll-cycle';
  readonly module = 'cvision';
  readonly description =
    'Full payroll cycle: profiles -> run -> dry-run -> approve -> WPS export -> verify payslips + GOSI';

  protected async run(): Promise<void> {
    const { baseUrl, clock, state, credentials } = this.ctx;
    const payrollGen = new CVisionPayrollGenerator();
    const empGen = new CVisionEmployeeGenerator();

    // 1. Login payroll admin and admin
    const payrollAdmin = new CVisionPayrollAdmin({ baseUrl, credentials: credentials.cvisionPayroll });
    const admin = new CVisionAdmin({ baseUrl, credentials: credentials.cvisionAdmin });

    await this.step('Login payroll admin and admin', async () => {
      await Promise.all([payrollAdmin.login(), admin.login()]);
    });

    // 2. Resolve org data using idempotent helpers
    const { departmentId, jobTitleId } = await this.step(
      'Resolve departmentId and jobTitleId',
      async () => {
        const dept = await admin.getOrCreateDepartment({
          name: 'Finance',
          nameAr: 'المالية',
          code: 'FIN',
          description: 'Finance department',
        });
        this.assertExists(dept.id, 'departmentId');

        const jt = await admin.getOrCreateJobTitle({
          code: 'ACCT',
          name: 'Accountant',
          nameAr: 'محاسب',
          departmentId: dept.id,
        });
        this.assertExists(jt.id, 'jobTitleId');

        return { departmentId: dept.id, jobTitleId: jt.id };
      },
    );

    // 3. Ensure at least 3 employees exist (create if needed)
    const employees = await this.step('Ensure 3+ employees exist', async () => {
      const listResult = await admin.listEmployees();
      // listEmployees returns { success: true, data: [...], total: n }
      const existing = listResult.data || listResult.employees || listResult.items || listResult;
      const empList = Array.isArray(existing) ? existing : [];

      if (empList.length >= 3) {
        return empList.slice(0, 3);
      }

      // Create employees to reach minimum of 3
      const needed = 3 - empList.length;
      const created: Array<Record<string, unknown>> = [...empList];

      for (let i = 0; i < needed; i++) {
        const empData = empGen.generate({ salary: 8000 + Math.floor(Math.random() * 20000) });
        const empResult = await admin.createEmployee({
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
          baseSalary: empData.baseSalary,
          iban: empData.iban,
          status: 'ACTIVE',
        });

        // createEmployee returns { success: true, employee: {...}, contract: {...} }
        const emp = empResult.employee || empResult;

        state.trackCVisionEmployee({
          id: emp.id,
          employeeNo: emp.employeeNo || emp.employeeNumber || '',
          name: `${empData.firstName} ${empData.lastName}`,
          status: 'ACTIVE',
        });

        created.push(emp);
      }

      return created;
    });

    this.assert(employees.length >= 3, `Expected at least 3 employees, got ${employees.length}`);

    // 4. Create payroll profiles for each employee
    await this.step('Create payroll profiles', async () => {
      for (const emp of employees) {
        const e = emp as Record<string, unknown>;
        const empId = e.id as string;
        const baseSalary = (e.baseSalary as number) || 10000;
        const structure = payrollGen.generateSalaryStructure(baseSalary);

        await payrollAdmin.createPayrollProfile({
          employeeId: empId,
          baseSalary: structure.baseSalary,
          housingAllowance: structure.housingAllowance,
          transportAllowance: structure.transportAllowance,
          otherAllowances: structure.otherAllowances,
          currency: 'SAR',
          bankName: 'Al Rajhi Bank',
          iban: (e.iban as string) || payrollGen.generateIBAN(),
        });
      }
    });

    // 5. Create payroll run
    // Use a unique period to avoid 409 conflict with previous test runs.
    // Period format must be YYYY-MM, so we use a future month offset by a random value.
    const basePeriod = payrollGen.generatePeriod();
    const randomMonth = Math.floor(Math.random() * 12) + 1;
    const [baseYear, baseMonth] = basePeriod.split('-').map(Number);
    const totalMonths = baseYear * 12 + (baseMonth - 1) + randomMonth;
    const period = `${Math.floor(totalMonths / 12)}-${String((totalMonths % 12) + 1).padStart(2, '0')}`;

    const payrollRun = await this.step(`Create payroll run for ${period}`, async () => {
      return payrollAdmin.createPayrollRun({
        period,
        description: `Monthly payroll run for ${period}`,
      });
    });

    const run = payrollRun.payrollRun || payrollRun.run || payrollRun;
    this.assertExists(run.id, 'payroll run id');

    // 6. Dry-run
    const dryRunResult = await this.step('Dry-run payroll', async () => {
      return payrollAdmin.dryRunPayroll(run.id);
    });

    this.assertExists(dryRunResult, 'dry-run result');

    await clock.shortDelay();

    // 7. Approve payroll run
    await this.step('Approve payroll run', async () => {
      return payrollAdmin.approvePayrollRun(run.id);
    });

    // 8. Export WPS
    await this.step('Export WPS file', async () => {
      const wps = await payrollAdmin.exportWPS(run.id);
      this.assertExists(wps, 'WPS export data');
      return wps;
    });

    // 9. Get payslips and verify each has gross/net
    await this.step('Verify payslips have gross and net', async () => {
      const payslips = await payrollAdmin.getPayslips(run.id);
      const slipList = payslips.payslips || payslips.data || payslips.items || payslips;
      const slips = Array.isArray(slipList) ? slipList : [];

      this.assert(slips.length > 0, `Expected payslips, got ${slips.length}`);

      for (const slip of slips) {
        const gross = slip.grossSalary ?? slip.gross ?? slip.totalEarnings;
        const net = slip.netSalary ?? slip.net ?? slip.netPay;
        this.assertExists(gross, `payslip ${slip.id} gross salary`);
        this.assertExists(net, `payslip ${slip.id} net salary`);
        this.assert(gross > 0, `payslip ${slip.id} gross must be > 0, got ${gross}`);
        this.assert(net > 0, `payslip ${slip.id} net must be > 0, got ${net}`);
        this.assert(net <= gross, `payslip ${slip.id} net (${net}) must be <= gross (${gross})`);
      }
    });

    // 10. Verify GOSI contributions
    await this.step('Verify GOSI summary', async () => {
      const gosi = await payrollAdmin.getGosiSummary({ period });
      this.assertExists(gosi, 'GOSI summary');
    });

    // Track payroll run in state
    state.trackCVisionPayrollRun({
      id: run.id,
      period,
      status: 'APPROVED',
    });
  }
}
