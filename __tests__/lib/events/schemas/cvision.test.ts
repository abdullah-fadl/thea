/**
 * Phase 7.5 — CVision event schema tests
 *
 * One describe per registered event:
 *   1. employee.hired@v1
 *   2. employee.terminated@v1
 *   3. payroll.run.completed@v1
 *
 * Each block exercises the Zod payload contract directly via getSchema(),
 * after triggering registration via the schemas barrel side-effect import.
 *
 * The schemas use Zod v4's default object semantics (unknown keys stripped).
 * The "no PII" discipline is enforced at parse-time: any extra field a
 * careless caller adds — names, salaries, national IDs, free-text reasons —
 * MUST be silently discarded so the event row only contains the declared
 * fields.
 */

import { describe, it, expect } from 'vitest';
import '@/lib/events/schemas';
import { getSchema } from '@/lib/events/registry';

const TENANT_ID       = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const EMPLOYEE_ID     = '550e8400-e29b-41d4-a716-446655440000';
const DEPARTMENT_ID   = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const JOB_TITLE_ID    = '7d3a9c2e-1b8d-4c4f-9e7a-2f5e8a1d3c4b';
const PAYROLL_RUN_ID  = '8e4b0d3f-2c9e-45a0-9f8b-3a6f9b2e4d5c';
const NOW_ISO         = '2026-04-25T10:00:00.000Z';

describe('CVision event schemas', () => {
  describe('employee.hired@v1', () => {
    const schema = getSchema('employee.hired', 1).payloadSchema;

    it('accepts a valid payload', () => {
      const result = schema.safeParse({
        employeeId: EMPLOYEE_ID,
        tenantId: TENANT_ID,
        departmentId: DEPARTMENT_ID,
        jobTitleId: JOB_TITLE_ID,
        status: 'PROBATION',
        hiredAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects payload with status outside the CvisionEmployeeStatus enum', () => {
      const result = schema.safeParse({
        employeeId: EMPLOYEE_ID,
        tenantId: TENANT_ID,
        departmentId: DEPARTMENT_ID,
        jobTitleId: JOB_TITLE_ID,
        status: 'WORKING',
        hiredAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips PII fields (firstName, salary, nationalId) — only IDs + scope persist', () => {
      const result = schema.safeParse({
        employeeId: EMPLOYEE_ID,
        tenantId: TENANT_ID,
        departmentId: DEPARTMENT_ID,
        jobTitleId: JOB_TITLE_ID,
        status: 'ACTIVE',
        hiredAt: NOW_ISO,
        // PII a careless caller might attach:
        firstName: 'Ahmed',
        lastName: 'Al-Saud',
        email: 'ahmed@example.com',
        phone: '+966500000000',
        nationalId: '1234567890',
        basicSalary: 12000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('firstName');
        expect(result.data).not.toHaveProperty('lastName');
        expect(result.data).not.toHaveProperty('email');
        expect(result.data).not.toHaveProperty('phone');
        expect(result.data).not.toHaveProperty('nationalId');
        expect(result.data).not.toHaveProperty('basicSalary');
      }
    });
  });

  describe('employee.terminated@v1', () => {
    const schema = getSchema('employee.terminated', 1).payloadSchema;

    it('accepts a valid payload with toStatus = TERMINATED', () => {
      const result = schema.safeParse({
        employeeId: EMPLOYEE_ID,
        tenantId: TENANT_ID,
        fromStatus: 'ACTIVE',
        toStatus: 'TERMINATED',
        effectiveAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects toStatus outside {RESIGNED, TERMINATED}', () => {
      const result = schema.safeParse({
        employeeId: EMPLOYEE_ID,
        tenantId: TENANT_ID,
        fromStatus: 'ACTIVE',
        toStatus: 'SUSPENDED',
        effectiveAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips PII fields (reason, notes, terminationLetter) — grievance content stays out', () => {
      const result = schema.safeParse({
        employeeId: EMPLOYEE_ID,
        tenantId: TENANT_ID,
        fromStatus: 'NOTICE_PERIOD',
        toStatus: 'RESIGNED',
        effectiveAt: NOW_ISO,
        reason: 'Personal — relocation to family city',
        notes: 'Manager confirms exit interview completed',
        terminationLetter: 'Dear Mr. X, ...',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('reason');
        expect(result.data).not.toHaveProperty('notes');
        expect(result.data).not.toHaveProperty('terminationLetter');
      }
    });
  });

  describe('payroll.run.completed@v1', () => {
    const schema = getSchema('payroll.run.completed', 1).payloadSchema;

    it('accepts a valid payload with payslipCount=0 (an empty run is still a finalisation)', () => {
      const result = schema.safeParse({
        runId: PAYROLL_RUN_ID,
        tenantId: TENANT_ID,
        period: '2026-04',
        status: 'APPROVED',
        payslipCount: 0,
        finalizedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects status other than APPROVED (PAID is a separate downstream event)', () => {
      const result = schema.safeParse({
        runId: PAYROLL_RUN_ID,
        tenantId: TENANT_ID,
        period: '2026-04',
        status: 'PAID',
        payslipCount: 12,
        finalizedAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips financial fields (totalGross, totalNet, deductions) — salary detail stays inside RLS', () => {
      const result = schema.safeParse({
        runId: PAYROLL_RUN_ID,
        tenantId: TENANT_ID,
        period: '2026-04',
        status: 'APPROVED',
        payslipCount: 137,
        finalizedAt: NOW_ISO,
        totalGross: 1_540_000,
        totalNet: 1_120_000,
        deductionsBreakdown: { gosi: 220_000, tax: 0, loan: 200_000 },
        payerBankAccount: 'SA0380000000608010167519',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('totalGross');
        expect(result.data).not.toHaveProperty('totalNet');
        expect(result.data).not.toHaveProperty('deductionsBreakdown');
        expect(result.data).not.toHaveProperty('payerBankAccount');
      }
    });
  });
});
