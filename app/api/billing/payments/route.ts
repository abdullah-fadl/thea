import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { createPaymentSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const encounterCoreId = String(req.nextUrl.searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }
  const includeVoided = req.nextUrl.searchParams.get('includeVoided') === '1';

  const where: any = { tenantId, encounterCoreId };
  if (!includeVoided) where.status = 'RECORDED';

  const payments = await prisma.billingPayment.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }],
    take: 100,
  });

  return NextResponse.json({ items: payments });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.payment.view' }
);

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

  const v = validateBody(body, createPaymentSchema);
  if ('error' in v) return v.error;

  const invoiceId = String(v.data.invoiceId || '').trim();
  const amount = v.data.amount;
  const method = String(v.data.method || '').trim().toUpperCase();
  const reference = v.data.reference ? String(v.data.reference || '').trim() : null;
  const status = String(v.data.status || 'COMPLETED').trim().toUpperCase();
  let encounterCoreId = String(v.data.encounterCoreId || '').trim();

  if (!encounterCoreId && invoiceId) {
    const invoice = await prisma.billingInvoice.findFirst({
      where: { tenantId, id: invoiceId },
      select: { encounterCoreId: true },
    });
    if (invoice?.encounterCoreId) encounterCoreId = String(invoice.encounterCoreId);
  }

  if (!encounterCoreId) {
    return NextResponse.json(
      { error: 'encounterCoreId is required (or provide invoiceId to resolve from invoice)' },
      { status: 400 }
    );
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  const now = new Date();
  const record = {
    id: randomUUID(),
    tenantId,
    invoiceId: invoiceId || null,
    encounterCoreId,
    method,
    amount,
    currency: 'SAR',
    reference,
    status,
    createdAt: now,
    createdBy: userId || null,
  };

  await prisma.billingPayment.create({ data: record as any });

  // Mark the invoice as PAID when payment is completed
  if (status === 'COMPLETED' && invoiceId) {
    await prisma.billingInvoice.updateMany({
      where: { tenantId, id: invoiceId, status: { not: 'VOID' } },
      data: { status: 'PAID', paidAt: now },
    });
  }

  await createAuditLog(
    'billing_payment', record.id, 'PAYMENT_CREATED',
    userId || 'system', user?.email,
    { encounterCoreId, method, amount },
    tenantId
  );

  return NextResponse.json({ payment: record });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.payment.create' }
);
