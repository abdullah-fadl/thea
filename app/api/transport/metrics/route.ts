import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getTransportMetrics } from '@/lib/transport/transportEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/transport/metrics — Transport KPIs and metrics
// Query: from, to (ISO date strings for date range)
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const dateRange =
      from && to
        ? { from: new Date(from), to: new Date(to) }
        : undefined;

    const metrics = await getTransportMetrics(tenantId, dateRange);

    return NextResponse.json({ metrics });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'transport.view',
  },
);
