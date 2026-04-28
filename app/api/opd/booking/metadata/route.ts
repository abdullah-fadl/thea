import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }) => {
  const specialties = await prisma.clinicalInfraSpecialty.findMany({
    where: { tenantId, isArchived: false },
    orderBy: [{ name: 'asc' }],
    take: 500,
  });

  const providers = await prisma.clinicalInfraProvider.findMany({
    where: { tenantId, isArchived: false },
    take: 500,
  });

  const providerProfiles = await prisma.clinicalInfraProviderProfile.findMany({
    where: { tenantId },
    take: 500,
  });

  const providerAssignments = await prisma.clinicalInfraProviderAssignment.findMany({
    where: { tenantId },
    take: 500,
  });

  const clinics = await prisma.clinicalInfraClinic.findMany({
    where: { tenantId, isArchived: false },
    orderBy: [{ name: 'asc' }],
    take: 500,
  });

  const profileByProvider = providerProfiles.reduce<Record<string, (typeof providerProfiles)[0]>>((acc, profile) => {
    acc[profile.providerId] = profile;
    return acc;
  }, {});

  const assignmentsByProvider = providerAssignments.reduce<Record<string, (typeof providerAssignments)[0]>>((acc, assignment) => {
    acc[assignment.providerId] = assignment;
    return acc;
  }, {});

  const providerById = providers.reduce<Record<string, (typeof providers)[0]>>((acc, provider) => {
    acc[provider.id] = provider;
    return acc;
  }, {});

  const resources = await prisma.schedulingResource.findMany({
    where: { tenantId, resourceType: 'PROVIDER', departmentKey: 'opd', status: { not: 'ARCHIVED' } },
    orderBy: [{ createdAt: 'asc' }],
    take: 500,
  });

  const resourceItems = resources.map((resource) => {
    const refObj = resource.resourceRef && typeof resource.resourceRef === 'object' ? (resource.resourceRef as Record<string, unknown>) : null;
    const providerIdFromRef = refObj?.providerId != null ? String(refObj.providerId).trim() : '';
    const providerId = String(resource.resourceRefProviderId || providerIdFromRef || '').trim();
    const profile = providerId ? profileByProvider[providerId] : null;
    const provider = providerId ? providerById[providerId] : null;
    const assignment = providerId ? assignmentsByProvider[providerId] : null;
    return {
      resourceId: resource.id,
      providerId: providerId || null,
      displayName: String(provider?.displayName || resource.displayName || '').trim(),
      specialtyIds: Array.isArray(profile?.specialtyIds) ? profile.specialtyIds : [],
      primaryClinicId: String(assignment?.primaryClinicId || '').trim() || null,
      parallelClinicIds: Array.isArray(assignment?.parallelClinicIds) ? assignment.parallelClinicIds : [],
    };
  });

  const uniqueProviders = Array.from(
    new Map(
      resourceItems
        .filter((p) => p.resourceId || p.providerId)
        .map((p) => [String(p.providerId || p.resourceId), p])
    ).values()
  ).sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''), 'en'));

  // For doctors: include myResource so OPD Appointments can auto-select their schedule
  let myResource: { resourceId: string; providerId: string; clinicId: string | null; specialtyId: string | null } | null = null;
  const staffId = String(user?.staffId || '').trim();
  if (staffId) {
    const provider = await prisma.clinicalInfraProvider.findFirst({
      where: { tenantId, staffId, isArchived: false },
    });
    if (provider) {
      const myRes = resourceItems.find((r) => String(r.providerId || '') === String(provider.id));
      if (myRes) {
        const assignment = assignmentsByProvider[provider.id];
        const clinicId = assignment?.primaryClinicId || assignment?.parallelClinicIds?.[0] || null;
        const clinic = clinicId ? clinics.find((c) => c.id === clinicId) : null;
        const specialtyId = clinic?.specialtyId || (Array.isArray(myRes.specialtyIds) ? myRes.specialtyIds[0] : null) || null;
        myResource = {
          resourceId: myRes.resourceId,
          providerId: String(provider.id),
          clinicId: clinicId || null,
          specialtyId: specialtyId || null,
        };
      }
    }
  }

  return NextResponse.json({
    specialties: specialties.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code || null,
    })),
    clinics: clinics.map((item) => ({
      id: item.id,
      name: item.name,
      unitId: item.unitId,
      specialtyId: item.specialtyId,
    })),
    providers: uniqueProviders,
    myResource: myResource || null,
  });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);
