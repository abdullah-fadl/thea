import { prisma, prismaModel } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

function buildDisplay(user: any): string {
  if (!user) return '';
  const name = `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim();
  return name || String(user.email || '').trim() || String(user.id || '').trim();
}

export async function buildMedTimeline(args: {
  db?: any; // ignored — kept for backward compat
  tenantId: string;
  episodeId: string;
}): Promise<Array<{
  time: string;
  type: string;
  label: string;
  details: string;
  actorDisplay: string;
  orderId: string;
  encounterContext?: { episodeId: string; encounterId: string };
  _sortId: string;
  _sortTime: number;
}>> {
  const { tenantId, episodeId } = args;

  let encounterId = '';
  try {
    const episode = await prismaModel('ipdEpisode').findFirst({
      where: { tenantId, id: episodeId },
    });
    if (!episode) return [];
    encounterId = String((episode as any).encounterId || '').trim();
  } catch (error) {
    logger.error('Failed to fetch IpdEpisode', { category: 'ipd', episodeId, error });
    return [];
  }

  const encounterContext = encounterId ? { episodeId, encounterId } : undefined;

  // Fetch medication orders from orders_hub via Prisma
  const ordersHubRows = await prisma.ordersHub.findMany({
    where: { tenantId, encounterCoreId: encounterId, kind: 'MEDICATION' },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  const orders = ordersHubRows.map((order: any) => {
    const medication = order?.meta?.medication || {};
    const medicationName = String(medication.medicationName || order.orderName || '').trim();
    return {
      id: order.id,
      drugName: medicationName,
      dose: medication.doseValue || '',
      doseUnit: medication.doseUnit || '',
      route: medication.route || '',
      type: medication.orderType || '',
    };
  });
  const orderById = new Map<string, any>();
  for (const order of orders) {
    orderById.set(String(order.id || ''), order);
  }

  let orderEvents: any[] = [];
  let mar: any[] = [];
  try {
    orderEvents = await prismaModel('ipdMedOrderEvent').findMany({
      where: { tenantId, episodeId },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    }) ?? [];
  } catch (error) {
    logger.error('Failed to fetch IpdMedOrderEvent records', { category: 'ipd', episodeId, error });
  }
  try {
    mar = await prismaModel('ipdMarEvent').findMany({
      where: { tenantId, episodeId },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    }) ?? [];
  } catch (error) {
    logger.error('Failed to fetch IpdMarEvent records', { category: 'ipd', episodeId, error });
  }

  // Collect user IDs for display names
  const userIds = new Set<string>();
  for (const ev of orderEvents) {
    if (ev?.createdByUserId) userIds.add(String(ev.createdByUserId));
  }
  for (const ev of mar) {
    if (ev?.performedByUserId) userIds.add(String(ev.performedByUserId));
  }

  const users = userIds.size
    ? await prisma.user.findMany({
        where: { tenantId, id: { in: Array.from(userIds) } },
        select: { id: true, email: true, firstName: true, lastName: true },
      })
    : [];
  const userDisplay = new Map<string, string>();
  for (const u of users) {
    const display = buildDisplay(u);
    if (display) userDisplay.set(String(u.id || ''), display);
  }

  const rows: any[] = [];
  for (const ev of orderEvents) {
    const status = String(ev?.status || '').toUpperCase();
    const orderId = String(ev?.orderId || '');
    const order = orderById.get(orderId) || null;
    const drugLabel = order?.drugName ? String(order.drugName) : 'Medication';
    const actorId = String(ev?.createdByUserId || '');
    const actorDisplay = userDisplay.get(actorId) || actorId || '\u2014';
    const time = ev?.createdAt ? new Date(ev.createdAt) : null;
    if (!time) continue;
    if (['ORDERED', 'ACTIVE', 'DISPENSED', 'DISCONTINUED'].includes(status)) {
      rows.push({
        time: time.toISOString(),
        type: 'STATUS',
        label: `${drugLabel} status ${status}`,
        details: ev?.reason ? `Reason: ${String(ev.reason)}` : `Status set to ${status}`,
        actorDisplay,
        orderId,
        encounterContext,
        _sortId: String(ev.id || ''),
        _sortTime: time.getTime(),
      });
    }
  }

  for (const ev of mar) {
    const action = String(ev?.action || '').toUpperCase();
    if (!action) continue;
    const orderId = String(ev?.orderId || '');
    const order = orderById.get(orderId) || null;
    const drugLabel = order?.drugName ? String(order.drugName) : 'Medication';
    const actorId = String(ev?.performedByUserId || '');
    const actorDisplay = userDisplay.get(actorId) || actorId || '\u2014';
    const time = ev?.createdAt ? new Date(ev.createdAt) : null;
    if (!time) continue;
    const scheduledFor = ev?.scheduledFor ? new Date(ev.scheduledFor).toISOString() : null;
    const reason = ev?.reason ? `Reason: ${String(ev.reason)}` : '';
    const dose = ev?.doseGiven ? `Dose: ${String(ev.doseGiven)}` : '';
    rows.push({
      time: time.toISOString(),
      type: 'MAR',
      label: `${drugLabel} MAR ${action}`,
      details: [scheduledFor ? `Scheduled: ${scheduledFor}` : '', dose, reason].filter(Boolean).join(' \u2022 '),
      actorDisplay,
      orderId,
      encounterContext,
      _sortId: String(ev.id || ''),
      _sortTime: time.getTime(),
    });
  }

  rows.sort((a, b) => {
    if (a._sortTime !== b._sortTime) return a._sortTime - b._sortTime;
    return String(a._sortId || '').localeCompare(String(b._sortId || ''));
  });

  return rows;
}
