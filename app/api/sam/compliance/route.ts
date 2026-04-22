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

const createRequirementSchema = z.object({
  title: z.string().min(1),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  standardId: z.string().optional(),
  standardCode: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['NOT_MET', 'PARTIALLY_MET', 'MET', 'NOT_APPLICABLE']).default('NOT_MET'),
  dueDate: z.string().nullable().optional(),
  evidenceRequired: z.boolean().default(false),
  assignedTo: z.string().optional(),
  departmentId: z.string().optional(),
});

/**
 * GET /api/sam/compliance — List compliance requirements
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const category = searchParams.get('category');
      const priority = searchParams.get('priority');
      const standardId = searchParams.get('standardId');
      const departmentId = searchParams.get('departmentId');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');

      const where: Record<string, unknown> = { tenantId };
      if (status) where.status = status;
      if (category) where.category = category;
      if (priority) where.priority = priority;
      if (standardId) where.standardId = standardId;
      if (departmentId) where.departmentId = departmentId;

      const [requirements, total] = await Promise.all([
        prisma.complianceRequirement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.complianceRequirement.count({ where }),
      ]);

      return NextResponse.json({
        requirements,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Compliance list error:', { error });
      return NextResponse.json({ error: 'Failed to list compliance requirements' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.read' }
);

/**
 * POST /api/sam/compliance — Create a compliance requirement
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId, user }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createRequirementSchema);
      if ('error' in v) return v.error;

      const requirement = await prisma.complianceRequirement.create({
        data: {
          tenantId,
          ...v.data,
          dueDate: v.data.dueDate ? new Date(v.data.dueDate) : null,
          createdBy: userId,
        },
      });

      try {
        const ctx = createAuditContext({ userId, userRole: user?.role || '', tenantId });
        await logAuditEvent(ctx, 'CREATE' as any, 'COMPLIANCE' as any, {
          resourceId: requirement.id,
          metadata: { title: v.data.title },
        });
      } catch { /* audit best-effort */ }

      return NextResponse.json({ requirement }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Compliance create error:', { error });
      return NextResponse.json({ error: 'Failed to create compliance requirement' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.write' }
);
