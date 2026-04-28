import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { determineVisitPricing } from '@/lib/billing/visitPricing';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const patientId = params.get('patientId') || '';
  const doctorId = params.get('doctorId') || '';
  const specialtyCode = params.get('specialtyCode') || '';

  if (!patientId || !doctorId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const pricing = await determineVisitPricing(null, tenantId, patientId, doctorId, specialtyCode);
    // Filter service catalog — do not expose internal fields (pricing tiers, rules, raw data)
    const safeService = pricing.service
      ? {
          code: pricing.service.code,
          name: pricing.service.name,
          nameAr: pricing.service.nameAr || null,
          nameEn: pricing.service.nameEn || null,
          serviceType: pricing.service.serviceType,
          specialtyCode: pricing.service.specialtyCode || null,
        }
      : null;
    return NextResponse.json({
      ...pricing,
      service: safeService,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to determine pricing' }, { status: 400 });
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
