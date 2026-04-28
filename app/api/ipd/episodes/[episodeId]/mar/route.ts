import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { computeMarDue } from '@/lib/ipd/marDue';
import { buildMedicationSafetyFlags } from '@/lib/ipd/medSafety';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isNurse(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('nurse') || r.includes('nursing');
}

function normalizeName(v: any): string {
  return String(v || '').trim().toLowerCase();
}

function mapOrderToMed(order: any) {
  const medication = order?.meta?.medication || {};
  const medicationName = String(medication.medicationName || order.orderName || '').trim();
  const route = String(medication.route || '').trim().toUpperCase();
  const orderType = String(medication.orderType || '').trim().toUpperCase();
  const frequency = String(medication.frequency || '').trim().toUpperCase();
  return {
    id: order.id,
    drugName: medicationName,
    drugNameNormalized: normalizeName(medicationName),
    route,
    type: orderType,
    schedule: frequency || null,
    startAt: medication.startAt || order.createdAt,
    endAt: null,
    prnMaxPer24h: medication.maxPer24h ?? null,
    isNarcotic: Boolean(medication.isNarcotic),
  };
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const role = String((user as unknown as Record<string, unknown>)?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!dev && !charge && !isNurse(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String((episode as Record<string, unknown>)?.encounterId || '').trim();
  const riskFlags = ((episode as Record<string, unknown>).riskFlags || {}) as Record<string, any>;
  const allergies = Array.isArray(riskFlags.allergies) ? riskFlags.allergies : [];
  const ordersHub = await prisma.ordersHub.findMany({
    where: { tenantId, encounterCoreId, kind: 'MEDICATION' },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const orders = ordersHub.map(mapOrderToMed);
  const orderIds = orders.map((o: any) => o.id).filter(Boolean);
  const events = await prisma.ipdMedOrderEvent.findMany({
    where: { tenantId, orderId: { in: orderIds } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const latestByOrder: any = {};
  for (const ev of events) {
    if (!latestByOrder[ev.orderId]) latestByOrder[ev.orderId] = ev;
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const windowEvents = await prisma.ipdMarEvent.findMany({
    where: {
      tenantId,
      episodeId,
      scheduledFor: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { performedAt: 'desc' },
    take: 500,
  });
  const { due, prn, overdueCountByOrder } = computeMarDue({
    orders,
    latestByOrder,
    windowEvents,
    now,
  });
  const safetyByOrder = buildMedicationSafetyFlags(orders, allergies);
  const dueWithFlags = due.map((item) => {
    const safety = safetyByOrder[item.orderId] || {
      allergyConflict: false,
      duplicateWarning: false,
      highRisk: false,
      existingOrderIds: [],
    };
    return {
      ...item,
      allergyConflict: safety.allergyConflict,
      duplicateWarning: safety.duplicateWarning,
      highRisk: safety.highRisk,
      overdueDoseCount: overdueCountByOrder[item.orderId] || 0,
    };
  });

  const historyEvents = await prisma.ipdMarEvent.findMany({
    where: { tenantId, episodeId },
    orderBy: { performedAt: 'desc' },
    take: 200,
  });

  const history = historyEvents.map((ev: any) => {
    const order = orders.find((o: any) => o.id === ev.orderId);
    return {
      ...ev,
      drugName: order?.drugName || '',
      route: order?.route || '',
      type: order?.type || '',
      schedule: order?.schedule || null,
    };
  });

  return NextResponse.json({ due: dueWithFlags, prn, history });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
