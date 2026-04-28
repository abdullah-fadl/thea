import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { requirePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toSummary(value: any) {
  const text = String(value || '').trim();
  return text || null;
}

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { encounterCoreId: string } }
) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const encounterCoreId = String(params?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const portalUser: any = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });
  if (!portalUser?.patientMasterId) {
    return NextResponse.json({ items: [] });
  }

  const encounter: any = await prisma.encounterCore.findFirst({
    where: { tenantId: payload.tenantId, id: encounterCoreId },
  });
  if (!encounter || String(encounter.patientId || '') !== String(portalUser.patientMasterId || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get order IDs from orders_hub (primary) + opd_orders (legacy fallback)
  const [hubOrders, legacyOrders] = await Promise.all([
    prisma.ordersHub.findMany({
      where: { tenantId: payload.tenantId, encounterCoreId },
      take: 200,
    }),
    prisma.opdOrder.findMany({
      where: { tenantId: payload.tenantId, encounterCoreId },
      take: 200,
    }),
  ]);
  const orderIds = Array.from(new Set(
    [...hubOrders, ...legacyOrders].map((o: any) => String(o.id || '')).filter(Boolean)
  ));
  if (!orderIds.length) {
    return NextResponse.json({ items: [] });
  }

  const results = await prisma.orderResult.findMany({
    where: { tenantId: payload.tenantId, orderId: { in: orderIds } },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
  });

  const resultIds = results.map((r: any) => String(r.id || '')).filter(Boolean);
  const attachments = resultIds.length
    ? await prisma.attachment.findMany({
        where: { tenantId: payload.tenantId, entityType: 'order_result', entityId: { in: resultIds } },
      })
    : [];
  const attachmentsByResult = attachments.reduce<Record<string, any[]>>((acc, item: any) => {
    const key = String(item.entityId || '');
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const connectResults = await prisma.connectResult.findMany({
    where: { tenantId: payload.tenantId, order: { path: ['orderId'], string_contains: orderIds[0] } } as any,
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  }).catch(() => []);

  const items = results.map((result: any) => {
    const summary = toSummary(result.summary) || toSummary(result.payload?.summary) || result.resultType || 'RESULT';
    const attachmentsCount = attachmentsByResult[String(result.id || '')]?.length || 0;
    const payloadSummary = attachmentsCount > 0 ? `${summary} • Attachments: ${attachmentsCount}` : summary;
    return {
      resultId: result.id,
      type: result.kind || null,
      title: summary,
      status: result.status || 'RESULT_READY',
      createdAt: result.createdAt,
      source: 'EHR',
      payloadSummary,
    };
  });

  const connectItems = (connectResults || []).map((result: any) => {
    const summary =
      toSummary(result?.result?.reportText) ||
      toSummary(result?.result?.testName) ||
      toSummary(result?.result?.value) ||
      'RESULT';
    return {
      resultId: result.id,
      type: 'LAB',
      title: summary,
      status: result?.result?.flag || 'RESULT_READY',
      createdAt: result.createdAt,
      source: 'CONNECT',
      payloadSummary: summary,
    };
  });

  const merged = [...items, ...connectItems].sort((a, b) => {
    const diff = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    if (diff !== 0) return diff;
    return String(a.resultId || '').localeCompare(String(b.resultId || ''));
  });

  return NextResponse.json({ items: merged });
});
