import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/compliance/monitor — Monitor compliance status across all requirements
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const requirements = await prisma.complianceRequirement.findMany({
        where: { tenantId },
        select: { id: true, status: true, priority: true, category: true, dueDate: true, departmentId: true },
        take: 1000,
      });

      const now = new Date();
      const summary = {
        total: requirements.length,
        met: requirements.filter((r) => r.status === 'MET').length,
        partiallyMet: requirements.filter((r) => r.status === 'PARTIALLY_MET').length,
        notMet: requirements.filter((r) => r.status === 'NOT_MET').length,
        notApplicable: requirements.filter((r) => r.status === 'NOT_APPLICABLE').length,
        overdue: requirements.filter((r) => r.dueDate && new Date(r.dueDate) < now && r.status !== 'MET').length,
        complianceRate: requirements.length > 0
          ? Math.round(
              (requirements.filter((r) => r.status === 'MET').length /
                requirements.filter((r) => r.status !== 'NOT_APPLICABLE').length) *
                100
            ) || 0
          : 0,
      };

      // By priority breakdown
      const byPriority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => ({
        priority: p,
        total: requirements.filter((r) => r.priority === p).length,
        met: requirements.filter((r) => r.priority === p && r.status === 'MET').length,
      }));

      // By category breakdown
      const categories = [...new Set(requirements.map((r) => r.category).filter(Boolean))];
      const byCategory = categories.map((c) => ({
        category: c,
        total: requirements.filter((r) => r.category === c).length,
        met: requirements.filter((r) => r.category === c && r.status === 'MET').length,
      }));

      // Violations count
      const openViolations = await prisma.complianceViolation.count({
        where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      });

      return NextResponse.json({
        summary,
        byPriority,
        byCategory,
        openViolations,
        lastChecked: now.toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Compliance monitor error:', { error });
      return NextResponse.json({ error: 'Failed to monitor compliance' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.read' }
);
