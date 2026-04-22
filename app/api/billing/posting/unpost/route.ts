import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';

import { canAccessBilling } from '@/lib/billing/access';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { unpostSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const canUnpost = String(role || '').toLowerCase() === 'admin';
  if (!canUnpost) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, unpostSchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(v.data.encounterCoreId || '').trim();
  const idempotencyKey = String(v.data.idempotencyKey || '').trim();
  const notes = v.data.note ? String(v.data.note || '').trim() : null;
  const override = Boolean(v.data.override);
  const overrideReason = v.data.reason ? String(v.data.reason || '').trim() : notes;

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  // Check billing lock — must be locked to unpost
  const billingLock = await prisma.billingLock.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });
  if (!billingLock?.isLocked) {
    return NextResponse.json({ error: 'Billing must be locked to unpost' }, { status: 409 });
  }

  if (override && !overrideReason) {
    return NextResponse.json({ error: 'Validation failed', missing: ['reason'] }, { status: 400 });
  }

  const existing = await prisma.billingPosting.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });
  if (idempotencyKey && existing?.idempotencyKey === idempotencyKey) {
    return NextResponse.json({ posting: existing, noOp: true });
  }
  if (!existing || existing.status === 'DRAFT') {
    return NextResponse.json({ posting: existing || null, noOp: true });
  }

  const recordedPayments = await prisma.billingPayment.count({
    where: { tenantId, encounterCoreId, status: 'RECORDED' },
  });
  if (recordedPayments > 0 && !override) {
    return NextResponse.json({ error: 'Payments already recorded', code: 'BILLING_HAS_PAYMENTS' }, { status: 409 });
  }
  // WARNING: Override unpost does NOT void existing payments.
  // Payments remain in RECORDED status even after unposting.
  // This is intentional — voiding payments must be done separately via /payments/:id/void.

  const now = new Date();
  const record = await prisma.billingPosting.update({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
    data: {
      status: 'DRAFT',
      unpostedAt: now,
      unpostedBy: userId || null,
      notes: notes || existing.notes || null,
      idempotencyKey: idempotencyKey || null,
    },
  });

  await createAuditLog(
    'billing_posting',
    record.id,
    override ? 'UNPOST_OVERRIDE' : 'BILLING_UNPOST',
    userId || 'system',
    user?.email,
    { before: existing || null, after: record, encounterCoreId, notes, override, overrideReason },
    tenantId
  );

  return NextResponse.json({ posting: record });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
