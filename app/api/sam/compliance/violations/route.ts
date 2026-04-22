import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createViolationSchema = z.object({
  requirementId: z.string().optional(),
  title: z.string().min(1),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  departmentId: z.string().optional(),
  assignedTo: z.string().optional(),
  slaDeadline: z.string().nullable().optional(),
});

const updateViolationSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assignedTo: z.string().nullable().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  correctiveActionId: z.string().nullable().optional(),
});

/**
 * GET /api/sam/compliance/violations — List compliance violations
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const severity = searchParams.get('severity');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');

      const where: Record<string, unknown> = { tenantId };
      if (status) where.status = status;
      if (severity) where.severity = severity;

      const [violations, total] = await Promise.all([
        prisma.complianceViolation.findMany({
          where,
          orderBy: { detectedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.complianceViolation.count({ where }),
      ]);

      return NextResponse.json({
        violations,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Violations list error:', { error });
      return NextResponse.json({ error: 'Failed to list violations' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.read' }
);

/**
 * POST /api/sam/compliance/violations — Create a compliance violation
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createViolationSchema);
      if ('error' in v) return v.error;

      const violation = await prisma.complianceViolation.create({
        data: {
          tenantId,
          ...v.data,
          slaDeadline: v.data.slaDeadline ? new Date(v.data.slaDeadline) : null,
          createdBy: userId,
        },
      });

      return NextResponse.json({ violation }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Violation create error:', { error });
      return NextResponse.json({ error: 'Failed to create violation' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.write' }
);

/**
 * PATCH /api/sam/compliance/violations — Update a violation (pass id in body)
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const { id, ...rest } = body;
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

      const v = validateBody(rest, updateViolationSchema);
      if ('error' in v) return v.error;

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (v.data.status) updateData.status = v.data.status;
      if (v.data.status === 'RESOLVED') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = userId;
      }
      if (v.data.assignedTo !== undefined) updateData.assignedTo = v.data.assignedTo;
      if (v.data.severity) updateData.severity = v.data.severity;
      if (v.data.correctiveActionId !== undefined) updateData.correctiveActionId = v.data.correctiveActionId;

      const result = await prisma.complianceViolation.updateMany({
        where: { tenantId, id },
        data: updateData,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Violation update error:', { error });
      return NextResponse.json({ error: 'Failed to update violation' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.write' }
);
