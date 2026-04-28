import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { buildMedTimeline } from '@/lib/ipd/medTimeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildDisplay(user: any | null): string {
  if (!user) return '';
  const name = `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim();
  return name || String(user.email || '').trim() || String(user.id || '').trim();
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const role = String(user?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!dev && !charge) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const routeParams = (params || {}) as Record<string, string>;
  const episodeId = String(routeParams.episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const url = new URL(req.url);
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));
  const typeFilter = String(url.searchParams.get('type') || '').trim().toUpperCase();

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const orderItems = await prisma.ipdOrder.findMany({
    where: { tenantId, episodeId },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  const vitalsItems = await prisma.ipdVitals.findMany({
    where: { tenantId, episodeId },
    orderBy: { recordedAt: 'asc' },
    take: 500,
  });

  const nursingNoteItems = await prisma.clinicalNote.findMany({
    where: { tenantId, metadata: { path: ['episodeId'], equals: episodeId }, noteType: 'NURSING_SHIFT_NOTE' },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  const carePlanItems = await prisma.clinicalNote.findMany({
    where: { tenantId, metadata: { path: ['episodeId'], equals: episodeId }, noteType: { startsWith: 'CARE_PLAN' } },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  const doctorProgressItems = await prisma.clinicalNote.findMany({
    where: { tenantId, metadata: { path: ['episodeId'], equals: episodeId }, noteType: 'DAILY_PROGRESS' },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  const nursingProgressItems = await prisma.clinicalNote.findMany({
    where: { tenantId, metadata: { path: ['episodeId'], equals: episodeId }, noteType: 'NURSING_PROGRESS' },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  const orderIds = orderItems.map((o) => o.id).filter(Boolean);
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      OR: [
        { resourceType: 'ipd_episode', resourceId: episodeId },
        { resourceType: 'ipd_order', resourceId: { in: orderIds } },
      ],
    },
    orderBy: { timestamp: 'asc' },
    take: 2000,
  });

  const medTimeline = await buildMedTimeline({ tenantId, episodeId });

  const userIds = new Set<string>();
  for (const item of orderItems) if (item?.createdByUserId) userIds.add(String(item.createdByUserId));
  for (const item of vitalsItems) if (item?.recordedByUserId) userIds.add(String(item.recordedByUserId));
  for (const item of nursingNoteItems) if (item?.createdByUserId) userIds.add(String(item.createdByUserId));
  for (const item of carePlanItems) if (item?.createdByUserId) userIds.add(String(item.createdByUserId));
  for (const item of doctorProgressItems) if (item?.createdByUserId) userIds.add(String(item.createdByUserId));
  for (const item of nursingProgressItems) if (item?.createdByUserId) userIds.add(String(item.createdByUserId));
  for (const item of auditLogs) if (item?.actorUserId) userIds.add(String(item.actorUserId));

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

  const rows: Array<any> = [];
  for (const order of orderItems) {
    const time = order.createdAt ? new Date(order.createdAt) : null;
    if (!time) continue;
    rows.push({
      time: time.toISOString(),
      type: 'ORDER',
      label: `${String(order.kind || '').toUpperCase()} order created`,
      details: order.title || '',
      actorDisplay: userDisplay.get(String(order.createdByUserId || '')) || String(order.createdByUserId || '') || '---',
      source: 'ipd_orders',
      entityId: order.id,
      _sortTime: time.getTime(),
      _sortId: String(order.id || ''),
    });
  }

  for (const log of auditLogs) {
    const time = log.timestamp ? new Date(log.timestamp) : null;
    if (!time) continue;
    if (log.resourceType === 'ipd_order' && log.action === 'SET_STATUS') {
      const logMeta = log.metadata as Record<string, unknown> | null;
      const afterData = (logMeta?.after as Record<string, unknown>) || {};
      const status = String(afterData?.status || '');
      const reason = String(afterData?.cancelReason || '');
      rows.push({
        time: time.toISOString(),
        type: 'ORDER_STATUS',
        label: `Order status ${status || 'UPDATED'}`,
        details: reason ? `Reason: ${reason}` : '',
        actorDisplay: userDisplay.get(String(log.actorUserId || '')) || String(log.actorUserId || '') || '---',
        source: 'audit_logs',
        entityId: String(log.resourceId || ''),
        _sortTime: time.getTime(),
        _sortId: String(log.id || ''),
      });
      continue;
    }
    if (log.resourceType === 'ipd_episode' && log.action === 'SET_LOCATION') {
      const locMeta = log.metadata as Record<string, unknown> | null;
      const after = (locMeta?.after as Record<string, unknown>) || {};
      rows.push({
        time: time.toISOString(),
        type: 'LOCATION',
        label: 'Location updated',
        details: `${after?.ward || '---'} / ${after?.room || '---'} / ${after?.bed || '---'}`,
        actorDisplay: userDisplay.get(String(log.actorUserId || '')) || String(log.actorUserId || '') || '---',
        source: 'audit_logs',
        entityId: String(log.resourceId || ''),
        _sortTime: time.getTime(),
        _sortId: String(log.id || ''),
      });
      continue;
    }
    if (log.resourceType === 'ipd_episode' && log.action === 'SET_OWNERSHIP') {
      const ownMeta = log.metadata as Record<string, unknown> | null;
      const after = (ownMeta?.after as Record<string, unknown>) || {};
      rows.push({
        time: time.toISOString(),
        type: 'OWNERSHIP',
        label: 'Ownership updated',
        details: `Attending: ${after?.attendingPhysicianUserId || '---'}`,
        actorDisplay: userDisplay.get(String(log.actorUserId || '')) || String(log.actorUserId || '') || '---',
        source: 'audit_logs',
        entityId: String(log.resourceId || ''),
        _sortTime: time.getTime(),
        _sortId: String(log.id || ''),
      });
    }
  }

  for (const item of vitalsItems) {
    const time = item.recordedAt ? new Date(item.recordedAt) : null;
    if (!time) continue;
    const vitalsData = item.vitals as Record<string, unknown> | null;
    rows.push({
      time: time.toISOString(),
      type: 'VITALS',
      label: 'Vitals recorded',
      details: `BP ${vitalsData?.systolic ?? '---'}/${vitalsData?.diastolic ?? '---'}`,
      actorDisplay: userDisplay.get(String(item.recordedByUserId || '')) || '---',
      source: 'ipd_vitals',
      entityId: item.id,
      _sortTime: time.getTime(),
      _sortId: String(item.id || ''),
    });
  }

  for (const item of medTimeline) {
    const time = item.time ? new Date(item.time) : null;
    if (!time) continue;
    rows.push({
      time: time.toISOString(),
      type: 'MEDICATION',
      label: item.label,
      details: item.details,
      actorDisplay: item.actorDisplay,
      source: 'med_timeline',
      entityId: item.orderId || '',
      _sortTime: time.getTime(),
      _sortId: String(item._sortId || ''),
    });
  }

  const filtered = rows.filter((row) => {
    const time = new Date(row.time);
    if (from && time < from) return false;
    if (to && time > to) return false;
    if (typeFilter && typeFilter !== 'ALL' && row.type !== typeFilter) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (a._sortTime !== b._sortTime) return a._sortTime - b._sortTime;
    return String(a._sortId || '').localeCompare(String(b._sortId || ''));
  });

  const items = filtered.map(({ _sortTime, _sortId, ...rest }) => rest);
  return NextResponse.json({
    episode: { id: episodeId, patient: (episode.patient as Record<string, unknown>) || null },
    items,
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
