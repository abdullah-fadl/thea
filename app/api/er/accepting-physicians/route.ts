import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {

  const rawUnit = String(req.nextUrl.searchParams.get('unitId') || '').trim();
  if (!rawUnit) {
    return NextResponse.json({ items: [] });
  }

  const cleanedName = rawUnit.replace(/\s*\([^)]+\)\s*/g, '').trim();
  const parenMatch = rawUnit.match(/\(([^)]+)\)/);
  const parenToken = String(parenMatch?.[1] || '').trim();

  // Find the unit by id, name, or shortCode
  const unitOrConditions: any[] = [
    { id: rawUnit },
    { name: cleanedName || rawUnit },
  ];
  if (parenToken) {
    unitOrConditions.push({ shortCode: parenToken });
  }

  const unit = await prisma.clinicalInfraUnit.findFirst({
    where: {
      tenantId,
      OR: unitOrConditions,
    },
    select: { id: true, name: true, shortCode: true },
  });

  const unitName = String(unit?.name || '').trim();
  const unitShortCode = String(unit?.shortCode || '').trim();
  const unitId = String(unit?.id || '').trim();
  if (!unitId) {
    return NextResponse.json({ items: [] });
  }

  // Find providers linked to this unit via profiles
  const profiles = await prisma.clinicalInfraProviderProfile.findMany({
    where: { tenantId, unitIds: { has: unitId } },
    select: { providerId: true },
    take: 500,
  });

  // Find providers linked via unit scopes
  const scopeUnits = await prisma.clinicalInfraProviderUnitScope.findMany({
    where: { tenantId, unitId },
    select: { providerId: true },
    take: 500,
  });

  // Find rooms in this unit
  const roomDocs = await prisma.clinicalInfraRoom.findMany({
    where: { tenantId, unitId, status: { not: 'inactive' } },
    select: { id: true },
    take: 500,
  });
  const roomIdList = roomDocs.map((r: any) => String(r.id || '')).filter(Boolean);

  // Find providers assigned to rooms
  const roomAssignments = roomIdList.length
    ? await prisma.clinicalInfraProviderRoomAssignment.findMany({
        where: { tenantId, roomId: { in: roomIdList } },
        select: { providerId: true },
      })
    : [];

  // Find clinics in this unit
  const clinics = await prisma.clinicalInfraClinic.findMany({
    where: { tenantId, unitId, isArchived: { not: true } },
    select: { id: true },
    take: 500,
  });
  const clinicIds = clinics.map((c: any) => String(c.id || '')).filter(Boolean);

  // Find providers assigned to clinics
  const providerAssignments = clinicIds.length
    ? await prisma.clinicalInfraProviderAssignment.findMany({
        where: {
          tenantId,
          OR: [
            { primaryClinicId: { in: clinicIds } },
            { parallelClinicIds: { hasSome: clinicIds } },
          ],
        },
        select: { providerId: true },
      })
    : [];

  // Collect unique provider IDs
  const providerIds = Array.from(
    new Set(
      [...profiles, ...scopeUnits, ...roomAssignments, ...providerAssignments]
        .map((p: any) => String(p.providerId || '').trim())
        .filter(Boolean)
    )
  );

  if (!providerIds.length) {
    return NextResponse.json({ items: [] });
  }

  // Fetch provider details
  const providers = await prisma.clinicalInfraProvider.findMany({
    where: { tenantId, id: { in: providerIds }, isArchived: { not: true } },
    select: { id: true, displayName: true, email: true, staffId: true },
    orderBy: [{ displayName: 'asc' }],
  });

  const providerItems = providers.map((p: any) => ({
    id: String(p.id || ''),
    displayName: String(p.displayName || '').trim() || String(p.email || '').trim() || String(p.id || '').trim(),
  }));

  // Also find users by department matching unit name/shortCode
  const userOrConditions: any[] = [];
  if (unitName) {
    userOrConditions.push({ department: { equals: unitName, mode: 'insensitive' as const } });
  }
  if (unitShortCode) {
    userOrConditions.push({ department: { equals: unitShortCode, mode: 'insensitive' as const } });
  }

  const users = userOrConditions.length
    ? await prisma.user.findMany({
        where: { tenantId, OR: userOrConditions },
        select: { id: true, email: true, firstName: true, lastName: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 200,
      })
    : [];

  const userItems = users.map((u: any) => {
    const name = `${String(u.firstName || '').trim()} ${String(u.lastName || '').trim()}`.trim();
    const displayName = name || String(u.email || '').trim() || String(u.id || '').trim();
    return { id: String(u.id || ''), displayName };
  });

  // Deduplicate
  const seen = new Set<string>();
  const items = [...providerItems, ...userItems].filter((item) => {
    const key = `${item.id}:${item.displayName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.view' }
);
