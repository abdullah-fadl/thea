import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const encounterCoreId = String(req.nextUrl.searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const booking = await prisma.opdBooking.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!booking) {
    return NextResponse.json({ booking: null });
  }

  const resource = booking.resourceId
    ? await prisma.schedulingResource.findFirst({
        where: { tenantId, id: booking.resourceId },
      })
    : null;

  const providerId = String(resource?.resourceRefProviderId || '').trim();
  const provider = providerId
    ? await prisma.clinicalInfraProvider.findFirst({
        where: { tenantId, id: providerId, isArchived: false },
      })
    : null;

  const clinic = booking.clinicId
    ? await prisma.clinicalInfraClinic.findFirst({
        where: { tenantId, id: booking.clinicId, isArchived: false },
      })
    : null;

  return NextResponse.json({
    booking,
    clinic: clinic
      ? { id: clinic.id, name: clinic.name, unitId: clinic.unitId, specialtyId: clinic.specialtyId }
      : null,
    provider: provider ? { id: provider.id, displayName: provider.displayName || provider.id } : null,
  });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);
