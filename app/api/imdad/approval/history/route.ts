/**
 * SCM Approval — History
 *
 * GET /api/imdad/approval/history — Full approval history with filters
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
  status: z.string().optional(),
  actorId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = querySchema.parse(params);
      const { page, limit, documentType, status, actorId, organizationId, dateFrom, dateTo } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (documentType) where.entityType = documentType;
      if (status) where.status = status;
      if (organizationId) where.organizationId = organizationId;
      if (actorId) where.submittedBy = actorId;

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }

      const [data, total] = await Promise.all([
        prisma.imdadApprovalRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            steps: {
              orderBy: { stepNumber: 'asc' },
              select: {
                id: true,
                stepNumber: true,
                approverId: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            decisions: {
              orderBy: { decidedAt: 'desc' },
              select: {
                id: true,
                requestId: true,
                stepNumber: true,
                status: true,
                approverId: true,
                delegatedToId: true,
                comments: true,
                decidedAt: true,
              },
            },
          } as any,
        }),
        prisma.imdadApprovalRequest.count({ where }),
      ]);

      return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.history.view' }
);
