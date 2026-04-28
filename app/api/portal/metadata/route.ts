import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const tenantId = payload.tenantId;

  const [facilities, units, specialties, clinics, providers, resources] = await Promise.all([
    prisma.clinicalInfraFacility.findMany({
      where: { tenantId, status: { not: 'inactive' } },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    prisma.clinicalInfraUnit.findMany({
      where: { tenantId, status: { not: 'inactive' } },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    prisma.clinicalInfraSpecialty.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    prisma.clinicalInfraClinic.findMany({
      where: { tenantId, isArchived: { not: true } },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    prisma.clinicalInfraProvider.findMany({
      where: { tenantId, isArchived: { not: true } },
      orderBy: { displayName: 'asc' },
      take: 500,
    }),
    prisma.schedulingResource.findMany({
      where: {
        tenantId,
        resourceType: 'PROVIDER',
        departmentKey: 'opd',
        status: { not: 'ARCHIVED' },
      },
      take: 500,
    }),
  ]);

  return NextResponse.json({
    facilities: facilities.map((item: any) => ({ id: item.id, name: item.name })),
    units: units.map((item: any) => ({ id: item.id, name: item.name, facilityId: item.facilityId, code: item.code })),
    specialties: specialties.map((item: any) => ({ id: item.id, name: item.name, code: item.code || null })),
    clinics: clinics.map((item: any) => ({
      id: item.id,
      name: item.name,
      unitId: item.unitId,
      specialtyId: item.specialtyId,
    })),
    providers: providers.map((item: any) => ({
      id: item.id,
      displayName: item.displayName || item.id,
      specialtyIds: Array.isArray(item.specialtyIds) ? item.specialtyIds : [],
    })),
    resources: resources.map((item: any) => ({
      id: item.id,
      displayName: item.displayName,
      resourceRef: item.resourceRef || null,
    })),
  });
});
