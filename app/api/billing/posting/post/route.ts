import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { canAccessBilling } from '@/lib/billing/access';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { postingSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  const roleLower = String(role || '').toLowerCase();
  const canPost = canAccessBilling({ email: user?.email, tenantId, role }) &&
    (canAccessChargeConsole({ email: user?.email, tenantId, role }) ||
     roleLower.includes('finance') || roleLower.includes('billing') || roleLower === 'staff');
  if (!canPost) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, postingSchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(v.data.encounterCoreId || '').trim();
  const idempotencyKey = String(v.data.idempotencyKey || '').trim();
  const notes = v.data.note ? String(v.data.note || '').trim() : null;

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const lock = await prisma.billingLock.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });
  if (!lock?.isLocked) {
    return NextResponse.json({ error: 'Billing must be locked', code: 'BILLING_LOCK_REQUIRED' }, { status: 409 });
  }

  const activeCharges = await prisma.billingChargeEvent.count({
    where: { tenantId, encounterCoreId, status: 'ACTIVE' },
  });
  const voidedCharges = await prisma.billingChargeEvent.count({
    where: { tenantId, encounterCoreId, status: 'VOID' },
  });
  const payerContext = await prisma.billingPayerContext.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
    select: { id: true },
  });

  let encounterStatusOk = true;
  if (String(encounter.encounterType || '') === 'OPD') {
    const opd = await prisma.opdEncounter.findFirst({
      where: { tenantId, encounterCoreId },
      select: { status: true },
    });
    encounterStatusOk = String(encounter.status || '') === 'CLOSED' || String(opd?.status || '') === 'COMPLETED';
  } else {
    encounterStatusOk = String(encounter.status || '') !== '';
  }

  const reasons: string[] = [];
  if (!activeCharges) reasons.push('NO_ACTIVE_CHARGES');
  if (!payerContext) reasons.push('NO_PAYER_CONTEXT');
  if (!encounterStatusOk) reasons.push('ENCOUNTER_NOT_READY');
  if (reasons.length) {
    return NextResponse.json({ error: 'Readiness failed', code: 'BILLING_NOT_READY', reasons }, { status: 409 });
  }

  const existing = await prisma.billingPosting.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });
  if (idempotencyKey && existing?.idempotencyKey === idempotencyKey) {
    return NextResponse.json({ posting: existing, noOp: true });
  }
  if (existing?.status === 'POSTED') {
    return NextResponse.json({ posting: existing, noOp: true });
  }

  const now = new Date();
  const recordId = existing?.id || uuidv4();

  const record = await prisma.billingPosting.upsert({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
    create: {
      id: recordId,
      tenantId,
      encounterCoreId,
      status: 'POSTED',
      postedAt: now,
      postedBy: userId || null,
      unpostedAt: null,
      unpostedBy: null,
      notes: notes || null,
      idempotencyKey: idempotencyKey || null,
    },
    update: {
      status: 'POSTED',
      postedAt: now,
      postedBy: userId || null,
      notes: notes || existing?.notes || null,
      idempotencyKey: idempotencyKey || null,
    },
  });

  await createAuditLog(
    'billing_posting',
    record.id,
    'BILLING_POST',
    userId || 'system',
    user?.email,
    { before: existing || null, after: record, encounterCoreId, notes },
    tenantId
  );

  return NextResponse.json({ posting: record });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
