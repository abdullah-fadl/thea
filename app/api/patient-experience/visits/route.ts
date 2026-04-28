import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { resolvePxTenantUuid } from '@/lib/patient-experience/tenant';
import { PX_SENTIMENTS } from '@/lib/patient-experience/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE_MAX = 100;

/**
 * GET /api/patient-experience/visits
 *
 * Lists PxVisitExperience rows with experience flags. Filters: dateFrom,
 * dateTo, departmentKey, sentiment, hasComplaint (true|false).
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const resolved = await resolvePxTenantUuid(tenantId);
    if (resolved instanceof NextResponse) return resolved;
    const { tenantUuid } = resolved;

    const url = new URL(req.url);
    const departmentKey = url.searchParams.get('departmentKey') ?? '';
    const sentiment = url.searchParams.get('sentiment') ?? '';
    const hasComplaint = url.searchParams.get('hasComplaint');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const limit = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, Number(url.searchParams.get('limit') ?? '25') || 25),
    );

    const where: Record<string, unknown> = { tenantId: tenantUuid };
    if (departmentKey) where.departmentKey = departmentKey;
    if (sentiment && (PX_SENTIMENTS as readonly string[]).includes(sentiment)) {
      where.sentiment = sentiment;
    }
    if (hasComplaint === 'true') where.hasComplaint = true;
    if (hasComplaint === 'false') where.hasComplaint = false;

    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) range.gte = new Date(dateFrom);
      if (dateTo) range.lte = new Date(dateTo);
      where.visitDate = range;
    }

    const [total, rows] = await Promise.all([
      prisma.pxVisitExperience.count({ where }),
      prisma.pxVisitExperience.findMany({
        where,
        orderBy: { visitDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({ success: true, page, limit, total, visits: rows });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'px.visits.view' },
);
