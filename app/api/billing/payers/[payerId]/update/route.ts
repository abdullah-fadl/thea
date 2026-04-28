import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { updatePayerSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUSES = new Set(['ACTIVE', 'INACTIVE']);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payerId = String((params as Record<string, string>)?.payerId || '').trim();
  if (!payerId) {
    return NextResponse.json({ error: 'payerId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updatePayerSchema);
  if ('error' in v) return v.error;

  const payer = await prisma.billingPayer.findFirst({
    where: { tenantId, id: payerId },
  });
  if (!payer) {
    return NextResponse.json({ error: 'Payer not found' }, { status: 404 });
  }

  const nextName = body.name !== undefined ? String(body.name || '').trim() : payer.name;
  const nextStatus = body.status !== undefined ? String(body.status || '').trim().toUpperCase() : payer.status;
  const invalid: string[] = [];
  if (body.status !== undefined && !STATUSES.has(nextStatus)) invalid.push('status');
  if (invalid.length) {
    return NextResponse.json({ error: 'Validation failed', invalid }, { status: 400 });
  }

  const patch: any = {};
  if (nextName !== payer.name) patch.name = nextName;
  if (nextStatus !== payer.status) patch.status = nextStatus;
  if (!Object.keys(patch).length) {
    return NextResponse.json({ payer, noOp: true });
  }

  patch.updatedAt = new Date();
  const updated = await prisma.billingPayer.update({
    where: { id: payerId },
    data: patch,
  });

  await createAuditLog(
    'billing_payer',
    payerId,
    'UPDATE',
    userId || 'system',
    user?.email,
    { before: payer, after: updated },
    tenantId
  );

  return NextResponse.json({ payer: updated });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
