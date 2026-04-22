import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const encounterCoreId = String(req.nextUrl.searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  // OrderEvent doesn't have encounterCoreId directly — find orders for this encounter first
  const orders = await prisma.ordersHub.findMany({
    where: { tenantId, encounterCoreId },
    select: { id: true },
    take: 200,
  });
  const orderIds = orders.map((o) => o.id);

  if (!orderIds.length) {
    return NextResponse.json({ items: [] });
  }

  const events = await prisma.orderEvent.findMany({
    where: { tenantId, orderId: { in: orderIds } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  return NextResponse.json({ items: events });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'orders.hub.view' }
);
