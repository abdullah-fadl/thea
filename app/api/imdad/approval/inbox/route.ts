/**
 * SCM Approval — Inbox
 *
 * GET /api/imdad/approval/inbox — Pending approvals for current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  documentType: z.string().optional(),
  organizationId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = querySchema.parse(params);
      const { page, limit, documentType, organizationId } = parsed;

      // Find active delegations TO current user
      const delegations = await prisma.imdadApprovalDelegation.findMany({
        where: {
          tenantId,
          delegateUserId: userId,
          isActive: true,
          isDeleted: false,
          validUntil: { gt: new Date() },
        },
        select: { delegatorUserId: true },
        take: 100,
      });

      const delegatedFromUserIds = delegations.map((d) => d.delegatorUserId);

      // Build approver filter: direct or delegated
      const approverFilter: any[] = [
        { approverId: userId },
      ];
      if (delegatedFromUserIds.length > 0) {
        approverFilter.push({ approverId: { in: delegatedFromUserIds } });
      }

      // Build step where clause
      const stepWhere: any = {
        tenantId,
        status: 'PENDING',
        OR: approverFilter,
      };

      // Build request filters
      const requestWhere: any = { tenantId, isDeleted: false, status: 'PENDING' };
      if (documentType) requestWhere.entityType = documentType;
      if (organizationId) requestWhere.organizationId = organizationId;

      // Query pending steps with request details
      const [steps, total] = await Promise.all([
        prisma.imdadApprovalStep.findMany({
          where: {
            ...stepWhere,
            request: requestWhere,
          },
          orderBy: { createdAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            request: {
              select: {
                id: true,
                entityId: true,
                entityType: true,
                organizationId: true,
                submittedBy: true,
                totalSteps: true,
                currentStep: true,
                createdAt: true,
              },
            },
          } as any,
        }),
        prisma.imdadApprovalStep.count({
          where: {
            ...stepWhere,
            request: requestWhere,
          },
        }),
      ]);

      // Compute time remaining for each step
      const data = steps.map((step: any) => {
        let timeRemainingHours: number | null = null;
        if (step.timeoutHours && step.createdAt) {
          const deadlineMs = new Date(step.createdAt).getTime() + step.timeoutHours * 3600000;
          timeRemainingHours = Math.max(0, (deadlineMs - Date.now()) / 3600000);
        }

        return {
          stepId: step.id,
          stepNumber: step.stepNumber,
          canDelegate: step.canDelegate,
          timeoutHours: step.timeoutHours,
          timeRemainingHours: timeRemainingHours ? Math.round(timeRemainingHours * 10) / 10 : null,
          isDelegated: delegatedFromUserIds.includes(step.approverId),
          request: step.request,
        };
      });

      return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.inbox.view' }
);
