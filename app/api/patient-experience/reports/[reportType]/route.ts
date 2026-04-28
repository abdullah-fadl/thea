import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { resolvePxTenantUuid } from '@/lib/patient-experience/tenant';
import { isPxReportType } from '@/lib/patient-experience/reports';
import { runPxReport } from '@/lib/patient-experience/reportRunner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/patient-experience/reports/[reportType]?dateFrom=&dateTo=
 *
 * Returns chart-ready data for one report. Validates reportType against the
 * registered list; rejects unknowns with 404.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const reportType = String((await params)?.reportType ?? '');
    if (!isPxReportType(reportType)) {
      return NextResponse.json({ error: 'Unknown report type' }, { status: 404 });
    }
    const resolved = await resolvePxTenantUuid(tenantId);
    if (resolved instanceof NextResponse) return resolved;
    const { tenantUuid } = resolved;

    const url = new URL(req.url);
    const dateFromStr = url.searchParams.get('dateFrom');
    const dateToStr = url.searchParams.get('dateTo');

    const payload = await runPxReport({
      tenantUuid,
      reportType,
      dateFrom: dateFromStr ? new Date(dateFromStr) : null,
      dateTo: dateToStr ? new Date(dateToStr) : null,
    });

    return NextResponse.json({ success: true, ...payload });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'px.reports.view' },
);
