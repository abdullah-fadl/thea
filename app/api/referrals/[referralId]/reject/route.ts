import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const resolvedParams = params instanceof Promise ? await params : params;
  const referralId = String(resolvedParams?.referralId || '');

  // [R-01] Guard: check referral status before rejecting
  const referral = await prisma.referral.findFirst({
    where: { tenantId, id: referralId },
  });
  if (!referral) {
    return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
  }
  const currentStatus = String(referral.status || '').toUpperCase();
  if (currentStatus !== 'PENDING') {
    return NextResponse.json(
      { error: `Referral is ${currentStatus} — cannot reject`, code: 'INVALID_STATE' },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const bodySchema = z.object({
    reason: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;
  const { reason } = body;

  await prisma.referral.updateMany({
    where: { tenantId, id: referralId, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      rejectedBy: userId,
      rejectedAt: new Date(),
      rejectionReason: reason,
    },
  });

  await createAuditLog(
    'referral',
    referralId,
    'REJECT',
    userId || 'system',
    user?.email,
    { referralId, reason },
    tenantId
  );

  return NextResponse.json({ success: true });
}, { tenantScoped: true, permissionKey: 'referral.edit' });
