import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = await params as Record<string, string>;
    const noteId = String(resolvedParams?.noteId || '').trim();
    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    const links = await prisma.orderContextLink.findMany({
      where: { tenantId, noteId },
      orderBy: { linkedAt: 'asc' },
    });
    if (!links.length) {
      return NextResponse.json({ items: [] });
    }

    type ContextLink = any;
    const orderIds = links.map((l) => String((l as ContextLink).orderId || '')).filter(Boolean);
    const orders = await prisma.ordersHub.findMany({
      where: { tenantId, id: { in: orderIds } },
    });
    const orderById = orders.reduce<Record<string, any>>((acc, order) => {
      acc[String(order.id || '')] = order;
      return acc;
    }, {});

    const items = links.map((link) => {
      const linkRec = link as ContextLink;
      const order = orderById[String(linkRec.orderId || '')] || {};
      return {
        orderId: linkRec.orderId,
        encounterCoreId: linkRec.encounterCoreId,
        linkedAt: linkRec.linkedAt,
        reason: linkRec.reason || null,
        orderName: order.orderName || null,
        orderCode: order.orderCode || null,
        kind: order.kind || null,
        status: order.status || null,
        createdAt: order.createdAt || null,
        priority: order.priority || null,
      };
    });

    items.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.orderId || '').localeCompare(String(b.orderId || ''));
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.view' }
);
