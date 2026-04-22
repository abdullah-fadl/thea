import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { encounterCoreId: string } }
) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const encounterCoreId = String(params?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const portalUser: any = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });
  if (!portalUser?.patientMasterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const encounter: any = await prisma.encounterCore.findFirst({
    where: { tenantId: payload.tenantId, id: encounterCoreId },
  });
  if (!encounter || String(encounter.patientId || '') !== String(portalUser.patientMasterId || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const patient: any = await prisma.patientMaster.findFirst({
    where: { tenantId: payload.tenantId, id: portalUser.patientMasterId },
  });

  const opd: any = await prisma.opdEncounter.findFirst({
    where: { tenantId: payload.tenantId, encounterCoreId },
  });

  const booking: any = await prisma.opdBooking.findFirst({
    where: { tenantId: payload.tenantId, encounterCoreId },
  });

  const clinic: any = booking?.clinicId
    ? await prisma.clinicalInfraClinic.findFirst({
        where: { tenantId: payload.tenantId, id: booking.clinicId },
      })
    : null;

  const provider: any = booking?.resourceId
    ? await prisma.schedulingResource.findFirst({
        where: { tenantId: payload.tenantId, id: booking.resourceId },
      })
    : null;

  return NextResponse.json({
    encounter: encounter
      ? {
          id: encounter.id,
          encounterType: encounter.encounterType || null,
          status: encounter.status || null,
          openedAt: encounter.openedAt || encounter.createdAt || null,
          closedAt: encounter.closedAt || null,
          department: encounter.department || null,
        }
      : null,
    patient: patient
      ? {
          name:
            [patient.firstNameAr, patient.lastNameAr].filter(Boolean).join(' ') ||
            [patient.firstName, patient.lastName].filter(Boolean).join(' ') ||
            null,
          mrn: patient.mrn || null,
          dob: patient.dob || null,
        }
      : null,
    opd: opd
      ? {
          id: opd.id,
          encounterCoreId: opd.encounterCoreId || null,
          status: opd.status || null,
          arrivalState: opd.arrivalState || null,
          arrivedAt: opd.arrivedAt || null,
          ophthalmologyData: opd.ophthalmologyData || null,
          clinicExtensions: opd.clinicExtensions || null,
        }
      : null,
    booking: booking
      ? {
          id: booking.id,
          slotDate: booking.slotDate || null,
          slotStartAt: booking.slotStartAt || null,
          visitType: booking.visitType || null,
          status: booking.status || null,
        }
      : null,
    clinic: clinic
      ? {
          id: clinic.id,
          name: clinic.name || null,
          nameAr: clinic.nameAr || null,
          specialty: clinic.specialty || null,
        }
      : null,
    provider: provider
      ? {
          id: provider.id,
          name: provider.name || null,
          nameAr: provider.nameAr || null,
          specialty: provider.specialty || null,
        }
      : null,
  });
});
