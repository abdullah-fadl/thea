/**
 * CVision Delegations API
 *
 * GET  ?action=list              — outgoing + incoming delegations for current user
 * GET  ?action=active&userId=X   — active delegations for a specific employee
 * GET  ?action=detail&id=X       — single delegation detail
 * POST action=create             — create delegation
 * POST action=revoke             — revoke delegation
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function hasPermission(ctx: any, perm: string): boolean {
  const rolePerms: string[] = CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || CVISION_ROLE_PERMISSIONS['staff'] || [];
  return rolePerms.includes(perm) || ctx.isOwner;
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  const col = await getCVisionCollection<any>(tenantId, 'delegations');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const [outgoing, incoming] = await Promise.all([
      col.find({ tenantId, delegatorId: userId }).sort({ createdAt: -1 }).limit(100).toArray(),
      col.find({ tenantId, delegateId: userId }).sort({ createdAt: -1 }).limit(100).toArray(),
    ]);
    return NextResponse.json({ ok: true, outgoing, incoming });
  }

  if (action === 'active') {
    const targetId = searchParams.get('userId') || userId;
    const now = new Date();
    const data = await col.find({
      tenantId, delegateId: targetId, status: 'ACTIVE',
      startDate: { $lte: now }, endDate: { $gte: now },
    }).toArray();
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'detail') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    const doc = await col.findOne({ tenantId, delegationId: id });
    if (!doc) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: doc });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.delegation.manage' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  const body = await request.json();
  const action = body.action;
  const col = await getCVisionCollection<any>(tenantId, 'delegations');
  const auditCtx = createCVisionAuditContext(
    { userId: ctx.userId, role: ctx.roles[0] || 'unknown', tenantId, user: ctx.user },
    request,
  );

  if (action === 'create') {
    const { delegatorId, delegatorName, delegateId, delegateName, scope, permissions, startDate, endDate, reason, linkedLeaveId } = body;

    if (!delegatorId || !delegateId || !startDate || !endDate) {
      return NextResponse.json({ ok: false, error: 'delegatorId, delegateId, startDate, endDate required' }, { status: 400 });
    }
    if (delegatorId === delegateId) {
      return NextResponse.json({ ok: false, error: 'Cannot delegate to yourself' }, { status: 400 });
    }
    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json({ ok: false, error: 'endDate must be after startDate' }, { status: 400 });
    }

    // Non-admin cannot delegate permissions they don't own
    if (!ctx.isOwner && scope === 'SPECIFIC' && permissions?.length) {
      const rolePerms = CVISION_ROLE_PERMISSIONS[ctx.roles[0]] || [];
      const forbidden = (permissions as string[]).filter(p => !rolePerms.includes(p));
      if (forbidden.length > 0) {
        return NextResponse.json({ ok: false, error: `Cannot delegate permissions you don't have: ${forbidden.join(', ')}` }, { status: 403 });
      }
    }

    // Check for overlapping active delegations
    const overlap = await col.findOne({
      tenantId,
      delegatorId,
      delegateId,
      status: { $in: ['PENDING', 'ACTIVE'] },
      startDate: { $lt: new Date(endDate) },
      endDate: { $gt: new Date(startDate) },
    });
    if (overlap) {
      return NextResponse.json({ ok: false, error: 'Overlapping delegation already exists' }, { status: 409 });
    }

    const now = new Date();
    const isActive = new Date(startDate) <= now;
    const doc = {
      tenantId,
      delegationId: uuidv4(),
      delegatorId,
      delegatorName: delegatorName || delegatorId,
      delegateId,
      delegateName: delegateName || delegateId,
      scope: scope || 'ALL',
      permissions: scope === 'SPECIFIC' ? (permissions || []) : [],
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || '',
      status: isActive ? 'ACTIVE' : 'PENDING',
      linkedLeaveId: linkedLeaveId || undefined,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await col.insertOne(doc);
    await logCVisionAudit(auditCtx, 'CREATE', 'authz', {
      resourceId: doc.delegationId,
      metadata: { type: 'delegation', delegatorId, delegateId, scope: doc.scope },
    });

    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'revoke') {
    const { delegationId } = body;
    if (!delegationId) return NextResponse.json({ ok: false, error: 'delegationId required' }, { status: 400 });

    const existing = await col.findOne({ tenantId, delegationId });
    if (!existing) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    // Only the delegator, admins, or the creator can revoke
    const canRevoke = existing.delegatorId === userId || existing.createdBy === userId || ctx.isOwner || hasPermission(ctx, CVISION_PERMISSIONS.DELEGATION_MANAGE);
    if (!canRevoke) return deny('FORBIDDEN', 'You cannot revoke this delegation');

    const now = new Date();
    await col.updateOne(
      { tenantId, delegationId },
      { $set: { status: 'REVOKED', revokedBy: userId, revokedAt: now, updatedAt: now } },
    );

    await logCVisionAudit(auditCtx, 'STATUS_CHANGE', 'authz', {
      resourceId: delegationId,
      metadata: { type: 'delegation', action: 'revoke' },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});
