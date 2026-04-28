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

  const encounterCoreId = String(params.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const portalUser: any = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });
  if (!portalUser?.patientMasterId) {
    return NextResponse.json({ error: 'Portal user not linked to patient' }, { status: 403 });
  }

  // Verify encounter belongs to patient
  const encounter: any = await prisma.encounterCore.findFirst({
    where: { tenantId: payload.tenantId, id: encounterCoreId, patientId: portalUser.patientMasterId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  // Get OPD encounter for doctor entries (inline prescriptions)
  const opd: any = await prisma.opdEncounter.findFirst({
    where: { tenantId: payload.tenantId, encounterCoreId },
  });

  // Get medication orders from orders_hub
  const hubOrders = await prisma.ordersHub.findMany({
    where: { tenantId: payload.tenantId, encounterCoreId, kind: 'MEDICATION' },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });

  // Fallback: also check opd_orders for legacy medication entries
  const opdOrders = await prisma.opdOrder.findMany({
    where: {
      tenantId: payload.tenantId,
      encounterCoreId,
      OR: [{ kind: 'MEDICATION' }, { orderType: 'MEDICATION' }],
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });

  // Get patient info for the prescription header
  const patient: any = await prisma.patientMaster.findFirst({
    where: { tenantId: payload.tenantId, id: portalUser.patientMasterId },
  });

  // Merge and deduplicate by id (orders_hub takes priority)
  const seenIds = new Set<string>();
  const medications: any[] = [];
  for (const raw of [...hubOrders, ...opdOrders]) {
    const o = raw as Record<string, string | Date | null>;
    if (seenIds.has(String(o.id))) continue;
    seenIds.add(String(o.id));
    medications.push({
      id: o.id,
      drugName: o.drugName || o.name || null,
      dose: o.dose || null,
      frequency: o.frequency || null,
      route: o.route || null,
      duration: o.duration || null,
      instructions: o.instructions || null,
      status: o.status || null,
      createdAt: o.createdAt || null,
    });
  }

  return NextResponse.json({
    encounterCoreId,
    patient: patient
      ? {
          name: [patient.firstNameAr, patient.lastNameAr].filter(Boolean).join(' ') ||
                [patient.firstName, patient.lastName].filter(Boolean).join(' ') || null,
          mrn: patient.mrn || null,
          dob: patient.dob || null,
        }
      : null,
    encounterDate: encounter.openedAt || encounter.createdAt || null,
    medications,
  });
});
