import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { logAuditEvent, createAuditContext } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createRiskSchema = z.object({
  title: z.string().min(1),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  riskCategory: z.string().optional(),
  likelihood: z.number().min(1).max(5).default(1),
  impact: z.number().min(1).max(5).default(1),
  departmentId: z.string().optional(),
  assignedTo: z.string().optional(),
  mitigationPlan: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  reviewDate: z.string().nullable().optional(),
});

const updateRiskSchema = z.object({
  id: z.string(),
  status: z.enum(['IDENTIFIED', 'ANALYZED', 'MITIGATING', 'MITIGATED', 'ACCEPTED', 'CLOSED']).optional(),
  likelihood: z.number().min(1).max(5).optional(),
  impact: z.number().min(1).max(5).optional(),
  assignedTo: z.string().nullable().optional(),
  mitigationPlan: z.string().optional(),
  residualRisk: z.number().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  reviewDate: z.string().nullable().optional(),
});

function computeRiskLevel(score: number): string {
  if (score >= 20) return 'CRITICAL';
  if (score >= 12) return 'HIGH';
  if (score >= 6) return 'MEDIUM';
  return 'LOW';
}

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const riskLevel = searchParams.get('riskLevel');
      const riskCategory = searchParams.get('riskCategory');
      const departmentId = searchParams.get('departmentId');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');

      const where: Record<string, unknown> = { tenantId };
      if (status) where.status = status;
      if (riskLevel) where.riskLevel = riskLevel;
      if (riskCategory) where.riskCategory = riskCategory;
      if (departmentId) where.departmentId = departmentId;

      const [risks, total] = await Promise.all([
        prisma.riskAssessment.findMany({
          where,
          orderBy: { riskScore: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.riskAssessment.count({ where }),
      ]);

      return NextResponse.json({
        risks,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Risk list error:', { error });
      return NextResponse.json({ error: 'Failed to list risks' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.read' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId, user }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createRiskSchema);
      if ('error' in v) return v.error;

      const riskScore = v.data.likelihood * v.data.impact;
      const riskLevel = computeRiskLevel(riskScore);

      const risk = await prisma.riskAssessment.create({
        data: {
          tenantId,
          ...v.data,
          riskScore,
          riskLevel,
          dueDate: v.data.dueDate ? new Date(v.data.dueDate) : null,
          reviewDate: v.data.reviewDate ? new Date(v.data.reviewDate) : null,
          createdBy: userId,
        },
      });

      try {
        const ctx = createAuditContext({ userId, userRole: user?.role || '', tenantId });
        await logAuditEvent(ctx, 'CREATE' as any, 'RISK' as any, {
          resourceId: risk.id,
          metadata: { title: v.data.title, riskLevel },
        });
      } catch { /* audit best-effort */ }

      return NextResponse.json({ risk }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Risk create error:', { error });
      return NextResponse.json({ error: 'Failed to create risk' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.write' }
);

export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, updateRiskSchema);
      if ('error' in v) return v.error;

      const { id, ...updates } = v.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (updates.status) updateData.status = updates.status;
      if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;
      if (updates.mitigationPlan) updateData.mitigationPlan = updates.mitigationPlan;
      if (updates.residualRisk !== undefined) updateData.residualRisk = updates.residualRisk;
      if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
      if (updates.reviewDate !== undefined) updateData.reviewDate = updates.reviewDate ? new Date(updates.reviewDate) : null;

      if (updates.likelihood !== undefined || updates.impact !== undefined) {
        const existing = await prisma.riskAssessment.findFirst({ where: { tenantId, id }, select: { likelihood: true, impact: true } });
        if (!existing) return NextResponse.json({ error: 'Risk not found' }, { status: 404 });

        const newLikelihood = updates.likelihood ?? existing.likelihood;
        const newImpact = updates.impact ?? existing.impact;
        const newScore = newLikelihood * newImpact;
        updateData.likelihood = newLikelihood;
        updateData.impact = newImpact;
        updateData.riskScore = newScore;
        updateData.riskLevel = computeRiskLevel(newScore);
      }

      const result = await prisma.riskAssessment.updateMany({
        where: { tenantId, id },
        data: updateData,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Risk update error:', { error });
      return NextResponse.json({ error: 'Failed to update risk' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.write' }
);
