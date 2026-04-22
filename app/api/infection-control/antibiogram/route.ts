import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { generateAntibiogram } from '@/lib/analytics/antibiogram';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/infection-control/antibiogram
 * Generates annual organism × antibiotic susceptibility matrix.
 * Query params: year (defaults to current year), minIsolates (default 30)
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get('year') || '') || new Date().getFullYear();
    const minIsolates = Math.max(1, parseInt(url.searchParams.get('minIsolates') || '30'));

    if (year < 2020 || year > 2030) {
      return NextResponse.json({ error: 'Year must be between 2020 and 2030' }, { status: 400 });
    }

    const result = await generateAntibiogram(tenantId, year, minIsolates);

    return NextResponse.json(result);
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);
