import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { recordPaymentSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const METHODS = new Set(['CASH', 'CARD', 'BANK_TRANSFER', 'INSURANCE_COPAY']);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, recordPaymentSchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(v.data.encounterCoreId || '').trim();
  const method = String(v.data.method || '').trim().toUpperCase();
  const amount = v.data.amount;
  const currency = String(v.data.currency || '').trim().toUpperCase();
  const reference = v.data.reference ? String(v.data.reference || '').trim() : null;
  const note = v.data.note ? String(v.data.note || '').trim() : null;
  const idempotencyKey = String(v.data.idempotencyKey || '').trim();

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (String(encounter.encounterType || '') !== 'OPD') {
    return NextResponse.json({ error: 'Payments supported for OPD only' }, { status: 409 });
  }

  const lock = await prisma.billingLock.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!lock?.isLocked) {
    return NextResponse.json({ error: 'Billing is unlocked', code: 'BILLING_UNLOCKED' }, { status: 409 });
  }

  const posting = await prisma.billingPosting.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (posting?.status !== 'POSTED') {
    return NextResponse.json({ error: 'Billing not posted', code: 'BILLING_NOT_POSTED' }, { status: 409 });
  }

  const activeCharges = await prisma.billingChargeEvent.count({
    where: { tenantId, encounterCoreId, status: 'ACTIVE' },
  });
  const payerContext = await prisma.billingPayerContext.findFirst({
    where: { tenantId, encounterCoreId },
    select: { id: true },
  });
  let encounterStatusOk = true;
  if (String(encounter.encounterType || '') === 'OPD') {
    const opd = await prisma.opdEncounter.findFirst({
      where: { tenantId, encounterCoreId },
      select: { status: true },
    });
    encounterStatusOk = String(encounter.status || '') === 'CLOSED' || String(opd?.status || '') === 'COMPLETED';
  }

  const reasons: string[] = [];
  if (!activeCharges) reasons.push('NO_ACTIVE_CHARGES');
  if (!payerContext) reasons.push('NO_PAYER_CONTEXT');
  if (!encounterStatusOk) reasons.push('ENCOUNTER_NOT_READY');
  if (reasons.length) {
    return NextResponse.json({ error: 'Billing not ready', code: 'BILLING_NOT_READY', reasons }, { status: 409 });
  }

  // RACE-02 fix: Wrap idempotency check + payment creation in a serializable
  // transaction to prevent duplicate payments from concurrent requests.
  const now = new Date();
  const paymentId = uuidv4();
  const record: any = {
    id: paymentId,
    tenantId,
    encounterCoreId,
    method,
    amount,
    currency,
    reference: reference || idempotencyKey || null,
    status: 'RECORDED',
    createdAt: now,
    createdBy: userId || null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
  };

  let noOp = false;
  let finalRecord: any = record;

  try {
    finalRecord = await prisma.$transaction(async (tx) => {
      // Idempotency check inside transaction
      if (idempotencyKey) {
        const existing = await tx.billingPayment.findFirst({
          where: { tenantId, encounterCoreId, reference: idempotencyKey },
        });
        if (existing) {
          throw Object.assign(new Error('IDEMPOTENT_HIT'), { existing });
        }
      }

      await tx.billingPayment.create({ data: record });
      return record;
    }, { isolationLevel: 'Serializable' });
  } catch (err: any) {
    if (err?.message === 'IDEMPOTENT_HIT' && err?.existing) {
      finalRecord = err.existing;
      noOp = true;
    } else if (err?.code === 'P2002') {
      // Handle unique constraint violations (Prisma error code P2002)
      const dup = await prisma.billingPayment.findFirst({
        where: { tenantId, encounterCoreId, reference: idempotencyKey },
      });
      return NextResponse.json({ payment: dup, noOp: true });
    } else {
      throw err;
    }
  }

  if (noOp) {
    return NextResponse.json({ payment: finalRecord, noOp: true });
  }

  await createAuditLog(
    'billing_payment',
    paymentId,
    'PAYMENT_RECORDED',
    userId || 'system',
    user?.email,
    {
      encounterCoreId,
      method,
      amount,
      currency,
      reference,
      note,
    },
    tenantId
  );

  return NextResponse.json({ payment: finalRecord });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.payment.create' }
);
