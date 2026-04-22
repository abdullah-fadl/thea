import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Public-facing clinics lookup for the registration page.
 * Filters active clinics by specialty (code, shortCode, or id).
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const specialtyCode = String(
      req.nextUrl.searchParams.get('specialtyCode') || ''
    ).trim();

    const where: any = { tenantId, isArchived: { not: true } };

    if (specialtyCode) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const specialtyOr: any[] = [
        { code: { equals: specialtyCode, mode: 'insensitive' as const } },
        { shortCode: { equals: specialtyCode, mode: 'insensitive' as const } },
        { name: { equals: specialtyCode, mode: 'insensitive' as const } },
      ];
      if (uuidRe.test(specialtyCode)) specialtyOr.push({ id: specialtyCode });

      const specialty = await prisma.clinicalInfraSpecialty.findFirst({
        where: {
          tenantId,
          isArchived: { not: true },
          OR: specialtyOr,
        },
        select: { id: true },
      });

      if (specialty) {
        where.specialtyId = specialty.id;
      } else if (uuidRe.test(specialtyCode)) {
        where.specialtyId = specialtyCode;
      } else {
        where.specialtyId = '00000000-0000-0000-0000-000000000000';
      }
    }

    const items = await prisma.clinicalInfraClinic.findMany({
      where,
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
