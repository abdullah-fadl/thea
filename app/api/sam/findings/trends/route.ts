import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/findings/trends — Finding trends over time
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const days = parseInt(searchParams.get('days') || '90');

      const since = new Date();
      since.setDate(since.getDate() - days);

      const findings = await prisma.integrityFinding.findMany({
        where: {
          tenantId,
          createdAt: { gte: since },
        },
        select: {
          id: true,
          type: true,
          category: true,
          severity: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 1000,
      });

      // Group by week
      const weeklyTrends: Record<string, { opened: number; resolved: number; week: string }> = {};
      findings.forEach((f) => {
        const date = new Date(f.createdAt);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!weeklyTrends[weekKey]) {
          weeklyTrends[weekKey] = { opened: 0, resolved: 0, week: weekKey };
        }
        weeklyTrends[weekKey].opened++;

        if (f.resolvedAt) {
          const resolvedDate = new Date(f.resolvedAt);
          const resolvedWeekStart = new Date(resolvedDate);
          resolvedWeekStart.setDate(resolvedDate.getDate() - resolvedDate.getDay());
          const resolvedWeekKey = resolvedWeekStart.toISOString().split('T')[0];
          if (!weeklyTrends[resolvedWeekKey]) {
            weeklyTrends[resolvedWeekKey] = { opened: 0, resolved: 0, week: resolvedWeekKey };
          }
          weeklyTrends[resolvedWeekKey].resolved++;
        }
      });

      // Severity distribution
      const bySeverity = {
        CRITICAL: findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'critical').length,
        HIGH: findings.filter((f) => f.severity === 'HIGH' || f.severity === 'high').length,
        MEDIUM: findings.filter((f) => f.severity === 'MEDIUM' || f.severity === 'medium').length,
        LOW: findings.filter((f) => f.severity === 'LOW' || f.severity === 'low').length,
      };

      // Status distribution
      const byStatus = {
        OPEN: findings.filter((f) => f.status === 'OPEN').length,
        IN_REVIEW: findings.filter((f) => f.status === 'IN_REVIEW').length,
        RESOLVED: findings.filter((f) => f.status === 'RESOLVED').length,
        IGNORED: findings.filter((f) => f.status === 'IGNORED').length,
      };

      // Average time to resolution (in days)
      const resolvedFindings = findings.filter((f) => f.resolvedAt);
      const avgResolutionDays = resolvedFindings.length > 0
        ? Math.round(
            resolvedFindings.reduce((sum, f) => {
              return sum + (new Date(f.resolvedAt!).getTime() - new Date(f.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            }, 0) / resolvedFindings.length * 10
          ) / 10
        : null;

      return NextResponse.json({
        period: { days, since: since.toISOString() },
        totalFindings: findings.length,
        weeklyTrends: Object.values(weeklyTrends).sort((a, b) => a.week.localeCompare(b.week)),
        bySeverity,
        byStatus,
        avgResolutionDays,
      });
    } catch (error: unknown) {
      logger.error('Finding trends error:', { error });
      return NextResponse.json({ error: 'Failed to load finding trends' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.read' }
);
