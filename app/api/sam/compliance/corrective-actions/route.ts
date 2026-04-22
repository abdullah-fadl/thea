import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createActionSchema = z.object({
  violationId: z.string().optional(),
  findingId: z.string().optional(),
  title: z.string().min(1),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  actionType: z.enum(['CORRECTIVE', 'PREVENTIVE', 'IMPROVEMENT']).default('CORRECTIVE'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  assignedTo: z.string().optional(),
  departmentId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  rootCause: z.string().optional(),
});

const updateActionSchema = z.object({
  id: z.string(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED']).optional(),
  assignedTo: z.string().nullable().optional(),
  actionTaken: z.string().optional(),
  effectiveness: z.string().optional(),
  rootCause: z.string().optional(),
});

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const violationId = searchParams.get('violationId');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');

      const where: Record<string, unknown> = { tenantId };
      if (status) where.status = status;
      if (violationId) where.violationId = violationId;

      const [actions, total] = await Promise.all([
        prisma.correctiveAction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.correctiveAction.count({ where }),
      ]);

      return NextResponse.json({
        actions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Corrective actions list error:', { error });
      return NextResponse.json({ error: 'Failed to list corrective actions' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.read' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createActionSchema);
      if ('error' in v) return v.error;

      const action = await prisma.correctiveAction.create({
        data: {
          tenantId,
          ...v.data,
          dueDate: v.data.dueDate ? new Date(v.data.dueDate) : null,
          createdBy: userId,
        },
      });

      return NextResponse.json({ action }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Corrective action create error:', { error });
      return NextResponse.json({ error: 'Failed to create corrective action' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.write' }
);

export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, updateActionSchema);
      if ('error' in v) return v.error;

      const { id, ...updates } = v.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.status) {
        updateData.status = updates.status;
        if (updates.status === 'COMPLETED') {
          updateData.completedAt = new Date();
          updateData.completedBy = userId;
        }
        if (updates.status === 'VERIFIED') {
          updateData.verifiedAt = new Date();
          updateData.verifiedBy = userId;
        }
      }
      if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;
      if (updates.actionTaken) updateData.actionTaken = updates.actionTaken;
      if (updates.effectiveness) updateData.effectiveness = updates.effectiveness;
      if (updates.rootCause) updateData.rootCause = updates.rootCause;

      const result = await prisma.correctiveAction.updateMany({
        where: { tenantId, id },
        data: updateData,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Corrective action not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Corrective action update error:', { error });
      return NextResponse.json({ error: 'Failed to update corrective action' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.write' }
);
