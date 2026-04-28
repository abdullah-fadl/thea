import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureResultsWriteAllowed } from '@/lib/core/guards/resultsGuard';
import { emitNotification, emitNotificationToRole } from '@/lib/notifications/emit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESULT_TYPES = new Set(['TEXT', 'NUMERIC', 'PDF', 'IMAGE', 'STRUCTURED_JSON']);
const LEGACY_ATTACHMENT_TYPES = new Set(['TEXT', 'PDF_URL', 'IMAGE_URL']);

function deriveKind(orderKind: string) {
  const kind = String(orderKind || '').toUpperCase();
  if (kind === 'RADIOLOGY') return 'RAD';
  if (kind === 'PROCEDURE') return 'PROC';
  return 'LAB';
}

function attachmentMime(type: string) {
  if (type === 'PDF_URL') return 'application/pdf';
  if (type === 'IMAGE_URL') return 'image/*';
  return 'text/plain';
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const orderId = String((params as any)?.orderId || '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  const results = await prisma.orderResult.findMany({
    where: { tenantId, orderId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  if (!results.length) {
    return NextResponse.json({ items: [] });
  }

  const resultIds = results.map((r) => String(r.id || '')).filter(Boolean);

  const acks = await prisma.resultAck.findMany({
    where: { tenantId, orderResultId: { in: resultIds } },
  });
  const acksByResult = acks.reduce<Record<string, typeof acks>>((acc, ack) => {
    const key = String(ack.orderResultId || '');
    if (!acc[key]) acc[key] = [];
    acc[key].push(ack);
    return acc;
  }, {});

  const items = results.map((result) => {
    const list = acksByResult[String(result.id || '')] || [];
    const lastAckAt = list.reduce<Date | null>((acc, item) => {
      const ts = item.ackAt ? new Date(item.ackAt) : null;
      if (!ts || Number.isNaN(ts.getTime())) return acc;
      if (!acc || ts.getTime() > acc.getTime()) return ts;
      return acc;
    }, null);
    return {
      ...result,
      acksCount: list.length,
      ackedByMe: Boolean(userId && list.some((ack) => String(ack.userId || '') === String(userId || ''))),
      lastAckAt: lastAckAt ? lastAckAt.toISOString() : null,
    };
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'orders.hub.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const orderId = String((params as any)?.orderId || '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    resultType: z.string().optional(),
    summary: z.string().optional(),
    summaryText: z.string().optional(),
    payload: z.unknown().optional(),
    idempotencyKey: z.string().optional(),
    attachments: z.array(z.unknown()).optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const resultTypeRaw = body.resultType ? String(body.resultType || '').trim().toUpperCase() : '';
  const summary = body.summary ? String(body.summary || '').trim() : body.summaryText ? String(body.summaryText || '').trim() : null;
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : null;
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey || '').trim() : null;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const invalid: string[] = [];

  const normalizedAttachments = attachments.map((item: unknown) => {
    const att = item as Record<string, unknown>;
    const type = String(att?.type || '').trim().toUpperCase();
    const label = String(att?.label || '').trim();
    const url = att?.url ? String(att.url).trim() : null;
    const text = att?.text ? String(att.text).trim() : null;
    if (!type || !LEGACY_ATTACHMENT_TYPES.has(type)) invalid.push('attachments.type');
    if (!label) invalid.push('attachments.label');
    if (type === 'TEXT' && !text) invalid.push('attachments.text');
    if ((type === 'PDF_URL' || type === 'IMAGE_URL') && !url) invalid.push('attachments.url');
    return { type, label, url, text };
  });

  const resultType =
    resultTypeRaw && RESULT_TYPES.has(resultTypeRaw)
      ? resultTypeRaw
      : normalizedAttachments[0]?.type === 'PDF_URL'
      ? 'PDF'
      : normalizedAttachments[0]?.type === 'IMAGE_URL'
      ? 'IMAGE'
      : 'TEXT';

  if (resultTypeRaw && !RESULT_TYPES.has(resultTypeRaw)) invalid.push('resultType');
  if (invalid.length) {
    return NextResponse.json({ error: 'Validation failed', invalid }, { status: 400 });
  }

  const order = await prisma.ordersHub.findFirst({
    where: { tenantId, id: orderId },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Order is cancelled' }, { status: 409 });
  }

  const guard = await ensureResultsWriteAllowed({
    tenantId,
    encounterCoreId: String(order.encounterCoreId || ''),
  });
  if (guard) return guard;

  // Check idempotency
  if (idempotencyKey) {
    const existing = await prisma.orderResult.findFirst({
      where: { tenantId, orderId, data: { path: ['idempotencyKey'], equals: idempotencyKey } },
    });
    if (existing) {
      return NextResponse.json({ success: true, noOp: true, id: existing.id, result: existing });
    }
  }

  // Store extra metadata in the `data` JSON field
  const resultData = {
    ...(payload || {}),
    encounterCoreId: order.encounterCoreId || null,
    patientMasterId: order.patientMasterId || null,
    kind: deriveKind(order.kind),
    createdByUserId: userId || null,
    idempotencyKey: idempotencyKey || null,
  };

  let result: Awaited<ReturnType<typeof prisma.orderResult.create>>;
  try {
    result = await prisma.orderResult.create({
      data: {
        tenantId,
        orderId,
        resultType,
        status: 'RESULT_READY',
        summary,
        data: resultData,
      },
    });
  } catch (err: unknown) {
    // Handle duplicate idempotency via unique constraint
    if (idempotencyKey && (err as Record<string, unknown>)?.code === 'P2002') {
      const existing = await prisma.orderResult.findFirst({
        where: { tenantId, orderId, data: { path: ['idempotencyKey'], equals: idempotencyKey } },
      });
      if (existing) {
        return NextResponse.json({ success: true, noOp: true, id: existing.id, result: existing });
      }
    }
    throw err;
  }

  await createAuditLog(
    'order_result',
    result.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: result, meta: { orderId, resultType } },
    tenantId
  );

  if (order.createdByUserId) {
    await emitNotification({
      tenantId,
      recipientUserId: String(order.createdByUserId),
      recipientRole: 'doctor',
      scope: 'RESULTS',
      kind: 'RESULT_READY',
      severity: 'INFO',
      title: 'Result ready',
      message: `${order.orderName || order.orderCode || 'Order'} result is ready`,
      entity: {
        type: 'order_result',
        id: result.id,
        encounterCoreId: order.encounterCoreId,
        patientMasterId: order.patientMasterId,
        orderId: order.id,
        link: '/orders',
      },
      dedupeKey: `result:${result.id}:user:${order.createdByUserId}`,
      actorUserId: userId || null,
      actorUserEmail: user?.email || null,
    });
  }
  await emitNotificationToRole({
    tenantId,
    recipientRole: 'charge',
    scope: 'RESULTS',
    kind: 'RESULT_READY',
    severity: 'INFO',
    title: 'Result ready',
    message: `${order.orderName || order.orderCode || 'Order'} result is ready`,
    entity: {
      type: 'order_result',
      id: result.id,
      encounterCoreId: order.encounterCoreId,
      patientMasterId: order.patientMasterId,
      orderId: order.id,
      link: '/orders',
    },
    dedupeKey: `result:${result.id}:charge`,
    actorUserId: userId || null,
    actorUserEmail: user?.email || null,
  });

  if (normalizedAttachments.length) {
    const now = new Date();
    for (const item of normalizedAttachments) {
      const attachment = await prisma.attachment.create({
        data: {
          tenantId,
          entityType: 'order_result',
          entityId: result.id,
          fileName: item.label,
          mimeType: attachmentMime(item.type),
          sizeBytes: 0,
          storage: {
            provider: 'local_stub',
            key: item.url || `inline-${result.id}`,
            url: item.url || null,
          },
          checksum: null,
          createdByUserId: userId || null,
        },
      });
      await createAuditLog(
        'attachment',
        attachment.id,
        'CREATE',
        userId || 'system',
        user?.email,
        { after: attachment },
        tenantId
      );
    }
  }

  return NextResponse.json({ result });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'orders.hub.view' }
);
