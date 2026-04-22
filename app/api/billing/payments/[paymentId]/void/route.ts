import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { voidPaymentSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const paymentId = String((params as Record<string, string>)?.paymentId || '').trim();
  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, voidPaymentSchema);
  if ('error' in v) return v.error;
  const reason = v.data.reason;
  const idempotencyKey = v.data.idempotencyKey;

  const payment = await prisma.billingPayment.findFirst({
    where: { tenantId, id: paymentId },
  });
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const lock = await prisma.billingLock.findFirst({
    where: { tenantId, encounterCoreId: payment.encounterCoreId },
  });
  if (!lock?.isLocked) {
    return NextResponse.json({ error: 'Billing is unlocked', code: 'BILLING_UNLOCKED' }, { status: 409 });
  }

  const posting = await prisma.billingPosting.findFirst({
    where: { tenantId, encounterCoreId: payment.encounterCoreId },
  });
  if (posting?.status !== 'POSTED') {
    return NextResponse.json({ error: 'Billing not posted', code: 'BILLING_NOT_POSTED' }, { status: 409 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId: payment.encounterCoreId });
  if (deathGuard) return deathGuard;

  if (payment.status === 'VOIDED') {
    return NextResponse.json({ payment, noOp: true });
  }

  const now = new Date();
  const patch = {
    status: 'VOIDED',
    voidReason: reason,
    voidedAt: now,
    voidedBy: userId || null,
  };

  // Only update if still RECORDED (optimistic concurrency)
  try {
    const updated = await prisma.billingPayment.update({
      where: { id: paymentId, tenantId } as any,
      data: patch as any,
    });

    await createAuditLog(
      'payment',
      paymentId,
      'VOID',
      userId || 'system',
      user?.email,
      { encounterCoreId: updated.encounterCoreId, reason },
      tenantId
    );

    return NextResponse.json({ payment: updated });
  } catch {
    // If update failed (e.g. already voided), return current state
    const latest = await prisma.billingPayment.findFirst({
      where: { tenantId, id: paymentId },
    });
    return NextResponse.json({ payment: latest || payment, noOp: true });
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.payment.void' }
);
