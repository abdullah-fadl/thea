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

      // ── IDENTITY LOCK: if client sent a snapshot, validate it matches ──
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
      const log = workflowLogger({ traceId, route: '/api/imdad/workflow/requests/[id]/reject', action: 'REJECT', tenantId, userId, role, requestId: id as string });
      log.start();

      const supplyRequest = await prisma.imdadSupplyRequest.findFirst({
        where: { id: id as string, tenantId, isDeleted: false },
        include: { approvalSteps: { orderBy: { stepNumber: 'asc' } as any }, items: true } as any,
      });

      if (!supplyRequest) throw WorkflowErrors.REQUEST_NOT_FOUND();

      // SAFE RETRY: if already rejected, return current state
      if (supplyRequest.status === 'REJECTED') {
        log.success(`Safe retry — already REJECTED`);
        return withTraceId(NextResponse.json(supplyRequest), traceId);
      }

      // Terminal states that are NOT rejection → cannot reject
      if (isTerminalState(supplyRequest.status)) throw WorkflowErrors.TERMINAL_STATE(supplyRequest.status);

      const currentStep = (supplyRequest as any).approvalSteps[supplyRequest.currentApprovalStep];
      if (!currentStep) throw WorkflowErrors.NO_APPROVAL_STEP();

      // SAFE RETRY: if this step is already rejected, return current state
      if (currentStep.status === 'REJECTED') {
        log.success(`Safe retry — step ${currentStep.role} already rejected`);
        return withTraceId(NextResponse.json(supplyRequest), traceId);
      }

      if (currentStep.role !== role && currentStep.escalatedTo !== role) {
        throw WorkflowErrors.NOT_YOUR_TURN(role, currentStep.role, currentStep.escalatedTo);
      }

      const now = new Date();
      const previousState = supplyRequest.status;

      const updated = await prisma.$transaction(async (tx) => {
        // CONCURRENCY GUARD: conditional update — only if step is still PENDING
        const affected = await tx.imdadSupplyRequestApproval.updateMany({
          where: { id: currentStep.id, status: 'PENDING' },
          data: { status: 'REJECTED', decidedAt: now, decidedBy: performedByName, comments: comments ?? null },
        });
        if (affected.count === 0) throw WorkflowErrors.ALREADY_PROCESSED();

        const updatedReq = await tx.imdadSupplyRequest.update({
          where: { id: supplyRequest.id },
          data: { status: 'REJECTED' },
          include: { items: true, approvalSteps: { orderBy: { stepNumber: 'asc' } as any } } as any,
        });

        await tx.imdadSupplyRequestAudit.create({
          data: {
            tenantId, requestId: supplyRequest.id, requestCode: supplyRequest.code,
            action: 'REJECTED', performedBy: performedByName, performedByRole: role,
            previousState, newState: 'REJECTED', stepRole: currentStep.role,
            comments: comments ?? null, metadata: { stepNumber: supplyRequest.currentApprovalStep, traceId },
          },
        });

        return updatedReq;
      });

      increment('rejections');
      log.success(`Step rejected for ${id}`, { requestCode: supplyRequest.code });
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
