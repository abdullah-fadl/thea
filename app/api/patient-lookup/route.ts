import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEPARTMENT_KINDS: Record<string, string[]> = {
  pharmacy: ['MEDICATION', 'PHARMACY'],
  lab: ['LAB'],
  radiology: ['RADIOLOGY', 'RAD'],
};

function getOrderPaymentStatus(order: any, invoicesByEncounter: Record<string, any[]>): string {
  const meta = (order.meta || {}) as Record<string, unknown>;
  if ((meta as any).payment?.status === 'PAID') return 'PAID';

  const encId = order.encounterCoreId;
  if (encId) {
    const invoices = invoicesByEncounter[encId] || [];
    for (const inv of invoices) {
      if (inv.status !== 'PAID') continue;
      const items = Array.isArray(inv.items) ? inv.items : [];
      if (items.some((it: any) => it.orderId === order.id)) return 'PAID';
    }
  }
  return 'UNPAID';
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    const department = String(req.nextUrl.searchParams.get('department') || '').trim().toLowerCase();

    if (!q || q.length < 2) {
      return NextResponse.json({ patients: [] });
    }

    const kindFilter = DEPARTMENT_KINDS[department] || null;

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

    const ordersWhere: any = {
      tenantId,
      encounterCoreId: { in: encounterIds },
    };
    if (kindFilter) {
      ordersWhere.kind = { in: kindFilter };
    }

    const [orders, invoices, bookings] = await Promise.all([
      encounterIds.length
        ? prisma.ordersHub.findMany({ where: ordersWhere, orderBy: { orderedAt: 'desc' } })
        : [],
      encounterIds.length
        ? prisma.billingInvoice.findMany({
            where: { tenantId, encounterCoreId: { in: encounterIds } },
            select: { id: true, encounterCoreId: true, status: true, items: true, total: true, paidAt: true },
          })
        : [],
      encounterIds.length
        ? prisma.opdBooking.findMany({
            where: { tenantId, encounterCoreId: { in: encounterIds } },
            select: { encounterCoreId: true, resourceId: true },
          })
        : [],
    ]);

    const invoicesByEncounter: Record<string, any[]> = {};
    for (const inv of invoices) {
      const eid = inv.encounterCoreId;
      if (!eid) continue;
      if (!invoicesByEncounter[eid]) invoicesByEncounter[eid] = [];
      invoicesByEncounter[eid].push(inv);
    }

    const resourceIdsByEncounter: Record<string, string> = {};
    for (const b of bookings) {
      if (b.encounterCoreId && b.resourceId) {
        resourceIdsByEncounter[b.encounterCoreId] = b.resourceId;
      }
    }

    const resourceIds = [...new Set(Object.values(resourceIdsByEncounter).filter(Boolean))];
    const resources = resourceIds.length
      ? await prisma.schedulingResource.findMany({
          where: { tenantId, id: { in: resourceIds } },
          select: { id: true, displayName: true, resourceRefProviderId: true },
        })
      : [];

    const providerIds = resources.map((r) => r.resourceRefProviderId).filter(Boolean) as string[];
    const providers = providerIds.length
      ? await prisma.clinicalInfraProvider.findMany({
          where: { tenantId, id: { in: providerIds }, isArchived: false },
          select: { id: true, displayName: true },
        })
      : [];
    const providerById: Record<string, string> = {};
    for (const p of providers) {
      providerById[p.id] = p.displayName || '';
    }

    const resourceNameById: Record<string, string> = {};
    for (const r of resources) {
      resourceNameById[r.id] = r.resourceRefProviderId
        ? (providerById[r.resourceRefProviderId] || r.displayName || '')
        : (r.displayName || '');
    }

    function getDoctorName(encounterCoreId: string): string | null {
      const resId = resourceIdsByEncounter[encounterCoreId];
      if (!resId) return null;
      return resourceNameById[resId] || null;
    }

    const prescriptions = department === 'pharmacy'
      ? await prisma.pharmacyPrescription.findMany({
          where: { tenantId, patientId: { in: patientIds } },
          orderBy: { prescribedAt: 'desc' },
          take: 100,
        })
      : [];

    const result = patients.map((patient) => {
      const patientEncounters = encounters
        .filter((e) => e.patientId === patient.id)
        .map((enc) => {
          const encOrders = orders
            .filter((o) => o.encounterCoreId === enc.id)
            .map((o) => {
              const meta = (o.meta || {}) as Record<string, unknown>;
              return {
                id: o.id,
                kind: o.kind,
                orderCode: o.orderCode || null,
                orderName: o.orderName,
                orderNameAr: o.orderNameAr,
                status: o.status,
                priority: o.priority,
                orderedAt: o.orderedAt,
                price: Number(meta.price || meta.unitPrice || 0) || 0,
                paymentStatus: getOrderPaymentStatus(o, invoicesByEncounter),
              };
            });

          const encInvoices = (invoicesByEncounter[enc.id] || []).map((inv: any) => ({
            id: inv.id,
            status: inv.status,
            total: Number(inv.total || 0),
            paidAt: inv.paidAt,
          }));

          const hasPaidInvoice = encInvoices.some((i: any) => i.status === 'PAID');
          const unpaidOrders = encOrders.filter((o) => o.paymentStatus === 'UNPAID');

          return {
            id: enc.id,
            encounterType: enc.encounterType,
            status: enc.status,
            createdAt: enc.createdAt,
            closedAt: enc.closedAt,
            doctorName: getDoctorName(enc.id),
            orders: encOrders,
            invoices: encInvoices,
            hasPaidInvoice,
            unpaidOrderCount: unpaidOrders.length,
          };
        });

      const patientPrescriptions = (prescriptions as Record<string, unknown>[])
        .filter((rx) => rx.patientId === patient.id)
        .map((rx) => ({
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
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['pharmacy.dispense.view', 'lab.results.view', 'radiology.studies.view', 'opd.queue.view'],
  }
);
