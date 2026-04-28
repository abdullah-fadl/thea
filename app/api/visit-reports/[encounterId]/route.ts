import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import {
  generateVisitReport,
  renderReportToHtml,
  renderReportToText,
} from '@/lib/opd/visitReportGenerator';

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId, user }) => {
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const encounterId = segments[segments.indexOf('visit-reports') + 1];
    const format = url.searchParams.get('format') || 'json';
    const lang = (url.searchParams.get('lang') || 'en') as 'ar' | 'en';

    if (!encounterId) {
      return NextResponse.json({ error: 'Missing encounterId' }, { status: 400 });
    }

    const report = await generateVisitReport(
      prisma,
      tenantId,
      encounterId,
      user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email,
    );

    if (!report) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
    }

    if (format === 'html') {
      const html = renderReportToHtml(report, lang);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="visit-report-${report.reportId}.html"`,
        },
      });
    }

    if (format === 'text') {
      const text = renderReportToText(report, lang);
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="visit-report-${report.reportId}.txt"`,
        },
      });
    }

    return NextResponse.json(report);
  }),
  { platformKey: 'thea_health', permissionKey: 'opd.visit.view' },
);
