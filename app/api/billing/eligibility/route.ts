import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const encounterCoreId = String(req.nextUrl.searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const payerContext = await prisma.billingPayerContext.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });

  const warnings: string[] = [];
  if (!payerContext) {
    warnings.push('No payer context set');
  }

  let eligibilityStatus: 'UNKNOWN' | 'ASSUMED_ELIGIBLE' | 'ASSUMED_NOT_ELIGIBLE' = 'UNKNOWN';
  if (payerContext?.mode === 'INSURANCE') eligibilityStatus = 'ASSUMED_ELIGIBLE';
  if (payerContext?.mode === 'CASH') eligibilityStatus = 'ASSUMED_NOT_ELIGIBLE';

  let payerMatch: any = null;
  if (payerContext?.insuranceCompanyId || payerContext?.insuranceCompanyName) {
    const key = String(payerContext.insuranceCompanyId || '').trim();
    const name = String(payerContext.insuranceCompanyName || '').trim();

    // Build OR conditions for payer lookup
    const orConditions: any[] = [];
    if (key) {
      orConditions.push({ tenantId, id: key });
      orConditions.push({ tenantId, code: key.toUpperCase() });
    }
    if (name) {
      orConditions.push({ tenantId, name });
    }

    if (orConditions.length) {
      payerMatch = await prisma.billingPayer.findFirst({
        where: { OR: orConditions },
      });
    }
    if (!payerMatch) warnings.push('Payer not found');
  }

  const rules = payerMatch?.id
    ? await prisma.billingPolicyRule.findMany({
        where: { tenantId, payerId: payerMatch.id },
        orderBy: { createdAt: 'asc' },
        take: 100,
      })
    : [];

  const benefitsSummary = rules
    .filter((rule: any) => rule.status === 'ACTIVE')
    .map((rule: any) => (rule.notes ? `${rule.title}: ${rule.notes}` : rule.title));

  return NextResponse.json({
    encounterCoreId,
    payerContext: payerContext || null,
    eligibilityStatus,
    benefitsSummary,
    warnings,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
