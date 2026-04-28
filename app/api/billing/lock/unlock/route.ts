import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { billingLockSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const roleLower = String(role || '').trim().toLowerCase();
  const canUnlock = roleLower === 'admin';
  if (!canUnlock) {
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
  const reason = v.data.reason ? String(v.data.reason || '').trim() : null;
  const idempotencyKey = String(v.data.idempotencyKey || '').trim();

  const existing = await prisma.billingLock.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });
  if (existing?.lastUnlockIdempotencyKey === idempotencyKey) {
    return NextResponse.json({ lock: existing, noOp: true });
  }
  if (!existing || !existing.isLocked) {
    if (existing) {
      await prisma.billingLock.update({
        where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
        data: { lastUnlockIdempotencyKey: idempotencyKey, updatedAt: new Date() },
      });
    }
    return NextResponse.json({ lock: existing || null, noOp: true });
  }

  const now = new Date();
  const record = await prisma.billingLock.update({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
    data: {
      isLocked: false,
      unlockedAt: now,
      unlockedBy: userId || null,
      updatedAt: now,
      updatedBy: userId || null,
      version: (existing.version || 0) + 1,
      lastUnlockIdempotencyKey: idempotencyKey,
    },
  });

  const auditId = existing.id || String(encounterCoreId || '');
  await createAuditLog(
    'billing_lock',
    auditId,
    'BILLING_UNLOCKED',
    userId || 'system',
    user?.email,
    { before: existing, after: record, encounterCoreId, reason },
    tenantId
  );

  return NextResponse.json({ lock: record });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
