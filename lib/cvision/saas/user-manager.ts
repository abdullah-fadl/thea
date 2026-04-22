/**
 * CVision SaaS — User Manager
 *
 * Tenant-scoped user management with role-based permissions.
 * Every user belongs to exactly one tenant and has a role with granular permissions.
 */

import { Collection, ObjectId } from '@/lib/cvision/infra/mongo-compat';
import { getTenantDbByKey } from '@/lib/cvision/infra';
import { v4 as uuid } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type TenantUserRole =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'HR_MANAGER'
  | 'MANAGER'
  | 'EMPLOYEE'
  | 'VIEWER';

export interface TenantUser {
  _id?: ObjectId;
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  nameAr?: string;
  role: TenantUserRole;
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  invitedBy?: string;
  invitedAt?: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// Role → Default Permissions
// ═══════════════════════════════════════════════════════════════════════════

export const ROLE_PERMISSIONS: Record<TenantUserRole, string[]> = {
  SUPER_ADMIN: ['ALL'],
  OWNER: ['ALL'],
  ADMIN: [
    'view_all', 'edit_all', 'delete_all',
    'manage_users', 'manage_settings',
    'view_reports', 'export_data',
  ],
  HR_MANAGER: [
    'view_employees', 'edit_employees',
    'manage_attendance', 'manage_payroll',
    'manage_leaves', 'manage_recruitment',
    'manage_performance', 'view_reports',
    'manage_disciplinary', 'manage_promotions',
  ],
  MANAGER: [
    'view_team', 'approve_leaves',
    'review_performance', 'view_reports',
    'view_team_attendance',
  ],
  EMPLOYEE: [
    'view_self', 'submit_leave',
    'self_review', 'view_payslip',
    'update_profile',
  ],
  VIEWER: [
    'view_dashboard', 'view_reports',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Internal
// ═══════════════════════════════════════════════════════════════════════════

const COLLECTION = 'cvision_tenant_users';

async function getUsersCollection(tenantId: string): Promise<Collection<TenantUser>> {
  const db = await getTenantDbByKey(tenantId);
  return db.collection<TenantUser>(COLLECTION);
}

// ═══════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════

export async function createUser(
  tenantId: string,
  data: Partial<TenantUser>,
): Promise<TenantUser> {
  const col = await getUsersCollection(tenantId);

  if (!data.email || !data.name || !data.role) {
    throw new Error('email, name, and role are required');
  }

  const existing = await col.findOne({ tenantId, email: data.email });
  if (existing) throw new Error(`User with email "${data.email}" already exists in this tenant`);

  const role = data.role as TenantUserRole;
  const defaultPerms = ROLE_PERMISSIONS[role] || [];

  const user: TenantUser = {
    tenantId,
    userId: data.userId || uuid(),
    email: data.email,
    name: data.name,
    nameAr: data.nameAr,
    role,
    permissions: data.permissions?.length ? data.permissions : defaultPerms,
    isActive: data.isActive !== false,
    invitedBy: data.invitedBy,
    invitedAt: data.invitedBy ? new Date() : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await col.insertOne(user as any);
  return user;
}

export async function inviteUser(
  tenantId: string,
  email: string,
  role: TenantUserRole,
  invitedBy: string,
): Promise<{ inviteLink: string; user: TenantUser }> {
  const user = await createUser(tenantId, {
    email,
    name: email.split('@')[0],
    role,
    isActive: false,
    invitedBy,
  });

  const token = Buffer.from(JSON.stringify({
    tenantId,
    userId: user.userId,
    email,
    exp: Date.now() + 7 * 86400000,
  })).toString('base64url');

  const inviteLink = `/cvision/accept-invite?token=${token}`;

  return { inviteLink, user };
}

export async function acceptInvite(
  tenantId: string,
  userId: string,
): Promise<TenantUser | null> {
  const col = await getUsersCollection(tenantId);
  return col.findOneAndUpdate(
    { tenantId, userId },
    { $set: { isActive: true, acceptedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

export async function getUser(
  tenantId: string,
  userId: string,
): Promise<TenantUser | null> {
  const col = await getUsersCollection(tenantId);
  return col.findOne({ tenantId, userId });
}

export async function getUserByEmail(
  tenantId: string,
  email: string,
): Promise<TenantUser | null> {
  const col = await getUsersCollection(tenantId);
  return col.findOne({ tenantId, email });
}

export async function updateUser(
  tenantId: string,
  userId: string,
  updates: Partial<TenantUser>,
): Promise<TenantUser | null> {
  const col = await getUsersCollection(tenantId);
  const { _id, tenantId: _tid, userId: _uid, createdAt: _ca, ...safe } = updates as Record<string, unknown>;
  return col.findOneAndUpdate(
    { tenantId, userId },
    { $set: { ...safe, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

export async function deactivateUser(
  tenantId: string,
  userId: string,
): Promise<void> {
  const col = await getUsersCollection(tenantId);
  await col.updateOne(
    { tenantId, userId },
    { $set: { isActive: false, updatedAt: new Date() } },
  );
}

export async function recordLogin(tenantId: string, userId: string): Promise<void> {
  const col = await getUsersCollection(tenantId);
  await col.updateOne(
    { tenantId, userId },
    { $set: { lastLogin: new Date(), updatedAt: new Date() } },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Permissions
// ═══════════════════════════════════════════════════════════════════════════

export async function getUserPermissions(
  tenantId: string,
  userId: string,
): Promise<string[]> {
  const user = await getUser(tenantId, userId);
  if (!user) return [];
  return user.permissions;
}

export function hasPermission(user: TenantUser, permission: string): boolean {
  if (user.permissions.includes('ALL')) return true;
  if (user.permissions.includes(permission)) return true;

  // Wildcard: 'view_all' grants 'view_employees', etc.
  const [action] = permission.split('_');
  if (user.permissions.includes(`${action}_all`)) return true;

  return false;
}

export function hasAnyPermission(user: TenantUser, permissions: string[]): boolean {
  return permissions.some(p => hasPermission(user, p));
}

// ═══════════════════════════════════════════════════════════════════════════
// Listing
// ═══════════════════════════════════════════════════════════════════════════

export async function listTenantUsers(
  tenantId: string,
  filters?: { role?: TenantUserRole; isActive?: boolean; search?: string },
): Promise<TenantUser[]> {
  const col = await getUsersCollection(tenantId);
  const query: Record<string, any> = { tenantId };

  if (filters?.role) query.role = filters.role;
  if (filters?.isActive !== undefined) query.isActive = filters.isActive;
  if (filters?.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  return col.find(query).sort({ createdAt: -1 }).limit(500).toArray();
}

// ═══════════════════════════════════════════════════════════════════════════
// Indexes
// ═══════════════════════════════════════════════════════════════════════════

export async function ensureUserIndexes(tenantId: string): Promise<void> {
  const col = await getUsersCollection(tenantId);
  await col.createIndex({ tenantId: 1, email: 1 }, { unique: true });
  await col.createIndex({ tenantId: 1, userId: 1 }, { unique: true });
  await col.createIndex({ tenantId: 1, role: 1 });
  await col.createIndex({ tenantId: 1, isActive: 1 });
}
