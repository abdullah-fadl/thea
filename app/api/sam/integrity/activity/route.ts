import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const runId = searchParams.get('runId');
      const findingId = searchParams.get('findingId');
      const limit = parseInt(searchParams.get('limit') || '50');
      const page = parseInt(searchParams.get('page') || '1');

      const where: any = { tenantId };
      if (runId) where.metadata = { path: ['runId'], equals: runId };
      if (findingId) where.metadata = { path: ['findingId'], equals: findingId };

      // For simple filtering, fetch all matching and filter in JS
      // since metadata is JSON and Prisma JSON filtering varies by provider
      const allItems = await prisma.integrityActivity.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });

      let filtered = allItems;
      if (runId) {
        filtered = filtered.filter((item: any) => {
          const meta = item.metadata as Record<string, unknown>;
          return meta?.runId === runId;
        });
      }
      if (findingId) {
        filtered = filtered.filter((item: any) => {
          const meta = item.metadata as Record<string, unknown>;
          return meta?.findingId === findingId;
        });
      }

      const total = filtered.length;
      const items = filtered.slice((page - 1) * limit, page * limit);

      return NextResponse.json({
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      logger.error('Integrity activity list error:', { error: error });
      // [SEC-06]
      return NextResponse.json(
        { error: 'Failed to load integrity activity' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.read' }
);
