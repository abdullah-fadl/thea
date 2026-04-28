import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ patients: [] });
    }

    // 1) Search patients by MRN or name
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

    if (!patients.length) {
      return NextResponse.json({ patients: [] });
    }

    const patientIds = patients.map((p) => p.id);

    // 2) Fetch recent encounters for these patients (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const encounters = await prisma.encounterCore.findMany({
      where: {
        tenantId,
        patientId: { in: patientIds },
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const encounterIds = encounters.map((e) => e.id);

    // 3) Fetch orders for these encounters
    const orders = encounterIds.length
      ? await prisma.ordersHub.findMany({
          where: {
            tenantId,
            encounterCoreId: { in: encounterIds },
          },
          orderBy: { orderedAt: 'desc' },
          take: 100,
        })
      : [];

    // 4) Fetch prescriptions from Prisma
    const prescriptions = await prisma.pharmacyPrescription.findMany({
      where: { tenantId, patientId: { in: patientIds } },
      orderBy: { prescribedAt: 'desc' },
      take: 100,
    });

    // 5) Group data per patient
    const result = patients.map((patient) => {
      const patientEncounters = encounters
        .filter((e) => e.patientId === patient.id)
        .map((enc) => {
          const encOrders = orders
            .filter((o) => o.encounterCoreId === enc.id)
            .map((o) => ({
              id: o.id,
              kind: o.kind,
              orderName: o.orderName,
              orderNameAr: o.orderNameAr,
              status: o.status,
              priority: o.priority,
              orderedAt: o.orderedAt,
            }));
          return {
            id: enc.id,
            encounterType: enc.encounterType,
            status: enc.status,
            createdAt: enc.createdAt,
            closedAt: enc.closedAt,
            orders: encOrders,
          };
        });

      const patientPrescriptions = prescriptions
        .filter((rx: any) => rx.patientId === patient.id)
        .map((rx: any) => ({
          id: rx.id,
          medication: rx.medication,
          strength: rx.strength,
          frequency: rx.frequency,
          duration: rx.duration,
          quantity: rx.quantity,
          status: rx.status,
          prescribedAt: rx.prescribedAt,
          doctorName: rx.doctorName,
        }));

      return {
        id: patient.id,
        fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
        mrn: patient.mrn || '',
        dob: patient.dob,
        gender: patient.gender,
        encounters: patientEncounters,
        prescriptions: patientPrescriptions,
      };
    });

    return NextResponse.json({ patients: result });
  }), { resourceType: 'patient', logResponseMeta: true }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'pharmacy.dispense.view' }
);
