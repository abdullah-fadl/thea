import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const paySchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CREDIT_CARD', 'BANK_TRANSFER', 'APPLE_PAY']),
});

// ---------------------------------------------------------------------------
// POST /api/portal/billing/pay — initiate a payment
// ---------------------------------------------------------------------------
export const POST = withErrorHandler(async (request: NextRequest) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const body = await request.json().catch(() => ({}));
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { invoiceId, amount, paymentMethod } = parsed.data;

  // Resolve portal user
  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });
  if (!portalUser) {
    return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
  }

  const patientMasterId = portalUser.patientMasterId;
  if (!patientMasterId) {
    return NextResponse.json({ error: 'No patient profile linked' }, { status: 400 });
  }

  // Resolve tenant UUID
  const tenant = await prisma.tenant.findFirst({ where: { tenantId: payload.tenantId } });
  const tenantId = tenant?.id || payload.tenantId;

  // Verify invoice exists and belongs to this patient
  const invoice = await prisma.billingInvoice.findFirst({
    where: { tenantId, id: invoiceId, patientMasterId },
  });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Check remaining balance
  const existingPayments = await prisma.billingPayment.findMany({
    where: { tenantId, invoiceId, status: 'RECORDED' },
    take: 200,
  });
  const totalPaid = existingPayments.reduce((sum: number, p) => sum + Number(p.amount || 0), 0);
  const remaining = Math.max(Number(invoice.total || 0) - totalPaid, 0);

  if (amount > remaining + 0.01) {
    return NextResponse.json({ error: 'Amount exceeds remaining balance' }, { status: 400 });
  }

  // Map portal payment method to billing method
  const methodMap: Record<string, string> = {
    CREDIT_CARD: 'CREDIT_CARD',
    BANK_TRANSFER: 'BANK_TRANSFER',
    APPLE_PAY: 'CREDIT_CARD', // Apple Pay processed as card
  };

  const now = new Date();
  const receiptNumber = `PR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Create payment record
  const payment = await prisma.billingPayment.create({
    data: {
      tenantId,
      invoiceId,
      encounterCoreId: invoice.encounterCoreId,
      method: methodMap[paymentMethod] || 'CREDIT_CARD',
      amount,
      currency: 'SAR',
      reference: receiptNumber,
      status: 'RECORDED',
      createdAt: now,
      createdBy: `portal:${payload.portalUserId}`,
    },
  });

  // Check if invoice is now fully paid
  const newTotalPaid = totalPaid + amount;
  if (newTotalPaid >= Number(invoice.total || 0) - 0.01) {
    await prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: now },
    });
  }

  logger.info('Portal payment recorded', {
    category: 'portal',
    tenantId,
    portalUserId: payload.portalUserId,
    invoiceId,
    amount,
    paymentMethod,
    receiptNumber,
  });

  return NextResponse.json({
    success: true,
    payment: {
      paymentId: payment.id,
      receiptNumber,
      amount,
      method: paymentMethod,
      status: 'RECORDED',
      createdAt: now.toISOString(),
    },
  });
});
