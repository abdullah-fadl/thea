import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getGapStatistics } from '@/lib/quality/careGapScanner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/care-gaps/findings/stats
 *
 * Returns aggregated care gap finding statistics for the scanner dashboard.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    try {
      const stats = await getGapStatistics(tenantId);
      return NextResponse.json(stats);
    } catch {
      // Return empty stats if DB is not ready
      return NextResponse.json({
        totalOpen: 0,
        totalAddressed: 0,
        totalDismissed: 0,
        bySeverity: { low: 0, moderate: 0, high: 0, critical: 0 },
        byCategory: {},
        byGapType: {},
        addressedThisMonth: 0,
        closureRate: 0,
        trend: [],
      });
    }
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'care-gaps.view',
  }
);
