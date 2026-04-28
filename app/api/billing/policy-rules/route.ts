import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { createPolicyRuleSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RULE_TYPES = new Set(['ELIGIBILITY_NOTE', 'PREAUTH_NOTE', 'COVERAGE_NOTE', 'BILLING_NOTE']);
const STATUSES = new Set(['ACTIVE', 'INACTIVE']);

function buildRuleKey(payerId: string, planId: string | null, ruleType: string, title: string) {
  return `${payerId}:${planId || 'NONE'}:${ruleType}:${title}`.toUpperCase();
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payerId = String(req.nextUrl.searchParams.get('payerId') || '').trim();
  const planId = String(req.nextUrl.searchParams.get('planId') || '').trim();
  if (!payerId) {
    return NextResponse.json({ error: 'payerId is required' }, { status: 400 });
  }
  const where: any = { tenantId, payerId };
  if (planId) where.planId = planId;

  const items = await prisma.billingPolicyRule.findMany({
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

  const v = validateBody(body, createPolicyRuleSchema);
  if ('error' in v) return v.error;

  const payerId = String(v.data.payerId || '').trim();
  const planId = v.data.planId ? String(v.data.planId || '').trim() : null;
  const ruleType = String(v.data.ruleType || '').trim().toUpperCase();
  const title = String(v.data.title || '').trim();
  const notes = v.data.notes ? String(v.data.notes || '').trim() : null;
  const status = String(v.data.status || 'ACTIVE').trim().toUpperCase();

  const payer = await prisma.billingPayer.findFirst({
    where: { tenantId, id: payerId },
  });
  if (!payer) {
    return NextResponse.json({ error: 'Payer not found' }, { status: 404 });
  }
  if (planId) {
    const plan = await prisma.billingPlan.findFirst({
      where: { tenantId, id: planId },
    });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
  }

  const ruleKey = buildRuleKey(payerId, planId, ruleType, title);
  const existing = await prisma.billingPolicyRule.findFirst({
    where: { tenantId, ruleKey },
  });
  if (existing) {
    return NextResponse.json({ rule: existing, noOp: true });
  }

  const now = new Date();

  try {
    const rule = await prisma.billingPolicyRule.create({
      data: {
        id: uuidv4(),
        tenantId,
        payerId,
        planId: planId || null,
        ruleType,
        title,
        notes,
        status,
        ruleKey,
        createdAt: now,
        updatedAt: now,
      },
    });

    await createAuditLog(
      'billing_policy_rule',
      rule.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: rule },
      tenantId
    );

    return NextResponse.json({ rule });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const fallback = await prisma.billingPolicyRule.findFirst({
        where: { tenantId, ruleKey },
      });
      if (fallback) return NextResponse.json({ rule: fallback, noOp: true });
    }
    throw err;
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
