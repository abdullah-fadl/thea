import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KIND_MAP: Record<string, string> = {
  LAB: 'LAB',
  RAD: 'RAD',
  PROC: 'PROC',
  RADIOLOGY: 'RAD',
  PROCEDURE: 'PROC',
};

function deriveSeverity(result: Record<string, unknown>): 'normal' | 'abnormal' | 'critical' {
  const payload = (result?.payload || {}) as Record<string, unknown>;
  const summary = String(result?.summary || '').toLowerCase();
  const severityRaw = String(payload.severity || payload.level || payload.flag || '').toLowerCase();
  const isCritical =
    payload.critical === true ||
    severityRaw === 'critical' ||
    severityRaw === 'high' ||
    summary.includes('critical');
  if (isCritical) return 'critical';

  const isAbnormal =
    payload.abnormal === true ||
    severityRaw === 'abnormal' ||
    severityRaw === 'medium' ||
    summary.includes('abnormal');
  if (isAbnormal) return 'abnormal';

  return 'normal';
}

function deriveConnectSeverity(flag: string | null | undefined): 'normal' | 'abnormal' | 'critical' {
  const v = String(flag || '').toUpperCase();
  if (v === 'CRITICAL') return 'critical';
  if (v === 'ABNORMAL') return 'abnormal';
  return 'normal';
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, role }) => {
  const params = req.nextUrl.searchParams;
  const scope = String(params.get('scope') || 'mine').toLowerCase();
  const unacked = String(params.get('unacked') || '1') !== '0';
  const kindRaw = params.get('kind');
  const kind = kindRaw ? KIND_MAP[String(kindRaw).toUpperCase()] : null;
  const encounterCoreId = String(params.get('encounterCoreId') || '').trim();
  const dateParam = String(params.get('date') || '').trim();

  const filter: Record<string, unknown> = { tenantId };
  if (kind) filter.kind = kind;
  if (dateParam) {
    const start = new Date(`${dateParam}T00:00:00.000Z`);
    const end = new Date(`${dateParam}T23:59:59.999Z`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      filter.createdAt = { gte: start, lte: end };
    }
  }

  if (encounterCoreId) {
    const ordersForEncounter = await prisma.ordersHub.findMany({
      where: { tenantId, encounterCoreId },
      select: { id: true },
    });
    const orderIdsForEncounter = ordersForEncounter.map((o) => String(o.id || '')).filter(Boolean);
    if (!orderIdsForEncounter.length) {
      return NextResponse.json({ items: [] });
    }
    filter.orderId = { in: orderIdsForEncounter };
  }

  const results = await prisma.orderResult.findMany({
    where: filter,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const connectFilter: Record<string, unknown> = { tenantId };
  if (dateParam && filter.createdAt) connectFilter.createdAt = filter.createdAt;
  if (encounterCoreId) {
    const ordersForEncounter = await prisma.ordersHub.findMany({
      where: { tenantId, encounterCoreId },
      select: { id: true },
    });
    const orderIdsForEncounter = ordersForEncounter.map((o) => String(o.id || '')).filter(Boolean);
    if (!orderIdsForEncounter.length) {
      connectFilter.orderId = '__none__';
    } else {
      connectFilter.orderId = { in: orderIdsForEncounter };
    }
  }

  let connectResults = await prisma.connectResult.findMany({
    where: connectFilter,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  if (kind && kind !== 'LAB') {
    connectResults = [];
  }

  const resultIds = results.map((r) => String(r.id || '')).filter(Boolean);
  const acksAll = await prisma.resultAck.findMany({
    where: { tenantId, orderResultId: { in: resultIds } },
  });

  const ackedByMe = new Set(
    acksAll.filter((ack) => String(ack.userId || '') === String(userId || '')).map((ack) => ack.orderResultId)
  );

  const acksByResult = acksAll.reduce<Record<string, typeof acksAll>>((acc, ack) => {
    const key = String(ack.orderResultId || '');
    if (!acc[key]) acc[key] = [];
    acc[key].push(ack);
    return acc;
  }, {});

  const filtered = unacked ? results.filter((r) => !ackedByMe.has(String(r.id || ''))) : results;

  const connectOrderIds = connectResults
    .map((r) => String((r as Record<string, unknown>).orderId || ''))
    .filter(Boolean);
  const orderIds = Array.from(new Set([...filtered.map((r) => String(r.orderId || '')), ...connectOrderIds])).filter(
    Boolean
  );
  const orders = await prisma.ordersHub.findMany({
    where: { tenantId, id: { in: orderIds } },
  });
  const ordersById = orders.reduce<Record<string, typeof orders[0]>>((acc, order) => {
    acc[String(order.id || '')] = order;
    return acc;
  }, {});

  const encounterIds = Array.from(new Set(orders.map((o) => String(o.encounterCoreId || '')))).filter(Boolean);
  const encounters = encounterIds.length
    ? await prisma.encounterCore.findMany({
        where: { tenantId, id: { in: encounterIds } },
      })
    : [];
  const encounterById = encounters.reduce<Record<string, typeof encounters[0]>>((acc, enc) => {
    acc[String(enc.id || '')] = enc;
    return acc;
  }, {});

  const patientIds = Array.from(
    new Set(encounters.map((e) => String(e.patientId || '')).filter(Boolean))
  );
  const connectPatientIds = Array.from(
    new Set(connectResults.map((r) => String((r as Record<string, unknown>).patientMasterId || '')).filter(Boolean))
  );
  const allPatientIds = Array.from(new Set([...patientIds, ...connectPatientIds]));
  const patients = allPatientIds.length
    ? await prisma.patientMaster.findMany({
        where: { tenantId, id: { in: allPatientIds } },
      })
    : [];
  const patientById = patients.reduce<Record<string, typeof patients[0]>>((acc, p) => {
    acc[String(p.id || '')] = p;
    return acc;
  }, {});

  const ipdEpisodes = encounterIds.length
    ? await prisma.ipdEpisode.findMany({
        where: { tenantId, encounterId: { in: encounterIds } },
      })
    : [];
  const ipdByEncounter = ipdEpisodes.reduce<Record<string, typeof ipdEpisodes[0]>>((acc, episode) => {
    acc[String(episode.encounterId || '')] = episode;
    return acc;
  }, {});

  const items = filtered.map((result: any) => {
    const order = (ordersById[String(result.orderId || '')] || {}) as any;
    const encounter = (encounterById[String(order.encounterCoreId || '')] || {}) as any;
    const patient = (patientById[String(encounter.patientId || '')] || {}) as any;
    const list = acksByResult[String(result.id || '')] || [];
    const lastAckAt = list.reduce<Date | null>((acc, item: Record<string, unknown>) => {
      const ts = item.ackAt ? new Date(item.ackAt as string) : null;
      if (!ts || Number.isNaN(ts.getTime())) return acc;
      if (!acc || ts.getTime() > acc.getTime()) return ts;
      return acc;
    }, null);

    const encounterType = String(encounter.encounterType || '').toUpperCase();
    const deepLink =
      encounterType === 'ER'
        ? `/er/encounter/${encodeURIComponent(String(encounter.id || ''))}`
        : encounterType === 'OPD'
        ? `/opd/visit/${encodeURIComponent(String(encounter.id || ''))}`
        : encounterType === 'IPD'
        ? `/ipd/episode/${ipdByEncounter[String(encounter.id || '')]?.id || ''}`
        : null;

    return {
      orderId: order.id || result.orderId,
      orderCode: order.orderCode || null,
      kind: (result as any).kind || KIND_MAP[String(order.kind || '').toUpperCase()] || null,
      encounterCoreId: order.encounterCoreId || (result as any).encounterCoreId,
      encounterType: encounterType || null,
      patientMasterId: patient.id || null,
      patientName: [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unknown',
      mrn: (encounter as any).mrn || null,
      tempMrn: (encounter as any).tempMrn || null,
      resultId: result.id,
      summary: result.summary || null,
      severity: deriveSeverity(result as any),
      createdAt: result.createdAt,
      source: 'EHR',
      acksCount: list.length,
      ackedByMe: Boolean(userId && list.some((ack) => String((ack as Record<string, unknown>).userId || '') === String(userId || ''))),
      lastAckAt: lastAckAt ? lastAckAt.toISOString() : null,
      deepLink,
      scope,
    };
  });

  const connectItems = connectResults.map((result: any) => {
    const orderId = String(result.orderId || '');
    const order = (ordersById[orderId] || {}) as any;
    const encounter = (encounterById[String(order.encounterCoreId || '')] || {}) as any;
    const patient =
      (patientById[String(order.patientMasterId || '')] ||
      patientById[String(result?.patientLink?.patientMasterId || '')] ||
      {}) as any;
    const encounterType = String(encounter.encounterType || '').toUpperCase();
    const deepLink =
      encounterType === 'ER'
        ? `/er/encounter/${encodeURIComponent(String(encounter.id || ''))}`
        : encounterType === 'OPD'
        ? `/opd/visit/${encodeURIComponent(String(encounter.id || ''))}`
        : encounterType === 'IPD'
        ? `/ipd/episode/${ipdByEncounter[String(encounter.id || '')]?.id || ''}`
        : null;

    return {
      orderId: order.id || orderId || null,
      orderCode: order.orderCode || null,
      kind: 'LAB',
      encounterCoreId: order.encounterCoreId || null,
      encounterType: encounterType || null,
      patientMasterId: patient.id || result?.patientLink?.patientMasterId || null,
      patientName: [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unknown',
      mrn: encounter.mrn || null,
      tempMrn: encounter.tempMrn || null,
      resultId: result.id,
      summary: result?.result?.reportText || result?.result?.testName || null,
      severity: deriveConnectSeverity(result?.result?.flag),
      createdAt: result.createdAt,
      acksCount: 0,
      ackedByMe: false,
      lastAckAt: null,
      deepLink,
      scope,
      source: 'CONNECT',
    };
  });

  const roleLower = String(role || '').toLowerCase();
  const isPrivileged =
    roleLower.includes('charge') || roleLower.includes('admin') || roleLower.includes('doctor') || roleLower.includes('nurse');
  const finalItems = scope === 'mine' && !isPrivileged ? items : [...items, ...connectItems];

  finalItems.sort((a, b) => {
    const diff = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    if (diff !== 0) return diff;
    return String(a.resultId || '').localeCompare(String(b.resultId || ''));
  });

  return NextResponse.json({ items: finalItems });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'results.inbox.view' }
);
