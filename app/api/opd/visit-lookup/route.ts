import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    const encId = String(req.nextUrl.searchParams.get('encounterId') || '').trim();

    // Mode 1: fetch full visit detail for a specific encounter
    if (encId) {
      return fetchVisitDetail(tenantId, encId);
    }

    // Mode 2: search patients
    if (!q || q.length < 2) {
      return NextResponse.json({ patients: [] });
    }

    const patients = await prisma.patientMaster.findMany({
      where: {
        tenantId,
        OR: [
          { mrn: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    });

    if (!patients.length) return NextResponse.json({ patients: [] });

    const patientIds = patients.map((p) => p.id);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const encounters = await prisma.encounterCore.findMany({
      where: { tenantId, patientId: { in: patientIds }, createdAt: { gte: ninetyDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const encounterIds = encounters.map((e) => e.id);

    const [opdEncounters, bookings] = await Promise.all([
      encounterIds.length
        ? prisma.opdEncounter.findMany({
            where: { tenantId, encounterCoreId: { in: encounterIds } },
            select: { encounterCoreId: true, status: true, opdFlowState: true, visitType: true },
          })
        : [],
      encounterIds.length
        ? prisma.opdBooking.findMany({
            where: { tenantId, encounterCoreId: { in: encounterIds } },
            select: { encounterCoreId: true, resourceId: true },
          })
        : [],
    ]);

    const opdByEnc: Record<string, typeof opdEncounters[0]> = {};
    for (const o of opdEncounters) {
      if (o.encounterCoreId) opdByEnc[o.encounterCoreId] = o;
    }

    const resourceIdsByEnc: Record<string, string> = {};
    for (const b of bookings) {
      if (b.encounterCoreId && b.resourceId) resourceIdsByEnc[b.encounterCoreId] = b.resourceId;
    }

    const resourceIds = [...new Set(Object.values(resourceIdsByEnc).filter(Boolean))];
    const doctorNameById = await resolveDoctorNames(tenantId, resourceIds);

    const result = patients.map((patient) => {
      const patEncs = encounters
        .filter((e) => e.patientId === patient.id)
        .map((enc) => {
          const opd = opdByEnc[enc.id];
          const resId = resourceIdsByEnc[enc.id];
          return {
            id: enc.id,
            encounterType: enc.encounterType,
            status: enc.status,
            createdAt: enc.createdAt,
            closedAt: enc.closedAt,
            opdStatus: opd?.status || null,
            opdFlowState: opd?.opdFlowState || null,
            visitType: opd?.visitType || null,
            doctorName: resId ? (doctorNameById[resId] || null) : null,
          };
        });
      return {
        id: patient.id,
        fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
        mrn: patient.mrn || '',
        dob: patient.dob,
        gender: patient.gender,
        encounters: patEncs,
      };
    });

    return NextResponse.json({ patients: result });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['opd.visit.view', 'opd.queue.view'],
  }
);

async function resolveDoctorNames(tenantId: string, resourceIds: string[]): Promise<Record<string, string>> {
  if (!resourceIds.length) return {};
  const resources = await prisma.schedulingResource.findMany({
    where: { tenantId, id: { in: resourceIds } },
    select: { id: true, displayName: true, resourceRefProviderId: true },
  });
  const providerIds = resources.map((r) => r.resourceRefProviderId).filter(Boolean) as string[];
  const providers = providerIds.length
    ? await prisma.clinicalInfraProvider.findMany({
        where: { tenantId, id: { in: providerIds }, isArchived: false },
        select: { id: true, displayName: true },
      })
    : [];
  const providerById: Record<string, string> = {};
  for (const p of providers) providerById[p.id] = p.displayName || '';

  const result: Record<string, string> = {};
  for (const r of resources) {
    result[r.id] = r.resourceRefProviderId
      ? (providerById[r.resourceRefProviderId] || r.displayName || '')
      : (r.displayName || '');
  }
  return result;
}

async function fetchVisitDetail(tenantId: string, encounterCoreId: string) {
  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });

  const patient = encounter.patientId
    ? await prisma.patientMaster.findFirst({
        where: { tenantId, id: encounter.patientId },
        select: { id: true, fullName: true, firstName: true, lastName: true, mrn: true, dob: true, gender: true },
      })
    : null;

  const [opdEnc, visitNotes, orders, booking, referrals] = await Promise.all([
    prisma.opdEncounter.findFirst({
      where: { tenantId, encounterCoreId },
      include: {
        nursingEntries: { orderBy: { createdAt: 'desc' } },
        doctorEntries: { orderBy: { createdAt: 'desc' } },
        doctorAddenda: { orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.opdVisitNote.findMany({
      where: { tenantId, encounterCoreId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.ordersHub.findMany({
      where: { tenantId, encounterCoreId },
      orderBy: { orderedAt: 'desc' },
      take: 200,
    }),
    prisma.opdBooking.findFirst({
      where: { tenantId, encounterCoreId },
      select: { id: true, resourceId: true, clinicId: true, specialtyCode: true, bookingDate: true, status: true },
    }),
    prisma.referral.findMany({
      where: { tenantId, encounterCoreId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  let doctorName: string | null = null;
  if (booking?.resourceId) {
    const names = await resolveDoctorNames(tenantId, [booking.resourceId]);
    doctorName = names[booking.resourceId] || null;
  }

  // Resolve user names for nursing/doctor entries
  const userIds = new Set<string>();
  for (const n of opdEnc?.nursingEntries || []) { if (n.createdByUserId) userIds.add(n.createdByUserId); }
  for (const d of opdEnc?.doctorEntries || []) { if (d.createdByUserId) userIds.add(d.createdByUserId); }
  for (const a of opdEnc?.doctorAddenda || []) { if (a.createdByUserId) userIds.add(a.createdByUserId); }
  for (const vn of visitNotes) { if (vn.createdByUserId) userIds.add(vn.createdByUserId); }

  const users = userIds.size
    ? await prisma.user.findMany({
        where: { tenantId, id: { in: [...userIds] } },
        select: { id: true, displayName: true, email: true },
      })
    : [];
  const userNameById: Record<string, string> = {};
  for (const u of users) userNameById[u.id] = u.displayName || u.email || '';

  const nursingEntries = (opdEnc?.nursingEntries || []).map((n: any) => ({
    id: n.id,
    nursingNote: n.nursingNote,
    chiefComplaint: n.chiefComplaintShort,
    painScore: n.painScore,
    painLocation: n.painLocation,
    fallRiskScore: n.fallRiskScore,
    fallRiskLabel: n.fallRiskLabel,
    vitals: n.vitals,
    pfe: n.pfe,
    createdAt: n.createdAt,
    createdBy: n.createdByUserId ? (userNameById[n.createdByUserId] || null) : null,
  }));

  const doctorEntries = (opdEnc?.doctorEntries || []).map((d: any) => ({
    id: d.id,
    noteType: d.noteType,
    subjective: d.subjective,
    objective: d.objective,
    assessment: d.assessment,
    plan: d.plan,
    freeText: d.freeText,
    createdAt: d.createdAt,
    createdBy: d.createdByUserId ? (userNameById[d.createdByUserId] || null) : null,
  }));

  const doctorAddenda = (opdEnc?.doctorAddenda || []).map((a: any) => ({
    id: a.id,
    noteType: a.noteType,
    subjective: a.subjective,
    objective: a.objective,
    assessment: a.assessment,
    plan: a.plan,
    freeText: a.freeText,
    reason: a.reason,
    createdAt: a.createdAt,
    createdBy: a.createdByUserId ? (userNameById[a.createdByUserId] || null) : null,
  }));

  const formattedNotes = visitNotes.map((vn: any) => ({
    id: vn.id,
    chiefComplaint: vn.chiefComplaint,
    historyOfPresentIllness: vn.historyOfPresentIllness,
    reviewOfSystems: vn.reviewOfSystems,
    pastMedicalHistory: vn.pastMedicalHistory,
    physicalExam: vn.physicalExam,
    physicalExamStructured: vn.physicalExamStructured,
    assessment: vn.assessment,
    plan: vn.plan,
    diagnoses: vn.diagnoses,
    vitalsSnapshot: vn.vitalsSnapshot,
    status: vn.status,
    signedAt: vn.signedAt,
    createdAt: vn.createdAt,
    createdBy: vn.createdByUserId ? (userNameById[vn.createdByUserId] || null) : null,
  }));

  const formattedOrders = orders.map((o: any) => {
    const meta = (o.meta || {});
    return {
      id: o.id,
      kind: o.kind,
      orderCode: o.orderCode,
      orderName: o.orderName,
      orderNameAr: o.orderNameAr,
      status: o.status,
      priority: o.priority,
      orderedAt: o.orderedAt,
      notes: o.notes,
      price: Number(meta.price || meta.unitPrice || 0) || 0,
      paymentStatus: meta.payment?.status === 'PAID' ? 'PAID' : 'UNPAID',
    };
  });

  const formattedReferrals = referrals.map((r: any) => ({
    id: r.id,
    type: r.type,
    fromProviderName: r.fromProviderName,
    fromSpecialtyName: r.fromSpecialtyName,
    toProviderName: r.toProviderName,
    toSpecialtyName: r.toSpecialtyName,
    reason: r.reason,
    urgency: r.urgency,
    clinicalNotes: r.clinicalNotes,
    transferBilling: r.transferBilling,
    status: r.status,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({
    visit: {
      encounterCoreId,
      encounterType: encounter.encounterType,
      encounterStatus: encounter.status,
      createdAt: encounter.createdAt,
      closedAt: encounter.closedAt,
      patient: patient
        ? {
            id: patient.id,
            fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
            mrn: patient.mrn,
            dob: patient.dob,
            gender: patient.gender,
          }
        : null,
      doctorName,
      opdStatus: opdEnc?.status || null,
      opdFlowState: opdEnc?.opdFlowState || null,
      visitType: opdEnc?.visitType || null,
      dispositionType: opdEnc?.dispositionType || null,
      dispositionNote: opdEnc?.dispositionNote || null,
      clinicExtensions: opdEnc?.clinicExtensions || null,
      nursingEntries,
      doctorEntries,
      doctorAddenda,
      visitNotes: formattedNotes,
      orders: formattedOrders,
      referrals: formattedReferrals,
    },
  });
}
