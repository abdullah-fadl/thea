/**
 * CVision RBAC Isolation — Verify employee role cannot access admin-only endpoints.
 * Tests that regular employees are blocked from HR admin operations
 * while self-service endpoints remain accessible.
 */

import { BaseScenario } from './base';
import { CVisionEmployee } from '../actors/cvision/employee';
import { CVisionAdmin } from '../actors/cvision/admin';

export class CVisionRBACIsolation extends BaseScenario {
  readonly name = 'cvision-rbac-isolation';
  readonly module = 'cvision';
  readonly description =
    'Verify employee role is blocked from admin endpoints but self-service works';

  protected async run(): Promise<void> {
    const { baseUrl, credentials } = this.ctx;

    const employee = new CVisionEmployee({
      baseUrl,
      credentials: credentials.cvisionEmployee,
    });

    const admin = new CVisionAdmin({
      baseUrl,
      credentials: credentials.cvisionAdmin,
    });

    // -- Login both actors --

    await this.step('Login employee', () => employee.login());
    await this.step('Login admin (control)', () => admin.login());

    // -- Employee attempts admin-only operations (all should fail with 4xx) --

    await this.step('Employee attempt: create employee (expect 403)', async () => {
      const res = await employee.post('/api/cvision/employees', {
        firstName: 'Test',
        lastName: 'Blocked',
        email: 'blocked@test.sim',
        nationalId: '1000000000',
        hireDate: '2025-01-01',
      });
      // Should be denied — either 403 (permission denied) or 400/401
      this.assert(
        !res.ok || res.status >= 400,
        `Expected create-employee to be denied, got status ${res.status}`,
      );
    });

    await this.step('Employee attempt: access payroll runs (expect non-ok)', async () => {
      const res = await employee.get('/api/cvision/payroll/runs');
      // Payroll endpoints require hr-admin role
      this.assert(
        !res.ok || res.status >= 400,
        `Expected payroll runs to be denied, got status ${res.status}`,
      );
    });

    await this.step('Employee attempt: create department (expect non-ok)', async () => {
      const res = await employee.post('/api/cvision/org/departments', {
        name: 'Unauthorized Dept',
        code: 'UNAUTH',
      });
      this.assert(
        !res.ok || res.status >= 400,
        `Expected create-department to be denied, got status ${res.status}`,
      );
    });

    // -- Self-service MUST work for employee --

    await this.step('Verify employee self-service access works', async () => {
      const res = await employee.get('/api/cvision/self-service');
      this.assert(
        res.ok,
        `Expected self-service to succeed, got status ${res.status}`,
      );
      // Verify the response body looks correct
      const data = res.data as Record<string, unknown>;
      this.assert(
        data?.ok === true || data?.data !== undefined,
        'Self-service should return ok:true or contain data',
      );
    });

    // -- Control: admin CAN do these operations --

    await this.step('Control: admin can list departments', async () => {
      const result = await admin.listDepartments();
      // listDepartments returns { items: [...] }
      this.assertExists(result, 'admin list departments result');
      const items = result.items || result.data || result;
      this.assert(
        Array.isArray(items),
        'Admin should be able to list departments and get an array',
      );
    });

    await this.step('Control: admin can list employees', async () => {
      const result = await admin.listEmployees();
      this.assertExists(result, 'admin list employees result');
    });
  }
}
