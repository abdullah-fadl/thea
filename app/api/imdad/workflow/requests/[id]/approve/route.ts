import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { WorkflowError, WorkflowErrors } from '@/lib/imdad/errors';
import { workflowLogger, getTraceId, withTraceId } from '@/lib/imdad/logger';
import { increment } from '@/lib/imdad/metrics';
import { checkRateLimit } from '@/lib/imdad/rate-limit';
import { isTerminalState } from '@/lib/imdad/terminal-states';
import { resolveIdentity, IdentityError } from '@/lib/imdad/user-identity';

export const dynamic = 'force-dynamic';

const FINAL_STATUS: Record<string, string> = {
  SUPPLY_REQUEST: 'PO_GENERATED',
  REPLENISHMENT_REQUEST: 'PO_GENERATED',
  MAINTENANCE_REQUEST: 'WORK_ORDER_CREATED',
  TRANSFER_REQUEST: 'TRANSFER_INITIATED',
  BUDGET_REQUEST: 'BUDGET_APPROVED',
};

export const POST = withAuthTenant(
  async (request, { tenantId, userId, user, role: authRole }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const id = resolvedParams.id;

      const body = await request.json();
      const { comments, identitySnapshot } = body;

      // ── STRICT IDENTITY: fetch from authoritative source (users table) ──
      let identity;
      try {
        identity = await resolveIdentity(userId, tenantId);
      } catch (e) {
        if (e instanceof IdentityError) {
          return NextResponse.json(e.toResponse(), { status: 403 });
        }
        throw e;
      }

      // ── IDENTITY LOCK: if client sent a snapshot, validate it matches current server identity ──
      if (identitySnapshot) {
        const mismatches: string[] = [];
        if (identitySnapshot.userId && identitySnapshot.userId !== identity.userId) mismatches.push('userId');
        if (identitySnapshot.role && identitySnapshot.role !== identity.role) mismatches.push('role');
        if (identitySnapshot.hospitalId && identitySnapshot.hospitalId !== identity.hospitalId) mismatches.push('hospitalId');
        if (identitySnapshot.departmentId && identitySnapshot.departmentId !== identity.departmentId) mismatches.push('departmentId');
        if (mismatches.length > 0) {
          return NextResponse.json({
            error: 'IDENTITY_MISMATCH',
            message: `Identity changed since action was initiated. Mismatched fields: ${mismatches.join(', ')}. Re-authenticate and retry.`,
            mismatchedFields: mismatches,
            expected: { userId: identitySnapshot.userId, role: identitySnapshot.role, hospitalId: identitySnapshot.hospitalId },
            actual: { userId: identity.userId, role: identity.role, hospitalId: identity.hospitalId },
          }, { status: 409 });
        }
      }

      const role = identity.role;
      const performedByName = identity.fullName;

      const rl = checkRateLimit(tenantId, userId);
      if (!rl.allowed) {
        return NextResponse.json({ error: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded', retryAfterMs: rl.resetAt - Date.now() }, { status: 429 });
      }

      const traceId = getTraceId(request);
      const log = workflowLogger({ traceId, route: '/api/imdad/workflow/requests/[id]/approve', action: 'APPROVE', tenantId, userId, role, requestId: id as string });
      log.start();

      const supplyRequest = await prisma.imdadSupplyRequest.findFirst({
        where: { id: id as string, tenantId, isDeleted: false },
        include: { approvalSteps: { orderBy: { stepNumber: 'asc' } as any }, items: true } as any,
      });

      if (!supplyRequest) throw WorkflowErrors.REQUEST_NOT_FOUND();

      // SAFE RETRY: if already in terminal state, return current state (idempotent)
      if (isTerminalState(supplyRequest.status)) {
        log.success(`Safe retry — already in ${supplyRequest.status}`);
        return withTraceId(NextResponse.json(supplyRequest), traceId);
      }

      const currentStep = (supplyRequest as any).approvalSteps[supplyRequest.currentApprovalStep];
      if (!currentStep) throw WorkflowErrors.NO_APPROVAL_STEP();

      // SAFE RETRY: if this step is already approved, return current state
      if (currentStep.status === 'APPROVED') {
        log.success(`Safe retry — step ${currentStep.role} already approved`);
        return withTraceId(NextResponse.json(supplyRequest), traceId);
      }

      if (currentStep.role !== role && currentStep.escalatedTo !== role) {
        throw WorkflowErrors.NOT_YOUR_TURN(role, currentStep.role, currentStep.escalatedTo);
      }

      const now = new Date();
      const previousState = supplyRequest.status;
      const isLastStep = supplyRequest.currentApprovalStep >= (supplyRequest as any).approvalSteps.length - 1;

      const updated = await prisma.$transaction(async (tx) => {
        // CONCURRENCY GUARD: conditional update — only if step is still PENDING
        // True race condition (two different users hitting at exact same time) → 409
        const affected = await tx.imdadSupplyRequestApproval.updateMany({
          where: { id: currentStep.id, status: 'PENDING' },
          data: { status: 'APPROVED', decidedAt: now, decidedBy: performedByName, comments: comments ?? null },
        });
        if (affected.count === 0) throw WorkflowErrors.ALREADY_PROCESSED();

        let newStatus: string;

        if (isLastStep) {
          newStatus = FINAL_STATUS[supplyRequest.requestType] ?? 'APPROVED';
        } else {
          newStatus = 'IN_APPROVAL';
          const nextStep = (supplyRequest as any).approvalSteps[supplyRequest.currentApprovalStep + 1];
          if (nextStep) {
            await tx.imdadSupplyRequestApproval.update({
              where: { id: nextStep.id },
              data: { status: 'PENDING', pendingSince: now },
            });
          }
        }

        const updatedReq = await tx.imdadSupplyRequest.update({
          where: { id: supplyRequest.id },
          data: {
            status: newStatus as any,
            currentApprovalStep: isLastStep ? supplyRequest.currentApprovalStep : supplyRequest.currentApprovalStep + 1,
          },
          include: { items: true, approvalSteps: { orderBy: { stepNumber: 'asc' } as any } } as any,
        });

        await tx.imdadSupplyRequestAudit.create({
          data: {
            tenantId, requestId: supplyRequest.id, requestCode: supplyRequest.code,
            action: 'APPROVED', performedBy: performedByName, performedByRole: role,
            previousState, newState: newStatus, stepRole: currentStep.role,
            comments: comments ?? null,
            metadata: {
              stepNumber: supplyRequest.currentApprovalStep, traceId,
              resolvedIdentity: { userId: identity.userId, fullName: identity.fullName, role: identity.role, hospitalId: identity.hospitalId, departmentId: identity.departmentId },
              clientSnapshot: identitySnapshot || null,
            },
          },
        });

        if (isLastStep) {
          await tx.imdadSupplyRequestAudit.create({
            data: {
              tenantId, requestId: supplyRequest.id, requestCode: supplyRequest.code,
              action: 'COMPLETED', performedBy: performedByName, performedByRole: role,
              previousState: newStatus, newState: newStatus, stepRole: currentStep.role,
              comments: `Request finalized as ${newStatus}`,
              metadata: { finalStatus: newStatus, totalSteps: (supplyRequest as any).approvalSteps.length, traceId },
            },
          });
        }

        return updatedReq;
      });

      increment('approvals');
      log.success(`Step approved for ${id}`, { requestCode: supplyRequest.code });
      return withTraceId(NextResponse.json(updated), traceId);
    } catch (err: any) {
      if (err instanceof WorkflowError) {
        if (err.statusCode === 409) increment('conflicts');
        if (err.statusCode === 403) increment('forbidden');
        console.error(err.code, err.message);
        return withTraceId(NextResponse.json(err.toResponse(), { status: err.statusCode }), 'trace');
      }
      console.error('INTERNAL_ERROR', err?.message);
      return NextResponse.json({ error: 'INTERNAL_ERROR', message: err?.message }, { status: 500 });
    }
  },
  { platformKey: 'imdad' as any, permissionKey: 'imdad.workflow.manage' },
);
