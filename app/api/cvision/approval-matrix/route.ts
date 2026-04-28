/**
 * CVision Approval Matrix API
 *
 * GET  ?action=list                                     — all rules
 * GET  ?action=resolve&type=X&amount=X&days=X&dept=X    — resolve approval chain
 * POST action=create                                    — create rule
 * POST action=update                                    — update rule
 * POST action=delete                                    — delete rule
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

const APPROVER_TYPES = [
  'DIRECT_MANAGER', 'DEPARTMENT_HEAD', 'HR_MANAGER', 'HR_ADMIN',
  'FINANCE_MANAGER', 'CEO', 'SPECIFIC_ROLE', 'SPECIFIC_PERSON',
] as const;

function canWrite(ctx: any): boolean {
  const rolePerms: string[] = CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || [];
  return ctx.isOwner || rolePerms.includes(CVISION_PERMISSIONS.WORKFLOWS_WRITE) || rolePerms.includes(CVISION_PERMISSIONS.CONFIG_WRITE);
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;

  const col = await getCVisionCollection<any>(tenantId, 'approvalMatrix');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const rules = await col.find({ tenantId, isActive: { $ne: false } }).sort({ priority: -1 }).limit(500).toArray();
    return NextResponse.json({ ok: true, data: rules });
  }

  if (action === 'resolve') {
    const requestType = searchParams.get('type');
    const amount = parseFloat(searchParams.get('amount') || '0');
    const days = parseInt(searchParams.get('days') || '0', 10);
    const department = searchParams.get('department') || searchParams.get('dept') || '';
    const grade = searchParams.get('grade') || '';

    if (!requestType) {
      return NextResponse.json({ ok: false, error: 'type is required' }, { status: 400 });
    }

    const rules = await col.find({ tenantId, requestType, isActive: { $ne: false } }).sort({ priority: -1 }).limit(500).toArray();

    for (const rule of rules) {
      const c = rule.conditions || {};
      if (c.minAmount != null && amount < c.minAmount) continue;
      if (c.maxAmount != null && amount > c.maxAmount) continue;
      if (c.minDays != null && days < c.minDays) continue;
      if (c.maxDays != null && days > c.maxDays) continue;
      if (c.departments?.length && department && !c.departments.includes(department)) continue;
      if (c.grades?.length && grade && !c.grades.includes(grade)) continue;

      return NextResponse.json({ ok: true, rule, approvers: rule.approvers || [] });
    }

    // Default fallback: direct manager only
    return NextResponse.json({
      ok: true,
      rule: null,
      approvers: [{ step: 1, type: 'DIRECT_MANAGER', label: 'Direct Manager', timeoutHours: 48, timeoutAction: 'ESCALATE' }],
      isDefault: true,
    });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  if (!canWrite(ctx)) {
    return deny('INSUFFICIENT_PERMISSION', 'Requires WORKFLOWS_WRITE or CONFIG_WRITE');
  }

  const body = await request.json();
  const action = body.action;
  const col = await getCVisionCollection<any>(tenantId, 'approvalMatrix');
  const auditCtx = createCVisionAuditContext(
    { userId: ctx.userId, role: ctx.roles[0] || 'unknown', tenantId, user: ctx.user },
    request,
  );

  if (action === 'create') {
    const { requestType, conditions, approvers, priority } = body;
    if (!requestType || !approvers?.length) {
      return NextResponse.json({ ok: false, error: 'requestType and approvers required' }, { status: 400 });
    }

    const doc = {
      tenantId,
      ruleId: uuidv4(),
      requestType,
      conditions: conditions || {},
      approvers: (approvers as any[]).map((a: any, i: number) => ({
        step: a.step ?? i + 1,
        type: a.type || 'DIRECT_MANAGER',
        label: a.label || a.type || 'Approver',
        timeoutHours: a.timeoutHours ?? 48,
        timeoutAction: a.timeoutAction || 'ESCALATE',
        specificId: a.specificId,
      })),
      priority: priority ?? 0,
      isActive: true,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await col.insertOne(doc);
    await logCVisionAudit(auditCtx, 'CREATE', 'authz', {
      resourceId: doc.ruleId,
      metadata: { type: 'approval_matrix', requestType },
    });
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'update') {
    const { ruleId, ...updates } = body;
    if (!ruleId) return NextResponse.json({ ok: false, error: 'ruleId required' }, { status: 400 });
    delete updates.action;
    delete updates.tenantId;
    const result = await col.updateOne(
      { tenantId, ruleId },
      { $set: { ...updates, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    await logCVisionAudit(auditCtx, 'UPDATE', 'authz', { resourceId: ruleId, metadata: { type: 'approval_matrix' } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const { ruleId } = body;
    if (!ruleId) return NextResponse.json({ ok: false, error: 'ruleId required' }, { status: 400 });
    await col.updateOne({ tenantId, ruleId }, { $set: { isActive: false, updatedAt: new Date() } });
    await logCVisionAudit(auditCtx, 'DELETE', 'authz', { resourceId: ruleId, metadata: { type: 'approval_matrix' } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' });
