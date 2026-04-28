/**
 * OPD Intelligence — Meeting Report API
 *
 * GET /api/opd/dashboard/intelligence/report
 *
 * Generates a management meeting report using AI or template fallback.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { generateMeetingReport } from '@/lib/opd/intelligence/meetingReport';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  try {
    const report = await generateMeetingReport(null, tenantId);
    return NextResponse.json(report);
  } catch (err) {
    logger.error('Meeting report generation error', { category: 'opd', error: err });
    return NextResponse.json(
      { error: 'Failed to generate meeting report' },
      { status: 500 },
    );
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.dashboard.strategic' }
);
