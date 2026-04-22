import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { waitingToDoctorMinutes, waitingToNursingMinutes } from '@/lib/opd/waiting';
import { deriveOpdStatus } from '@/lib/opd/status';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveDateParam(req: NextRequest) {
  const dateParam = String(req.nextUrl.searchParams.get('date') || '').trim();
  if (dateParam) return dateParam;
  return new Date().toISOString().slice(0, 10);
}

function getPatientMrn(patient: any) {
  if (!patient) return '';
  const topLevel = String(patient.mrn || patient.fileNumber || '').trim();
  if (topLevel) return topLevel;
  const links = Array.isArray(patient.links) ? patient.links : [];
  const opdLink = links.find((link: any) => link?.system === 'OPD' && (link?.mrn || link?.tempMrn));
  const anyLink = links.find((link: any) => link?.mrn || link?.tempMrn);
  return opdLink?.mrn || opdLink?.tempMrn || anyLink?.mrn || anyLink?.tempMrn || '';
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const clinicId = String(req.nextUrl.searchParams.get('clinicId') || '').trim();
  const date = resolveDateParam(req);

  // Filter by booking date (local date field) + checked-in status
  // Do NOT use UTC checkedInAt range — that breaks for timezones ahead of UTC (e.g. Asia/Riyadh UTC+3)
  const bookingFilter: any = {
    tenantId,
    date,                                            // booking date field (local date)
    bookingType: 'PATIENT',
    status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },  // include both
    checkedInAt: { not: null },                      // must have been checked in
  };
  if (clinicId && clinicId !== 'ALL') {
    bookingFilter.clinicId = clinicId;
  }

  const bookings = await prisma.opdBooking.findMany({
    where: bookingFilter,
    orderBy: [{ startAt: 'asc' }],
    take: 500,
  });

  const patientIds = Array.from(
    new Set(bookings.map((booking) => String(booking.patientMasterId || '').trim()).filter(Boolean))
  );
  const patients = patientIds.length
    ? await prisma.patientMaster.findMany({
        where: { tenantId, id: { in: patientIds } },
      })
    : [];
  const patientById = patients.reduce<Record<string, (typeof patients)[0]>>((acc, patient) => {
    acc[patient.id] = patient;
    return acc;
  }, {});

  const encounterIds = Array.from(
    new Set(bookings.map((booking) => String(booking.encounterCoreId || '')).filter(Boolean))
  );
  const opdRecords = encounterIds.length
    ? await prisma.opdEncounter.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
        include: {
          nursingEntries: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      })
    : [];
  const opdByEncounter = opdRecords.reduce<Record<string, (typeof opdRecords)[0]>>((acc, record) => {
    acc[record.encounterCoreId] = record;
    return acc;
  }, {});

  const resourceIds = Array.from(
    new Set(bookings.map((booking) => String(booking.resourceId || '')).filter(Boolean))
  );
  const resources = resourceIds.length
    ? await prisma.schedulingResource.findMany({
        where: { tenantId, id: { in: resourceIds } },
      })
    : [];
  const resourceById = resources.reduce<Record<string, (typeof resources)[0]>>((acc, resource) => {
    acc[resource.id] = resource;
    return acc;
  }, {});

  const providerIds = Array.from(
    new Set(
      resources
        .map((resource) => String(resource.resourceRefProviderId || '').trim())
        .filter(Boolean)
    )
  );
  const providers = providerIds.length
    ? await prisma.clinicalInfraProvider.findMany({
        where: { tenantId, id: { in: providerIds }, isArchived: false },
      })
    : [];
  const providerById = providers.reduce<Record<string, (typeof providers)[0]>>((acc, provider) => {
    acc[provider.id] = provider;
    return acc;
  }, {});

  const clinicIds = Array.from(
    new Set(bookings.map((b) => String(b.clinicId || '').trim()).filter(Boolean))
  );
  const clinics = clinicIds.length
    ? await prisma.clinicalInfraClinic.findMany({
        where: { tenantId, id: { in: clinicIds } },
      })
    : [];
  const clinicById = clinics.reduce<Record<string, (typeof clinics)[0]>>((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  const now = new Date();
  const items = bookings.map((booking) => {
    const encounterCoreId = String(booking.encounterCoreId || '').trim();
    const opd = encounterCoreId ? opdByEncounter[encounterCoreId] || null : null;
    const patient = patientById[String(booking.patientMasterId || '')] || null;
    const resource = resourceById[String(booking.resourceId || '')] || null;
    const providerId = String(resource?.resourceRefProviderId || '').trim();
    const provider = providerId ? providerById[providerId] || null : null;
    const arrivedAt = opd?.arrivedAt || null;
    const nursingStartAt = opd?.nursingStartAt || null;
    const nursingEndAt = opd?.nursingEndAt || null;
    const doctorStartAt = opd?.doctorStartAt || null;
    const payment = (opd as any)?.payment as Record<string, unknown> | undefined;
    const waitingStartAt = payment?.paidAt || arrivedAt || null;
    const waitingSinceLabel = payment?.paidAt ? 'PAYMENT' : arrivedAt ? 'ARRIVAL' : null;

    // Get nursing entries for this OPD encounter
    const nursingEntries = opd?.nursingEntries || [];

    return {
      bookingId: booking.id,
      bookingTypeLabel: booking.bookingType === 'PATIENT' ? 'BOOKED' : 'WALK_IN',
      sourceType: booking.isWalkIn ? 'WALK_IN' : 'APPOINTMENT',
      clinicId: booking.clinicId || null,
      clinicName: clinicById[booking.clinicId]?.name || null,
      startAt: booking.startAt || null,
      checkedInAt: booking.checkedInAt || null,
      encounterCoreId: encounterCoreId || null,
      visitType: opd?.visitType || null,
      doctorName: provider?.displayName || resource?.displayName || null,
      isArrived: Boolean(arrivedAt),
      isCheckedIn: Boolean(booking.checkedInAt),
      status: deriveOpdStatus({ checkedInAt: booking.checkedInAt || null, arrivedAt }),
      waitingStartAt,
      waitingSinceLabel,
      waitingToNursingMinutes: waitingToNursingMinutes(now, arrivedAt, nursingStartAt),
      waitingToDoctorMinutes: waitingToDoctorMinutes(now, nursingEndAt, doctorStartAt),
      patient: patient
        ? {
            id: patient.id,
            fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
            dob: patient.dob || null,
            gender: patient.gender || null,
            mrn: getPatientMrn(patient),
          }
        : null,
      opdFlowState: opd?.opdFlowState || null,
      latestAllergies: null, // Will be populated from nursing entries table when available
      latestVitals: null, // Will be populated from nursing entries table when available
      criticalVitalsFlag: opd?.criticalVitalsFlag || null,
      priority: opd?.priority || 'NORMAL',
      opdClinicExtensions: opd?.clinicExtensions || null,
      latestNursingEntry: opd?.nursingEntries?.[0] || null,
      opdNursingEntries: opd?.nursingEntries || [],
    };
  });

  // Sort by priority (URGENT first) then by arrival time
  const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  items.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    const ta = a.waitingStartAt ? new Date(a.waitingStartAt as string).getTime() : Infinity;
    const tb = b.waitingStartAt ? new Date(b.waitingStartAt as string).getTime() : Infinity;
    return ta - tb;
  });

  return NextResponse.json({ date, clinicId, items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.nursing.view' }
);
