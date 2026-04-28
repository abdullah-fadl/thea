/**
 * CVision Policy Functions - Unit Tests
 * 
 * Tests for ABAC policy functions ensuring correct access control.
 * Roles: CVISION_ADMIN, HR_ADMIN, HR_MANAGER, EMPLOYEE, CANDIDATE, AUDITOR
 */

import { describe, it, expect } from 'vitest';
import {
  canReadEmployee,
  canWriteEmployee,
  canChangeEmployeeStatus,
  canDeleteEmployee,
  canReadRequest,
  canCreateRequest,
  canApproveRequest,
  canEscalateRequest,
  canManageRecruitment,
  canReadCandidate,
  buildAccessFilter,
  buildRequestAccessFilter,
  buildCandidateAccessFilter,
  PolicyContext,
  EmployeeResource,
  RequestResource,
  CandidateResource,
} from '@/lib/cvision/policy';

import { CVISION_ROLES } from '@/lib/cvision/roles';

// =============================================================================
// Test Fixtures
// =============================================================================

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const DEPT_HR = 'dept-hr';
const DEPT_ENGINEERING = 'dept-engineering';

function createContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    userId: 'user-1',
    tenantId: TENANT_A,
    role: 'staff',
    cvisionRole: CVISION_ROLES.EMPLOYEE,
    departmentId: DEPT_ENGINEERING,
    employeeId: 'emp-1',
    ...overrides,
  };
}

function createEmployee(overrides: Partial<EmployeeResource> = {}): EmployeeResource {
  return {
    id: 'emp-2',
    tenantId: TENANT_A,
    departmentId: DEPT_ENGINEERING,
    status: 'active',
    ...overrides,
  };
}

function createRequest(overrides: Partial<RequestResource> = {}): RequestResource {
  return {
    id: 'req-1',
    tenantId: TENANT_A,
    employeeId: 'emp-2',
    departmentId: DEPT_ENGINEERING,
    status: 'submitted',
    createdBy: 'user-2',
    ...overrides,
  };
}

function createCandidate(overrides: Partial<CandidateResource> = {}): CandidateResource {
  return {
    id: 'cnd-1',
    tenantId: TENANT_A,
    requisitionId: 'req-1',
    email: 'candidate@example.com',
    ...overrides,
  };
}

// =============================================================================
// Employee Policy Tests
// =============================================================================

describe('canReadEmployee', () => {
  describe('Tenant-wide access roles', () => {
    it('should allow CVISION_ADMIN to read any employee', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.CVISION_ADMIN });
      const employee = createEmployee();
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });

    it('should allow HR_ADMIN to read any employee in tenant', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
      const employee = createEmployee();
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });

    it('should allow HR_MANAGER to read any employee in tenant', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
      const employee = createEmployee();
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });

    it('should allow AUDITOR to read any employee', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.AUDITOR });
      const employee = createEmployee();
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('Department-scoped access', () => {
    it('should allow EMPLOYEE to read employees in same department', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        departmentId: DEPT_ENGINEERING,
      });
      const employee = createEmployee({ departmentId: DEPT_ENGINEERING });
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny EMPLOYEE reading employee from different department (unless self)', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        departmentId: DEPT_ENGINEERING,
        employeeId: 'emp-1',
      });
      const employee = createEmployee({ id: 'emp-2', departmentId: DEPT_HR });
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(false);
    });

    it('should allow EMPLOYEE to read their own record', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        employeeId: 'emp-1',
      });
      const employee = createEmployee({ id: 'emp-1' });
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('Candidate role', () => {
    it('should deny CANDIDATE from reading employee records', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.CANDIDATE });
      const employee = createEmployee();
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CANDIDATE_NO_ACCESS');
    });
  });

  describe('Tenant isolation', () => {
    it('should deny reading employee from different tenant', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
      const employee = createEmployee({ tenantId: TENANT_B });
      
      const result = canReadEmployee(ctx, employee);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TENANT_MISMATCH');
    });
  });
});

describe('canWriteEmployee', () => {
  it('should allow HR_ADMIN to write any employee', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
    const employee = createEmployee();
    
    const result = canWriteEmployee(ctx, employee);
    
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER to write employees', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
    const employee = createEmployee();
    
    const result = canWriteEmployee(ctx, employee);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny EMPLOYEE from writing employees', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.EMPLOYEE });
    const employee = createEmployee();
    
    const result = canWriteEmployee(ctx, employee);
    
    expect(result.allowed).toBe(false);
  });

  it('should deny CANDIDATE from writing employees', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.CANDIDATE });
    const employee = createEmployee();
    
    const result = canWriteEmployee(ctx, employee);
    
    expect(result.allowed).toBe(false);
  });

  it('should deny AUDITOR from writing employees', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.AUDITOR });
    const employee = createEmployee();
    
    const result = canWriteEmployee(ctx, employee);
    
    expect(result.allowed).toBe(false);
  });
});

describe('canDeleteEmployee', () => {
  it('should allow CVISION_ADMIN to delete employees', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.CVISION_ADMIN });
    const employee = createEmployee();
    
    const result = canDeleteEmployee(ctx, employee);
    
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_ADMIN to delete employees', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
    const employee = createEmployee();
    
    const result = canDeleteEmployee(ctx, employee);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny HR_MANAGER from deleting employees', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
    const employee = createEmployee();
    
    const result = canDeleteEmployee(ctx, employee);
    
    expect(result.allowed).toBe(false);
  });
});

// =============================================================================
// Request Policy Tests
// =============================================================================

describe('canReadRequest', () => {
  describe('Tenant-wide access', () => {
    it('should allow HR_ADMIN to read all requests', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
      const request = createRequest();
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
    });

    it('should allow HR_MANAGER to read all requests', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
      const request = createRequest();
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('Department-scoped access with confidentiality', () => {
    it('should allow EMPLOYEE to read normal confidentiality requests in their department', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        departmentId: DEPT_ENGINEERING,
      });
      const request = createRequest({
        departmentId: DEPT_ENGINEERING,
        confidentiality: 'normal',
      } as Partial<RequestResource>);
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny EMPLOYEE from reading confidential requests in their department', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        departmentId: DEPT_ENGINEERING,
        employeeId: 'emp-1',
      });
      const request = createRequest({
        departmentId: DEPT_ENGINEERING,
        confidentiality: 'confidential',
        employeeId: 'emp-2',
        createdBy: 'user-2',
      } as Partial<RequestResource>);
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CONFIDENTIAL_REQUEST');
    });

    it('should allow EMPLOYEE to read their own requests', () => {
      const ctx = createContext({
        cvisionRole: CVISION_ROLES.EMPLOYEE,
        userId: 'user-1',
        employeeId: 'emp-1',
      });
      const request = createRequest({
        employeeId: 'emp-1',
        createdBy: 'user-1',
      });
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('Candidate access', () => {
    it('should deny CANDIDATE from reading requests', () => {
      const ctx = createContext({ cvisionRole: CVISION_ROLES.CANDIDATE });
      const request = createRequest();
      
      const result = canReadRequest(ctx, request);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CANDIDATE_NO_ACCESS');
    });
  });
});

describe('canCreateRequest', () => {
  it('should allow HR_ADMIN to create request for anyone', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
    const request = createRequest();
    
    const result = canCreateRequest(ctx, request);
    
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER to create request for anyone', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
    const request = createRequest();
    
    const result = canCreateRequest(ctx, request);
    
    expect(result.allowed).toBe(true);
  });

  it('should allow EMPLOYEE to create their own request', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.EMPLOYEE,
      userId: 'user-1',
      employeeId: 'emp-1',
    });
    const request = createRequest({
      employeeId: 'emp-1',
      createdBy: 'user-1',
    });
    
    const result = canCreateRequest(ctx, request);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny EMPLOYEE creating request for others', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.EMPLOYEE,
      userId: 'user-1',
      employeeId: 'emp-1',
    });
    const request = createRequest({
      employeeId: 'emp-2',
      createdBy: 'user-2',
    });
    
    const result = canCreateRequest(ctx, request);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('SELF_ONLY');
  });

  it('should deny AUDITOR from creating requests', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.AUDITOR });
    const request = createRequest();
    
    const result = canCreateRequest(ctx, request);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('AUDITOR_READ_ONLY');
  });

  it('should deny CANDIDATE from creating requests', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.CANDIDATE });
    const request = createRequest();
    
    const result = canCreateRequest(ctx, request);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('CANDIDATE_NO_ACCESS');
  });
});

describe('canApproveRequest', () => {
  it('should allow HR_ADMIN to approve any request', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.HR_ADMIN,
      userId: 'user-hr',
    });
    const request = createRequest({ createdBy: 'user-1' });
    
    const result = canApproveRequest(ctx, request);
    
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER to approve any request', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.HR_MANAGER,
      userId: 'user-hr',
    });
    const request = createRequest({ createdBy: 'user-1' });
    
    const result = canApproveRequest(ctx, request);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny approving own request (conflict of interest)', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.HR_ADMIN,
      userId: 'user-1',
    });
    const request = createRequest({ createdBy: 'user-1' });
    
    const result = canApproveRequest(ctx, request);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('CANNOT_APPROVE_OWN_REQUEST');
  });

  it('should deny EMPLOYEE from approving requests', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.EMPLOYEE });
    const request = createRequest();
    
    const result = canApproveRequest(ctx, request);
    
    expect(result.allowed).toBe(false);
  });
});

describe('canEscalateRequest', () => {
  it('should allow HR_MANAGER to escalate any request', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
    const request = createRequest();
    
    const result = canEscalateRequest(ctx, request);
    
    expect(result.allowed).toBe(true);
  });

  it('should allow EMPLOYEE to escalate their own rejected request', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.EMPLOYEE,
      userId: 'user-1',
      employeeId: 'emp-1',
    });
    const request = createRequest({
      employeeId: 'emp-1',
      createdBy: 'user-1',
      status: 'rejected',
    });
    
    const result = canEscalateRequest(ctx, request);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny EMPLOYEE escalating non-rejected request', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.EMPLOYEE,
      userId: 'user-1',
      employeeId: 'emp-1',
    });
    const request = createRequest({
      employeeId: 'emp-1',
      createdBy: 'user-1',
      status: 'submitted',
    });
    
    const result = canEscalateRequest(ctx, request);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('CAN_ONLY_ESCALATE_REJECTED');
  });

  it('should deny CANDIDATE from escalating requests', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.CANDIDATE });
    const request = createRequest();
    
    const result = canEscalateRequest(ctx, request);
    
    expect(result.allowed).toBe(false);
  });
});

// =============================================================================
// Candidate Policy Tests
// =============================================================================

describe('canReadCandidate', () => {
  it('should allow HR_ADMIN to read any candidate', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
    const candidate = createCandidate();
    
    const result = canReadCandidate(ctx, candidate);
    
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER to read any candidate', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
    const candidate = createCandidate();
    
    const result = canReadCandidate(ctx, candidate);
    
    expect(result.allowed).toBe(true);
  });

  it('should allow CANDIDATE to read their own application', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.CANDIDATE,
      userId: 'user-candidate',
    });
    const candidate = createCandidate({ userId: 'user-candidate' });
    
    const result = canReadCandidate(ctx, candidate);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny CANDIDATE from reading other applications', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.CANDIDATE,
      userId: 'user-candidate-1',
    });
    const candidate = createCandidate({ userId: 'user-candidate-2' });
    
    const result = canReadCandidate(ctx, candidate);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('CAN_ONLY_VIEW_OWN_APPLICATION');
  });

  it('should deny EMPLOYEE from reading candidates (no recruitment permission)', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.EMPLOYEE });
    const candidate = createCandidate();
    
    const result = canReadCandidate(ctx, candidate);
    
    expect(result.allowed).toBe(false);
  });
});

// =============================================================================
// Recruitment Policy Tests
// =============================================================================

describe('canManageRecruitment', () => {
  it('should allow HR_ADMIN to manage recruitment', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
    
    const result = canManageRecruitment(ctx);
    
    expect(result.allowed).toBe(true);
  });

  it('should allow HR_MANAGER to manage recruitment', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
    
    const result = canManageRecruitment(ctx);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny EMPLOYEE from managing recruitment', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.EMPLOYEE });
    
    const result = canManageRecruitment(ctx);
    
    expect(result.allowed).toBe(false);
  });

  it('should deny CANDIDATE from managing recruitment', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.CANDIDATE });
    
    const result = canManageRecruitment(ctx);
    
    expect(result.allowed).toBe(false);
  });
});

// =============================================================================
// Access Filter Tests
// =============================================================================

describe('buildAccessFilter', () => {
  it('should return null for HR_ADMIN (tenant-wide access)', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_ADMIN });
    
    const filter = buildAccessFilter(ctx);
    
    expect(filter).toBeNull();
  });

  it('should return null for HR_MANAGER (tenant-wide access)', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
    
    const filter = buildAccessFilter(ctx);
    
    expect(filter).toBeNull();
  });

  it('should return department + self filter for EMPLOYEE', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.EMPLOYEE,
      departmentId: DEPT_ENGINEERING,
      employeeId: 'emp-1',
      userId: 'user-1',
    });
    
    const filter = buildAccessFilter(ctx);
    
    expect(filter).toHaveProperty('$or');
    expect(filter?.$or).toContainEqual({ departmentId: DEPT_ENGINEERING });
    expect(filter?.$or).toContainEqual({ id: 'emp-1' });
    expect(filter?.$or).toContainEqual({ employeeId: 'emp-1' });
    expect(filter?.$or).toContainEqual({ createdBy: 'user-1' });
  });

  it('should return self-only filter for CANDIDATE', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.CANDIDATE,
      userId: 'user-candidate',
    });
    
    const filter = buildAccessFilter(ctx);
    
    expect(filter).toHaveProperty('$or');
    expect(filter?.$or).toContainEqual({ userId: 'user-candidate' });
    expect(filter?.$or).toContainEqual({ createdBy: 'user-candidate' });
  });
});

describe('buildRequestAccessFilter', () => {
  it('should return null for HR_MANAGER (can see all requests)', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
    
    const filter = buildRequestAccessFilter(ctx);
    
    expect(filter).toBeNull();
  });

  it('should return _impossible filter for CANDIDATE', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.CANDIDATE });
    
    const filter = buildRequestAccessFilter(ctx);
    
    expect(filter).toEqual({ _impossible: true });
  });

  it('should include confidentiality filter for EMPLOYEE in department', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.EMPLOYEE,
      departmentId: DEPT_ENGINEERING,
      employeeId: 'emp-1',
      userId: 'user-1',
    });
    
    const filter = buildRequestAccessFilter(ctx);
    
    expect(filter).toHaveProperty('$or');
    expect(filter?.$or).toContainEqual({ createdBy: 'user-1' });
    expect(filter?.$or).toContainEqual({ employeeId: 'emp-1' });
    expect(filter?.$or).toContainEqual({
      departmentId: DEPT_ENGINEERING,
      confidentiality: { $in: ['normal', null] },
    });
  });
});

describe('buildCandidateAccessFilter', () => {
  it('should return null for HR_MANAGER', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.HR_MANAGER });
    
    const filter = buildCandidateAccessFilter(ctx);
    
    expect(filter).toBeNull();
  });

  it('should return userId filter for CANDIDATE', () => {
    const ctx = createContext({
      cvisionRole: CVISION_ROLES.CANDIDATE,
      userId: 'user-candidate',
    });
    
    const filter = buildCandidateAccessFilter(ctx);
    
    expect(filter).toEqual({ userId: 'user-candidate' });
  });

  it('should return _impossible filter for EMPLOYEE (no recruitment permission)', () => {
    const ctx = createContext({ cvisionRole: CVISION_ROLES.EMPLOYEE });
    
    const filter = buildCandidateAccessFilter(ctx);
    
    expect(filter).toEqual({ _impossible: true });
  });
});
