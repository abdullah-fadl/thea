/**
 * SCM Approval — Record Decision
 *
 * POST /api/imdad/approval/decide — Approve or reject an approval step
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const decideSchema = z.object({
  requestId: z.string().uuid(),
  stepId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = decideSchema.parse(body);

      // 1. Load request
      const request = await prisma.imdadApprovalRequest.findFirst({
        where: { id: parsed.requestId, tenantId, isDeleted: false },
      });

      if (!request) {
        return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
      }

      if (request.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Request is no longer pending', currentStatus: request.status },
          { status: 422 }
        );
      }

      // 2. Separation of Duties — approver cannot be submitter
      if (request.submittedBy === userId) {
        return NextResponse.json(
          { error: 'Separation of duties violation: approver cannot be the same as submitter' },
          { status: 403 }
        );
      }

      // 3. Load step
      const step = await prisma.imdadApprovalStep.findFirst({
        where: { id: parsed.stepId, requestId: parsed.requestId, tenantId },
      });

      if (!step) {
        return NextResponse.json({ error: 'Approval step not found' }, { status: 404 });
      }

      if (step.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Step is not pending', currentStatus: step.status },
          { status: 422 }
        );
      }

      // 4. Verify approver authorization (check user or delegated user)
      const isDirectApprover = step.approverId === userId;
      const delegation = await prisma.imdadApprovalDelegation.findFirst({
        where: {
          tenantId,
          delegatorUserId: step.approverId || undefined,
          delegateUserId: userId,
          isActive: true,
          isDeleted: false,
          OR: [
            { validUntil: null },
            { validUntil: { gt: new Date() } },
          ],
        },
      });

      if (!isDirectApprover && !delegation) {
        return NextResponse.json(
          { error: 'You are not authorized to decide on this step' },
          { status: 403 }
        );
      }

      // 5. Execute decision in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Record decision
        await tx.imdadApprovalDecision.create({
          data: {
            tenantId,
            requestId: parsed.requestId,
            stepId: parsed.stepId,
            decision: parsed.decision as any,
            decidedBy: userId,
            delegatedFrom: delegation ? step.approverId : null,
            comments: parsed.comments,
            decidedAt: new Date(),
            createdBy: userId,
          } as any,
        });

        // Update step status
        await tx.imdadApprovalStep.update({
          where: { id: parsed.stepId },
          data: {
            status: parsed.decision as any,
            decidedBy: userId,
            decidedAt: new Date(),
            comments: parsed.comments,
          } as any,
        });

        if (parsed.decision === 'REJECTED') {
          // Reject the whole request
          await tx.imdadApprovalRequest.update({
            where: { id: parsed.requestId },
            data: {
              status: 'REJECTED' as any,
              completedAt: new Date(),
            } as any,
          });
          return { status: 'REJECTED' as const };
        }

        // APPROVED — check if last step
        const totalSteps = request.totalSteps;
        const currentStep = step.stepNumber;

        if (currentStep >= totalSteps) {
          // Last step — complete the request
          await tx.imdadApprovalRequest.update({
            where: { id: parsed.requestId },
            data: {
              status: 'APPROVED' as any,
              currentStep: currentStep,
              completedAt: new Date(),
            } as any,
          });
          return { status: 'APPROVED' as const };
        }

        // Not last step — advance to next
        const nextStepNumber = currentStep + 1;
        await tx.imdadApprovalStep.updateMany({
          where: { requestId: parsed.requestId, stepNumber: nextStepNumber, tenantId },
          data: { status: 'PENDING' as any },
        });

        await tx.imdadApprovalRequest.update({
          where: { id: parsed.requestId },
          data: { currentStep: nextStepNumber } as any,
        });

        return { status: 'PENDING' as const };
      });

      await imdadAudit.log({
        tenantId,
        organizationId: request.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'approval_decision',
        resourceId: parsed.stepId,
        boundedContext: 'BC8_APPROVAL',
        metadata: {
          requestId: parsed.requestId,
          decision: parsed.decision,
          resultStatus: result.status,
        },
        request: req,
      });

      return NextResponse.json({
        data: {
          requestId: parsed.requestId,
          status: result.status,
          decision: parsed.decision,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.decide' }
);
