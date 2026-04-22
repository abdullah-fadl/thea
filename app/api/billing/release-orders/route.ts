import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { releaseOrdersSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, releaseOrdersSchema);
  if ('error' in v) return v.error;

  const orderIds = v.data.orderIds.map((id: string) => String(id));
  const invoiceId = String(v.data.invoiceId || '').trim();
  const paymentMethod = v.data.paymentMethod ? String(v.data.paymentMethod || '').trim().toUpperCase() : null;
  const paymentReference = v.data.paymentReference ? String(v.data.paymentReference || '').trim() : null;
  const amount = Number(v.data.amount || 0);

  const now = new Date();
  const paymentInfo = {
    status: 'PAID',
    invoiceId,
    paidAt: now.toISOString(),
    paidBy: userId || null,
    paymentMethod,
    paymentReference,
    paidAmount: Number.isFinite(amount) ? amount : null,
  };

  // Update orders_hub with payment info in meta JSON field
  // orders_hub is the primary source (legacy collections removed during Prisma migration)
  const existingOrders = await prisma.ordersHub.findMany({
    where: { tenantId, id: { in: orderIds } },
  });
  for (const order of existingOrders) {
    const existingMeta = (order.meta as Record<string, unknown>) || {};
    await prisma.ordersHub.update({
      where: { id: order.id },
      data: {
        meta: {
          ...existingMeta,
          payment: paymentInfo,
        },
        updatedAt: now,
        updatedByUserId: userId || null,
      },
    });
  }

  await prisma.orderPaymentLog.create({
    data: {
      id: uuidv4(),
      tenantId,
      orderId: orderIds.join(','),
      invoiceId,
      status: 'RELEASE',
      amount: Number.isFinite(amount) ? amount : null,
      metadata: {
        orderIds,
        paymentMethod,
        paymentReference,
        releasedBy: userId || null,
        releasedAt: now,
      },
      createdAt: now,
    },
  });

  await createAuditLog(
    'billing_release', 'batch', 'ORDERS_RELEASED',
    userId || 'system', user?.email,
    { orderIds, paymentMethod: body.paymentMethod },
    tenantId
  );

  return NextResponse.json({
    success: true,
    releasedCount: orderIds.length,
    message: `تم فتح ${orderIds.length} أوردر للتنفيذ`,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.payment.create' }
);
