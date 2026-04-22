import { prisma } from '@/lib/db/prisma';
import { detectVisitType } from '@/lib/opd/visitType';

export type VisitType = 'NEW' | 'RETURN' | 'FOLLOW_UP';

export interface VisitPricingResult {
  visitType: VisitType;
  visitTypeCode: 'FVH' | 'FVC' | 'RV' | 'FU' | 'REF';
  serviceCode: string;
  serviceName: string;
  serviceNameAr?: string | null;
  serviceNameEn?: string | null;
  price: number;
  isFree: boolean;
  reason?: string;
  service?: any;
}

function resolveServiceName(service: any) {
  return String(service?.nameAr || service?.nameEn || service?.name || service?.code || '').trim();
}

function normalizePricing(service: any) {
  const pricing = service?.pricing || {};
  const defaultPrice = Number(pricing.default ?? service?.basePrice ?? 0);
  return {
    consultant: Number(pricing.consultant ?? defaultPrice),
    specialist: Number(pricing.specialist ?? defaultPrice),
    resident: Number(pricing.resident ?? defaultPrice),
    default: defaultPrice,
  };
}

function normalizeRules(service: any) {
  const rules = service?.rules || {};
  return {
    followUpFree: rules.followUpFree !== false,
    followUpDays: Number.isFinite(Number(rules.followUpDays)) ? Number(rules.followUpDays) : 14,
    requiresApproval: Boolean(rules.requiresApproval),
  };
}

function pricingForLevel(level: string | null | undefined, pricing: ReturnType<typeof normalizePricing>) {
  const normalized = String(level || '').toUpperCase();
  if (normalized === 'CONSULTANT') return pricing.consultant;
  if (normalized === 'SPECIALIST') return pricing.specialist;
  if (normalized === 'RESIDENT') return pricing.resident;
  return pricing.default;
}

export async function determineVisitPricing(
  _db: any,
  tenantId: string,
  patientId: string,
  doctorId: string,
  specialtyCode: string | null | undefined
): Promise<VisitPricingResult> {
  // Fetch doctor from scheduling_resources (has Prisma model)
  const doctor = await prisma.schedulingResource.findFirst({
    where: { tenantId, id: doctorId },
  });
  if (!doctor) throw new Error('Doctor not found');

  // Fetch consultation service from service_catalog (no Prisma model yet)
  let service: any | null = null;
  const doctorCode = String(doctor.consultationServiceCode || '').trim();

  if (doctorCode) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "service_catalog"
       WHERE "tenantId" = $1 AND "code" = $2 AND "serviceType" = 'CONSULTATION' AND "status" = 'ACTIVE'
       LIMIT 1`,
      tenantId,
      doctorCode
    );
    service = rows[0] || null;
  }

  if (!service) {
    const specialtyFilter = String(specialtyCode || '').trim();
    if (specialtyFilter) {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM "service_catalog"
         WHERE "tenantId" = $1 AND "serviceType" = 'CONSULTATION' AND "status" = 'ACTIVE' AND "specialtyCode" = $2
         LIMIT 1`,
        tenantId,
        specialtyFilter
      );
      service = rows[0] || null;
    } else {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM "service_catalog"
         WHERE "tenantId" = $1 AND "serviceType" = 'CONSULTATION' AND "status" = 'ACTIVE'
         LIMIT 1`,
        tenantId
      );
      service = rows[0] || null;
    }
  }

  if (!service) {
    // Fallback: consultation service with null/empty specialty
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "service_catalog"
       WHERE "tenantId" = $1 AND "serviceType" = 'CONSULTATION' AND "status" = 'ACTIVE'
         AND ("specialtyCode" IS NULL OR "specialtyCode" = '')
       LIMIT 1`,
      tenantId
    );
    service = rows[0] || null;
  }

  if (!service) throw new Error('Consultation service not found');

  const pricing = normalizePricing(service);
  const rules = normalizeRules(service);
  const basePrice = pricingForLevel(doctor.level, pricing);

  // Use detectVisitType: FVH (first hospital), FVC (first with doctor), FU (follow-up ≤14d), RV (return >14d), REF (referral)
  const visitTypeCode = await detectVisitType(null, tenantId, patientId, doctorId);

  const visitType: VisitType =
    visitTypeCode === 'FU' ? 'FOLLOW_UP' : visitTypeCode === 'RV' || visitTypeCode === 'REF' ? 'RETURN' : 'NEW';

  // FU (follow-up within 14 days) may be free per service rules; REF uses base price
  const isFollowUpFree = visitTypeCode === 'FU' && rules.followUpFree;
  const price = isFollowUpFree ? 0 : basePrice;

  const reasonMap: Record<string, string> = {
    FVH: 'First visit to hospital',
    FVC: 'First visit with this doctor',
    FU: isFollowUpFree
      ? `Follow-up within ${rules.followUpDays} days`
      : `Follow-up within ${rules.followUpDays} days (paid)`,
    RV: 'Return visit (more than 14 days since last visit)',
    REF: 'Referral from another doctor or department',
  };
  const reason = reasonMap[visitTypeCode] || '';

  return {
    visitType,
    visitTypeCode,
    serviceCode: service.code,
    serviceName: resolveServiceName(service) || service.code,
    serviceNameAr: service.nameAr || null,
    serviceNameEn: service.nameEn || service.name || null,
    price,
    isFree: isFollowUpFree,
    reason,
    service,
  };
}
