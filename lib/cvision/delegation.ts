/**
 * CVision Delegation Engine
 *
 * Manages permission delegation between employees:
 * - Delegator grants some or all of their permissions to a delegate
 * - Time-bounded (startDate → endDate)
 * - Optionally linked to a leave record
 *
 * Status lifecycle: PENDING → ACTIVE → EXPIRED | REVOKED
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionCollection } from './db';
import { CVISION_COLLECTIONS, CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from './constants';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface Delegation {
  tenantId: string;
  delegationId: string;
  delegatorId: string;
  delegatorName: string;
  delegateId: string;
  delegateName: string;
  scope: 'ALL' | 'SPECIFIC';
  permissions: string[];
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  linkedLeaveId?: string;
  createdBy: string;
  revokedBy?: string;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EffectivePermissionContext {
  tenantId: string;
  userId: string;
  role: string;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function getRolePermissions(role: string): string[] {
  return CVISION_ROLE_PERMISSIONS[role] || CVISION_ROLE_PERMISSIONS['staff'] || [];
}

/* ── Core Functions ─────────────────────────────────────────────────── */

/**
 * Get active delegations *to* a specific employee (they are the delegate).
 */
export async function getActiveDelegations(
  tenantId: string,
  employeeId: string,
): Promise<Delegation[]> {
  const col = await getCVisionCollection<any>(tenantId, 'delegations');
  const now = new Date();
  return col.find({
    tenantId,
    delegateId: employeeId,
    status: 'ACTIVE',
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).toArray() as Promise<Delegation[]>;
}

/**
 * Fetch the delegator's current role from the employees collection.
 * Returns null if the employee record no longer exists (delegation is stale).
 */
async function getDelegatorCurrentRole(
  tenantId: string,
  delegatorId: string,
): Promise<string | null> {
  const col = await getCVisionCollection<any>(tenantId, 'employees');
  const employee = await col.findOne({ tenantId, employeeId: delegatorId });
  return employee?.role ?? null;
}

/**
 * Get effective permissions: own role permissions + all delegated permissions.
 *
 * Freshness check: for each delegation, we verify the delegator still has the
 * same role they held when the delegation was created.  If their role has
 * changed (or their record no longer exists) we skip that delegation so that
 * stale permissions are never granted.
 */
export async function getEffectivePermissions(
  ctx: EffectivePermissionContext,
): Promise<string[]> {
  const own = getRolePermissions(ctx.role);
  const delegations = await getActiveDelegations(ctx.tenantId, ctx.userId);

  const delegatedPerms = new Set<string>();
  for (const d of delegations) {
    // Freshness check: resolve the delegator's current role at query time
    const currentDelegatorRole = await getDelegatorCurrentRole(ctx.tenantId, d.delegatorId);

    // If the delegator no longer exists, skip this delegation entirely
    if (currentDelegatorRole === null) continue;

    if (d.scope === 'ALL') {
      // Use the delegator's actual current role — not a hardcoded fallback
      const delegatorPerms = getRolePermissions(currentDelegatorRole);
      delegatorPerms.forEach(p => delegatedPerms.add(p));
    } else {
      // For SPECIFIC scope, only grant permissions the delegator still holds
      const delegatorPerms = new Set(getRolePermissions(currentDelegatorRole));
      d.permissions
        .filter(p => delegatorPerms.has(p))
        .forEach(p => delegatedPerms.add(p));
    }
  }

  return [...new Set([...own, ...delegatedPerms])];
}

/**
 * Check a single permission against effective set.
 */
export async function hasEffectivePermission(
  ctx: EffectivePermissionContext,
  permission: string,
): Promise<boolean> {
  const perms = await getEffectivePermissions(ctx);
  return perms.includes(permission);
}

/**
 * Cron helper: activate PENDING delegations whose startDate has arrived,
 * and expire ACTIVE delegations whose endDate has passed.
 */
export async function processDelegationStatus(tenantId: string): Promise<{
  activated: number;
  expired: number;
}> {
  const col = await getCVisionCollection<any>(tenantId, 'delegations');
  const now = new Date();

  const activateResult = await col.updateMany(
    { tenantId, status: 'PENDING', startDate: { $lte: now } },
    { $set: { status: 'ACTIVE', updatedAt: now } },
  );

  const expireResult = await col.updateMany(
    { tenantId, status: 'ACTIVE', endDate: { $lt: now } },
    { $set: { status: 'EXPIRED', updatedAt: now } },
  );

  return {
    activated: activateResult.modifiedCount,
    expired: expireResult.modifiedCount,
  };
}
