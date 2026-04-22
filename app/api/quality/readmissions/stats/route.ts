import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getReadmissionStats } from '@/lib/quality/readmissionTracker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/quality/readmissions/stats
 *
 * Returns readmission rate KPIs and dashboard statistics.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    try {
      const stats = await getReadmissionStats(tenantId);
      return NextResponse.json(stats);
    } catch {
      // Return empty stats if DB is not ready
      return NextResponse.json({
        thirtyDayRate: 0,
        totalReadmissions: 0,
        pendingReview: 0,
        reviewedCount: 0,
        actionTakenCount: 0,
        preventablePercent: 0,
        byRootCause: [],
        bySeverity: { preventable: 0, notPreventable: 0, unknown: 0, underReview: 0 },
        trend: [],
      });
    }
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'readmissions.view',
  }
);
