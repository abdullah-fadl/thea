import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { normalizeDepartmentKey } from '@/lib/orders/ordersHub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DEFAULT_STATUSES = ['ORDERED', 'PLACED', 'ACCEPTED', 'IN_PROGRESS', 'RESULT_READY'];

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const departmentKey = normalizeDepartmentKey(params.get('departmentKey'));
  if (!departmentKey) {
    return NextResponse.json({ error: 'departmentKey is required' }, { status: 400 });
  }

  const statusParam = params.get('status');
  const statuses = statusParam
    ? statusParam.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_STATUSES;
  const from = parseDate(params.get('from'));
  const to = parseDate(params.get('to'));
  const encounterCoreId = String(params.get('encounterCoreId') || '').trim();

  const where: any = { tenantId, departmentKey, status: { in: statuses } };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }
  if (encounterCoreId) {
    where.encounterCoreId = encounterCoreId;
  }

  const orders = await prisma.ordersHub.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 500,
  });

  const patientIds = Array.from(new Set(orders.map((item: any) => String(item.patientMasterId || '')))).filter(Boolean);
  const patients = patientIds.length
    ? await prisma.patientMaster.findMany({
        where: { tenantId, id: { in: patientIds } },
      })
    : [];
  const patientsById = patients.reduce<Record<string, any>>((acc, patient) => {
    acc[String(patient.id || '')] = patient;
    return acc;
  }, {});

  const items = orders.map((order: any) => ({
    order,
    patient: patientsById[String(order.patientMasterId || '')] || null,
  }));

  return NextResponse.json({ items });
}), {
  tenantScoped: true,
  platformKey: 'thea_health',
  permissionKeys: ['orders.hub.view', 'orders.view', 'opd.doctor.orders.create'],
}
);
