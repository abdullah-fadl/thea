import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const runId = String((resolvedParams as Record<string, string>)?.runId || '').trim();
      if (!runId) {
        return NextResponse.json({ error: 'runId is required' }, { status: 400 });
      }

      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const limit = parseInt(searchParams.get('limit') || '50');
      const page = parseInt(searchParams.get('page') || '1');

      const where: any = { tenantId, runId, archivedAt: null };
      if (status) {
        where.status = status;
      }

      const [total, findings] = await Promise.all([
        prisma.integrityFinding.count({ where }),
        prisma.integrityFinding.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return NextResponse.json({
        items: findings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      logger.error('Integrity findings list error:', { error: error });
      // [SEC-06]
      return NextResponse.json(
        { error: 'Failed to list integrity findings' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.read' }
);
