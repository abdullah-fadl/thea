import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { resolvePxTenantUuid } from '@/lib/patient-experience/tenant';
import { isPxReportType } from '@/lib/patient-experience/reports';
import { runPxReport } from '@/lib/patient-experience/reportRunner';
import { rowsToCsv, type CsvRow } from '@/lib/patient-experience/csv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/patient-experience/reports/[reportType]/export?dateFrom=&dateTo=
 *
 * Same data as the JSON endpoint, served as text/csv with a download disposition.
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
    const payload = await runPxReport({
      tenantUuid,
      reportType,
      dateFrom: url.searchParams.get('dateFrom')
        ? new Date(url.searchParams.get('dateFrom')!)
        : null,
      dateTo: url.searchParams.get('dateTo')
        ? new Date(url.searchParams.get('dateTo')!)
        : null,
    });

    const rows = payload.rows as unknown as CsvRow[];
    const csv = rowsToCsv(rows);
    const filename = `px-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'px.reports.export',
  },
);
