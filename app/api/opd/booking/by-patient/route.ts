import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Returns today's opd_bookings for a patient.
 * Used by OPD Registration to show appointments with correct opd_booking ids for check-in.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const params = req.nextUrl.searchParams;
    const patientId = String(params.get('patientId') || '').trim();
    const date = String(params.get('date') || '').trim() || new Date().toISOString().slice(0, 10);

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const bookings = await prisma.opdBooking.findMany({
      where: {
        tenantId,
        patientMasterId: patientId,
        date,
        bookingType: 'PATIENT',
        status: 'ACTIVE',
      },
      orderBy: [{ startAt: 'asc' }],
      take: 100,
    });

    const resourceIds = Array.from(
      new Set(bookings.map((b) => b.resourceId).filter(Boolean) as string[])
    );
    const clinicIds = Array.from(
      new Set(bookings.map((b) => b.clinicId).filter(Boolean) as string[])
    );

    const [resources, clinics] = await Promise.all([
      resourceIds.length
        ? prisma.schedulingResource.findMany({
            where: { tenantId, id: { in: resourceIds } },
          })
        : [],
      clinicIds.length
        ? prisma.clinicalInfraClinic.findMany({
            where: { tenantId, id: { in: clinicIds }, isArchived: false },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const resourceById = Object.fromEntries(resources.map((r) => [r.id, r]));
    const clinicById = Object.fromEntries(clinics.map((c) => [c.id, c]));

    const providerIds = resources
      .map((r) => r.resourceRefProviderId)
      .filter(Boolean) as string[];
    const providers =
      providerIds.length > 0
        ? await prisma.clinicalInfraProvider.findMany({
            where: { tenantId, id: { in: providerIds }, isArchived: false },
          })
        : [];
    const providerById = Object.fromEntries(providers.map((p) => [p.id, p]));

    const items = bookings.map((booking) => {
      const resource = resourceById[booking.resourceId || ''];
      const provider = resource
        ? providerById[resource.resourceRefProviderId || '']
        : null;
      const clinic = clinicById[booking.clinicId || ''];

      return {
        id: booking.id,
        resourceId: booking.resourceId,
        resourceName:
          provider?.displayName || resource?.displayName || resource?.name || '',
        clinicId: booking.clinicId,
        clinicName: clinic?.name || null,
        specialtyCode:
          provider?.specialtyCode || resource?.specialtyCode || null,
        specialtyName:
          provider?.displayName || resource?.displayName || resource?.name || '',
        slotStart: booking.startAt,
        slotEnd: booking.endAt,
        startAt: booking.startAt,
        endAt: booking.endAt,
        date: booking.date,
        status: 'ACTIVE',
      };
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);
