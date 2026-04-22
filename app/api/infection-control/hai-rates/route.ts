import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { calculateHAIRates } from '@/lib/analytics/haiRates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/infection-control/hai-rates
 * Calculates standardized HAI rates: VAP, CLABSI, CAUTI per 1000 device-days, SSI per 100 procedures.
 * Query params: startMonth (YYYY-MM), endMonth (YYYY-MM)
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);

    // Default to last 12 months
    const now = new Date();
    const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const defaultStart = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    const startMonth = url.searchParams.get('startMonth') || defaultStart;
    const endMonth = url.searchParams.get('endMonth') || defaultEnd;

    // Validate YYYY-MM format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(startMonth) || !monthRegex.test(endMonth)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM.' }, { status: 400 });
    }

    const result = await calculateHAIRates(tenantId, startMonth, endMonth);

    return NextResponse.json({
      startMonth,
      endMonth,
      rates: result.rates,
      monthlyTrend: result.monthlyTrend,
      deviceDayTotals: result.deviceDayTotals,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);
