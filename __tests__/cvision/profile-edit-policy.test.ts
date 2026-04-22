/**
 * Unit tests for canEditProfileSection policy function
 * 
 * Tests RBAC/ABAC enforcement for profile section editing.
 */

import { describe, it, expect } from 'vitest';
import { canEditProfileSection } from '@/lib/cvision/authz/policy';
import { CVISION_ROLES } from '@/lib/cvision/roles';
import type { AuthzContext } from '@/lib/cvision/authz/types';
import type { CVisionEmployee } from '@/lib/cvision/types';

// Mock employee data
const createMockEmployee = (overrides: Partial<CVisionEmployee> = {}): CVisionEmployee => ({
  id: 'emp-123',
  tenantId: 'tenant-1',
  employeeNo: 'EMP-001',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  departmentId: 'dept-1',
  jobTitleId: 'job-1',
  status: 'active',
  statusEffectiveAt: new Date(),
  isActive: true,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'user-1',
  updatedBy: 'user-1',
  ...overrides,
});

// Mock context data
const createMockContext = (overrides: Partial<AuthzContext> = {}): AuthzContext => ({
  tenantId: 'tenant-1',
  userId: 'user-1',
  roles: [],
  departmentIds: [],
  isOwner: false,
  ...overrides,
});

describe('canEditProfileSection', () => {
  describe('CVISION_ADMIN / HR_ADMIN', () => {
    it('should allow HR_ADMIN to edit ALL sections for any employee', () => {
      const ctx = createMockContext({ roles: [CVISION_ROLES.HR_ADMIN] });
      const employee = createMockEmployee();

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'EMPLOYMENT').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'FINANCIAL').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'CONTRACT').allowed).toBe(true);
    });

    it('should allow CVISION_ADMIN to edit ALL sections for any employee', () => {
      const ctx = createMockContext({ roles: [CVISION_ROLES.CVISION_ADMIN] });
      const employee = createMockEmployee();

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'EMPLOYMENT').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'FINANCIAL').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'CONTRACT').allowed).toBe(true);
    });

    it('should allow HR_ADMIN to edit terminated employee', () => {
      const ctx = createMockContext({ roles: [CVISION_ROLES.HR_ADMIN] });
      const employee = createMockEmployee({ status: 'terminated' });

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
    });

    it('should allow HR_ADMIN to edit resigned employee', () => {
      const ctx = createMockContext({ roles: [CVISION_ROLES.HR_ADMIN] });
      const employee = createMockEmployee({ status: 'resigned' });

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
    });
  });

  describe('HR_MANAGER', () => {
    it('should allow HR_MANAGER to edit PERSONAL for employee in scoped department', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.HR_MANAGER],
        departmentIds: ['dept-1'],
      });
      const employee = createMockEmployee({ departmentId: 'dept-1' });

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
    });

    it('should allow HR_MANAGER to edit EMPLOYMENT for employee in scoped department', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.HR_MANAGER],
        departmentIds: ['dept-1'],
      });
      const employee = createMockEmployee({ departmentId: 'dept-1' });

      expect(canEditProfileSection(ctx, employee, 'EMPLOYMENT').allowed).toBe(true);
    });

    it('should allow HR_MANAGER to edit CONTRACT for employee in scoped department', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.HR_MANAGER],
        departmentIds: ['dept-1'],
      });
      const employee = createMockEmployee({ departmentId: 'dept-1' });

      expect(canEditProfileSection(ctx, employee, 'CONTRACT').allowed).toBe(true);
    });

    it('should DENY HR_MANAGER from editing FINANCIAL (SECTION_READONLY)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.HR_MANAGER],
        departmentIds: ['dept-1'],
      });
      const employee = createMockEmployee({ departmentId: 'dept-1' });

      const result = canEditProfileSection(ctx, employee, 'FINANCIAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SECTION_READONLY');
    });

    it('should DENY HR_MANAGER from editing employee outside scoped department (FORBIDDEN_SCOPE)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.HR_MANAGER],
        departmentIds: ['dept-1'],
      });
      const employee = createMockEmployee({ departmentId: 'dept-2' });

      const result = canEditProfileSection(ctx, employee, 'PERSONAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('FORBIDDEN_SCOPE');
    });

    it('should DENY HR_MANAGER without departmentIds (FORBIDDEN_SCOPE)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.HR_MANAGER],
        departmentIds: [],
      });
      const employee = createMockEmployee({ departmentId: 'dept-1' });

      const result = canEditProfileSection(ctx, employee, 'PERSONAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('FORBIDDEN_SCOPE');
    });
  });

  describe('EMPLOYEE', () => {
    it('should allow EMPLOYEE to edit own PERSONAL section', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.EMPLOYEE],
        employeeId: 'emp-123',
      });
      const employee = createMockEmployee({ id: 'emp-123' });

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
    });

    it('should allow EMPLOYEE to edit own PERSONAL using employeeNo', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.EMPLOYEE],
        employeeId: 'EMP-001',
      });
      const employee = createMockEmployee({ employeeNo: 'EMP-001' });

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
    });

    it('should DENY EMPLOYEE from editing someone else\'s PERSONAL (FORBIDDEN_EMPLOYEE)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.EMPLOYEE],
        employeeId: 'emp-123',
      });
      const employee = createMockEmployee({ id: 'emp-456' });

      const result = canEditProfileSection(ctx, employee, 'PERSONAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('FORBIDDEN_EMPLOYEE');
    });

    it('should DENY EMPLOYEE from editing EMPLOYMENT section (FORBIDDEN_SECTION)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.EMPLOYEE],
        employeeId: 'emp-123',
      });
      const employee = createMockEmployee({ id: 'emp-123' });

      const result = canEditProfileSection(ctx, employee, 'EMPLOYMENT');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('FORBIDDEN_SECTION');
    });

    it('should DENY EMPLOYEE from editing FINANCIAL section (FORBIDDEN_SECTION)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.EMPLOYEE],
        employeeId: 'emp-123',
      });
      const employee = createMockEmployee({ id: 'emp-123' });

      const result = canEditProfileSection(ctx, employee, 'FINANCIAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('FORBIDDEN_SECTION');
    });

    it('should DENY EMPLOYEE from editing CONTRACT section (FORBIDDEN_SECTION)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.EMPLOYEE],
        employeeId: 'emp-123',
      });
      const employee = createMockEmployee({ id: 'emp-123' });

      const result = canEditProfileSection(ctx, employee, 'CONTRACT');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('FORBIDDEN_SECTION');
    });
  });

  describe('Terminated/Resigned Employee Access', () => {
    it('should DENY non-HR from editing terminated employee (EMPLOYEE_STATUS_BLOCKED)', () => {
      const ctx = createMockContext({ roles: [CVISION_ROLES.EMPLOYEE] });
      const employee = createMockEmployee({ status: 'terminated' });

      const result = canEditProfileSection(ctx, employee, 'PERSONAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('EMPLOYEE_STATUS_BLOCKED');
    });

    it('should DENY non-HR from editing resigned employee (EMPLOYEE_STATUS_BLOCKED)', () => {
      const ctx = createMockContext({ roles: [CVISION_ROLES.EMPLOYEE] });
      const employee = createMockEmployee({ status: 'resigned' });

      const result = canEditProfileSection(ctx, employee, 'PERSONAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('EMPLOYEE_STATUS_BLOCKED');
    });

    it('should ALLOW HR_ADMIN to edit terminated employee', () => {
      const ctx = createMockContext({ roles: [CVISION_ROLES.HR_ADMIN] });
      const employee = createMockEmployee({ status: 'terminated' });

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
    });
  });

  describe('Terminated/Resigned User Access', () => {
    it('should DENY terminated user (TERMINATED_ACCESS_BLOCKED)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.EMPLOYEE],
        employeeStatus: 'terminated',
      });
      const employee = createMockEmployee();

      const result = canEditProfileSection(ctx, employee, 'PERSONAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TERMINATED_ACCESS_BLOCKED');
    });

    it('should DENY resigned user (RESIGNED_READONLY)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.EMPLOYEE],
        employeeStatus: 'resigned',
      });
      const employee = createMockEmployee();

      const result = canEditProfileSection(ctx, employee, 'PERSONAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RESIGNED_READONLY');
    });
  });

  describe('Tenant Isolation', () => {
    it('should DENY cross-tenant access (TENANT_MISMATCH)', () => {
      const ctx = createMockContext({ tenantId: 'tenant-1' });
      const employee = createMockEmployee({ tenantId: 'tenant-2' });

      const result = canEditProfileSection(ctx, employee, 'PERSONAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TENANT_MISMATCH');
    });
  });

  describe('OWNER Role (Tenant Super-Admin Override)', () => {
    it('should ALLOW OWNER to edit FINANCIAL section for any employee', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.OWNER],
      });
      const employee = createMockEmployee();

      expect(canEditProfileSection(ctx, employee, 'FINANCIAL').allowed).toBe(true);
    });

    it('should ALLOW OWNER to edit ALL sections for any employee', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.OWNER],
      });
      const employee = createMockEmployee();

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'EMPLOYMENT').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'FINANCIAL').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'CONTRACT').allowed).toBe(true);
    });

    it('should ALLOW OWNER to edit employee outside department scope (bypasses ABAC)', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.OWNER],
        departmentIds: ['dept-1'],
      });
      const employee = createMockEmployee({ departmentId: 'dept-2' });

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'FINANCIAL').allowed).toBe(true);
    });

    it('should ALLOW OWNER to edit terminated employee', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.OWNER],
      });
      const employee = createMockEmployee({ status: 'terminated' });

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'FINANCIAL').allowed).toBe(true);
    });

    it('should ALLOW OWNER to edit resigned employee', () => {
      const ctx = createMockContext({
        roles: [CVISION_ROLES.OWNER],
      });
      const employee = createMockEmployee({ status: 'resigned' });

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
      expect(canEditProfileSection(ctx, employee, 'FINANCIAL').allowed).toBe(true);
    });
  });

  describe('THEA_OWNER (Legacy Owner Flag)', () => {
    it('should DENY THEA_OWNER without HR role (OWNER_READ_ONLY)', () => {
      const ctx = createMockContext({
        isOwner: true,
        roles: [],
      });
      const employee = createMockEmployee();

      const result = canEditProfileSection(ctx, employee, 'PERSONAL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('OWNER_READ_ONLY');
    });

    it('should ALLOW THEA_OWNER with HR_ADMIN role', () => {
      const ctx = createMockContext({
        isOwner: true,
        roles: [CVISION_ROLES.HR_ADMIN],
      });
      const employee = createMockEmployee();

      expect(canEditProfileSection(ctx, employee, 'PERSONAL').allowed).toBe(true);
    });
  });
});
