import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { waitingToDoctorMinutes, waitingToNursingMinutes } from '@/lib/opd/waiting';
import { deriveOpdStatus } from '@/lib/opd/status';
import { computeNewResults } from '@/lib/opd/results';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveDateParam(req: NextRequest) {
  const dateParam = String(req.nextUrl.searchParams.get('date') || '').trim();
  if (dateParam) return dateParam;
  return new Date().toISOString().slice(0, 10);
}

function getPatientMrn(patient: any) {
  const links = Array.isArray(patient?.links) ? patient.links : [];
  const opdLink = links.find((link: any) => link?.system === 'OPD' && (link?.mrn || link?.tempMrn));
  const anyLink = links.find((link: any) => link?.mrn || link?.tempMrn);
  return opdLink?.mrn || opdLink?.tempMrn || anyLink?.mrn || anyLink?.tempMrn || '';
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }) => {
  const date = resolveDateParam(req);
  const staffId = String(user?.staffId || '').trim();
  if (!staffId) {
    return NextResponse.json({ items: [], date, reason: 'NO_STAFF_ID' });
  }

  const provider = await prisma.clinicalInfraProvider.findFirst({
    where: { tenantId, staffId, isArchived: false },
  });
  if (!provider) {
    return NextResponse.json({ items: [], date, reason: 'NO_PROVIDER' });
  }

  let resources = await prisma.schedulingResource.findMany({
    where: {
      tenantId,
      resourceType: { in: ['PROVIDER', 'DOCTOR'] },
      departmentKey: 'opd',
      resourceRefProviderId: provider.id,
      status: { not: 'ARCHIVED' },
    },
  });

  // Fallback: also match by resourceRef JSON when resourceRefProviderId might be unset
  if (!resources.length) {
    const allOpdResources = await prisma.schedulingResource.findMany({
      where: {
        tenantId,
        resourceType: { in: ['PROVIDER', 'DOCTOR'] },
        departmentKey: 'opd',
        status: { not: 'ARCHIVED' },
      },
      take: 500,
    });
    resources = allOpdResources.filter((r) => {
      const ref = r.resourceRef as Record<string, unknown> | null;
      const refProviderId = ref?.providerId != null ? String(ref.providerId) : null;
      return refProviderId === provider.id;
    });
  }

  const resourceIds = resources.map((item) => item.id);
  if (!resourceIds.length) {
    return NextResponse.json({
      items: [],
      date,
      reason: 'NO_RESOURCES',
      doctor: { providerId: provider.id, displayName: provider.displayName || provider.id },
    });
  }

  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);
  const bookings = await prisma.opdBooking.findMany({
    where: {
      tenantId,
      resourceId: { in: resourceIds },
      bookingType: 'PATIENT',
      status: { in: ['ACTIVE', 'COMPLETED', 'PENDING_PAYMENT'] },
      OR: [
        { date },
        { checkedInAt: { gte: startOfDay, lte: endOfDay } },
      ],
    },
    orderBy: [{ startAt: 'asc' }],
    take: 500,
  });

  const patientIds = Array.from(
    new Set(bookings.map((booking) => String(booking.patientMasterId || '').trim()).filter(Boolean))
  );
  const patients = patientIds.length
    ? await prisma.patientMaster.findMany({ where: { tenantId, id: { in: patientIds } } })
    : [];
  const patientById = patients.reduce<Record<string, (typeof patients)[0]>>((acc, patient) => {
    acc[patient.id] = patient;
    return acc;
  }, {});

  const encounterIds = Array.from(
    new Set(bookings.map((booking) => String(booking.encounterCoreId || '')).filter(Boolean))
  );
  const opdRecords = encounterIds.length
    ? await prisma.opdEncounter.findMany({ where: { tenantId, encounterCoreId: { in: encounterIds } } })
    : [];
  const opdByEncounter = opdRecords.reduce<Record<string, (typeof opdRecords)[0]>>((acc, record) => {
    acc[record.encounterCoreId] = record;
    return acc;
  }, {});

  // Fetch latest nursing entries for each OPD encounter
  const opdIds = opdRecords.map((r: any) => r.id);
  const nursingEntries = opdIds.length
    ? await prisma.opdNursingEntry.findMany({
        where: { opdEncounterId: { in: opdIds } },
        orderBy: [{ createdAt: 'desc' }],
      })
    : [];

  // Build map: encounterCoreId → latest nursing entry
  const nursingByEncounter: Record<string, typeof nursingEntries[0]> = {};
  for (const entry of nursingEntries) {
    const opd = opdRecords.find((r: any) => r.id === entry.opdEncounterId);
    if (opd && !nursingByEncounter[opd.encounterCoreId]) {
      nursingByEncounter[opd.encounterCoreId] = entry;
    }
  }

  // Get orders and results for encounter-linked orders
  const ordersForEncounters = encounterIds.length
    ? await prisma.ordersHub.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
        select: { id: true, encounterCoreId: true },
      })
    : [];
  const orderIds = ordersForEncounters.map((o) => o.id);
  const orderEncounterMap = ordersForEncounters.reduce<Record<string, string>>((acc, order) => {
    if (order.encounterCoreId) acc[order.id] = order.encounterCoreId;
    return acc;
  }, {});

  const results = orderIds.length
    ? await prisma.orderResult.findMany({
        where: { tenantId, orderId: { in: orderIds } },
        select: { id: true, orderId: true },
      })
    : [];
  const connectResults = orderIds.length
    ? await prisma.connectResult.findMany({
        where: { tenantId, orderId: { in: orderIds } },
        select: { id: true, orderId: true },
      })
    : [];

  const resultsByEncounter = results.reduce<Record<string, any[]>>((acc, result) => {
    const encounterId = orderEncounterMap[result.orderId];
    if (!encounterId) return acc;
    if (!acc[encounterId]) acc[encounterId] = [];
    acc[encounterId].push({ resultId: result.id });
    return acc;
  }, {});
  connectResults.forEach((result) => {
    const encounterId = result.orderId ? orderEncounterMap[result.orderId] : null;
    if (!encounterId) return;
    if (!resultsByEncounter[encounterId]) resultsByEncounter[encounterId] = [];
    resultsByEncounter[encounterId].push({ resultId: result.id });
  });

  const now = new Date();
  const items = bookings.reduce<any[]>((acc, booking) => {
    const encounterCoreId = String(booking.encounterCoreId || '').trim();
    const opd = encounterCoreId ? opdByEncounter[encounterCoreId] || null : null;
    const arrivedAt = opd?.arrivedAt || null;
    const checkedInAt = booking.checkedInAt || null;

    if (!checkedInAt && opd?.arrivalSource === 'PATIENT') {
      return acc;
    }

    const status = deriveOpdStatus({ checkedInAt, arrivedAt });
    const payment = (opd as any)?.payment as Record<string, unknown>;
    const waitingStartAt = payment?.paidAt || arrivedAt || null;
    const waitingSinceLabel = payment?.paidAt ? 'PAYMENT' : arrivedAt ? 'ARRIVAL' : null;
    const patient = patientById[String(booking.patientMasterId || '')] || null;
    const viewedSet = new Set<string>(
      (((opd as any)?.opdResultsViewed as unknown[]) || []).map((entry: any) => String(entry?.resultId || '')).filter(Boolean)
    );
    const encounterResults = resultsByEncounter[encounterCoreId] || [];
    const hasNewResults = computeNewResults(encounterResults, viewedSet).length > 0;

    acc.push({
      bookingId: booking.id,
      bookingType: booking.bookingType || null,
      bookingTypeLabel: booking.bookingType === 'PATIENT' ? 'BOOKED' : 'WALK_IN',
      clinicId: booking.clinicId || null,
      startAt: booking.startAt || null,
      endAt: booking.endAt || null,
      checkedInAt,
      status,
      opdFlowState: opd?.opdFlowState || null,
      encounterCoreId: encounterCoreId || null,
      visitType: opd?.visitType || null,
      waitingStartAt,
      waitingSinceLabel,
      hasNewResults,
      latestVitals: nursingByEncounter[encounterCoreId] ? (() => {
        const n = nursingByEncounter[encounterCoreId];
        const v = n.vitals as Record<string, unknown> | null;
        return {
          bp: v?.bp || null,
          hr: v?.hr || null,
          temp: v?.temp || null,
          spo2: v?.spo2 || null,
          rr: v?.rr || null,
          weight: v?.weight || null,
          height: v?.height || null,
          bmi: v?.bmi || null,
          recordedAt: n.createdAt || null,
        };
      })() : null,
      latestAllergies: null,
      criticalVitalsFlag: opd?.criticalVitalsFlag || null,
      priority: opd?.priority || 'NORMAL',
      chiefComplaint: nursingByEncounter[encounterCoreId]?.chiefComplaintShort || null,
      painScore: nursingByEncounter[encounterCoreId]?.painScore ?? null,
      fallRisk: nursingByEncounter[encounterCoreId]?.fallRiskLabel || null,
      nursingNote: nursingByEncounter[encounterCoreId]?.nursingNote || null,
      waitingToNursingMinutes: waitingToNursingMinutes(now, arrivedAt, opd?.nursingStartAt || null),
      waitingToDoctorMinutes: waitingToDoctorMinutes(now, opd?.nursingEndAt || null, opd?.doctorStartAt || null),
      patient: patient
        ? {
            id: patient.id,
            fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
            dob: patient.dob || null,
            gender: patient.gender || null,
            mrn: getPatientMrn(patient),
          }
        : null,
    });

    return acc;
  }, []);

  return NextResponse.json({
    date,
    doctor: { providerId: provider.id, displayName: provider.displayName || provider.id },
    items,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.doctor.schedule.view' }
);
