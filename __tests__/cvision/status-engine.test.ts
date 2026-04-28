/**
 * CVision Employee Status Engine - Unit Tests
 * 
 * Tests for status transitions, idempotency, and role enforcement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EMPLOYEE_STATUSES,
  STATUS_TRANSITIONS,
  isTransitionAllowed,
  getAllowedTransitions,
  isTerminalStatus,
  validateTransition,
  isIdempotentTransition,
  canAccessInternalModules,
  canCreateRequests,
  canViewFinalPayslip,
  hasRestrictedPrivileges,
  getAccessLevel,
  AccessLevel,
} from '@/lib/cvision/statusMachine';
import {
  canReadEmployee,
  canWriteEmployee,
  canCreateRequest,
  canReadRequest,
  canChangeEmployeeStatus,
  PolicyContext,
  EmployeeResource,
  RequestResource,
} from '@/lib/cvision/policy';
import { CVISION_ROLES } from '@/lib/cvision/roles';

// =============================================================================
// Test Fixtures
// =============================================================================

const TENANT_A = 'tenant-a';
const DEPT_HR = 'dept-hr';

function createContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    userId: 'user-1',
    tenantId: TENANT_A,
    role: 'staff',
    cvisionRole: CVISION_ROLES.EMPLOYEE,
    departmentId: DEPT_HR,
    employeeId: 'emp-1',
    ...overrides,
  };
}

function createEmployee(overrides: Partial<EmployeeResource> = {}): EmployeeResource {
  return {
    id: 'emp-1',
    tenantId: TENANT_A,
    departmentId: DEPT_HR,
    status: EMPLOYEE_STATUSES.ACTIVE,
    ...overrides,
  };
}

function createRequest(overrides: Partial<RequestResource> = {}): RequestResource {
  return {
    id: 'req-1',
    tenantId: TENANT_A,
    employeeId: 'emp-1',
    departmentId: DEPT_HR,
    status: 'open',
    createdBy: 'user-1',
    ...overrides,
  };
}

// =============================================================================
// Status Machine Tests
// =============================================================================

describe('Status Machine', () => {
  describe('isTransitionAllowed', () => {
    it('should allow PROBATION -> ACTIVE', () => {
      expect(isTransitionAllowed(EMPLOYEE_STATUSES.PROBATION, EMPLOYEE_STATUSES.ACTIVE)).toBe(true);
    });

    it('should allow PROBATION -> TERMINATED', () => {
      expect(isTransitionAllowed(EMPLOYEE_STATUSES.PROBATION, EMPLOYEE_STATUSES.TERMINATED)).toBe(true);
    });

    it('should allow ACTIVE -> TERMINATED', () => {
      expect(isTransitionAllowed(EMPLOYEE_STATUSES.ACTIVE, EMPLOYEE_STATUSES.TERMINATED)).toBe(true);
    });

    it('should allow ACTIVE -> NOTICE_PERIOD', () => {
      expect(isTransitionAllowed(EMPLOYEE_STATUSES.ACTIVE, EMPLOYEE_STATUSES.NOTICE_PERIOD)).toBe(true);
    });

    it('should not allow ACTIVE -> PROBATION', () => {
      expect(isTransitionAllowed(EMPLOYEE_STATUSES.ACTIVE, EMPLOYEE_STATUSES.PROBATION)).toBe(false);
    });

    it('should not allow TERMINATED -> ACTIVE', () => {
      expect(isTransitionAllowed(EMPLOYEE_STATUSES.TERMINATED, EMPLOYEE_STATUSES.ACTIVE)).toBe(false);
    });

    it('should not allow RESIGNED -> ACTIVE', () => {
      expect(isTransitionAllowed(EMPLOYEE_STATUSES.RESIGNED, EMPLOYEE_STATUSES.ACTIVE)).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return correct transitions for PROBATION', () => {
      const transitions = getAllowedTransitions(EMPLOYEE_STATUSES.PROBATION);
      expect(transitions).toContain(EMPLOYEE_STATUSES.ACTIVE);
      expect(transitions).toContain(EMPLOYEE_STATUSES.TERMINATED);
      expect(transitions).toContain(EMPLOYEE_STATUSES.SUSPENDED);
    });

    it('should return correct transitions for ACTIVE', () => {
      const transitions = getAllowedTransitions(EMPLOYEE_STATUSES.ACTIVE);
      expect(transitions).toContain(EMPLOYEE_STATUSES.TERMINATED);
      expect(transitions).toContain(EMPLOYEE_STATUSES.NOTICE_PERIOD);
      expect(transitions).not.toContain(EMPLOYEE_STATUSES.PROBATION);
    });

    it('should return empty array for terminal statuses', () => {
      expect(getAllowedTransitions(EMPLOYEE_STATUSES.TERMINATED)).toEqual([]);
      expect(getAllowedTransitions(EMPLOYEE_STATUSES.RESIGNED)).toEqual([]);
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for TERMINATED', () => {
      expect(isTerminalStatus(EMPLOYEE_STATUSES.TERMINATED)).toBe(true);
    });

    it('should return true for RESIGNED', () => {
      expect(isTerminalStatus(EMPLOYEE_STATUSES.RESIGNED)).toBe(true);
    });

    it('should return false for ACTIVE', () => {
      expect(isTerminalStatus(EMPLOYEE_STATUSES.ACTIVE)).toBe(false);
    });

    it('should return false for PROBATION', () => {
      expect(isTerminalStatus(EMPLOYEE_STATUSES.PROBATION)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should allow valid transition', () => {
      const result = validateTransition(EMPLOYEE_STATUSES.PROBATION, EMPLOYEE_STATUSES.ACTIVE);
      expect(result.allowed).toBe(true);
    });

    it('should reject invalid transition', () => {
      const result = validateTransition(EMPLOYEE_STATUSES.TERMINATED, EMPLOYEE_STATUSES.ACTIVE);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });

    it('should allow same status transition (idempotent)', () => {
      const result = validateTransition(EMPLOYEE_STATUSES.ACTIVE, EMPLOYEE_STATUSES.ACTIVE);
      expect(result.allowed).toBe(true);
    });

    it('should reject future date more than 1 year', () => {
      const futureDate = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000); // ~400 days
      const result = validateTransition(EMPLOYEE_STATUSES.PROBATION, EMPLOYEE_STATUSES.ACTIVE, futureDate);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('more than 1 year');
    });

    it('should allow future date within 1 year', () => {
      const futureDate = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000); // ~100 days
      const result = validateTransition(EMPLOYEE_STATUSES.PROBATION, EMPLOYEE_STATUSES.ACTIVE, futureDate);
      expect(result.allowed).toBe(true);
    });
  });

  describe('isIdempotentTransition', () => {
    it('should return true for same status', () => {
      expect(isIdempotentTransition(
        EMPLOYEE_STATUSES.ACTIVE,
        EMPLOYEE_STATUSES.ACTIVE
      )).toBe(true);
    });

    it('should return false for different status', () => {
      expect(isIdempotentTransition(
        EMPLOYEE_STATUSES.PROBATION,
        EMPLOYEE_STATUSES.ACTIVE
      )).toBe(false);
    });

    it('should return true for same status with same effective date', () => {
      const date = new Date('2024-01-01');
      expect(isIdempotentTransition(
        EMPLOYEE_STATUSES.ACTIVE,
        EMPLOYEE_STATUSES.ACTIVE,
        date,
        date
      )).toBe(true);
    });

    it('should return true for same status with dates within 1 day', () => {
      const date1 = new Date('2024-01-01T10:00:00');
      const date2 = new Date('2024-01-01T14:00:00'); // Same day, 4 hours later
      expect(isIdempotentTransition(
        EMPLOYEE_STATUSES.ACTIVE,
        EMPLOYEE_STATUSES.ACTIVE,
        date1,
        date2
      )).toBe(true);
    });

    it('should return false for same status with dates more than 1 day apart', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-03'); // 2 days later
      expect(isIdempotentTransition(
        EMPLOYEE_STATUSES.ACTIVE,
        EMPLOYEE_STATUSES.ACTIVE,
        date1,
        date2
      )).toBe(false);
    });
  });

  describe('Access Level Functions', () => {
    it('should return FULL access for ACTIVE', () => {
      expect(getAccessLevel(EMPLOYEE_STATUSES.ACTIVE)).toBe(AccessLevel.FULL);
      expect(canAccessInternalModules(EMPLOYEE_STATUSES.ACTIVE)).toBe(true);
      expect(canCreateRequests(EMPLOYEE_STATUSES.ACTIVE)).toBe(true);
    });

    it('should return FULL access for PROBATION (same as ACTIVE)', () => {
      // PROBATION has permissions: 'FULL' in status-engine -> AccessLevel.FULL
      expect(getAccessLevel(EMPLOYEE_STATUSES.PROBATION)).toBe(AccessLevel.FULL);
      expect(hasRestrictedPrivileges(EMPLOYEE_STATUSES.PROBATION)).toBe(false);
      expect(canAccessInternalModules(EMPLOYEE_STATUSES.PROBATION)).toBe(true);
      expect(canCreateRequests(EMPLOYEE_STATUSES.PROBATION)).toBe(true);
    });

    it('should return NONE access for RESIGNED', () => {
      // RESIGNED has permissions: 'NONE' -> AccessLevel.NONE
      expect(getAccessLevel(EMPLOYEE_STATUSES.RESIGNED)).toBe(AccessLevel.NONE);
      expect(canAccessInternalModules(EMPLOYEE_STATUSES.RESIGNED)).toBe(false);
      expect(canCreateRequests(EMPLOYEE_STATUSES.RESIGNED)).toBe(false);
    });

    it('should return NONE access for TERMINATED', () => {
      expect(getAccessLevel(EMPLOYEE_STATUSES.TERMINATED)).toBe(AccessLevel.NONE);
      expect(canAccessInternalModules(EMPLOYEE_STATUSES.TERMINATED)).toBe(false);
      expect(canCreateRequests(EMPLOYEE_STATUSES.TERMINATED)).toBe(false);
    });

    it('should allow final payslip view (canViewFinalPayslip takes no args, always true)', () => {
      // canViewFinalPayslip() has no parameters and always returns true
      expect(canViewFinalPayslip()).toBe(true);
    });
  });
});

// =============================================================================
// Policy Tests with Status-Based Access
// =============================================================================

describe('Status-Based Policy Enforcement', () => {
  describe('canReadEmployee with status checks', () => {
    it('should allow HR_ADMIN to read TERMINATED employee', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
      const employee = createEmployee({ status: EMPLOYEE_STATUSES.TERMINATED });
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });

    it('should allow EMPLOYEE to read own TERMINATED record', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const employee = createEmployee({
        id: 'emp-1',
        status: EMPLOYEE_STATUSES.TERMINATED,
      });
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny EMPLOYEE reading other TERMINATED employee', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const employee = createEmployee({
        id: 'emp-2',
        status: EMPLOYEE_STATUSES.TERMINATED,
      });
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TERMINATED_EMPLOYEE_NO_ACCESS');
    });

    it('should deny EMPLOYEE reading other RESIGNED employee', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const employee = createEmployee({
        id: 'emp-2',
        status: EMPLOYEE_STATUSES.RESIGNED,
      });
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RESIGNED_EMPLOYEE_LIMITED_ACCESS');
    });
  });

  describe('canWriteEmployee with status checks', () => {
    it('should allow HR_ADMIN to write TERMINATED employee', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
      const employee = createEmployee({ status: EMPLOYEE_STATUSES.TERMINATED });
      
      const result = canWriteEmployee(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny EMPLOYEE writing TERMINATED employee', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.EMPLOYEE });
      const employee = createEmployee({ status: EMPLOYEE_STATUSES.TERMINATED });
      
      const result = canWriteEmployee(ctx, employee);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TERMINATED_EMPLOYEE_READ_ONLY');
    });

    it('should deny EMPLOYEE writing RESIGNED employee', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.EMPLOYEE });
      const employee = createEmployee({ status: EMPLOYEE_STATUSES.RESIGNED });
      
      const result = canWriteEmployee(ctx, employee);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RESIGNED_EMPLOYEE_LIMITED_WRITE');
    });
  });

  describe('canCreateRequest with status checks', () => {
    it('should allow ACTIVE employee to create request', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const request = createRequest({
        employeeId: 'emp-1',
        createdBy: 'user-1',
        employeeStatus: EMPLOYEE_STATUSES.ACTIVE,
      } as Partial<RequestResource>);
      
      const result = canCreateRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny TERMINATED employee creating regular request', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const request = createRequest({
        employeeId: 'emp-1',
        createdBy: 'user-1',
        type: 'leave',
        employeeStatus: EMPLOYEE_STATUSES.TERMINATED,
      } as Partial<RequestResource>);
      
      const result = canCreateRequest(ctx, request);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TERMINATED_EMPLOYEE_NO_REQUESTS');
    });

    it('should allow TERMINATED employee creating final payslip request', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const request = createRequest({
        employeeId: 'emp-1',
        createdBy: 'user-1',
        type: 'payroll_issue',
        employeeStatus: EMPLOYEE_STATUSES.TERMINATED,
      } as Partial<RequestResource>);
      
      const result = canCreateRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('FINAL_PAYSLIP_ALLOWED');
    });

    it('should allow RESIGNED employee creating payroll request', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const request = createRequest({
        employeeId: 'emp-1',
        createdBy: 'user-1',
        type: 'payroll_issue',
        employeeStatus: EMPLOYEE_STATUSES.RESIGNED,
      } as Partial<RequestResource>);
      
      const result = canCreateRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('RESIGNED_LIMITED_REQUESTS');
    });

    it('should deny RESIGNED employee creating leave request', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const request = createRequest({
        employeeId: 'emp-1',
        createdBy: 'user-1',
        type: 'leave',
        employeeStatus: EMPLOYEE_STATUSES.RESIGNED,
      } as Partial<RequestResource>);
      
      const result = canCreateRequest(ctx, request);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RESIGNED_EMPLOYEE_LIMITED_ACCESS');
    });

    it('should allow PROBATION employee creating requests', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const request = createRequest({
        employeeId: 'emp-1',
        createdBy: 'user-1',
        employeeStatus: EMPLOYEE_STATUSES.PROBATION,
      } as Partial<RequestResource>);
      
      const result = canCreateRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('canReadRequest with status checks', () => {
    it('should allow TERMINATED employee reading own final payslip request', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
        userId: 'user-1',
      });
      const request = createRequest({
        employeeId: 'emp-1',
        createdBy: 'user-1',
        type: 'payroll_issue',
        employeeStatus: EMPLOYEE_STATUSES.TERMINATED,
      } as Partial<RequestResource>);
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('FINAL_PAYSLIP_ALLOWED');
    });

    it('should deny TERMINATED employee reading other requests', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
        userId: 'user-1',
      });
      const request = createRequest({
        employeeId: 'emp-2',
        createdBy: 'user-2',
        type: 'leave',
        employeeStatus: EMPLOYEE_STATUSES.TERMINATED,
      } as Partial<RequestResource>);
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TERMINATED_EMPLOYEE_NO_ACCESS');
    });

    it('should allow RESIGNED employee reading own requests', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
        userId: 'user-1',
      });
      const request = createRequest({
        employeeId: 'emp-1',
        createdBy: 'user-1',
        employeeStatus: EMPLOYEE_STATUSES.RESIGNED,
      } as Partial<RequestResource>);
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny RESIGNED employee reading other requests', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
        userId: 'user-1',
      });
      const request = createRequest({
        employeeId: 'emp-2',
        createdBy: 'user-2',
        employeeStatus: EMPLOYEE_STATUSES.RESIGNED,
      } as Partial<RequestResource>);
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RESIGNED_EMPLOYEE_LIMITED_ACCESS');
    });
  });

  describe('canChangeEmployeeStatus', () => {
    it('should allow HR_ADMIN to change status', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
      const employee = createEmployee();
      
      const result = canChangeEmployeeStatus(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });

    it('should allow HR_MANAGER to change status', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
      const employee = createEmployee();
      
      const result = canChangeEmployeeStatus(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny EMPLOYEE from changing status', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.EMPLOYEE });
      const employee = createEmployee();
      
      const result = canChangeEmployeeStatus(ctx, employee);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('INSUFFICIENT_PERMISSION');
    });
  });
});

// =============================================================================
// Idempotency Tests
// =============================================================================

describe('Status Change Idempotency', () => {
  it('should handle same status transition as idempotent', () => {
    const currentStatus = EMPLOYEE_STATUSES.ACTIVE;
    const requestedStatus = EMPLOYEE_STATUSES.ACTIVE;
    
    expect(isIdempotentTransition(currentStatus, requestedStatus)).toBe(true);
  });

  it('should handle different status transition as non-idempotent', () => {
    const currentStatus = EMPLOYEE_STATUSES.PROBATION;
    const requestedStatus = EMPLOYEE_STATUSES.ACTIVE;
    
    expect(isIdempotentTransition(currentStatus, requestedStatus)).toBe(false);
  });

  it('should validate transition before checking idempotency', () => {
    const validation = validateTransition(
      EMPLOYEE_STATUSES.ACTIVE,
      EMPLOYEE_STATUSES.ACTIVE
    );
    expect(validation.allowed).toBe(true);
    
    const isIdempotent = isIdempotentTransition(
      EMPLOYEE_STATUSES.ACTIVE,
      EMPLOYEE_STATUSES.ACTIVE
    );
    expect(isIdempotent).toBe(true);
  });
});
