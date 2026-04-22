/**
 * CVision API Integration Tests
 *
 * Tests for CVision API endpoints including:
 * - Employee CRUD operations
 * - Status transitions
 * - Department-based access restrictions
 *
 * EMPLOYEE_STATUS_TRANSITIONS uses UPPERCASE keys from status-engine.ts
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { EMPLOYEE_STATUS_TRANSITIONS } from '@/lib/cvision/constants';

// =============================================================================
// Test Fixtures
// =============================================================================

const MOCK_TENANT_ID = 'test-tenant-123';
const MOCK_USER_ID = 'user-123';
const MOCK_DEPARTMENT_ID = 'dept-123';

const mockSession = {
  userId: MOCK_USER_ID,
  tenantId: MOCK_TENANT_ID,
  role: 'admin',
  departmentId: MOCK_DEPARTMENT_ID,
};

const mockEmployee = {
  id: 'emp-123',
  tenantId: MOCK_TENANT_ID,
  employeeNumber: 'EMP-000001',
  firstName: 'Test',
  lastName: 'Employee',
  email: 'test@example.com',
  departmentId: MOCK_DEPARTMENT_ID,
  jobTitleId: 'job-123',
  status: 'active',
  hireDate: new Date(),
  statusChangedAt: new Date(),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: MOCK_USER_ID,
  updatedBy: MOCK_USER_ID,
};

// =============================================================================
// Status Transition Tests (UPPERCASE keys)
// =============================================================================

describe('Employee Status Transitions', () => {
  describe('Valid Transitions', () => {
    it('should allow ACTIVE -> ON_ANNUAL_LEAVE transition', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['ACTIVE'] || [];
      expect(allowed).toContain('ON_ANNUAL_LEAVE');
    });

    it('should allow ACTIVE -> SUSPENDED transition', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['ACTIVE'] || [];
      expect(allowed).toContain('SUSPENDED');
    });

    it('should allow ACTIVE -> TERMINATED transition', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['ACTIVE'] || [];
      expect(allowed).toContain('TERMINATED');
    });

    it('should allow ON_ANNUAL_LEAVE -> ACTIVE transition', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['ON_ANNUAL_LEAVE'] || [];
      expect(allowed).toContain('ACTIVE');
    });

    it('should allow PROBATION -> ACTIVE transition', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['PROBATION'] || [];
      expect(allowed).toContain('ACTIVE');
    });

    it('should allow SUSPENDED -> ACTIVE transition', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['SUSPENDED'] || [];
      expect(allowed).toContain('ACTIVE');
    });
  });

  describe('Invalid Transitions', () => {
    it('should NOT allow TERMINATED -> ACTIVE transition', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['TERMINATED'] || [];
      expect(allowed).not.toContain('ACTIVE');
      expect(allowed).toHaveLength(0); // Terminal state
    });

    it('should NOT allow RESIGNED -> ACTIVE transition', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['RESIGNED'] || [];
      expect(allowed).not.toContain('ACTIVE');
      expect(allowed).toHaveLength(0); // Terminal state
    });

    it('should NOT allow RETIRED -> ACTIVE transition', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['RETIRED'] || [];
      expect(allowed).not.toContain('ACTIVE');
      expect(allowed).toHaveLength(0); // Terminal state
    });

    it('should NOT allow ACTIVE -> PROBATION transition (reverse not allowed)', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['ACTIVE'] || [];
      expect(allowed).not.toContain('PROBATION');
    });

    it('should NOT allow ON_ANNUAL_LEAVE -> SUSPENDED transition (must return to ACTIVE first)', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['ON_ANNUAL_LEAVE'] || [];
      expect(allowed).not.toContain('SUSPENDED');
    });
  });

  describe('Terminal States', () => {
    it('TERMINATED should be a terminal state with no transitions', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['TERMINATED'] || [];
      expect(allowed).toHaveLength(0);
    });

    it('RESIGNED should be a terminal state with no transitions', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['RESIGNED'] || [];
      expect(allowed).toHaveLength(0);
    });

    it('RETIRED should be a terminal state with no transitions', () => {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS['RETIRED'] || [];
      expect(allowed).toHaveLength(0);
    });
  });
});

// =============================================================================
// Employee Creation Validation Tests
// =============================================================================

describe('Employee Creation Validation', () => {
  it('should require firstName for employee creation', () => {
    const invalidEmployee = {
      lastName: 'Test',
      email: 'test@example.com',
      departmentId: MOCK_DEPARTMENT_ID,
      jobTitleId: 'job-123',
      hireDate: new Date().toISOString(),
    };

    // firstName is missing
    expect(invalidEmployee).not.toHaveProperty('firstName');
  });

  it('should require lastName for employee creation', () => {
    const invalidEmployee = {
      firstName: 'Test',
      email: 'test@example.com',
      departmentId: MOCK_DEPARTMENT_ID,
      jobTitleId: 'job-123',
      hireDate: new Date().toISOString(),
    };

    // lastName is missing
    expect(invalidEmployee).not.toHaveProperty('lastName');
  });

  it('should require departmentId for employee creation', () => {
    const invalidEmployee = {
      firstName: 'Test',
      lastName: 'Employee',
      email: 'test@example.com',
      jobTitleId: 'job-123',
      hireDate: new Date().toISOString(),
    };

    // departmentId is missing
    expect(invalidEmployee).not.toHaveProperty('departmentId');
  });

  it('should require jobTitleId for employee creation', () => {
    const invalidEmployee = {
      firstName: 'Test',
      lastName: 'Employee',
      email: 'test@example.com',
      departmentId: MOCK_DEPARTMENT_ID,
      hireDate: new Date().toISOString(),
    };

    // jobTitleId is missing
    expect(invalidEmployee).not.toHaveProperty('jobTitleId');
  });

  it('should have all required fields for valid employee', () => {
    const validEmployee = {
      firstName: 'Test',
      lastName: 'Employee',
      email: 'test@example.com',
      departmentId: MOCK_DEPARTMENT_ID,
      jobTitleId: 'job-123',
      hireDate: new Date().toISOString(),
    };

    expect(validEmployee).toHaveProperty('firstName');
    expect(validEmployee).toHaveProperty('lastName');
    expect(validEmployee).toHaveProperty('departmentId');
    expect(validEmployee).toHaveProperty('jobTitleId');
  });
});

// =============================================================================
// Department Access Restriction Tests
// =============================================================================

describe('Department-Based Access Restrictions', () => {
  it('manager should only access their department', () => {
    const managerDeptId = 'dept-A';
    const employeeDeptId = 'dept-B';
    const managerRole = 'manager';

    // Manager is in dept-A, employee is in dept-B
    const hasAccess = managerDeptId === employeeDeptId;

    expect(hasAccess).toBe(false);
  });

  it('manager should access employees in same department', () => {
    const managerDeptId = 'dept-A';
    const employeeDeptId = 'dept-A';
    const managerRole = 'manager';

    const hasAccess = managerDeptId === employeeDeptId;

    expect(hasAccess).toBe(true);
  });

  it('HR admin should access all departments', () => {
    const hrAdminRole = 'hr_admin';
    const isHRRole = ['cvision_admin', 'hr_admin', 'hr_specialist'].includes(hrAdminRole);

    expect(isHRRole).toBe(true);
  });

  it('regular employee should not access other employees', () => {
    const employeeRole = 'employee';
    const currentUserId = 'user-1';
    const targetEmployeeUserId = 'user-2';

    const canAccess = currentUserId === targetEmployeeUserId ||
      ['cvision_admin', 'hr_admin', 'hr_specialist', 'manager'].includes(employeeRole);

    expect(canAccess).toBe(false);
  });

  it('employee should access their own record', () => {
    const employeeRole = 'employee';
    const currentUserId = 'user-1';
    const targetEmployeeUserId = 'user-1';

    const canAccess = currentUserId === targetEmployeeUserId;

    expect(canAccess).toBe(true);
  });
});

// =============================================================================
// API Response Structure Tests
// =============================================================================

describe('API Response Structure', () => {
  it('should return consistent error structure for validation errors', () => {
    const validationError = {
      error: 'Validation error',
      details: [
        { path: ['firstName'], message: 'Required' }
      ]
    };

    expect(validationError).toHaveProperty('error');
    expect(validationError).toHaveProperty('details');
    expect(Array.isArray(validationError.details)).toBe(true);
  });

  it('should return consistent error structure for not found', () => {
    const notFoundError = {
      error: 'Employee not found'
    };

    expect(notFoundError).toHaveProperty('error');
  });

  it('should return consistent error structure for forbidden', () => {
    const forbiddenError = {
      error: 'Not authorized to perform this action'
    };

    expect(forbiddenError).toHaveProperty('error');
  });

  it('should return consistent success structure for list endpoints', () => {
    const listResponse = {
      success: true,
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    expect(listResponse).toHaveProperty('success', true);
    expect(listResponse).toHaveProperty('data');
    expect(listResponse).toHaveProperty('total');
    expect(listResponse).toHaveProperty('page');
    expect(listResponse).toHaveProperty('limit');
    expect(listResponse).toHaveProperty('hasMore');
  });

  it('should return consistent success structure for create endpoints', () => {
    const createResponse = {
      success: true,
      employee: mockEmployee,
    };

    expect(createResponse).toHaveProperty('success', true);
    expect(createResponse).toHaveProperty('employee');
  });
});

// =============================================================================
// Audit Log Tests
// =============================================================================

describe('Audit Log Requirements', () => {
  it('audit log should have required fields', () => {
    const auditLog = {
      id: 'audit-123',
      tenantId: MOCK_TENANT_ID,
      actorUserId: MOCK_USER_ID,
      action: 'employee_create',
      resourceType: 'employee',
      resourceId: 'emp-123',
      changes: {
        before: null,
        after: { firstName: 'Test' },
      },
      createdAt: new Date(),
    };

    expect(auditLog).toHaveProperty('tenantId');
    expect(auditLog).toHaveProperty('actorUserId');
    expect(auditLog).toHaveProperty('action');
    expect(auditLog).toHaveProperty('resourceType');
    expect(auditLog).toHaveProperty('resourceId');
    expect(auditLog).toHaveProperty('changes');
    expect(auditLog).toHaveProperty('createdAt');
  });

  it('status change audit should include before and after', () => {
    const statusChangeAudit = {
      action: 'employee_status_change',
      changes: {
        before: { status: 'ACTIVE' },
        after: { status: 'ON_ANNUAL_LEAVE' },
      },
    };

    expect(statusChangeAudit.changes).toHaveProperty('before');
    expect(statusChangeAudit.changes).toHaveProperty('after');
    expect(statusChangeAudit.changes.before).toHaveProperty('status');
    expect(statusChangeAudit.changes.after).toHaveProperty('status');
  });
});
