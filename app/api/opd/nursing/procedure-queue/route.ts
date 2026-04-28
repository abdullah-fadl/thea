import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveDateParam(req: NextRequest) {
  const dateParam = String(req.nextUrl.searchParams.get('date') || '').trim();
  if (dateParam) return dateParam;
  return new Date().toISOString().slice(0, 10);
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const clinicId = String(req.nextUrl.searchParams.get('clinicId') || '').trim();
    const date = resolveDateParam(req);

    // ── 1. Find OPD encounters with procedure-related flow states ──────
    const opdEncounters = await prisma.opdEncounter.findMany({
      where: {
        tenantId,
        opdFlowState: { in: ['PROCEDURE_PENDING', 'PROCEDURE_DONE_WAITING'] },
      },
      take: 200,
    });

    if (!opdEncounters.length) {
      return NextResponse.json({ items: [] });
    }

    const encounterIds = opdEncounters.map((e) => e.encounterCoreId);

    // ── 2. Find matching bookings for today's date ─────────────────────
    const bookingFilter: any = {
      tenantId,
      date,
      bookingType: 'PATIENT',
      encounterCoreId: { in: encounterIds },
      checkedInAt: { not: null },
    };
    if (clinicId && clinicId !== 'ALL') {
      bookingFilter.clinicId = clinicId;
    }

    const bookings = await prisma.opdBooking.findMany({
      where: bookingFilter,
      orderBy: [{ startAt: 'asc' }],
      take: 500,
    });

    if (!bookings.length) {
      return NextResponse.json({ items: [] });
    }

    const filteredEncounterIds = bookings.map((b) => String(b.encounterCoreId || ''));
    const opdByEncounter = opdEncounters.reduce<Record<string, any>>((acc, e) => {
      acc[e.encounterCoreId] = e;
      return acc;
    }, {});

    // ── 3. Fetch patients ──────────────────────────────────────────────
    const patientIds = Array.from(
      new Set(bookings.map((b) => String(b.patientMasterId || '')).filter(Boolean))
    );
    const patients = patientIds.length
      ? await prisma.patientMaster.findMany({
          where: { tenantId, id: { in: patientIds } },
        })
      : [];
    const patientById = patients.reduce<Record<string, any>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    // ── 4. Fetch procedure orders from OrdersHub ───────────────────────
    const procedureOrders = filteredEncounterIds.length
      ? await prisma.ordersHub.findMany({
          where: {
            tenantId,
            encounterCoreId: { in: filteredEncounterIds },
            kind: 'PROCEDURE',
            status: { notIn: ['CANCELLED'] },
          },
          orderBy: [{ orderedAt: 'desc' }],
        })
      : [];
    const ordersByEncounter = procedureOrders.reduce<Record<string, any[]>>((acc, order) => {
      const eid = String(order.encounterCoreId || '');
      if (!acc[eid]) acc[eid] = [];
      acc[eid].push(order);
      return acc;
    }, {});

    // ── 5. Fetch resources (doctors) ───────────────────────────────────
    const resourceIds = Array.from(
      new Set(bookings.map((b) => String(b.resourceId || '')).filter(Boolean))
    );
    const resources = resourceIds.length
      ? await prisma.schedulingResource.findMany({
          where: { tenantId, id: { in: resourceIds } },
        })
      : [];
    const resourceById = resources.reduce<Record<string, any>>((acc, r) => {
      acc[r.id] = r;
      return acc;
    }, {});

    const providerIds = Array.from(
      new Set(resources.map((r) => String(r.resourceRefProviderId || '')).filter(Boolean))
    );
    const providers = providerIds.length
      ? await prisma.clinicalInfraProvider.findMany({
          where: { tenantId, id: { in: providerIds }, isArchived: false },
        })
      : [];
    const providerById = providers.reduce<Record<string, any>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    // ── 6. Fetch clinics ───────────────────────────────────────────────
    const clinicIds = Array.from(
      new Set(bookings.map((b) => String(b.clinicId || '')).filter(Boolean))
    );
    const clinics = clinicIds.length
      ? await prisma.clinicalInfraClinic.findMany({
          where: { tenantId, id: { in: clinicIds } },
        })
      : [];
    const clinicById = clinics.reduce<Record<string, any>>((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});

    // ── 7. Build response ──────────────────────────────────────────────
    const now = new Date();
    const items = bookings.map((booking) => {
      const encId = String(booking.encounterCoreId || '');
      const opd = opdByEncounter[encId] || {};
      const patient = patientById[String(booking.patientMasterId || '')] || null;
      const resource = resourceById[String(booking.resourceId || '')] || null;
      const providerId = String(resource?.resourceRefProviderId || '');
      const provider = providerId ? providerById[providerId] || null : null;
      const clinic = clinicById[String(booking.clinicId || '')] || null;
      const orders = ordersByEncounter[encId] || [];

      // Calculate waiting time
      const procedureStateAt = opd.procedureStartAt || opd.doctorEndAt || opd.arrivedAt;
      const waitingSinceMinutes = procedureStateAt
        ? Math.floor((now.getTime() - new Date(procedureStateAt).getTime()) / 60000)
        : 0;

      return {
        encounterCoreId: encId,
        bookingId: booking.id,
        opdFlowState: opd.opdFlowState || 'PROCEDURE_PENDING',
        patient: patient
          ? {
              id: patient.id,
              fullName: patient.fullName || '',
              mrn: patient.mrn || '',
              dob: patient.dob || null,
              gender: patient.gender || null,
            }
          : null,
        procedures: orders.map((o: any) => ({
          orderId: o.id,
          orderCode: o.orderCode,
          orderName: o.orderName,
          orderNameAr: o.orderNameAr || null,
          status: o.status,
          orderedBy: o.createdByUserId || null,
          orderedAt: o.orderedAt,
        })),
        doctorName: provider?.displayName || resource?.displayName || null,
        clinicName: clinic?.name || null,
        procedureStartAt: opd.procedureStartAt || null,
        procedureEndAt: opd.procedureEndAt || null,
        waitingSinceMinutes,
      };
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.nursing.view' }
);
