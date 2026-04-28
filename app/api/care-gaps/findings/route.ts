import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getOpenGaps } from '@/lib/quality/careGapScanner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/care-gaps/findings?patientId=...&category=...&severity=...&status=open&gapType=...&page=1&limit=20
 *
 * List care gap findings (from the clinical scanner) with optional filters.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = req.nextUrl;
    const patientId = url.searchParams.get('patientId') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const severity = url.searchParams.get('severity') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const gapType = url.searchParams.get('gapType') || undefined;
    const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 100);

    const result = await getOpenGaps(tenantId, {
      patientId,
      category,
      severity,
      status,
      gapType,
      page,
      limit,
    });

    return NextResponse.json(result);
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'care-gaps.view',
  }
);
