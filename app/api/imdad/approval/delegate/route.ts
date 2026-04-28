/**
 * SCM Approval — Delegate a Step
 *
 * POST /api/imdad/approval/delegate — Delegate an approval step to another user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const delegateSchema = z.object({
  requestId: z.string().uuid(),
  stepId: z.string().uuid(),
  toUserId: z.string().uuid(),
  reason: z.string().min(1),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = delegateSchema.parse(body);

      // 1. Load the step
      const step = await prisma.imdadApprovalStep.findFirst({
        where: { id: parsed.stepId, requestId: parsed.requestId, tenantId },
      });

      if (!step) {
        return NextResponse.json({ error: 'Approval step not found' }, { status: 404 });
      }

      if (step.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Step is not pending and cannot be delegated' },
          { status: 422 }
        );
      }

      if (!step.canDelegate) {
        return NextResponse.json(
          { error: 'This step does not allow delegation' },
          { status: 403 }
        );
      }

      // 2. Verify current user is the assigned approver
      if (step.approverId !== userId) {
        return NextResponse.json(
          { error: 'Only the assigned approver can delegate this step' },
          { status: 403 }
        );
      }

      // 3. Cannot delegate to self or to the request submitter
      const request = await prisma.imdadApprovalRequest.findFirst({
        where: { id: parsed.requestId, tenantId, isDeleted: false },
      });

      if (!request) {
        return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
      }

      if (parsed.toUserId === request.submittedBy) {
        return NextResponse.json(
          { error: 'Cannot delegate to the request submitter (SoD violation)' },
          { status: 403 }
        );
      }

      // 4. Update step with new approver
      const updatedStep = await prisma.imdadApprovalStep.update({
        where: { id: parsed.stepId },
        data: {
          approverId: parsed.toUserId,
          delegatedFrom: userId,
          delegationReason: parsed.reason,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: request.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'approval_step_delegation',
        resourceId: parsed.stepId,
        boundedContext: 'BC8_APPROVAL',
        metadata: {
          requestId: parsed.requestId,
          fromUserId: userId,
          toUserId: parsed.toUserId,
          reason: parsed.reason,
        },
        request: req,
      });

      return NextResponse.json({
        data: {
          requestId: parsed.requestId,
          stepId: parsed.stepId,
          delegatedTo: parsed.toUserId,
          delegatedFrom: userId,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.delegate' }
);
