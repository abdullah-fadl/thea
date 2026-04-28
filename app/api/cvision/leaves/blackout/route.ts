/**
 * CVision Leave Blackout Periods API
 *
 * GET  /api/cvision/leaves/blackout        — List blackout periods
 * POST /api/cvision/leaves/blackout        — Create / update / delete blackout periods
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, withAuditedAuth } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) {
  return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm);
}

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const createBlackoutSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  nameAr: z.string().max(200).trim().default(''),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(1000).trim().default(''),
  reasonAr: z.string().max(1000).trim().default(''),
  scope: z.enum(['ALL', 'DEPARTMENT', 'UNIT']).default('ALL'),
  scopeIds: z.array(z.string()).default([]),
  exemptRoles: z.array(z.string()).default([]),
  leaveTypes: z.array(z.string()).default([]),
});

const updateBlackoutSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).trim().optional(),
  nameAr: z.string().max(200).trim().optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  reason: z.string().max(1000).trim().optional(),
  reasonAr: z.string().max(1000).trim().optional(),
  scope: z.enum(['ALL', 'DEPARTMENT', 'UNIT']).optional(),
  scopeIds: z.array(z.string()).optional(),
  exemptRoles: z.array(z.string()).optional(),
  leaveTypes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET — List blackout periods
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  if (!hasPerm(ctx, CVISION_PERMISSIONS.LEAVES_READ)) {
    return deny('INSUFFICIENT_PERMISSION', 'Requires LEAVES_READ permission');
  }

  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';

  const query: any = { tenantId, deletedAt: null };

  if (activeOnly) {
    const now = new Date();
    query.isActive = true;
    query.endDate = { $gte: now };
  }

  const blackouts = await db
    .collection('cvision_leave_blackouts')
    .find(query)
    .sort({ startDate: -1 })
    .limit(500)
    .toArray();

  return NextResponse.json({
    ok: true,
    data: { blackouts, total: blackouts.length },
  });
}, { platformKey: 'cvision', permissionKey: 'cvision.leaves.read' });

// ---------------------------------------------------------------------------
// POST — Create, update, delete blackout periods
// ---------------------------------------------------------------------------

export const POST = withAuditedAuth(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  if (!hasPerm(ctx, CVISION_PERMISSIONS.CONFIG_WRITE)) {
    return deny('INSUFFICIENT_PERMISSION', 'Requires CONFIG_WRITE permission');
  }

  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  switch (action) {
    // -----------------------------------------------------------------------
    // Create
    // -----------------------------------------------------------------------
    case 'create': {
      const parsed = createBlackoutSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: 'Validation error', details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }

      const data = parsed.data;

      // Validate date range
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (end <= start) {
        return NextResponse.json(
          { ok: false, error: 'endDate must be after startDate' },
          { status: 400 },
        );
      }

      const now = new Date();
      const blackout = {
        id: uuid(),
        tenantId,
        name: data.name,
        nameAr: data.nameAr,
        startDate: start,
        endDate: end,
        reason: data.reason,
        reasonAr: data.reasonAr,
        scope: data.scope,
        scopeIds: data.scopeIds,
        exemptRoles: data.exemptRoles,
        leaveTypes: data.leaveTypes,
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      await db.collection('cvision_leave_blackouts').insertOne(blackout);

      return NextResponse.json({ ok: true, data: blackout });
    }

    // -----------------------------------------------------------------------
    // Update
    // -----------------------------------------------------------------------
    case 'update': {
      const parsed = updateBlackoutSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: 'Validation error', details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }

      const { id, ...updates } = parsed.data;

      const existing = await db.collection('cvision_leave_blackouts').findOne({
        id,
        tenantId,
        deletedAt: null,
      });

      if (!existing) {
        return NextResponse.json(
          { ok: false, error: 'Blackout period not found' },
          { status: 404 },
        );
      }

      // Build $set payload, converting date strings to Date objects
      const setPayload: any = { updatedAt: new Date() };
      if (updates.name !== undefined) setPayload.name = updates.name;
      if (updates.nameAr !== undefined) setPayload.nameAr = updates.nameAr;
      if (updates.startDate !== undefined) setPayload.startDate = new Date(updates.startDate);
      if (updates.endDate !== undefined) setPayload.endDate = new Date(updates.endDate);
      if (updates.reason !== undefined) setPayload.reason = updates.reason;
      if (updates.reasonAr !== undefined) setPayload.reasonAr = updates.reasonAr;
      if (updates.scope !== undefined) setPayload.scope = updates.scope;
      if (updates.scopeIds !== undefined) setPayload.scopeIds = updates.scopeIds;
      if (updates.exemptRoles !== undefined) setPayload.exemptRoles = updates.exemptRoles;
      if (updates.leaveTypes !== undefined) setPayload.leaveTypes = updates.leaveTypes;
      if (updates.isActive !== undefined) setPayload.isActive = updates.isActive;

      // Validate date range if both dates are being set or one is changing
      const newStart = setPayload.startDate || existing.startDate;
      const newEnd = setPayload.endDate || existing.endDate;
      if (new Date(newEnd) <= new Date(newStart)) {
        return NextResponse.json(
          { ok: false, error: 'endDate must be after startDate' },
          { status: 400 },
        );
      }

      await db.collection('cvision_leave_blackouts').updateOne(
        { id, tenantId },
        { $set: setPayload },
      );

      return NextResponse.json({
        ok: true,
        data: { ...existing, ...setPayload },
      });
    }

    // -----------------------------------------------------------------------
    // Delete (soft)
    // -----------------------------------------------------------------------
    case 'delete': {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { ok: false, error: 'id is required' },
          { status: 400 },
        );
      }

      const existing = await db.collection('cvision_leave_blackouts').findOne({
        id,
        tenantId,
        deletedAt: null,
      });

      if (!existing) {
        return NextResponse.json(
          { ok: false, error: 'Blackout period not found' },
          { status: 404 },
        );
      }

      await db.collection('cvision_leave_blackouts').updateOne(
        { id, tenantId },
        { $set: { deletedAt: new Date(), isActive: false, updatedAt: new Date() } },
      );

      return NextResponse.json({ ok: true, data: { id, deleted: true } });
    }

    default:
      return NextResponse.json(
        { ok: false, error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }
}, { resourceType: 'LEAVE_BLACKOUT' });
