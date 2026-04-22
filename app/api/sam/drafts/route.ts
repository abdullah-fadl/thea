import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/drafts — List all drafts for the tenant
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const departmentId = searchParams.get('departmentId');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { tenantId };
      if (status) where.status = status;
      if (departmentId) where.departmentId = departmentId;

      const [drafts, total] = await Promise.all([
        prisma.draftDocument.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.draftDocument.count({ where }),
      ]);

      return NextResponse.json({
        drafts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: unknown) {
      logger.error('Draft list error:', { error });
      return NextResponse.json(
        { error: 'Failed to list drafts' },
        { status: 500 }
      );
    }
  }),
  { platformKey: 'sam', tenantScoped: true }
);
