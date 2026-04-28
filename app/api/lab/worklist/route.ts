import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { decryptField } from '@/lib/security/fieldEncryption';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const statusParam = String(req.nextUrl.searchParams.get('status') || '').trim();
    const statuses = statusParam
      ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
      : ['ORDERED', 'ACCEPTED', 'COLLECTED', 'RECEIVED', 'IN_PROGRESS'];

    const tests = await prisma.ordersHub.findMany({
      where: {
        tenantId,
        departmentKey: 'laboratory',
        kind: 'LAB',
        status: { in: statuses },
      },
      orderBy: [{ priority: 'desc' }, { orderedAt: 'asc' }],
      take: 200,
    });

    // Enrich with patient data
    const patientIds = [...new Set(tests.map((t: any) => String(t.patientMasterId || '')).filter(Boolean))];
    const patients = patientIds.length
      ? await prisma.patientMaster.findMany({
          where: { tenantId, id: { in: patientIds } },
        })
      : [];
    const patientsById = patients.reduce<Record<string, any>>((acc, p) => {
      acc[String(p.id || '')] = p;
      return acc;
    }, {});

    // Map orders_hub fields to lab_orders field names for frontend compatibility
    const items = tests.map((order: any) => {
      const patient = patientsById[String(order.patientMasterId || '')] || {};
      const firstName = decryptField(patient.firstName);
      const lastName = decryptField(patient.lastName);
      const patientName = [firstName, lastName].filter(Boolean).join(' ') || order.patientName || 'Unknown';
      return {
        ...order,
        testCode: order.orderCode || order.testCode,
        testName: order.orderName || order.testName,
        testNameAr: order.testNameAr || null,
        patientId: order.patientMasterId || order.patientId,
        patientName,
        mrn: patient.mrn || null,
        orderId: order.id,
        encounterId: order.encounterCoreId,
        priority: order.priority || 'ROUTINE',
        orderedAt: order.orderedAt || order.createdAt,
        parameters: order.meta?.parameters || order.parameters || [],
        specimenId: order.meta?.specimenId || order.specimenId || null,
      };
    });

    return NextResponse.json({ tests: items });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.view' }
);
