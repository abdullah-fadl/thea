import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { appendOrderEvent, auditOrder } from '@/lib/orders/ordersHub';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const resolved = params instanceof Promise ? await params : params;
  const orderId = String(resolved?.orderId || '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    reason: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const reason = body.reason ? String(body.reason || '').trim() : null;

  const order = await prisma.ordersHub.findFirst({
    where: { tenantId, id: orderId },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (!['RESULT_READY', 'COMPLETED'].includes(String(order.status || ''))) {
    return NextResponse.json({ error: 'Order not ready for acknowledgment', currentStatus: order.status }, { status: 409 });
  }

  const now = new Date();

  // Try to create the ack; handle unique constraint violation (duplicate ack)
  let ack: Awaited<ReturnType<typeof prisma.orderResultAck.create>>;
  try {
    ack = await prisma.orderResultAck.create({
      data: {
        tenantId,
        orderId,
        encounterCoreId: order.encounterCoreId || null,
        userId: userId || null,
        reason,
        time: now,
      },
    });
  } catch (err: unknown) {
    // Prisma unique constraint violation code
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      const existing = await prisma.orderResultAck.findFirst({
        where: { tenantId, orderId, userId: userId || undefined },
      });
      return NextResponse.json({ ack: existing, noOp: true });
    }
    throw err;
  }

  await appendOrderEvent({
    tenantId,
    orderId,
    encounterCoreId: order.encounterCoreId || '',
    type: 'ACK_RESULT',
    time: now,
    actorUserId: userId || null,
    actorDisplay: user?.email || null,
    payload: { reason },
  });
  await auditOrder({
    tenantId,
    orderId,
    action: 'ACK_RESULT',
    userId: userId || null,
    userEmail: user?.email || null,
    changes: { after: ack },
  });

  return NextResponse.json({ ack });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'orders.hub.view' }
);
