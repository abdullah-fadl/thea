import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/radiology/worklist
 *
 * Active radiology worklist. Defaults to orders with status IN_PROGRESS.
 * Pass ?status=ORDERED,SCHEDULED,IN_PROGRESS for multi-status filtering.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const statusParam = req.nextUrl.searchParams.get('status') || 'ORDERED,SCHEDULED,IN_PROGRESS';
    const modality = req.nextUrl.searchParams.get('modality');
    const search = req.nextUrl.searchParams.get('search') || '';

    const statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean);

    const where: Prisma.OrdersHubWhereInput = {
      tenantId,
      departmentKey: 'radiology',
      kind: 'RADIOLOGY',
      status: { in: statuses },
    };

    if (modality) {
      where.meta = { path: ['modality'], equals: modality.toUpperCase() };
    }

    const rawOrders = await prisma.ordersHub.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { orderedAt: 'asc' },
      ],
      take: 200,
    });

    // Enrich with patient data
    const patientIds = [...new Set(rawOrders.map((o) => o.patientMasterId).filter(Boolean))] as string[];
    const patients = patientIds.length
      ? await prisma.patientMaster.findMany({
          where: { tenantId, id: { in: patientIds } },
        })
      : [];
    const patientsById = patients.reduce<Record<string, any>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    // Map orders_hub fields to radiology_orders field names for frontend compatibility
    let orders = rawOrders.map((order: any) => {
      const meta = (order.meta || {}) as Record<string, any>;
      const patient = patientsById[String(order.patientMasterId || '')] || {};
      return {
        ...order,
        examCode: order.orderCode || order.examCode,
        examName: order.orderName || order.examName,
        examNameAr: order.orderNameAr || null,
        modality: meta.modality || order.modality || null,
        accessionNumber: meta.accessionNumber || order.accessionNumber || null,
        bodyPart: meta.bodyPart || order.bodyPart || null,
        patientId: order.patientMasterId || order.patientId,
        patientName: [patient.firstName, patient.lastName].filter(Boolean).join(' ') || order.patientName || 'Unknown',
        mrn: patient.mrn || null,
        orderId: order.id,
        encounterId: order.encounterCoreId,
        priority: order.priority || 'ROUTINE',
        orderedAt: order.orderedAt || order.createdAt,
      };
    });

    // Apply search filter post-enrichment (since patient names come from enrichment)
    if (search) {
      const searchLower = search.toLowerCase();
      orders = orders.filter((o: any) =>
        (o.patientName || '').toLowerCase().includes(searchLower) ||
        (o.mrn || '').toLowerCase().includes(searchLower) ||
        (o.accessionNumber || '').toLowerCase().includes(searchLower) ||
        (o.examName || '').toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ orders });
  }),
  { tenantScoped: true, permissionKey: 'radiology.reports.view' }
);
