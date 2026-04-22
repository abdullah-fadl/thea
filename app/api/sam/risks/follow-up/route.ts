import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createFollowUpSchema = z.object({
  riskId: z.string(),
  note: z.string().optional(),
  scheduledAt: z.string(),
});

const updateFollowUpSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'COMPLETED']).optional(),
  note: z.string().optional(),
});

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const riskId = searchParams.get('riskId');
      const status = searchParams.get('status');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');

      const where: Record<string, unknown> = { tenantId };
      if (riskId) where.riskId = riskId;
      if (status) where.status = status;

      const [followUps, total] = await Promise.all([
        prisma.riskFollowUp.findMany({
          where,
          orderBy: { scheduledAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.riskFollowUp.count({ where }),
      ]);

      return NextResponse.json({
        followUps,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Follow-up list error:', { error });
      return NextResponse.json({ error: 'Failed to list follow-ups' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.read' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createFollowUpSchema);
      if ('error' in v) return v.error;

      const risk = await prisma.riskAssessment.findFirst({ where: { tenantId, id: v.data.riskId } });
      if (!risk) {
        return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
      }

      const followUp = await prisma.riskFollowUp.create({
        data: {
          tenantId,
          riskId: v.data.riskId,
          note: v.data.note,
          scheduledAt: new Date(v.data.scheduledAt),
          createdBy: userId,
        },
      });

      return NextResponse.json({ followUp }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Follow-up create error:', { error });
      return NextResponse.json({ error: 'Failed to create follow-up' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.write' }
);

export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, updateFollowUpSchema);
      if ('error' in v) return v.error;

      const { id, ...updates } = v.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.status) {
        updateData.status = updates.status;
        if (updates.status === 'COMPLETED') {
          updateData.completedAt = new Date();
          updateData.completedBy = userId;
        }
      }
      if (updates.note) updateData.note = updates.note;

      const result = await prisma.riskFollowUp.updateMany({
        where: { tenantId, id },
        data: updateData,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Follow-up update error:', { error });
      return NextResponse.json({ error: 'Failed to update follow-up' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.write' }
);
