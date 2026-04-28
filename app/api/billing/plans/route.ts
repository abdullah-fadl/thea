import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { createPlanSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUSES = new Set(['ACTIVE', 'INACTIVE']);

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payerId = String(req.nextUrl.searchParams.get('payerId') || '').trim();
  if (!payerId) {
    return NextResponse.json({ error: 'payerId is required' }, { status: 400 });
  }
  const status = String(req.nextUrl.searchParams.get('status') || '').trim().toUpperCase();

  const where: any = { tenantId, payerId };
  if (status && STATUSES.has(status)) where.status = status;

  const items = await prisma.billingPlan.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }],
    take: 100,
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

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

  const v = validateBody(body, createPlanSchema);
  if ('error' in v) return v.error;

  const payerId = String(v.data.payerId || '').trim();
  const name = String(v.data.name || '').trim();
  const planCode = String(v.data.planCode || '').trim().toUpperCase();
  const status = String(v.data.status || 'ACTIVE').trim().toUpperCase();

  const payer = await prisma.billingPayer.findFirst({
    where: { tenantId, id: payerId },
  });
  if (!payer) {
    return NextResponse.json({ error: 'Payer not found' }, { status: 404 });
  }

  const existing = await prisma.billingPlan.findFirst({
    where: { tenantId, payerId, planCode },
  });
  if (existing) {
    return NextResponse.json({ plan: existing, noOp: true });
  }

  const now = new Date();

  try {
    const plan = await prisma.billingPlan.create({
      data: {
        id: uuidv4(),
        tenantId,
        payerId,
        name,
        planCode,
        status,
        createdAt: now,
        updatedAt: now,
      },
    });

    await createAuditLog(
      'billing_plan',
      plan.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: plan },
      tenantId
    );

    return NextResponse.json({ plan });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const fallback = await prisma.billingPlan.findFirst({
        where: { tenantId, payerId, planCode },
      });
      if (fallback) return NextResponse.json({ plan: fallback, noOp: true });
    }
    throw err;
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
