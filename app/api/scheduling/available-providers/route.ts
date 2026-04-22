import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canManageScheduling } from '@/lib/scheduling/access';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/scheduling/available-providers?specialtyCode=X
 * Returns providers from Clinical Infra filtered by specialty, for use in scheduling resources form.
 * Uses scheduling permissions (no admin required).
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role, permissions }) => {
    if (!canManageScheduling({ user, tenantId, role, permissions: permissions ?? [] })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const specialtyCode = String(req.nextUrl.searchParams.get('specialtyCode') || '').trim();
    const specialtyCodeUpper = specialtyCode ? specialtyCode.toUpperCase() : '';

    const baseFilter: any = { tenantId, isArchived: false };

    if (!specialtyCode) {
      const items = await prisma.clinicalInfraProvider.findMany({
        where: baseFilter,
        orderBy: { displayName: 'asc' },
        take: 500,
      });
      return NextResponse.json({ items });
    }

    const codesToTry = Array.from(new Set([specialtyCode, specialtyCodeUpper, specialtyCode.toLowerCase()].filter(Boolean)));
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const specialtyOr: any[] = [
      ...codesToTry.flatMap((c) => [
        { code: { equals: c, mode: 'insensitive' as const } },
        { shortCode: { equals: c, mode: 'insensitive' as const } },
        { name: { equals: c, mode: 'insensitive' as const } },
      ]),
    ];
    if (uuidRe.test(specialtyCode)) specialtyOr.push({ id: specialtyCode });

    const specialties = await prisma.clinicalInfraSpecialty.findMany({
      where: { tenantId, isArchived: false, OR: specialtyOr },
      select: { id: true, code: true, name: true },
      take: 500,
    });

    const resolvedIds = specialties.map((sp) => String(sp.id || '')).filter(Boolean);
    const specialtyIdsForProfile = Array.from(new Set(resolvedIds));

    const providerIdSets: string[] = [];

    if (specialtyIdsForProfile.length > 0) {
      const profiles = await prisma.clinicalInfraProviderProfile.findMany({
        where: { tenantId, specialtyIds: { hasSome: specialtyIdsForProfile } },
        select: { providerId: true },
        take: 500,
      });
      providerIdSets.push(...profiles.map((p) => String(p.providerId || '')).filter(Boolean));
    }

    const allCodesToMatch = Array.from(
      new Set([...codesToTry, ...specialties.map((s) => s.code), ...specialties.map((s) => s.name)].filter(Boolean))
    );
    if (allCodesToMatch.length > 0) {
      const byCode = await prisma.clinicalInfraProvider.findMany({
        where: {
          ...baseFilter,
          specialtyCode: { not: null },
          OR: allCodesToMatch.map((c) => ({ specialtyCode: { equals: c, mode: 'insensitive' as const } })),
        },
        select: { id: true },
        take: 500,
      });
      providerIdSets.push(...byCode.map((p) => String(p.id || '')).filter(Boolean));
    }

    // Fallback: providers assigned to clinics with this specialty
    if (resolvedIds.length > 0) {
      const clinicsWithSpecialty = await prisma.clinicalInfraClinic.findMany({
        where: { tenantId, isArchived: false, specialtyId: { in: resolvedIds } },
        select: { id: true },
        take: 500,
      });
      const clinicIds = clinicsWithSpecialty.map((c) => c.id);
      if (clinicIds.length > 0) {
        const assignments = await prisma.clinicalInfraProviderAssignment.findMany({
          where: {
            tenantId,
            OR: [
              { primaryClinicId: { in: clinicIds } },
              { parallelClinicIds: { hasSome: clinicIds } },
            ],
          },
          select: { providerId: true },
          take: 500,
        });
        providerIdSets.push(...assignments.map((a) => String(a.providerId || '')).filter(Boolean));
      }
    }

    const providerIds = Array.from(new Set(providerIdSets.filter(Boolean)));
    if (providerIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const items = await prisma.clinicalInfraProvider.findMany({
      where: { ...baseFilter, id: { in: providerIds } },
      orderBy: { displayName: 'asc' },
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);
