import { prisma } from '@/lib/db/prisma';

export interface PriceResult {
  basePrice: number;
  finalPrice: number;
  discounts: { type: string; amount: number }[];
  serviceCode: string;
  serviceName: string;
}

export async function getConsultationPrice(
  _db: any,
  tenantId: string,
  options: {
    specialtyCode?: string;
    providerId?: string;
    isFirstVisit: boolean;
    insurancePlanId?: string;
  }
): Promise<PriceResult> {
  const { specialtyCode, providerId, isFirstVisit } = options;

  // Check provider-level pricing (no Prisma model yet — use raw SQL)
  if (providerId) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "provider_pricing"
       WHERE "tenantId" = $1 AND "providerId" = $2 AND "serviceType" = $3 AND "isActive" = true
       LIMIT 1`,
      tenantId,
      providerId,
      isFirstVisit ? 'CONSULTATION' : 'FOLLOW_UP'
    );
    const providerPricing = rows[0];

    if (providerPricing) {
      return {
        basePrice: providerPricing.price,
        finalPrice: providerPricing.price,
        discounts: [],
        serviceCode: providerPricing.serviceCode || (isFirstVisit ? 'CONSUL-NEW' : 'CONSUL-FU'),
        serviceName: providerPricing.serviceName || (isFirstVisit ? 'كشف جديد' : 'متابعة'),
      };
    }
  }

  // Check specialty-level pricing (no Prisma model yet — use raw SQL)
  if (specialtyCode) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "specialty_pricing"
       WHERE "tenantId" = $1 AND "specialtyCode" = $2 AND "serviceType" = $3 AND "isActive" = true
       LIMIT 1`,
      tenantId,
      specialtyCode,
      isFirstVisit ? 'CONSULTATION' : 'FOLLOW_UP'
    );
    const specialtyPricing = rows[0];

    if (specialtyPricing) {
      return {
        basePrice: specialtyPricing.price,
        finalPrice: specialtyPricing.price,
        discounts: [],
        serviceCode: specialtyPricing.serviceCode || (isFirstVisit ? 'CONSUL-NEW' : 'CONSUL-FU'),
        serviceName: specialtyPricing.serviceName || (isFirstVisit ? 'كشف جديد' : 'متابعة'),
      };
    }
  }

  // Fallback to charge_catalog / billing_charge_catalog (no Prisma models yet)
  const serviceCode = isFirstVisit ? 'CONSUL-NEW' : 'CONSUL-FU';

  const catalogRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "charge_catalog"
     WHERE "tenantId" = $1 AND "code" = $2 AND "status" = 'ACTIVE'
     LIMIT 1`,
    tenantId,
    serviceCode
  );
  let catalogItem = catalogRows[0] || null;

  if (!catalogItem) {
    const billingRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "billing_charge_catalog"
       WHERE "tenantId" = $1 AND "code" = $2 AND "isActive" = true
       LIMIT 1`,
      tenantId,
      serviceCode
    );
    catalogItem = billingRows[0] || null;
  }

  if (catalogItem) {
    return {
      basePrice: catalogItem.price || 0,
      finalPrice: catalogItem.price || 0,
      discounts: [],
      serviceCode: catalogItem.code,
      serviceName:
        catalogItem.nameAr || catalogItem.name || (isFirstVisit ? 'كشف جديد' : 'متابعة'),
    };
  }

  // Default fallback pricing
  return {
    basePrice: isFirstVisit ? 200 : 100,
    finalPrice: isFirstVisit ? 200 : 100,
    discounts: [],
    serviceCode,
    serviceName: isFirstVisit ? 'كشف جديد' : 'متابعة',
  };
}
