import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { updatePlanSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUSES = new Set(['ACTIVE', 'INACTIVE']);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const planId = String((params as Record<string, string>)?.planId || '').trim();
  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updatePlanSchema);
  if ('error' in v) return v.error;

  const plan = await prisma.billingPlan.findFirst({
    where: { tenantId, id: planId },
  });
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  const nextName = body.name !== undefined ? String(body.name || '').trim() : plan.name;
  const nextStatus = body.status !== undefined ? String(body.status || '').trim().toUpperCase() : plan.status;
  const invalid: string[] = [];
  if (body.status !== undefined && !STATUSES.has(nextStatus)) invalid.push('status');
  if (invalid.length) {
    return NextResponse.json({ error: 'Validation failed', invalid }, { status: 400 });
  }

  const patch: any = {};
  if (nextName !== plan.name) patch.name = nextName;
  if (nextStatus !== plan.status) patch.status = nextStatus;
  if (!Object.keys(patch).length) {
    return NextResponse.json({ plan, noOp: true });
  }

  patch.updatedAt = new Date();
  const updated = await prisma.billingPlan.update({
    where: { id: planId },
    data: patch,
  });

  await createAuditLog(
    'billing_plan',
    planId,
    'UPDATE',
    userId || 'system',
    user?.email,
    { before: plan, after: updated },
    tenantId
  );

  return NextResponse.json({ plan: updated });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
