import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function canSeeAll(role: string, _user: any, _tenantId: string) {
  const roleLower = String(role || '').toLowerCase();
  return roleLower.includes('admin') || roleLower.includes('charge');
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  const params = req.nextUrl.searchParams;
  const scope = String(params.get('scope') || '').trim().toUpperCase();
  const status = String(params.get('status') || 'OPEN').trim().toUpperCase();
  const limit = Math.min(Number(params.get('limit') || 20), 100);
  const cursor = params.get('cursor');

  const visibilityFilter: any = {
    tenantId,
  };
  if (!canSeeAll(String(role || ''), user, tenantId)) {
    visibilityFilter.recipientUserId = userId;
  }
  if (scope) {
    visibilityFilter.scope = scope;
  }
  if (status && status !== 'ALL') {
    visibilityFilter.status = status;
  }

  const listFilter = { ...visibilityFilter };
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      listFilter.createdAt = { lt: cursorDate };
    }
  }

  const notifications = await prisma.notification.findMany({
    where: listFilter,
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  });

  // Get counts by severity, scope, status using groupBy
  const countFilter = { ...visibilityFilter };

  const [severityCounts, scopeCounts, statusCounts] = await Promise.all([
    prisma.notification.groupBy({
      by: ['severity'],
      where: countFilter,
      _count: { _all: true },
    }),
    prisma.notification.groupBy({
      by: ['scope'],
      where: countFilter,
      _count: { _all: true },
    }),
    prisma.notification.groupBy({
      by: ['status'],
      where: countFilter,
      _count: { _all: true },
    }),
  ]);

  const counts = {
    severity: {} as Record<string, number>,
    scope: {} as Record<string, number>,
    status: {} as Record<string, number>,
  };
  for (const row of severityCounts) {
    if (row.severity) counts.severity[row.severity] = row._count._all;
  }
  for (const row of scopeCounts) {
    if (row.scope) counts.scope[row.scope] = row._count._all;
  }
  for (const row of statusCounts) {
    if (row.status) counts.status[row.status] = row._count._all;
  }

  const openCount = await prisma.notification.count({
    where: { ...visibilityFilter, status: 'OPEN' },
  });

  return NextResponse.json({ items: notifications, counts, openCount });
}),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'notifications.view',
    softFailResponse: () => NextResponse.json({ items: [], counts: { severity: {}, scope: {}, status: {} }, openCount: 0 }),
  }
);
