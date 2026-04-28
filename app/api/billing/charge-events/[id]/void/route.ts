import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { voidChargeEventSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const chargeEventId = String((params as Record<string, string>)?.id || '').trim();
  if (!chargeEventId) {
    return NextResponse.json({ error: 'Charge event id is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, voidChargeEventSchema);
  if ('error' in v) return v.error;
  const reason = v.data.reason;

  const chargeEvent = await prisma.billingChargeEvent.findFirst({
    where: { tenantId, id: chargeEventId },
  });
  if (!chargeEvent) {
    return NextResponse.json({ error: 'Charge event not found' }, { status: 404 });
  }
  const lock = await prisma.billingLock.findFirst({
    where: { tenantId, encounterCoreId: chargeEvent.encounterCoreId },
  });
  if (lock?.isLocked) {
    return NextResponse.json({ error: 'Billing is locked' }, { status: 409 });
  }
  const posting = await prisma.billingPosting.findFirst({
    where: { tenantId, encounterCoreId: chargeEvent.encounterCoreId },
  });
  if (posting?.status === 'POSTED') {
    return NextResponse.json({ error: 'Billing is posted', code: 'BILLING_POSTED' }, { status: 409 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId: chargeEvent.encounterCoreId });
  if (deathGuard) return deathGuard;

  if (chargeEvent.status === 'VOID') {
    return NextResponse.json({ chargeEvent, noOp: true });
  }

  const now = new Date();
  const patch = {
    status: 'VOID',
    reason,
    voidedAt: now,
    voidedBy: userId || null,
  };

  await prisma.billingChargeEvent.update({
    where: { id: chargeEventId },
    data: patch,
  });
  const updated = { ...chargeEvent, ...patch } as Record<string, unknown>;

  await createAuditLog(
    'charge_event',
    chargeEventId,
    'VOID_CHARGE_EVENT',
    userId || 'system',
    user?.email,
    {
      encounterCoreId: updated.encounterCoreId,
      patientMasterId: updated.patientMasterId,
      departmentKey: updated.departmentKey,
      source: updated.source,
      chargeCatalogId: updated.chargeCatalogId,
      totals: { quantity: updated.quantity, unitPrice: updated.unitPrice, totalPrice: updated.totalPrice },
      reason,
    },
    tenantId
  );

  return NextResponse.json({ chargeEvent: updated });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
