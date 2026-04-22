import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { billingLockSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  const roleLower = String(role || '').toLowerCase();
  const canLock = canAccessBilling({ email: user?.email, tenantId, role }) &&
    (canAccessChargeConsole({ email: user?.email, tenantId, role }) ||
     roleLower.includes('finance') || roleLower.includes('billing') || roleLower === 'staff');
  if (!canLock) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, billingLockSchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(v.data.encounterCoreId || '').trim();
  const lockReason = v.data.reason ? String(v.data.reason || '').trim() : null;
  const idempotencyKey = String(v.data.idempotencyKey || '').trim();

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const existing = await prisma.billingLock.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });
  if (existing?.lastLockIdempotencyKey === idempotencyKey) {
    return NextResponse.json({ lock: existing, noOp: true });
  }
  if (existing?.isLocked) {
    await prisma.billingLock.update({
      where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
      data: { lastLockIdempotencyKey: idempotencyKey, updatedAt: new Date() },
    });
    return NextResponse.json({ lock: existing, noOp: true });
  }

  const now = new Date();
  const recordId = existing?.id || uuidv4();

  const record = await prisma.billingLock.upsert({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
    create: {
      id: recordId,
      tenantId,
      encounterCoreId,
      isLocked: true,
      lockedAt: now,
      lockedBy: userId || null,
      lockReason,
      unlockedAt: null,
      unlockedBy: null,
      version: 1,
      createdBy: userId || null,
      updatedBy: userId || null,
      lastLockIdempotencyKey: idempotencyKey,
      lastUnlockIdempotencyKey: null,
    },
    update: {
      isLocked: true,
      lockedAt: now,
      lockedBy: userId || null,
      lockReason,
      unlockedAt: null,
      unlockedBy: null,
      version: (existing?.version || 0) + 1,
      updatedBy: userId || null,
      lastLockIdempotencyKey: idempotencyKey,
    },
  });

  await createAuditLog(
    'billing_lock',
    record.id,
    'BILLING_LOCKED',
    userId || 'system',
    user?.email,
    { before: existing || null, after: record, encounterCoreId, lockReason },
    tenantId
  );

  return NextResponse.json({ lock: record });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
