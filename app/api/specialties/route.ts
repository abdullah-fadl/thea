import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Built-in Arabic translations for common specialty codes
const SPECIALTY_AR: Record<string, string> = {
  OPT: 'بصريات',
  OPTOMETRY: 'بصريات',
  OPTOMETRIST: 'بصريات',
  OPH: 'طب العيون',
  OPHTHALMOLOGY: 'طب العيون',
  GP: 'طب عام',
  GENERAL: 'طب عام',
  GENERAL_PRACTICE: 'طب عام',
  CARDIOLOGY: 'أمراض القلب',
  CARD: 'أمراض القلب',
  DERMATOLOGY: 'الجلدية',
  DERM: 'الجلدية',
  ENT: 'أنف وأذن وحنجرة',
  ENDOCRINOLOGY: 'الغدد الصماء',
  ENDO: 'الغدد الصماء',
  GASTROENTEROLOGY: 'الجهاز الهضمي',
  GASTRO: 'الجهاز الهضمي',
  NEUROLOGY: 'الأعصاب',
  NEURO: 'الأعصاب',
  ORTHOPEDICS: 'العظام والمفاصل',
  ORTHO: 'العظام والمفاصل',
  PEDIATRICS: 'طب الأطفال',
  PEDS: 'طب الأطفال',
  PSYCHIATRY: 'الطب النفسي',
  PSYCH: 'الطب النفسي',
  PULMONOLOGY: 'أمراض الصدر',
  PULM: 'أمراض الصدر',
  RHEUMATOLOGY: 'الروماتيزم',
  RHEUM: 'الروماتيزم',
  UROLOGY: 'المسالك البولية',
  URO: 'المسالك البولية',
  SURGERY: 'الجراحة العامة',
  SURG: 'الجراحة العامة',
  OBSTETRICS: 'أمراض النساء والولادة',
  OBG: 'أمراض النساء والولادة',
  OBGYN: 'أمراض النساء والولادة',
  ONCOLOGY: 'الأورام',
  ONCO: 'الأورام',
  NEPHROLOGY: 'أمراض الكلى',
  NEPH: 'أمراض الكلى',
  INTERNAL_MEDICINE: 'الباطنية',
  IM: 'الباطنية',
};

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const search = String(req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '').trim();
  const where: any = { tenantId, isArchived: { not: true } };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { shortCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  let items = await prisma.clinicalInfraSpecialty.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }],
  });

  // If no specialties configured yet, derive from active scheduling resources
  if (items.length === 0) {
    const resources = await prisma.schedulingResource.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        specialtyCode: { not: null },
      },
      select: { specialtyCode: true, displayName: true },
    });

    // Deduplicate by specialtyCode
    const seen = new Set<string>();
    items = resources
      .filter((r) => r.specialtyCode && !seen.has(r.specialtyCode) && seen.add(r.specialtyCode!))
      .map((r) => {
        const code = r.specialtyCode!;
        const codeUpper = code.toUpperCase();
        const nameAr = SPECIALTY_AR[codeUpper] || code;
        return {
          id: code,
          tenantId,
          name: r.displayName || code,
          nameAr,
          code,
          shortCode: code,
          isArchived: false,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        };
      });
  }

  // Attach Arabic names to existing specialties if missing
  const enriched = items.map((s: any) => ({
    ...s,
    nameAr: s.nameAr || SPECIALTY_AR[(s.code || '').toUpperCase()] || s.name,
  }));

  return NextResponse.json({ items: enriched });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['opd.visit.view', 'admin.scheduling.view', 'scheduling.view', 'scheduling.availability.view'],
  },
);
