import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toSummary(value: any) {
  const text = String(value || '').trim();
  return text || null;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const orders = await prisma.ordersHub.findMany({
    where: { tenantId, encounterCoreId },
    select: { id: true },
    take: 200,
  });
  const orderIds = orders.map((o) => o.id);
  if (!orderIds.length) {
    return NextResponse.json({ items: [] });
  }

  const results = await prisma.orderResult.findMany({
    where: { tenantId, orderId: { in: orderIds } },
    orderBy: [{ createdAt: 'desc' }],
  });

  const resultIds = results.map((r) => r.id);
  const attachments = resultIds.length
    ? await prisma.attachment.findMany({
        where: { tenantId, entityType: 'order_result', entityId: { in: resultIds } },
      })
    : [];
  const attachmentsByResult = attachments.reduce<Record<string, any[]>>((acc, item) => {
    const key = item.entityId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const connectResults = await prisma.connectResult.findMany({
    where: { tenantId, orderId: { in: orderIds } },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
  });

  const items = results.map((result) => {
    const data = result.data as Record<string, unknown>;
    const summary = toSummary(result.summary) || toSummary(data?.summary) || result.resultType || 'RESULT';
    const attachmentsCount = attachmentsByResult[result.id]?.length || 0;
    const payloadSummary =
      attachmentsCount > 0 ? `${summary} • Attachments: ${attachmentsCount}` : summary;
    return {
      resultId: result.id,
      type: result.resultType || null,
      title: summary,
      status: result.status || 'RESULT_READY',
      createdAt: result.createdAt,
      source: 'EHR',
      payloadSummary,
    };
  });

  const connectItems = connectResults.map((result) => {
    const resultData = result.result as Record<string, unknown>;
    const summary =
      toSummary(resultData?.reportText) ||
      toSummary(resultData?.testName) ||
      toSummary(resultData?.value) ||
      'RESULT';
    return {
      resultId: result.id,
      type: 'LAB',
      title: summary,
      status: resultData?.flag || 'RESULT_READY',
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
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
