import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createAssessmentSchema = z.object({
  standardId: z.string(),
  status: z.enum(['NOT_ASSESSED', 'NON_COMPLIANT', 'PARTIALLY_COMPLIANT', 'COMPLIANT']).default('NOT_ASSESSED'),
  score: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().optional(),
  departmentId: z.string().optional(),
  gapAnalysis: z.string().optional(),
  actionPlan: z.string().optional(),
  nextReviewDate: z.string().nullable().optional(),
});

const updateAssessmentSchema = z.object({
  id: z.string(),
  status: z.enum(['NOT_ASSESSED', 'NON_COMPLIANT', 'PARTIALLY_COMPLIANT', 'COMPLIANT']).optional(),
  score: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().optional(),
  gapAnalysis: z.string().optional(),
  actionPlan: z.string().optional(),
  nextReviewDate: z.string().nullable().optional(),
});

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const standardId = searchParams.get('standardId');
      const status = searchParams.get('status');
      const departmentId = searchParams.get('departmentId');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '50');

      const where: Record<string, unknown> = { tenantId };
      if (standardId) where.standardId = standardId;
      if (status) where.status = status;
      if (departmentId) where.departmentId = departmentId;

      const [assessments, total] = await Promise.all([
        prisma.standardAssessment.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.standardAssessment.count({ where }),
      ]);

      return NextResponse.json({
        assessments,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Assessment list error:', { error });
      return NextResponse.json({ error: 'Failed to list assessments' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.read' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createAssessmentSchema);
      if ('error' in v) return v.error;

      // Validate standard exists
      const standard = await prisma.samStandard.findFirst({ where: { tenantId, id: v.data.standardId } });
      if (!standard) {
        return NextResponse.json({ error: 'Standard not found' }, { status: 404 });
      }

      const assessment = await prisma.standardAssessment.create({
        data: {
          tenantId,
          ...v.data,
          nextReviewDate: v.data.nextReviewDate ? new Date(v.data.nextReviewDate) : null,
          assessedBy: userId,
          assessedAt: new Date(),
          createdBy: userId,
        },
      });

      return NextResponse.json({ assessment }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Assessment create error:', { error });
      return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.write' }
);

export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, updateAssessmentSchema);
      if ('error' in v) return v.error;

      const { id, ...updates } = v.data;
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
        assessedBy: userId,
        assessedAt: new Date(),
      };
      if (updates.status) updateData.status = updates.status;
      if (updates.score !== undefined) updateData.score = updates.score;
      if (updates.notes) updateData.notes = updates.notes;
      if (updates.gapAnalysis) updateData.gapAnalysis = updates.gapAnalysis;
      if (updates.actionPlan) updateData.actionPlan = updates.actionPlan;
      if (updates.nextReviewDate !== undefined) {
        updateData.nextReviewDate = updates.nextReviewDate ? new Date(updates.nextReviewDate) : null;
      }

      const result = await prisma.standardAssessment.updateMany({
        where: { tenantId, id },
        data: updateData,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Assessment update error:', { error });
      return NextResponse.json({ error: 'Failed to update assessment' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.write' }
);
