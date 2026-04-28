import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getConsultationPrice } from '@/lib/billing/pricing';
import { withErrorHandler } from '@/lib/core/errors';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const specialtyCode = params.get('specialtyCode') || undefined;
  const providerId = params.get('providerId') || undefined;
  const isFirstVisit = params.get('isFirstVisit') === 'true';
  const insurancePlanId = params.get('insurancePlanId') || undefined;

  const price = await getConsultationPrice(null, tenantId, {
    specialtyCode,
    providerId,
    isFirstVisit,
    insurancePlanId,
  });

  return NextResponse.json(price);
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
