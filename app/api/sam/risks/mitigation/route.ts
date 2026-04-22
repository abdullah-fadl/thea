import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createMitigationSchema = z.object({
  riskId: z.string(),
  title: z.string().min(1),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  strategy: z.enum(['AVOID', 'MITIGATE', 'TRANSFER', 'ACCEPT']).default('MITIGATE'),
  assignedTo: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

const updateMitigationSchema = z.object({
  id: z.string(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED']).optional(),
  effectivenessScore: z.number().min(0).max(100).nullable().optional(),
  assignedTo: z.string().nullable().optional(),
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

      const [mitigations, total] = await Promise.all([
        prisma.riskMitigation.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.riskMitigation.count({ where }),
      ]);

      return NextResponse.json({
        mitigations,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Mitigation list error:', { error });
      return NextResponse.json({ error: 'Failed to list mitigations' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.read' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createMitigationSchema);
      if ('error' in v) return v.error;

      // Validate risk exists
      const risk = await prisma.riskAssessment.findFirst({ where: { tenantId, id: v.data.riskId } });
      if (!risk) {
        return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
      }

      const mitigation = await prisma.riskMitigation.create({
        data: {
          tenantId,
          ...v.data,
          dueDate: v.data.dueDate ? new Date(v.data.dueDate) : null,
          createdBy: userId,
        },
      });

      return NextResponse.json({ mitigation }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Mitigation create error:', { error });
      return NextResponse.json({ error: 'Failed to create mitigation' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.write' }
);

export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, updateMitigationSchema);
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
      if (updates.effectivenessScore !== undefined) updateData.effectivenessScore = updates.effectivenessScore;
      if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;

      const result = await prisma.riskMitigation.updateMany({
        where: { tenantId, id },
        data: updateData,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Mitigation not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Mitigation update error:', { error });
      return NextResponse.json({ error: 'Failed to update mitigation' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.write' }
);
