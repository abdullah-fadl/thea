import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildDisplay(user: any): string {
  if (!user) return '';
  const name = `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim();
  return name || String(user.email || '').trim() || String(user.id || '').trim();
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const role = String((user as unknown as Record<string, unknown>)?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!dev && !charge) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const items = await prisma.ipdDowntimeIncident.findMany({
    where: { tenantId, episodeId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const userIds = Array.from(
    new Set(items.map((item: any) => String(item.createdByUserId || '')).filter(Boolean))
  );
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { tenantId, id: { in: userIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      })
    : [];
  const userDisplay = new Map<string, string>();
  for (const u of users) {
    const display = buildDisplay(u);
    if (display) userDisplay.set(String(u.id || ''), display);
  }

  const withDisplay = items.map((item: any) => ({
    ...item,
    creatorDisplay: userDisplay.get(String(item.createdByUserId || '')) || item.createdByUserId || '—',
  }));

  return NextResponse.json({ items: withDisplay });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
