import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { transitionOrderStatus } from '@/lib/orders/ordersHub';
import { tryCreateChargeFromOrder } from '@/lib/billing/chargeEvents';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const orderId = String((params as Record<string, string>)?.orderId || '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  const result = await transitionOrderStatus({
    tenantId,
    orderId,
    nextStatus: 'COMPLETED',
    action: 'COMPLETE',
    userId,
    userEmail: user?.email,
    actorDisplay: user?.email || null,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error, currentStatus: (result as Record<string, unknown>).currentStatus }, { status: result.status });
  }

  const order = result.order;
  try {
    await tryCreateChargeFromOrder({
      tenantId,
      order,
      userId,
      userEmail: user?.email,
    });
  } catch {
    // Charge capture is optional; do not block completion.
  }

  return NextResponse.json({ order, noOp: result.noOp });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'orders.hub.view' }
);
