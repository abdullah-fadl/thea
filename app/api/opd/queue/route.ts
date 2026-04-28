import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { waitingToNursingMinutes, waitingToDoctorMinutes } from '@/lib/opd/waiting';
import { deriveOpdStatus } from '@/lib/opd/status';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const date = String(params.get('date') || '').trim() || new Date().toISOString().slice(0, 10);
  const clinicIdFilter = String(params.get('clinicId') || '').trim();

  const bookingFilter: any = {
    tenantId,
    date,
    bookingType: 'PATIENT',
    status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
  };
  if (clinicIdFilter) bookingFilter.clinicId = clinicIdFilter;

  // [P-06] Add take limit to prevent unbounded booking fetch
  const bookings = await prisma.opdBooking.findMany({
    where: bookingFilter,
    orderBy: [{ startAt: 'asc' }],
    take: 500,
  });

  const patientIds = Array.from(
    new Set(bookings.map((booking) => String(booking.patientMasterId || '')).filter(Boolean))
  );
  const encounterIds = Array.from(
    new Set(bookings.map((booking) => String(booking.encounterCoreId || '')).filter(Boolean))
  );
  const resourceIds = Array.from(
    new Set(bookings.map((booking) => String(booking.resourceId || '')).filter(Boolean))
  );

  // [P-05] Parallelize the 3 independent batch queries (patients, OPD records, resources)
  const [patients, opdRecords, resources] = await Promise.all([
    patientIds.length
      ? prisma.patientMaster.findMany({
          where: { tenantId, id: { in: patientIds } },
        })
      : [],
    encounterIds.length
      ? prisma.opdEncounter.findMany({
          where: { tenantId, encounterCoreId: { in: encounterIds } },
        })
      : [],
    resourceIds.length
      ? prisma.schedulingResource.findMany({
          where: { tenantId, id: { in: resourceIds } },
        })
      : [],
  ]);

  const patientById: Record<string, typeof patients[0]> = {};
  for (const patient of patients) { patientById[patient.id] = patient; }
  const opdByEncounter: Record<string, typeof opdRecords[0]> = {};
  for (const record of opdRecords) { opdByEncounter[record.encounterCoreId] = record; }
  const resourceById: Record<string, typeof resources[0]> = {};
  for (const resource of resources) { resourceById[resource.id] = resource; }

  const providerIds = Array.from(
    new Set(resources.map((resource) => String(resource.resourceRefProviderId || '')).filter(Boolean))
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

  const clinicIdsFromBookings = Array.from(new Set(bookings.map((booking) => String(booking.clinicId || '')).filter(Boolean)));
  const assignments = providerIds.length
    ? await prisma.clinicalInfraProviderAssignment.findMany({
        where: { tenantId, providerId: { in: providerIds } },
        select: { providerId: true, primaryClinicId: true, parallelClinicIds: true },
      })
    : [];
  const fallbackClinicIds = Array.from(
    new Set(
      assignments
        .flatMap((a) => [a.primaryClinicId, ...(a.parallelClinicIds || [])].filter(Boolean) as string[])
    )
  );
  const allClinicIds = Array.from(new Set([...clinicIdsFromBookings, ...fallbackClinicIds]));
  const clinicRecords = allClinicIds.length
    ? await prisma.clinicalInfraClinic.findMany({
        where: { tenantId, id: { in: allClinicIds }, isArchived: false },
        select: { id: true, name: true },
      })
    : [];
  const clinicById = clinicRecords.reduce<Record<string, (typeof clinicRecords)[0]>>((acc, clinic) => {
    acc[clinic.id] = clinic;
    return acc;
  }, {});
  const clinicByProvider = assignments.reduce<Record<string, string>>((acc, a) => {
    if (a.primaryClinicId) acc[String(a.providerId)] = a.primaryClinicId;
    return acc;
  }, {});

  // ── Resolve specialtyCode → name for bookings without a clinic ──
  const specialtyCodes = Array.from(
    new Set(bookings.map((b) => String(b.specialtyCode || '')).filter(Boolean))
  );
  const specialtyRecords = specialtyCodes.length
    ? await prisma.clinicalInfraSpecialty.findMany({
        where: { tenantId, code: { in: specialtyCodes }, isArchived: false },
        select: { code: true, name: true },
      })
    : [];
  const specialtyByCode = specialtyRecords.reduce<Record<string, string>>((acc, s) => {
    acc[s.code] = s.name;
    return acc;
  }, {});

  // ── Fetch paid invoices to correctly determine payment status ──
  // isPendingPayment must use invoice truth, not stale booking.status
  const paidInvoiceEncounterIds = new Set<string>();
  const paidInvoicePatientIds = new Set<string>();
  if (encounterIds.length > 0) {
    const paidInvoices = await prisma.billingInvoice.findMany({
      where: {
        tenantId,
        encounterCoreId: { in: encounterIds },
        status: { in: ['PAID', 'ISSUED'] },
      },
      select: { encounterCoreId: true, patientMasterId: true },
    });
    for (const inv of paidInvoices) {
      paidInvoiceEncounterIds.add(inv.encounterCoreId);
      if (inv.patientMasterId) paidInvoicePatientIds.add(inv.patientMasterId);
    }
  }
  // Also check by patientMasterId for invoices created before encounter existed
  const patientIdsWithPendingBookings = bookings
    .filter((b) => b.status === 'PENDING_PAYMENT' && b.patientMasterId)
    .map((b) => String(b.patientMasterId));
  if (patientIdsWithPendingBookings.length > 0) {
    const today = date;
    const paidByPatient = await prisma.billingInvoice.findMany({
      where: {
        tenantId,
        patientMasterId: { in: patientIdsWithPendingBookings },
        status: { in: ['PAID', 'ISSUED'] },
        createdAt: { gte: new Date(`${today}T00:00:00Z`) },
      },
      select: { patientMasterId: true },
    });
    for (const inv of paidByPatient) {
      if (inv.patientMasterId) paidInvoicePatientIds.add(inv.patientMasterId);
    }
  }

  // ── Fetch open order counts per encounter for PENDING_PAYMENT badge ──
  const pendingEncounterIds = bookings
    .filter((b) => b.status === 'PENDING_PAYMENT' && b.encounterCoreId)
    .map((b) => String(b.encounterCoreId));

  const orderCountsByEncounter: Record<string, number> = {};
  if (pendingEncounterIds.length > 0) {
    const orderCounts = await prisma.ordersHub.groupBy({
      by: ['encounterCoreId'],
      where: {
        tenantId,
        encounterCoreId: { in: pendingEncounterIds },
        sourceSystem: 'OPD',
        status: { in: ['ORDERED', 'PLACED', 'ACCEPTED', 'IN_PROGRESS'] },
      },
      _count: true,
    });
    for (const oc of orderCounts) {
      if (oc.encounterCoreId) orderCountsByEncounter[oc.encounterCoreId] = oc._count;
    }
  }

  const now = new Date();
  const items = bookings.map((booking) => {
    const encounterCoreId = String(booking.encounterCoreId || '').trim();
    const opd = encounterCoreId ? opdByEncounter[encounterCoreId] || null : null;
    const patient = patientById[String(booking.patientMasterId || '')] || null;
    const resource = resourceById[String(booking.resourceId || '')] || null;
    const providerId = String(resource?.resourceRefProviderId || '').trim();
    const provider = providerId ? providerById[providerId] || null : null;
    let clinic = clinicById[String(booking.clinicId || '')] || null;
    if (!clinic && providerId) {
      const fallbackClinicId = clinicByProvider[providerId];
      if (fallbackClinicId) clinic = clinicById[fallbackClinicId] || null;
    }

    const arrivedAt = opd?.arrivedAt || null;
    const nursingStartAt = opd?.nursingStartAt || null;
    const nursingEndAt = opd?.nursingEndAt || null;
    const doctorStartAt = opd?.doctorStartAt || null;
    const checkedInAt = booking.checkedInAt || null;

    let waitingSinceMinutes: number | null = null;
    if (checkedInAt) {
      const checkedInDate = new Date(checkedInAt);
      if (!Number.isNaN(checkedInDate.getTime())) {
        waitingSinceMinutes = Math.max(0, Math.floor((now.getTime() - checkedInDate.getTime()) / 60000));
      }
    }

    const patientMrn = (() => {
      const p = patient as Record<string, string>;
      if (!p) return '';
      const top = String(p.mrn || p.fileNumber || '').trim();
      if (top) return top;
      const links = Array.isArray(p.links) ? p.links : [];
      const opdLink = links.find((link: any) => link?.system === 'OPD' && (link?.mrn || link?.tempMrn));
      const anyLink = links.find((link: any) => link?.mrn || link?.tempMrn);
      return opdLink?.mrn || opdLink?.tempMrn || anyLink?.mrn || anyLink?.tempMrn || '';
    })();

    // Determine pending payment: booking.status is the primary signal.
    // A prior paid invoice (e.g. initial consultation) does NOT cancel procedure payment needs.
    // Only skip if OPD encounter explicitly has paymentStatus = 'PAID' (set by confirm-payment API).
    const hasPaidInvoice =
      (encounterCoreId && paidInvoiceEncounterIds.has(encounterCoreId)) ||
      (booking.patientMasterId && paidInvoicePatientIds.has(String(booking.patientMasterId)));
    const opdPaymentStatus = opd?.paymentStatus || null;
    const isPendingPayment =
      booking.status === 'PENDING_PAYMENT' &&
      (opdPaymentStatus === 'PENDING' || !hasPaidInvoice);
    const pendingOrdersCount = encounterCoreId ? (orderCountsByEncounter[encounterCoreId] || 0) : 0;

    const specCode = String(booking.specialtyCode || '').trim();
    const specName = specCode ? (specialtyByCode[specCode] || null) : null;

    return {
      bookingId: booking.id,
      encounterCoreId: encounterCoreId || null,
      clinicId: booking.clinicId || null,
      clinicName: clinic?.name || specName || null,
      specialtyCode: specCode || null,
      specialtyName: specName || null,
      doctorName: provider?.displayName || resource?.displayName || null,
      startAt: booking.startAt || null,
      endAt: booking.endAt || null,
      checkedInAt,
      bookingTypeLabel: booking.bookingType === 'PATIENT' ? 'BOOKED' : 'WALK_IN',
      sourceType: booking.isWalkIn ? 'WALK_IN' : 'APPOINTMENT',
      visitType: opd?.visitType || null,
      status: deriveOpdStatus({ checkedInAt, arrivedAt }),
      opdFlowState: opd?.opdFlowState || (isPendingPayment ? 'PENDING_PAYMENT' : null),
      bookingStatus: booking.status,
      isPendingPayment,
      pendingOrdersCount,
      paymentStatus: opd?.paymentStatus || null,
      waitingSinceMinutes,
      waitingToNursingMinutes: waitingToNursingMinutes(now, arrivedAt, nursingStartAt),
      waitingToDoctorMinutes: waitingToDoctorMinutes(now, nursingEndAt, doctorStartAt),
      patient: patient
        ? {
            id: patient.id,
            fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
            dob: patient.dob || null,
            gender: patient.gender || null,
            mrn: patientMrn,
          }
        : null,
    };
  });

  const allClinics = clinicRecords.map((clinic) => ({ id: clinic.id, name: clinic.name }));

  return NextResponse.json({ date, items, clinics: allClinics });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.queue.view' }
);
