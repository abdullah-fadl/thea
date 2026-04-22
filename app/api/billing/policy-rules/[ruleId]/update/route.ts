import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { updatePolicyRuleSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RULE_TYPES = new Set(['ELIGIBILITY_NOTE', 'PREAUTH_NOTE', 'COVERAGE_NOTE', 'BILLING_NOTE']);
const STATUSES = new Set(['ACTIVE', 'INACTIVE']);

function buildRuleKey(payerId: string, planId: string | null, ruleType: string, title: string) {
  return `${payerId}:${planId || 'NONE'}:${ruleType}:${title}`.toUpperCase();
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ruleId = String((params as Record<string, string>)?.ruleId || '').trim();
  if (!ruleId) {
    return NextResponse.json({ error: 'ruleId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updatePolicyRuleSchema);
  if ('error' in v) return v.error;

  const rule = await prisma.billingPolicyRule.findFirst({
    where: { tenantId, id: ruleId },
  });
  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  const nextTitle = body.title !== undefined ? String(body.title || '').trim() : rule.title;
  const nextNotes = body.notes !== undefined ? String(body.notes || '').trim() : rule.notes;
  const nextRuleType = body.ruleType !== undefined ? String(body.ruleType || '').trim().toUpperCase() : rule.ruleType;
  const nextStatus = body.status !== undefined ? String(body.status || '').trim().toUpperCase() : rule.status;

  const invalid: string[] = [];
  if (body.ruleType !== undefined && !RULE_TYPES.has(nextRuleType)) invalid.push('ruleType');
  if (body.status !== undefined && !STATUSES.has(nextStatus)) invalid.push('status');
  if (invalid.length) {
    return NextResponse.json({ error: 'Validation failed', invalid }, { status: 400 });
  }

  const patch: any = {};
  if (nextTitle !== rule.title) patch.title = nextTitle;
  if (nextNotes !== rule.notes) patch.notes = nextNotes;
  if (nextRuleType !== rule.ruleType) patch.ruleType = nextRuleType;
  if (nextStatus !== rule.status) patch.status = nextStatus;

  const nextRuleKey = buildRuleKey(rule.payerId, rule.planId || null, nextRuleType, nextTitle);
  if (nextRuleKey !== rule.ruleKey) patch.ruleKey = nextRuleKey;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ rule, noOp: true });
  }

  patch.updatedAt = new Date();
  try {
    const updated = await prisma.billingPolicyRule.update({
      where: { id: ruleId },
      data: patch,
    });

    await createAuditLog(
      'billing_policy_rule',
      ruleId,
      'UPDATE',
      userId || 'system',
      user?.email,
      { before: rule, after: updated },
      tenantId
    );

    return NextResponse.json({ rule: updated });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Rule already exists' }, { status: 409 });
    }
    throw err;
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
