import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { getActiveDelegations } from '@/lib/cvision/delegation';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const col = await getCVisionCollection<any>(tenantId, 'workflowInstances');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'my-pending';

  if (action === 'my-pending') {
    // Find active/in-progress items, then filter by assignee in application code
    // stepHistory is now stored in JSON 'data' column
    const delegations = await getActiveDelegations(tenantId, userId);
    const delegatorIds = delegations.map(d => d.delegatorId);
    const assigneeIds = [userId, ...delegatorIds];
    const pending = await col.find({
      tenantId,
    }).sort({ startedAt: -1 }).limit(200).toArray();
    const filtered = pending.filter((inst: any) => {
      if (inst.status !== 'active' && inst.status !== 'IN_PROGRESS') return false;
      const d = typeof inst.data === 'string' ? JSON.parse(inst.data) : (inst.data || {});
      const history = d.stepHistory || [];
      const currentEntry = history.find((s: any) => s.stepNumber === inst.currentStep && !s.completedAt);
      return currentEntry && assigneeIds.includes(currentEntry.assigneeId);
    });
    return NextResponse.json({ ok: true, data: filtered.slice(0, 50) });
  }

  if (action === 'detail') {
    const detailId = searchParams.get('id');
    if (!detailId) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    // PG PK is 'id', not 'instanceId'
    const doc = await col.findOne({ tenantId, id: detailId });
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'history') {
    const resourceId = searchParams.get('resourceId');
    if (!resourceId) return NextResponse.json({ ok: false, error: 'resourceId required' }, { status: 400 });
    const data = await col.find({ tenantId, resourceId }).sort({ startedAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.workflows.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const col = await getCVisionCollection<any>(tenantId, 'workflowInstances');
  const wfCol = await getCVisionCollection<any>(tenantId, 'workflows');
  const body = await request.json();
  const action = body.action;
  const auditCtx = createCVisionAuditContext({ userId: ctx.userId, role: ctx.roles[0] || 'unknown', tenantId, user: ctx.user }, request);

  if (action === 'start') {
    const { workflowId, resourceType, resourceId, requesterName, metadata } = body;
    let wf: any;
    if (workflowId) {
      wf = await wfCol.findOne({ tenantId, id: workflowId, isActive: true });
    } else if (body.triggerType) {
      wf = await wfCol.findOne({ tenantId, triggerType: body.triggerType, isActive: true });
    }
    if (!wf) return NextResponse.json({ ok: false, error: 'No active workflow found' }, { status: 404 });

    const firstStep = wf.steps?.find((s: any) => s.stepNumber === 1);
    const instanceId = uuidv4();
    // PostgreSQL schema: id (PK), tenantId, workflowId, resourceType, resourceId,
    // currentStep, status, data (Json), startedAt, completedAt, createdAt, updatedAt
    const doc = {
      id: instanceId,
      tenantId,
      workflowId: wf.id || wf.workflowId || '',
      resourceType: resourceType || wf.triggerType,
      resourceId: resourceId || '',
      currentStep: 1,
      status: 'active',
      data: {
        workflowName: wf.name,
        requesterId: userId,
        requesterName: requesterName || userId,
        stepHistory: firstStep ? [{ stepNumber: 1, stepName: firstStep.name, assigneeId: body.managerId || userId, assigneeName: body.managerName || '', startedAt: new Date() }] : [],
        metadata: metadata || {},
      },
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await col.insertOne(doc);
    await logCVisionAudit(auditCtx, 'CREATE', 'authz', { resourceId: instanceId, metadata: { type: 'workflow_instance', workflowId: doc.workflowId } });
    // Return with instanceId alias for backward compatibility
    return NextResponse.json({ ok: true, data: { ...doc, instanceId } });
  }

  if (action === 'approve' || action === 'reject' || action === 'return') {
    const { instanceId, comment, returnToStep } = body;
    const wfInstId = instanceId || body.id;
    if (!wfInstId) return NextResponse.json({ ok: false, error: 'instanceId required' }, { status: 400 });
    // PostgreSQL PK is 'id', not 'instanceId'
    const inst = await col.findOne({ tenantId, id: wfInstId });
    if (!inst) return NextResponse.json({ ok: false, error: 'Instance not found' }, { status: 404 });
    const instStatus = inst.status;
    if (instStatus !== 'active' && instStatus !== 'IN_PROGRESS') return NextResponse.json({ ok: false, error: 'Workflow not in progress' }, { status: 400 });

    const wf = await wfCol.findOne({ tenantId, id: inst.workflowId });
    const wfSteps = typeof wf?.steps === 'string' ? JSON.parse(wf.steps) : (wf?.steps || []);
    const now = new Date();

    // Step history is stored in data JSON
    const instData = typeof inst.data === 'string' ? JSON.parse(inst.data) : (inst.data || {});

    /* ── Authorization checks ───────────────────────────────────────────
     * Three invariants must hold before any approve / reject / return:
     *  1. Self-approval prevention — the user who created/triggered the
     *     workflow request cannot approve or reject it themselves.
     *  2. Assignee check — the acting user must be the assigned approver
     *     for the current open step (or hold a delegation for that approver).
     *  3. Role check — for role-based approval steps the user must carry
     *     a matching role.
     * ─────────────────────────────────────────────────────────────────── */
    const requesterId: string = instData.requesterId || inst.requesterId || '';
    if (requesterId && requesterId === userId) {
      return NextResponse.json(
        { ok: false, error: 'Self-approval is not permitted: you cannot approve or reject a workflow you initiated' },
        { status: 403 }
      );
    }

    const history = instData.stepHistory || [];
    const currentEntry = history.find((s: any) => s.stepNumber === inst.currentStep && !s.completedAt);

    // Verify the acting user is the assigned approver for this step
    // (direct assignment or via active delegation — delegations were already
    // resolved in GET /my-pending and the assigneeId field captures them).
    const delegations = await getActiveDelegations(tenantId, userId);
    const delegatorIds = delegations.map((d: any) => d.delegatorId);
    const authorizedIds = [userId, ...delegatorIds];

    if (currentEntry && currentEntry.assigneeId && !authorizedIds.includes(currentEntry.assigneeId)) {
      // The current step's assigned approver is someone else entirely.
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: you are not the assigned approver for this workflow step' },
        { status: 403 }
      );
    }

    // Role-based authorization: cross-check the step's required approver type
    // against the roles carried in the JWT context.
    const currentStepDef = wfSteps.find((s: any) => s.stepNumber === inst.currentStep);
    if (currentStepDef && currentStepDef.approverType) {
      const approverType: string = currentStepDef.approverType;
      const userRoles: string[] = (ctx.roles || []).map((r: string) => r.toLowerCase());

      const APPROVER_ROLE_MAP: Record<string, string[]> = {
        HR:               ['hr', 'hr_manager', 'hr_admin'],
        FINANCE:          ['finance', 'finance_manager', 'finance_officer'],
        DEPARTMENT_HEAD:  ['department_head', 'dept_head'],
        DIRECT_MANAGER:   ['manager', 'direct_manager', 'supervisor'],
      };

      if (approverType === 'SPECIFIC_USER') {
        const allowedApprovers: string[] = currentStepDef.allowedApprovers ?? [];
        if (allowedApprovers.length > 0 && !allowedApprovers.includes(userId)) {
          return NextResponse.json(
            { ok: false, error: 'Unauthorized: you are not listed as an approver for this step' },
            { status: 403 }
          );
        }
      } else if (approverType === 'DYNAMIC') {
        const runtimeApprover: string = inst.assignedApprover || instData.assignedApprover || '';
        if (runtimeApprover && runtimeApprover !== userId && !delegatorIds.includes(runtimeApprover)) {
          return NextResponse.json(
            { ok: false, error: 'Unauthorized: you are not the dynamically assigned approver for this step' },
            { status: 403 }
          );
        }
      } else if (APPROVER_ROLE_MAP[approverType]) {
        const requiredRoles = APPROVER_ROLE_MAP[approverType];
        const hasRole = userRoles.some(r => requiredRoles.includes(r));
        if (!hasRole) {
          return NextResponse.json(
            { ok: false, error: `Unauthorized: approving this step requires the "${approverType}" role` },
            { status: 403 }
          );
        }
      }
    }
    /* ── End authorization checks ─────────────────────────────────────── */

    if (currentEntry) {
      currentEntry.action = action.toUpperCase();
      currentEntry.comment = comment || '';
      currentEntry.completedAt = now;
      currentEntry.completedBy = userId;
    }

    if (action === 'reject') {
      await col.updateOne({ tenantId, id: wfInstId }, { $set: { status: 'cancelled', completedAt: now, data: { ...instData, stepHistory: history }, updatedAt: now } });
      await logCVisionAudit(auditCtx, 'REJECT', 'authz', { resourceId: wfInstId, metadata: { type: 'workflow_action' } });
      return NextResponse.json({ ok: true, status: 'REJECTED' });
    }

    if (action === 'return') {
      const targetStep = returnToStep || 1;
      history.push({ stepNumber: targetStep, stepName: `Return to step ${targetStep}`, startedAt: now });
      await col.updateOne({ tenantId, id: wfInstId }, { $set: { currentStep: targetStep, status: 'active', data: { ...instData, stepHistory: history }, updatedAt: now } });
      return NextResponse.json({ ok: true, status: 'RETURNED' });
    }

    // Approve — move to next step
    let nextStepNum = inst.currentStep + 1;
    if (currentStepDef?.type === 'CONDITION' && currentStepDef.condition) {
      nextStepNum = currentStepDef.condition.trueStep || inst.currentStep + 1;
    }
    const nextStep = wfSteps.find((s: any) => s.stepNumber === nextStepNum);
    if (!nextStep || nextStep.type === 'ACTION') {
      // Final step — completed
      await col.updateOne({ tenantId, id: wfInstId }, { $set: { status: 'completed', currentStep: nextStepNum, completedAt: now, data: { ...instData, stepHistory: history }, updatedAt: now } });
      await logCVisionAudit(auditCtx, 'APPROVE', 'authz', { resourceId: wfInstId, metadata: { type: 'workflow_completed' } });
      return NextResponse.json({ ok: true, status: 'APPROVED' });
    }

    // Move to next approval step
    history.push({ stepNumber: nextStepNum, stepName: nextStep.name || '', startedAt: now });
    await col.updateOne({ tenantId, id: wfInstId }, { $set: { currentStep: nextStepNum, data: { ...instData, stepHistory: history }, updatedAt: now } });
    await logCVisionAudit(auditCtx, 'APPROVE', 'authz', { resourceId: wfInstId, metadata: { type: 'workflow_step_approved', step: inst.currentStep } });
    return NextResponse.json({ ok: true, status: 'IN_PROGRESS', currentStep: nextStepNum });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.workflows.write' });
