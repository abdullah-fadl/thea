/**
 * CVision Authorization Policy Tests
 * 
 * Tests for policy functions in lib/cvision/authz/policy.ts
 */

import { describe, it, expect } from 'vitest';
import {
  canListEmployees,
  canReadEmployee,
  canWriteEmployee,
  canListRequisitions,
  canReadRequisition,
  canReadCandidate,
  canWriteCandidate,
  canAccessPayroll,
} from '@/lib/cvision/authz/policy';
import type { AuthzContext } from '@/lib/cvision/authz/context';
import type { CVisionEmployee, CVisionJobRequisition, CVisionCandidate } from '@/lib/cvision/types';
import { CVISION_ROLES } from '@/lib/cvision/roles';

// Helper to create test contexts
function createContext(overrides: Partial<AuthzContext>): AuthzContext {
  return {
    tenantId: 'test-tenant',
    userId: 'test-user',
    roles: ['employee'],
    departmentIds: [],
    ...overrides,
  };
}

function createEmployee(overrides: Partial<CVisionEmployee>): CVisionEmployee {
  return {
    id: 'emp-1',
    tenantId: 'test-tenant',
    employeeNumber: 'EMP001',
    firstName: 'John',
    lastName: 'Doe',
    departmentId: 'dept-1',
    jobTitleId: 'title-1',
    status: 'active',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
    updatedBy: 'admin',
    ...overrides,
  } as CVisionEmployee;
}

function createRequisition(overrides: Partial<CVisionJobRequisition>): CVisionJobRequisition {
  return {
    id: 'req-1',
    tenantId: 'test-tenant',
    requisitionNumber: 'REQ001',
    departmentId: 'dept-1',
    jobTitleId: 'title-1',
    status: 'open',
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
    updatedBy: 'admin',
    ...overrides,
  } as CVisionJobRequisition;
}

function createCandidate(overrides: Partial<CVisionCandidate>): CVisionCandidate {
  return {
    id: 'cand-1',
    tenantId: 'test-tenant',
    requisitionId: 'req-1',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    status: 'applied',
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
    updatedBy: 'admin',
    ...overrides,
  } as CVisionCandidate;
}

describe('canListEmployees', () => {
  it('should allow HR_ADMIN to list all employees', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_ADMIN] });
    const result = canListEmployees(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should allow CVISION_ADMIN to list all employees', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.CVISION_ADMIN] });
    const result = canListEmployees(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should allow AUDITOR to list all employees', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.AUDITOR] });
    const result = canListEmployees(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER with department to list employees', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.HR_MANAGER],
      departmentIds: ['dept-1'],
    });
    const result = canListEmployees(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should deny HR_MANAGER without department', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_MANAGER] });
    const result = canListEmployees(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('NO_DEPARTMENT_ASSIGNED');
  });

  it('should allow EMPLOYEE to list (filtered to self)', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.EMPLOYEE] });
    const result = canListEmployees(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should deny TERMINATED user', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      employeeStatus: 'terminated',
    });
    const result = canListEmployees(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TERMINATED_ACCESS_BLOCKED');
  });

  it('should deny CANDIDATE', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.CANDIDATE] });
    const result = canListEmployees(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('CANDIDATE_NO_INTERNAL_ACCESS');
  });
});

describe('canReadEmployee', () => {
  const employee = createEmployee({ id: 'emp-1', departmentId: 'dept-1' });

  it('should allow HR_ADMIN to read any employee', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_ADMIN] });
    const result = canReadEmployee(ctx, employee);
    expect(result.allowed).toBe(true);
  });

  it('should allow self-access', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      employeeId: 'emp-1',
    });
    const result = canReadEmployee(ctx, employee);
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER to read employee in their department', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.HR_MANAGER],
      departmentIds: ['dept-1'],
    });
    const result = canReadEmployee(ctx, employee);
    expect(result.allowed).toBe(true);
  });

  it('should deny HR_MANAGER reading employee from different department', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.HR_MANAGER],
      departmentIds: ['dept-2'],
    });
    const result = canReadEmployee(ctx, employee);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('DEPARTMENT_MISMATCH');
  });

  it('should deny EMPLOYEE reading other employee', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      employeeId: 'emp-2',
    });
    const result = canReadEmployee(ctx, employee);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('SELF_ONLY');
  });

  it('should deny TERMINATED user', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      employeeStatus: 'terminated',
    });
    const result = canReadEmployee(ctx, employee);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TERMINATED_ACCESS_BLOCKED');
  });

  it('should deny CANDIDATE', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.CANDIDATE] });
    const result = canReadEmployee(ctx, employee);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('CANDIDATE_NO_INTERNAL_ACCESS');
  });

  it('should deny tenant mismatch', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_ADMIN] });
    const otherTenantEmployee = createEmployee({ tenantId: 'other-tenant' });
    const result = canReadEmployee(ctx, otherTenantEmployee);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TENANT_MISMATCH');
  });
});

describe('canWriteEmployee', () => {
  const employee = createEmployee({ id: 'emp-1', departmentId: 'dept-1' });

  it('should allow HR_ADMIN to write any employee', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_ADMIN] });
    const result = canWriteEmployee(ctx, employee);
    expect(result.allowed).toBe(true);
  });

  it('should allow CVISION_ADMIN to write any employee', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.CVISION_ADMIN] });
    const result = canWriteEmployee(ctx, employee);
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER to write employee in their department', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.HR_MANAGER],
      departmentIds: ['dept-1'],
    });
    const result = canWriteEmployee(ctx, employee);
    expect(result.allowed).toBe(true);
  });

  it('should deny HR_MANAGER writing employee from different department', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.HR_MANAGER],
      departmentIds: ['dept-2'],
    });
    const result = canWriteEmployee(ctx, employee);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('DEPARTMENT_MISMATCH');
  });

  it('should deny EMPLOYEE writing other employee', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      employeeId: 'emp-2',
    });
    const result = canWriteEmployee(ctx, employee);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('EMPLOYEE_NO_WRITE');
  });

  it('should deny TERMINATED user', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      employeeStatus: 'terminated',
    });
    const result = canWriteEmployee(ctx, employee);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TERMINATED_ACCESS_BLOCKED');
  });

  it('should deny RESIGNED user', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      employeeStatus: 'resigned',
    });
    const result = canWriteEmployee(ctx, employee);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('RESIGNED_READONLY');
  });
});

describe('canListRequisitions', () => {
  it('should allow HR_ADMIN to list all requisitions', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_ADMIN] });
    const result = canListRequisitions(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER with department to list requisitions', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.HR_MANAGER],
      departmentIds: ['dept-1'],
    });
    const result = canListRequisitions(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should deny TERMINATED user', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      employeeStatus: 'terminated',
    });
    const result = canListRequisitions(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TERMINATED_ACCESS_BLOCKED');
  });

  it('should deny CANDIDATE', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.CANDIDATE] });
    const result = canListRequisitions(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('CANDIDATE_NO_INTERNAL_ACCESS');
  });
});

describe('canReadRequisition', () => {
  const requisition = createRequisition({ id: 'req-1', departmentId: 'dept-1' });

  it('should allow HR_ADMIN to read any requisition', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_ADMIN] });
    const result = canReadRequisition(ctx, requisition);
    expect(result.allowed).toBe(true);
  });

  it('should allow user with matching department', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      departmentIds: ['dept-1'],
    });
    const result = canReadRequisition(ctx, requisition);
    expect(result.allowed).toBe(true);
  });

  it('should deny user with different department', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.EMPLOYEE],
      departmentIds: ['dept-2'],
    });
    const result = canReadRequisition(ctx, requisition);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('DEPARTMENT_MISMATCH');
  });
});

describe('canReadCandidate', () => {
  const candidate = createCandidate({ id: 'cand-1' });

  it('should allow HR_ADMIN to read any candidate', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_ADMIN] });
    const result = canReadCandidate(ctx, candidate);
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER to read candidates', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_MANAGER] });
    const result = canReadCandidate(ctx, candidate);
    expect(result.allowed).toBe(true);
  });

  it('should allow CANDIDATE to read (filtered at API level)', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.CANDIDATE] });
    const result = canReadCandidate(ctx, candidate);
    expect(result.allowed).toBe(true);
  });

  it('should deny EMPLOYEE reading candidates', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.EMPLOYEE] });
    const result = canReadCandidate(ctx, candidate);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('EMPLOYEE_NO_CANDIDATE_ACCESS');
  });
});

describe('canAccessPayroll', () => {
  it('should allow HR_ADMIN to access payroll', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_ADMIN] });
    const result = canAccessPayroll(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should allow CVISION_ADMIN to access payroll', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.CVISION_ADMIN] });
    const result = canAccessPayroll(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should deny HR_MANAGER', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.HR_MANAGER] });
    const result = canAccessPayroll(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('PAYROLL_ADMIN_ONLY');
  });

  it('should deny EMPLOYEE', () => {
    const ctx = createContext({ roles: [CVISION_ROLES.EMPLOYEE] });
    const result = canAccessPayroll(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('PAYROLL_ADMIN_ONLY');
  });

  it('should deny TERMINATED user', () => {
    const ctx = createContext({
      roles: [CVISION_ROLES.HR_ADMIN],
      employeeStatus: 'terminated',
    });
    const result = canAccessPayroll(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TERMINATED_ACCESS_BLOCKED');
  });
});
