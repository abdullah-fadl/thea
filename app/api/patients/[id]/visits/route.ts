import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = String((params as { id?: string } | undefined)?.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 10), 50);

  const encounters = await prisma.encounterCore.findMany({
    where: { tenantId, patientId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const encounterIds = encounters.map((enc: any) => String(enc.id || '')).filter(Boolean);
  const opdEncounters = encounterIds.length
    ? await prisma.opdEncounter.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const opdByEncounter = opdEncounters.reduce<Record<string, typeof opdEncounters[0]>>((acc, opd) => {
    acc[String(opd.encounterCoreId || '')] = opd;
    return acc;
  }, {});

  const opdIds = opdEncounters.map((o) => o.id).filter(Boolean);
  const latestNursingEntries = opdIds.length
    ? await prisma.opdNursingEntry.findMany({
        where: { opdEncounterId: { in: opdIds }, isCorrected: false },
        orderBy: { createdAt: 'desc' },
        distinct: ['opdEncounterId'],
      })
    : [];
  const nursingByOpdId = latestNursingEntries.reduce<Record<string, typeof latestNursingEntries[0]>>((acc, e) => {
    acc[e.opdEncounterId] = e;
    return acc;
  }, {});

  const latestDoctorEntries = opdIds.length
    ? await prisma.opdDoctorEntry.findMany({
        where: { opdEncounterId: { in: opdIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['opdEncounterId'],
      })
    : [];
  const doctorByOpdId = latestDoctorEntries.reduce<Record<string, typeof latestDoctorEntries[0]>>((acc, e) => {
    acc[e.opdEncounterId] = e;
    return acc;
  }, {});

  const bookings =
    encounterIds.length > 0
      ? await prisma.opdBooking.findMany({
          where: { tenantId, encounterCoreId: { in: encounterIds } },
        })
      : [];
  const bookingByEncounter = bookings.reduce<Record<string, typeof bookings[0]>>((acc, b) => {
    const eid = String(b.encounterCoreId || '');
    if (eid) acc[eid] = b;
    return acc;
  }, {});

  const clinicIds = Array.from(
    new Set(bookings.map((b: any) => String(b.clinicId || '').trim()).filter(Boolean))
  );
  const clinicRecords =
    clinicIds.length > 0
      ? await prisma.clinicalInfraClinic.findMany({
          where: { tenantId, id: { in: clinicIds } },
          select: { id: true, name: true },
        })
      : [];
  const clinicById = clinicRecords.reduce<Record<string, typeof clinicRecords[0]>>((acc, c) => {
    acc[String(c.id || '')] = c;
    return acc;
  }, {});

  const resourceIds = Array.from(
    new Set(bookings.map((b: any) => String(b.resourceId || '').trim()).filter(Boolean))
  );
  const resources =
    resourceIds.length > 0
      ? await prisma.schedulingResource.findMany({
          where: { tenantId, id: { in: resourceIds } },
          select: { id: true, resourceRef: true },
        })
      : [];
  const resourceById = resources.reduce<Record<string, typeof resources[0]>>((acc, r) => {
    acc[String(r.id || '')] = r;
    return acc;
  }, {});

  const providerIds = Array.from(
    new Set(
      resources
        .map((r: any) => String((r.resourceRef && (r.resourceRef as Record<string, string>).providerId) || '').trim())
        .filter(Boolean)
    )
  );
  const providers =
    providerIds.length > 0
      ? await prisma.clinicalInfraProvider.findMany({
          where: { tenantId, id: { in: providerIds } },
          select: { id: true, displayName: true },
        })
      : [];
  const providerById = providers.reduce<Record<string, typeof providers[0]>>((acc, p) => {
    acc[String(p.id || '')] = p;
    return acc;
  }, {});

  const nurseUserIds = Array.from(new Set(
    latestNursingEntries.map((e) => String(e.createdByUserId || '').trim()).filter(Boolean)
  ));
  const doctorUserIds = Array.from(new Set(
    latestDoctorEntries.map((e) => String(e.createdByUserId || '').trim()).filter(Boolean)
  ));
  const allUserIds = Array.from(new Set([...nurseUserIds, ...doctorUserIds]));
  const users = allUserIds.length
    ? await prisma.user.findMany({
        where: { tenantId, id: { in: allUserIds } },
        select: { id: true, displayName: true, firstName: true, lastName: true, role: true },
      })
    : [];
  const userById = users.reduce<Record<string, typeof users[0] & { name: string | null }>>((acc, u) => {
    acc[u.id] = { ...u, name: u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || null };
    return acc;
  }, {});

  const visits = encounters.map((enc: any) => {
    const opd = opdByEncounter[String(enc.id || '')] as any;
    const booking = bookingByEncounter[String(enc.id || '')] as any;
    const clinicId = booking?.clinicId || opd?.clinicId;
    const clinic = clinicId ? clinicById[String(clinicId)] : null;
    const resource = booking?.resourceId ? resourceById[String(booking.resourceId)] : null;
    const providerId = (resource?.resourceRef && (resource.resourceRef as Record<string, string>).providerId) || opd?.providerId;
    const provider = providerId ? providerById[String(providerId)] : null;
    const specialtyCode = booking?.specialtyCode || (resource?.resourceRef && (resource.resourceRef as Record<string, string>).specialtyCode);

    const nursing = opd?.id ? nursingByOpdId[opd.id] : null;
    const doctor = opd?.id ? doctorByOpdId[opd.id] : null;
    const vitals = (nursing?.vitals as Record<string, unknown>) || null;
    const fallRiskData = (nursing?.fallRiskData as Record<string, unknown>) || null;

    return {
      id: enc.id,
      encounterType: enc.encounterType,
      status: enc.status,
      createdAt: enc.createdAt,
      date: enc.openedAt || enc.createdAt,
      specialtyCode: specialtyCode || opd?.specialtyCode || null,
      specialtyName: opd?.specialtyName || null,
      clinicId: clinicId || null,
      clinicName: clinic?.name || opd?.clinicName || null,
      providerId: providerId || null,
      providerName: provider?.displayName || opd?.providerName || null,
      nurseName: nursing?.createdByUserId ? (userById[nursing.createdByUserId]?.name || null) : null,
      doctorEntryBy: doctor?.createdByUserId ? (userById[doctor.createdByUserId]?.name || null) : null,
      vitals: vitals ? { bp: vitals.bp, hr: vitals.hr, temp: vitals.temp, spo2: vitals.spo2, rr: vitals.rr, weight: vitals.weight, height: vitals.height } : null,
      chiefComplaint: nursing?.chiefComplaintShort || null,
      mewsScore: nursing?.mewsScore ?? null,
      mewsRiskLevel: nursing?.mewsRiskLevel || null,
      gcsScore: nursing?.gcsScore ?? null,
      gcsCategory: nursing?.gcsCategory || null,
      fallRiskLevel: fallRiskData?.riskLevel || null,
      diagnosis: doctor?.assessment || null,
      disposition: opd?.dispositionType || null,
    };
  });

  return NextResponse.json({ items: visits });
}), { resourceType: 'encounter', extractPatientId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('patients'); return idx >= 0 ? parts[idx + 1] || null : null; }, logResponseMeta: true }),
  { tenantScoped: true, permissionKeys: ['clinical.view', 'opd.doctor.encounter.view', 'opd.doctor.visit.view', 'opd.nursing.edit', 'opd.visit.view'] }
);
