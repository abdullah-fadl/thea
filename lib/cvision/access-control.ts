/**
 * CVision Access Control & Roles Engine
 *
 * Handles:
 *  - Role CRUD with granular permissions (page, module, data-scope, field)
 *  - User-role assignment (multi-role)
 *  - Delegation management
 *  - Audit logging
 *  - Approval authority matrix
 *  - Permission checking middleware
 */

import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Types ───────────────────────────────────────────────────────────────

export interface Role {
  _id?: string;
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string;
  isSystem: boolean;
  pagePermissions: Record<string, 'NONE' | 'VIEW' | 'EDIT' | 'FULL'>;
  modulePermissions: Record<string, string[]>; // module -> actions[]
  dataScope: 'ALL' | 'DEPARTMENT' | 'TEAM' | 'SELF';
  restrictedFields: string[];
  approvalAuthority: ApprovalAuthority;
  specialPermissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalAuthority {
  canApprove: string[];      // request types
  maxApprovalAmount: number;
  requiresCounterSign: boolean;
}

export interface UserRole {
  _id?: string;
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  roleIds: string[];
  primaryRoleId: string;
  departmentScope?: string[];
  effectiveFrom: Date;
  effectiveTo?: Date;
  assignedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Delegation {
  _id?: string;
  id: string;
  tenantId: string;
  delegatorId: string;
  delegatorName: string;
  delegateId: string;
  delegateName: string;
  permissions: string[];
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  createdAt: Date;
}

export interface AuditLogEntry {
  _id?: string;
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  resourceType: string;
  resourceId: string;
  details: string;
  ipAddress?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: Date;
}

// ── Constants ───────────────────────────────────────────────────────────

const APPROVAL_TYPES = [
  'LEAVE', 'LOAN', 'EXPENSE', 'TRAVEL', 'INSURANCE_UPGRADE', 'SALARY_CHANGE',
] as const;

const DEFAULT_ROLES: Omit<Role, '_id' | 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Super Admin', code: 'SUPER_ADMIN', description: 'Full system access', isSystem: true,
    pagePermissions: {}, modulePermissions: {}, dataScope: 'ALL', restrictedFields: [],
    approvalAuthority: { canApprove: [...APPROVAL_TYPES], maxApprovalAmount: 999999, requiresCounterSign: false },
    specialPermissions: ['MANAGE_ROLES', 'VIEW_AUDIT', 'BULK_OPERATIONS', 'DATA_EXPORT'],
  },
  {
    name: 'HR Manager', code: 'HR_MANAGER', description: 'Full HR operations', isSystem: true,
    pagePermissions: {}, modulePermissions: {}, dataScope: 'ALL', restrictedFields: [],
    approvalAuthority: { canApprove: ['LEAVE', 'LOAN', 'TRAVEL', 'INSURANCE_UPGRADE'], maxApprovalAmount: 50000, requiresCounterSign: false },
    specialPermissions: ['VIEW_AUDIT', 'BULK_OPERATIONS'],
  },
  {
    name: 'HR Officer', code: 'HR_OFFICER', description: 'Day-to-day HR tasks', isSystem: true,
    pagePermissions: {}, modulePermissions: {}, dataScope: 'ALL', restrictedFields: ['salary', 'bankAccount'],
    approvalAuthority: { canApprove: ['LEAVE'], maxApprovalAmount: 0, requiresCounterSign: true },
    specialPermissions: [],
  },
  {
    name: 'Department Manager', code: 'DEPT_MANAGER', description: 'Department-level access', isSystem: true,
    pagePermissions: {}, modulePermissions: {}, dataScope: 'DEPARTMENT', restrictedFields: ['salary', 'bankAccount', 'iqama'],
    approvalAuthority: { canApprove: ['LEAVE', 'EXPENSE', 'TRAVEL'], maxApprovalAmount: 5000, requiresCounterSign: false },
    specialPermissions: [],
  },
  {
    name: 'Team Leader', code: 'TEAM_LEADER', description: 'Team-level access', isSystem: true,
    pagePermissions: {}, modulePermissions: {}, dataScope: 'TEAM', restrictedFields: ['salary', 'bankAccount', 'iqama', 'passport'],
    approvalAuthority: { canApprove: ['LEAVE', 'EXPENSE'], maxApprovalAmount: 500, requiresCounterSign: false },
    specialPermissions: [],
  },
  {
    name: 'Employee', code: 'EMPLOYEE', description: 'Self-service access', isSystem: true,
    pagePermissions: {}, modulePermissions: {}, dataScope: 'SELF', restrictedFields: [],
    approvalAuthority: { canApprove: [], maxApprovalAmount: 0, requiresCounterSign: false },
    specialPermissions: [],
  },
  {
    name: 'Finance', code: 'FINANCE', description: 'Finance operations', isSystem: true,
    pagePermissions: {}, modulePermissions: {}, dataScope: 'ALL', restrictedFields: ['passport', 'iqama'],
    approvalAuthority: { canApprove: ['LOAN', 'EXPENSE', 'SALARY_CHANGE'], maxApprovalAmount: 100000, requiresCounterSign: false },
    specialPermissions: ['DATA_EXPORT'],
  },
  {
    name: 'Receptionist', code: 'RECEPTIONIST', description: 'Front desk access', isSystem: true,
    pagePermissions: {}, modulePermissions: {}, dataScope: 'ALL',
    restrictedFields: ['salary', 'bankAccount', 'iqama', 'passport', 'performanceRating'],
    approvalAuthority: { canApprove: [], maxApprovalAmount: 0, requiresCounterSign: false },
    specialPermissions: [],
  },
];

// ── Role CRUD ────────────────────────────────────────────────────────────

export async function createRole(db: Db, tenantId: string, data: any): Promise<{ id: string }> {
  const now = new Date();
  const id = uuidv4();
  const doc: Omit<Role, '_id'> = {
    id, tenantId,
    name: data.name,
    code: data.code,
    description: data.description || '',
    isSystem: false,
    pagePermissions: data.pagePermissions || {},
    modulePermissions: data.modulePermissions || {},
    dataScope: data.dataScope || 'SELF',
    restrictedFields: data.restrictedFields || [],
    approvalAuthority: data.approvalAuthority || { canApprove: [], maxApprovalAmount: 0, requiresCounterSign: false },
    specialPermissions: data.specialPermissions || [],
    createdAt: now, updatedAt: now,
  };
  await db.collection('cvision_roles').insertOne(doc);
  return { id };
}

export async function updateRole(db: Db, tenantId: string, roleId: string, data: any): Promise<{ success: boolean }> {
  const now = new Date();
  const updates: any = { updatedAt: now };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.pagePermissions !== undefined) updates.pagePermissions = data.pagePermissions;
  if (data.modulePermissions !== undefined) updates.modulePermissions = data.modulePermissions;
  if (data.dataScope !== undefined) updates.dataScope = data.dataScope;
  if (data.restrictedFields !== undefined) updates.restrictedFields = data.restrictedFields;
  if (data.approvalAuthority !== undefined) updates.approvalAuthority = data.approvalAuthority;
  if (data.specialPermissions !== undefined) updates.specialPermissions = data.specialPermissions;

  await db.collection('cvision_roles').updateOne(
    { tenantId, $or: [{ id: roleId }, { code: roleId }], isSystem: false },
    { $set: updates },
  );
  return { success: true };
}

export async function deleteRole(db: Db, tenantId: string, roleId: string): Promise<{ success: boolean }> {
  await db.collection('cvision_roles').deleteOne({ tenantId, $or: [{ id: roleId }, { code: roleId }], isSystem: false });
  return { success: true };
}

// ── User-Role Assignment ────────────────────────────────────────────────

export async function assignRole(
  db: Db, tenantId: string, userId: string, userName: string, roleIds: string[], assignedBy: string,
): Promise<{ success: boolean; id?: string }> {
  const now = new Date();
  const existing = await db.collection('cvision_user_roles').findOne({ tenantId, userId });

  if (existing) {
    const merged = [...new Set([...(existing.roleIds || []), ...roleIds])];
    await db.collection('cvision_user_roles').updateOne(
      { _id: existing._id, tenantId },
      { $set: { roleIds: merged, primaryRoleId: merged[0], assignedBy, updatedAt: now } },
    );
    return { success: true, id: existing.id };
  }

  const id = uuidv4();
  const doc: Omit<UserRole, '_id'> = {
    id, tenantId, userId, userName,
    roleIds,
    primaryRoleId: roleIds[0],
    effectiveFrom: now,
    assignedBy,
    createdAt: now, updatedAt: now,
  };
  await db.collection('cvision_user_roles').insertOne(doc);
  return { success: true, id };
}

export async function removeRole(
  db: Db, tenantId: string, userId: string, roleId: string,
): Promise<{ success: boolean }> {
  const existing = await db.collection('cvision_user_roles').findOne({ tenantId, userId });
  if (!existing) return { success: false };

  const updated = (existing.roleIds || []).filter((r: string) => r !== roleId);
  if (updated.length === 0) {
    await db.collection('cvision_user_roles').deleteOne({ _id: existing._id, tenantId });
  } else {
    await db.collection('cvision_user_roles').updateOne(
      { _id: existing._id, tenantId },
      { $set: { roleIds: updated, primaryRoleId: updated[0], updatedAt: new Date() } },
    );
  }
  return { success: true };
}

export async function bulkAssign(
  db: Db, tenantId: string, userIds: string[], roleId: string, assignedBy: string,
): Promise<{ assigned: number }> {
  let assigned = 0;
  for (const uid of userIds) {
    const r = await assignRole(db, tenantId, uid, '', [roleId], assignedBy);
    if (r.success) assigned++;
  }
  return { assigned };
}

// ── Delegations ─────────────────────────────────────────────────────────

export async function setDelegation(db: Db, tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  const now = new Date();
  const startDate = new Date(data.startDate);
  const doc: Omit<Delegation, '_id'> = {
    id, tenantId,
    delegatorId: data.delegatorId,
    delegatorName: data.delegatorName,
    delegateId: data.delegateId,
    delegateName: data.delegateName,
    permissions: data.permissions || [],
    startDate,
    endDate: new Date(data.endDate),
    reason: data.reason || '',
    status: startDate > now ? 'PENDING' : 'ACTIVE',
    createdAt: now,
  };
  await db.collection('cvision_delegations').insertOne(doc);
  return { id };
}

export async function cancelDelegation(db: Db, tenantId: string, delegationId: string): Promise<{ success: boolean }> {
  await db.collection('cvision_delegations').updateOne(
    { tenantId, id: delegationId },
    { $set: { status: 'CANCELLED' } },
  );
  return { success: true };
}

// ── Permission Checking ─────────────────────────────────────────────────

export async function checkPermission(
  db: Db, tenantId: string, userId: string, module: string, action: string,
): Promise<{ allowed: boolean; dataScope: string; restrictedFields: string[] }> {
  const userRole = await db.collection('cvision_user_roles').findOne({ tenantId, userId });
  if (!userRole) return { allowed: false, dataScope: 'SELF', restrictedFields: [] };

  const roles = await db.collection('cvision_roles').find({
    tenantId, $or: [
      { id: { $in: userRole.roleIds || [] } },
      { code: { $in: userRole.roleIds || [] } },
    ],
  }).toArray();

  if (roles.length === 0) return { allowed: false, dataScope: 'SELF', restrictedFields: [] };

  // Merge permissions from all roles (most permissive wins)
  let allowed = false;
  let bestScope = 'SELF';
  const allRestricted = new Set<string>();
  const scopeOrder = ['ALL', 'DEPARTMENT', 'TEAM', 'SELF'];

  for (const role of roles) {
    // Check special permissions first (Super Admin has all)
    if ((role.specialPermissions || []).includes('MANAGE_ROLES') && module === 'ACCESS_CONTROL') {
      allowed = true;
    }

    // Check module permissions
    const modulePerms = role.modulePermissions?.[module] || [];
    if (modulePerms.includes(action) || modulePerms.includes('FULL')) {
      allowed = true;
    }

    // If role is SUPER_ADMIN code, grant everything
    if (role.code === 'SUPER_ADMIN') {
      return { allowed: true, dataScope: 'ALL', restrictedFields: [] };
    }

    // Best data scope
    const currentIdx = scopeOrder.indexOf(role.dataScope || 'SELF');
    const bestIdx = scopeOrder.indexOf(bestScope);
    if (currentIdx < bestIdx) bestScope = role.dataScope;

    // Collect restricted fields (union across roles — most restrictive wins)
    (role.restrictedFields || []).forEach((f: string) => allRestricted.add(f));
  }

  // Check active delegations
  const delegations = await db.collection('cvision_delegations').find({
    tenantId, delegateId: userId, status: 'ACTIVE',
    startDate: { $lte: new Date() }, endDate: { $gte: new Date() },
  }).toArray();

  for (const d of delegations) {
    if ((d.permissions || []).includes(module) || (d.permissions || []).includes('ALL')) {
      allowed = true;
    }
  }

  return { allowed, dataScope: bestScope, restrictedFields: [...allRestricted] };
}

// ── Audit Logging ───────────────────────────────────────────────────────

export async function logAudit(
  db: Db, tenantId: string, data: {
    userId: string; userName: string; action: string; module: string;
    resourceType: string; resourceId: string; details: string;
    severity?: string; ipAddress?: string;
  },
): Promise<{ id: string }> {
  const id = uuidv4();
  const doc: Omit<AuditLogEntry, '_id'> = {
    id, tenantId,
    userId: data.userId,
    userName: data.userName,
    action: data.action,
    module: data.module,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    details: data.details,
    severity: String(data.severity || 'INFO') as any,
    ipAddress: data.ipAddress,
    timestamp: new Date(),
  };
  await db.collection('cvision_audit_log').insertOne(doc);
  return { id };
}

// ── Queries ─────────────────────────────────────────────────────────────

export async function listRoles(db: Db, tenantId: string): Promise<any[]> {
  return db.collection('cvision_roles').find({ tenantId }).sort({ isSystem: -1, name: 1 }).toArray();
}

export async function listUserRoles(db: Db, tenantId: string): Promise<any[]> {
  return db.collection('cvision_user_roles').find({ tenantId }).sort({ updatedAt: -1 }).toArray();
}

export async function getUserPermissions(db: Db, tenantId: string, userId: string): Promise<any> {
  const userRole = await db.collection('cvision_user_roles').findOne({ tenantId, userId });
  if (!userRole) return { roles: [], permissions: {}, dataScope: 'SELF' };

  const roles = await db.collection('cvision_roles').find({
    tenantId, $or: [
      { id: { $in: userRole.roleIds || [] } },
      { code: { $in: userRole.roleIds || [] } },
    ],
  }).toArray();

  return { roles, roleIds: userRole.roleIds, primaryRoleId: userRole.primaryRoleId, dataScope: roles[0]?.dataScope || 'SELF' };
}

export async function listDelegations(db: Db, tenantId: string): Promise<any[]> {
  return db.collection('cvision_delegations').find({ tenantId }).sort({ createdAt: -1 }).toArray();
}

export async function getAuditLogs(
  db: Db, tenantId: string, filters: { action?: string; module?: string; severity?: string; userId?: string; limit?: number } = {},
): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.action) query.action = filters.action;
  if (filters.module) query.module = filters.module;
  if (filters.severity) query.severity = filters.severity;
  if (filters.userId) query.userId = filters.userId;
  const limit = filters.limit || 200;
  return db.collection('cvision_audit_log').find(query).sort({ timestamp: -1 }).limit(limit).toArray();
}

export async function getStats(db: Db, tenantId: string) {
  const roles = await db.collection('cvision_roles').countDocuments({ tenantId });
  const userRoles = await db.collection('cvision_user_roles').countDocuments({ tenantId });
  const activeDelegations = await db.collection('cvision_delegations').countDocuments({
    tenantId, status: 'ACTIVE', endDate: { $gte: new Date() },
  });
  const recentAudit = await db.collection('cvision_audit_log').countDocuments({
    tenantId, timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });
  const criticalAudit = await db.collection('cvision_audit_log').countDocuments({
    tenantId, severity: 'CRITICAL', timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });

  return { totalRoles: roles, assignedUsers: userRoles, activeDelegations, recentAuditEvents: recentAudit, criticalEvents: criticalAudit };
}

export async function seedDefaultRoles(db: Db, tenantId: string): Promise<{ seeded: number }> {
  const existing = await db.collection('cvision_roles').countDocuments({ tenantId, isSystem: true });
  if (existing > 0) return { seeded: 0 };

  const now = new Date();
  const docs = DEFAULT_ROLES.map((r) => ({
    ...r, id: uuidv4(), tenantId, createdAt: now, updatedAt: now,
  }));
  await db.collection('cvision_roles').insertMany(docs);
  return { seeded: docs.length };
}
