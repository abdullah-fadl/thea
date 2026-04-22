import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { assignOrder } from '@/lib/orders/ordersHub';
import { validateBody } from '@/lib/validation/helpers';
import { assignOrderSchema } from '@/lib/validation/orders.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const orderId = String((params as Record<string, string>)?.orderId || '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, assignOrderSchema);
  if ('error' in v) return v.error;

  const assignedTo = {
    userId: body.assignedTo?.userId ? String(body.assignedTo.userId) : null,
    display: body.assignedTo?.display ? String(body.assignedTo.display) : null,
  };
  if (!assignedTo.userId && !assignedTo.display) {
    return NextResponse.json({ error: 'assignedTo is required' }, { status: 400 });
  }

  const result = await assignOrder({
    tenantId,
    orderId,
    assignedTo,
    userId,
    userEmail: user?.email,
    actorDisplay: user?.email || null,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error, currentStatus: (result as Record<string, unknown>).currentStatus }, { status: result.status });
  }

  return NextResponse.json({ order: result.order, noOp: result.noOp });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'orders.hub.view' }
);
