import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/findings/categories — Finding categorization and distribution
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const findings = await prisma.integrityFinding.findMany({
        where: { tenantId },
        select: {
          id: true,
          type: true,
          category: true,
          severity: true,
          status: true,
          createdAt: true,
        },
        take: 1000,
      });

      // Group by type
      const typeMap: Record<string, { count: number; open: number; resolved: number }> = {};
      findings.forEach((f) => {
        const key = f.type || 'UNCATEGORIZED';
        if (!typeMap[key]) typeMap[key] = { count: 0, open: 0, resolved: 0 };
        typeMap[key].count++;
        if (f.status === 'OPEN' || f.status === 'IN_REVIEW') typeMap[key].open++;
        if (f.status === 'RESOLVED') typeMap[key].resolved++;
      });

      // Group by category
      const categoryMap: Record<string, { count: number; open: number; resolved: number }> = {};
      findings.forEach((f) => {
        const key = f.category || 'UNCATEGORIZED';
        if (!categoryMap[key]) categoryMap[key] = { count: 0, open: 0, resolved: 0 };
        categoryMap[key].count++;
        if (f.status === 'OPEN' || f.status === 'IN_REVIEW') categoryMap[key].open++;
        if (f.status === 'RESOLVED') categoryMap[key].resolved++;
      });

      const byType = Object.entries(typeMap)
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.count - a.count);

      const byCategory = Object.entries(categoryMap)
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.count - a.count);

      // Top recurring issues (most common types by open count)
      const topRecurring = byType
        .filter((t) => t.open > 0)
        .sort((a, b) => b.open - a.open)
        .slice(0, 10);

      return NextResponse.json({
        total: findings.length,
        byType,
        byCategory,
        topRecurring,
      });
    } catch (error: unknown) {
      logger.error('Finding categories error:', { error });
      return NextResponse.json({ error: 'Failed to load finding categories' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.read' }
);
