import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { orderInvoiceSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function normalizeOrder(order: any, type: string) {
  const code =
    order.testCode ||
    order.examCode ||
    order.orderCode ||
    order.code ||
    order.procedureCode ||
    order.serviceCode ||
    '';
  const name =
    order.testName ||
    order.examName ||
    order.orderName ||
    order.name ||
    order.procedureName ||
    order.serviceName ||
    '';
  const nameAr =
    order.testNameAr ||
    order.examNameAr ||
    order.orderNameAr ||
    order.nameAr ||
    order.procedureNameAr ||
    order.serviceNameAr ||
    null;

  return {
    id: String(order.id || ''),
    type: String(type || order.kind || order.orderType || order.type || '').toUpperCase(),
    code: String(code || '').trim(),
    name: String(name || '').trim(),
    nameAr: nameAr ? String(nameAr || '').trim() : null,
    quantity: Number(order.quantity || 1) || 1,
    totalPrice: Number(order.totalPrice || 0) || 0,
  };
}

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

  const v = validateBody(body, orderInvoiceSchema);
  if ('error' in v) return v.error;

  const patientId = String(v.data.patientId || '').trim();
  const orderIds = v.data.orderIds.map((id: string) => String(id));

  // orders_hub is the primary source (legacy collections removed during Prisma migration)
  const hubOrders = await prisma.ordersHub.findMany({
    where: {
      tenantId,
      id: { in: orderIds },
    },
  });

  const orders = hubOrders.map((order: any) =>
    normalizeOrder(order, order.kind || order.type)
  );

  if (!orders.length) {
    return NextResponse.json({ error: 'Orders not found' }, { status: 404 });
  }

  const codeSet = Array.from(new Set(orders.map((order) => String(order.code || '')).filter(Boolean)));
  const catalogs = codeSet.length
    ? await prisma.billingChargeCatalog.findMany({
        where: { tenantId, code: { in: codeSet } },
        select: { code: true, name: true, basePrice: true },
      })
    : [];
  const catalogByCode = catalogs.reduce<any>((acc, item) => {
    acc[String(item.code || '')] = item;
    return acc;
  }, {});

  const items = orders.map((order) => {
    const catalog = catalogByCode[String(order.code || '')];
    const unitPrice = Number(order.totalPrice || 0) > 0 ? order.totalPrice / order.quantity : Number(catalog?.basePrice || 0);
    const totalPrice = order.totalPrice || roundMoney(unitPrice * order.quantity);
    return {
      orderId: order.id,
      type: order.type,
      code: order.code,
      name: order.nameAr || order.name || catalog?.name || '',
      quantity: order.quantity,
      unitPrice: roundMoney(unitPrice),
      totalPrice,
    };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0));
  const insuranceDiscount = roundMoney(Number(body.insuranceDiscount || 0));
  const promoDiscount = roundMoney(Number(body.promoDiscount || 0));
  const total = roundMoney(Math.max(subtotal - insuranceDiscount - promoDiscount, 0));

  const invoiceId = `INV-ORD-${nanoid(8).toUpperCase()}`;
  const now = new Date();
  const invoice = {
    id: uuidv4(),
    tenantId,
    invoiceNumber: invoiceId,
    encounterCoreId: body.encounterCoreId || hubOrders[0]?.encounterCoreId || uuidv4(),
    patientMasterId: patientId || null,
    items: items as unknown,
    subtotal,
    discount: insuranceDiscount,
    tax: 0,
    total,
    status: 'DRAFT',
    promoCode: body.promoCode || null,
    promoDiscount: promoDiscount || null,
    metadata: {
      type: 'ORDER',
      insuranceApprovalNumber: body.insuranceApprovalNumber || null,
      paymentMethod: body.paymentMethod || null,
      paymentReference: body.paymentReference || null,
    },
    createdAt: now,
    createdBy: userId || null,
  };

  await prisma.billingInvoice.create({ data: invoice as any });

  await createAuditLog(
    'billing_invoice', invoice.id, 'ORDER_INVOICE_DRAFT_CREATED',
    userId || 'system', user?.email,
    { patientId: invoice.patientMasterId, invoiceId: invoice.id },
    tenantId
  );

  return NextResponse.json({ success: true, invoiceId: invoice.id, invoiceNumber: invoiceId, status: 'DRAFT' });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.invoice.create' }
);
