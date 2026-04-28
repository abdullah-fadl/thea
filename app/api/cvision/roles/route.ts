/**
 * CVision Roles Management API
 *
 * GET  /api/cvision/roles?action=list|stats|user-roles|user-permissions
 * POST /api/cvision/roles?action=create|update|delete|assign|remove|bulk-assign|seed
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, withAuditedAuth } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import {
  listRoles,
  listUserRoles,
  getUserPermissions,
  getStats,
  createRole,
  updateRole,
  deleteRole,
  assignRole,
  removeRole,
  bulkAssign,
  seedDefaultRoles,
} from '@/lib/cvision/access-control';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) {
  return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm);
}

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const createRoleSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  code: z.string().min(1).max(50).trim().toUpperCase(),
  description: z.string().max(1000).trim().default(''),
  pagePermissions: z.record(z.string(), z.enum(['NONE', 'VIEW', 'EDIT', 'FULL'])).default({}),
  modulePermissions: z.record(z.string(), z.array(z.string())).default({}),
  dataScope: z.enum(['ALL', 'DEPARTMENT', 'TEAM', 'SELF']).default('SELF'),
  restrictedFields: z.array(z.string().max(100)).max(50).default([]),
  approvalAuthority: z.object({
    canApprove: z.array(z.string()).default([]),
    maxApprovalAmount: z.number().min(0).default(0),
    requiresCounterSign: z.boolean().default(false),
  }).default({ canApprove: [], maxApprovalAmount: 0, requiresCounterSign: false }),
  specialPermissions: z.array(z.string().max(100)).max(20).default([]),
});

const updateRoleSchema = z.object({
  roleId: z.string().min(1),
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  pagePermissions: z.record(z.string(), z.enum(['NONE', 'VIEW', 'EDIT', 'FULL'])).optional(),
  modulePermissions: z.record(z.string(), z.array(z.string())).optional(),
  dataScope: z.enum(['ALL', 'DEPARTMENT', 'TEAM', 'SELF']).optional(),
  restrictedFields: z.array(z.string().max(100)).max(50).optional(),
  approvalAuthority: z.object({
    canApprove: z.array(z.string()),
    maxApprovalAmount: z.number().min(0),
    requiresCounterSign: z.boolean(),
  }).optional(),
  specialPermissions: z.array(z.string().max(100)).max(20).optional(),
});

const assignRoleSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().max(200).default(''),
  roleIds: z.array(z.string().min(1)).min(1).max(20),
});

const removeRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});

const bulkAssignSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(500),
  roleId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// GET — List roles, user-roles, permissions, stats
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  // Reading roles requires at least VIEW access
  if (!hasPerm(ctx, (CVISION_PERMISSIONS as any).ACCESS_CONTROL || 'cvision.access_control')) {
    // Allow if user has any HR admin-level role
    const adminRoles = ['cvision_admin', 'hr_admin', 'owner', 'thea-owner', 'admin'];
    if (!ctx.isOwner && !adminRoles.some((r: string) => ctx.roles?.includes(r))) {
      return deny('INSUFFICIENT_PERMISSION', 'Requires access control permission');
    }
  }

  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  switch (action) {
    case 'list': {
      const roles = await listRoles(db, tenantId);
      return NextResponse.json({ ok: true, data: roles });
    }

    case 'user-roles': {
      const userRoles = await listUserRoles(db, tenantId);
      return NextResponse.json({ ok: true, data: userRoles });
    }

    case 'user-permissions': {
      const userId = searchParams.get('userId');
      if (!userId) return NextResponse.json({ ok: false, error: 'userId is required' }, { status: 400 });
      const permissions = await getUserPermissions(db, tenantId, userId);
      return NextResponse.json({ ok: true, data: permissions });
    }

    case 'stats': {
      const stats = await getStats(db, tenantId);
      return NextResponse.json({ ok: true, data: stats });
    }

    default:
      return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });

// ---------------------------------------------------------------------------
// POST — Create, update, delete, assign, remove, bulk-assign, seed
// ---------------------------------------------------------------------------

export const POST = withAuditedAuth(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  // Role management requires admin-level access
  const adminRoles = ['cvision_admin', 'hr_admin', 'owner', 'thea-owner', 'admin'];
  if (!ctx.isOwner && !adminRoles.some((r: string) => ctx.roles?.includes(r))) {
    return deny('INSUFFICIENT_PERMISSION', 'Only admins can manage roles');
  }

  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  switch (action) {
    case 'create': {
      const parsed = createRoleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Validation error', details: parsed.error.flatten().fieldErrors }, { status: 400 });
      }
      // Check duplicate code
      const existing = await db.collection('cvision_roles').findOne({ tenantId, code: parsed.data.code });
      if (existing) {
        return NextResponse.json({ ok: false, error: `Role with code "${parsed.data.code}" already exists` }, { status: 409 });
      }
      const result = await createRole(db, tenantId, parsed.data);
      return NextResponse.json({ ok: true, data: result });
    }

    case 'update': {
      const parsed = updateRoleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Validation error', details: parsed.error.flatten().fieldErrors }, { status: 400 });
      }
      const { roleId, ...updates } = parsed.data;
      const result = await updateRole(db, tenantId, roleId, updates);
      return NextResponse.json({ ok: true, data: result });
    }

    case 'delete': {
      const roleId = body.roleId;
      if (!roleId) return NextResponse.json({ ok: false, error: 'roleId is required' }, { status: 400 });
      const result = await deleteRole(db, tenantId, roleId);
      return NextResponse.json({ ok: true, data: result });
    }

    case 'assign': {
      const parsed = assignRoleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Validation error', details: parsed.error.flatten().fieldErrors }, { status: 400 });
      }
      const result = await assignRole(db, tenantId, parsed.data.userId, parsed.data.userName, parsed.data.roleIds, userId);
      return NextResponse.json({ ok: true, data: result });
    }

    case 'remove': {
      const parsed = removeRoleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Validation error', details: parsed.error.flatten().fieldErrors }, { status: 400 });
      }
      const result = await removeRole(db, tenantId, parsed.data.userId, parsed.data.roleId);
      return NextResponse.json({ ok: true, data: result });
    }

    case 'bulk-assign': {
      const parsed = bulkAssignSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Validation error', details: parsed.error.flatten().fieldErrors }, { status: 400 });
      }
      const result = await bulkAssign(db, tenantId, parsed.data.userIds, parsed.data.roleId, userId);
      return NextResponse.json({ ok: true, data: result });
    }

    case 'seed': {
      const result = await seedDefaultRoles(db, tenantId);
      return NextResponse.json({ ok: true, data: result });
    }

    default:
      return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}, { resourceType: 'ROLE' });
