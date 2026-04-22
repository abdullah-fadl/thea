/**
 * SCM Approval — Escalate a Step
 *
 * POST /api/imdad/approval/escalate — Escalate a timed-out or stuck step
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const escalateSchema = z.object({
  requestId: z.string().uuid(),
  stepId: z.string().uuid(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = escalateSchema.parse(body);

      // 1. Load step
      const step = await prisma.imdadApprovalStep.findFirst({
        where: { id: parsed.stepId, requestId: parsed.requestId, tenantId },
      });

      if (!step) {
        return NextResponse.json({ error: 'Approval step not found' }, { status: 404 });
      }

      if (step.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Step is not pending and cannot be escalated' },
          { status: 422 }
        );
      }

      // 2. Load the workflow rule step to get escalation target
      const ruleStep = await prisma.imdadApprovalWorkflowRuleStep.findFirst({
        where: {
          tenantId,
          stepNumber: step.stepNumber,
          rule: {
            id: (step as any).ruleId || undefined,
          },
        } as any,
      });

      const escalationUserId = ruleStep?.escalateToUserId;
      const escalationRoleKey = ruleStep?.escalateToRoleKey;

      if (!escalationUserId && !escalationRoleKey) {
        return NextResponse.json(
          { error: 'No escalation target configured for this step' },
          { status: 422 }
        );
      }

      // 3. Load request for audit
      const request = await prisma.imdadApprovalRequest.findFirst({
        where: { id: parsed.requestId, tenantId, isDeleted: false },
      });

      if (!request) {
        return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
      }

      // 4. Update step with escalation
      const previousApprover = step.approverId;

      const updatedStep = await prisma.imdadApprovalStep.update({
        where: { id: parsed.stepId },
        data: {
          approverId: escalationUserId || step.approverId,
          approverRole: escalationRoleKey || step.approverRole,
          isEscalated: true,
          escalatedAt: new Date(),
          escalatedBy: userId,
          escalatedFrom: previousApprover,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: request.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'approval_step_escalation',
        resourceId: parsed.stepId,
        boundedContext: 'BC8_APPROVAL',
        metadata: {
          requestId: parsed.requestId,
          previousApprover,
          escalatedTo: escalationUserId || escalationRoleKey,
        },
        request: req,
      });

      return NextResponse.json({
        data: {
          requestId: parsed.requestId,
          stepId: parsed.stepId,
          escalatedTo: escalationUserId || escalationRoleKey,
          escalatedFrom: previousApprover,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.escalate' }
);
