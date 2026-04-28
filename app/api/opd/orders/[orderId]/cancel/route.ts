import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { cancelOpdOrderSchema } from '@/lib/validation/opd.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const orderId = String((params as Record<string, string>)?.orderId || '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, cancelOpdOrderSchema);
  if ('error' in v) return v.error;
  const { cancelReason } = v.data;

  const order = await prisma.opdOrder.findFirst({
    where: { tenantId, id: orderId },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status === 'CANCELLED') {
    return NextResponse.json({ success: true, order, noOp: true });
  }

  const now = new Date();
  const updatedOrder = await prisma.opdOrder.update({
    where: { id: orderId },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelReason,
    },
  });

  // ── Sync cancellation to orders_hub ──
  try {
    // Find the matching orders_hub entry by opdOrderId in meta
    const hubOrder = await prisma.ordersHub.findFirst({
      where: {
        tenantId,
        meta: { path: ['opdOrderId'], equals: orderId },
      },
      select: { id: true, status: true },
    });

    if (hubOrder && hubOrder.status !== 'CANCELLED') {
      await prisma.ordersHub.update({
        where: { id: hubOrder.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelReason,
        },
      });
    }
  } catch (syncErr) {
    logger.error('[OPD→OrdersHub sync] Failed to sync cancellation', { category: 'api', error: syncErr instanceof Error ? syncErr : undefined });
  }

  await createAuditLog(
    'opd_order',
    orderId,
    'CANCEL',
    userId || 'system',
    user?.email,
    { before: order, after: updatedOrder },
    tenantId
  );

  return NextResponse.json({ success: true, order: updatedOrder });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.doctor.orders.create' }
);
