import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getAggregatedOPDData, calculateStatsFromRecords } from '@/lib/opd/data-aggregator';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildDateRange(period: string) {
  const now = new Date();
  let gte: Date;
  let lte: Date = new Date(now);
  lte.setHours(23, 59, 59, 999);

  switch (period) {
    case 'today':
      gte = new Date(now);
      gte.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      gte = new Date(now);
      gte.setDate(gte.getDate() - 7);
      gte.setHours(0, 0, 0, 0);
      break;
    }
    case 'month': {
      gte = new Date(now);
      gte.setMonth(gte.getMonth() - 1);
      gte.setHours(0, 0, 0, 0);
      break;
    }
    case 'quarter': {
      gte = new Date(now);
      gte.setMonth(gte.getMonth() - 3);
      gte.setHours(0, 0, 0, 0);
      break;
    }
    case 'year': {
      gte = new Date(now);
      gte.setFullYear(gte.getFullYear() - 1);
      gte.setHours(0, 0, 0, 0);
      break;
    }
    default:
      gte = new Date(now);
      gte.setDate(gte.getDate() - 30);
      gte.setHours(0, 0, 0, 0);
  }

  return { gte, lte };
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const period = req.nextUrl.searchParams.get('period') || 'month';
    const departmentId = req.nextUrl.searchParams.get('departmentId') || undefined;

    const dateRange = buildDateRange(period);
    const records = await getAggregatedOPDData(dateRange, departmentId, tenantId);
    const stats = calculateStatsFromRecords(records);

    return NextResponse.json({
      success: true,
      period,
      dateRange: {
        from: dateRange.gte.toISOString(),
        to: dateRange.lte.toISOString(),
      },
      stats,
      recordCount: records.length,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.dashboard.view' }
);
