import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureHandoverWriteAllowed } from '@/lib/core/guards/handoverGuard';
import { emitNotification, emitNotificationToRole } from '@/lib/notifications/emit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROLE_SET = new Set(['doctor', 'nurse']);

function roleKey(role: string, user: any) {
  const roleLower = String(role || user?.role || '').toLowerCase();
  if (roleLower.includes('doctor') || roleLower.includes('physician')) return 'doctor';
  if (roleLower.includes('nurse') || roleLower.includes('nursing')) return 'nurse';
  return roleLower;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    encounterCoreId: z.string().optional(),
    episodeId: z.string().optional(),
    toRole: z.string().min(1),
    summary: z.string().min(1),
    fromRole: z.string().optional(),
    toUserId: z.string().optional(),
    idempotencyKey: z.string().optional(),
    risks: z.array(z.string()).optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const encounterCoreIdRaw = String(body.encounterCoreId || '').trim();
  const episodeId = String(body.episodeId || '').trim();
  const fromRole = roleKey(String(body.fromRole || role || ''), user);
  const toRole = String(body.toRole || '').trim().toLowerCase();
  const summary = String(body.summary || '').trim();
  const toUserId = body.toUserId ? String(body.toUserId || '').trim() : null;
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey || '').trim() : null;
  const risks = Array.isArray(body.risks) ? body.risks.map((r: any) => String(r || '').trim()).filter(Boolean) : [];

  if (!encounterCoreIdRaw && !episodeId) missing.push('encounterCoreId|episodeId');
  if (!toRole) missing.push('toRole');
  if (!summary) missing.push('summary');
  if (!ROLE_SET.has(toRole)) {
    return NextResponse.json({ error: 'Invalid toRole', invalid: ['toRole'] }, { status: 400 });
  }

  if (missing.length) {
    return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });
  }

  let encounterCoreId = encounterCoreIdRaw;
  if (!encounterCoreId && episodeId) {
    const episode = await prisma.ipdEpisode.findFirst({
      where: { tenantId, id: episodeId },
    });
    if (episode?.encounterId) {
      encounterCoreId = String(episode.encounterId || '');
    }
  }

  if (!encounterCoreId) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const guard = await ensureHandoverWriteAllowed({ tenantId, encounterCoreId });
  if (guard) return guard;

  if (idempotencyKey) {
    const existing = await prisma.clinicalHandover.findFirst({
      where: { tenantId, idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({ success: true, noOp: true, handover: existing });
    }
  }

  const tasks = await prisma.clinicalTask.findMany({
    where: { tenantId, encounterCoreId, status: { in: ['OPEN', 'CLAIMED', 'IN_PROGRESS'] } },
    orderBy: { createdAt: 'asc' },
  });
  const pendingTasks = tasks.map((task: any) => ({
    id: task.id,
    title: task.title,
    taskType: task.taskType,
    status: task.status,
    assignedToUserId: task.assignedToUserId || null,
    priority: task.priority || null,
  }));

  const orders = await prisma.ordersHub.findMany({
    where: { tenantId, encounterCoreId, status: { in: ['PLACED', 'ACCEPTED', 'IN_PROGRESS', 'RESULT_READY'] } },
    orderBy: { createdAt: 'asc' },
  });
  const activeOrders = orders.map((order: any) => ({
    id: order.id,
    kind: order.kind,
    orderCode: order.orderCode,
    orderName: order.orderName,
    status: order.status,
  }));

  // Get order IDs for this encounter, then find their results
  const encounterOrderIds = orders.map((o: any) => o.id).filter(Boolean);
  const results = encounterOrderIds.length
    ? await prisma.orderResult.findMany({
        where: { tenantId, orderId: { in: encounterOrderIds } },
        orderBy: { createdAt: 'asc' },
      })
    : [];
  let pendingResults: any[] = [];
  if (results.length) {
    const resultIds = results.map((r: any) => String(r.id || '')).filter(Boolean);
    const acks = await prisma.resultAck.findMany({
      where: { tenantId, orderResultId: { in: resultIds } },
    });
    const acked = new Set(acks.map((ack: any) => String(ack.orderResultId || '')));
    pendingResults = results
      .filter((r: any) => !acked.has(String(r.id || '')))
      .map((r: any) => ({
        id: r.id,
        orderId: r.orderId,
        summary: r.summary || null,
        resultType: r.resultType || null,
        createdAt: r.createdAt,
      }));
  }

  const now = new Date();
  const handover = await prisma.clinicalHandover.create({
    data: {
      tenantId,
      encounterCoreId,
      episodeId: episodeId || null,
      fromRole: ROLE_SET.has(fromRole) ? fromRole : 'doctor',
      toRole,
      fromUserId: userId || null,
      toUserId,
      summary,
      risks,
      pendingTasks,
      pendingResults,
      activeOrders,
      createdAt: now,
      finalizedAt: null,
      status: 'OPEN',
      idempotencyKey: idempotencyKey || null,
    },
  });

  await createAuditLog(
    'clinical_handover',
    handover.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: handover },
    tenantId
  );

  if (handover.toUserId) {
    await emitNotification({
      tenantId,
      recipientUserId: handover.toUserId,
      recipientRole: handover.toRole,
      scope: 'SYSTEM',
      kind: 'HANDOVER_OPEN',
      severity: 'WARN',
      title: 'Handover created',
      message: handover.summary || 'New handover is ready',
      entity: {
        type: 'clinical_handover',
        id: handover.id,
        encounterCoreId,
        link: '/handover',
      },
      dedupeKey: `handover:${handover.id}:user:${handover.toUserId}`,
      actorUserId: userId || null,
      actorUserEmail: user?.email || null,
    });
  } else {
    await emitNotificationToRole({
      tenantId,
      recipientRole: handover.toRole,
      scope: 'SYSTEM',
      kind: 'HANDOVER_OPEN',
      severity: 'WARN',
      title: 'Handover created',
      message: handover.summary || 'New handover is ready',
      entity: {
        type: 'clinical_handover',
        id: handover.id,
        encounterCoreId,
        link: '/handover',
      },
      dedupeKey: `handover:${handover.id}:${handover.toRole}`,
      actorUserId: userId || null,
      actorUserEmail: user?.email || null,
    });
  }

  return NextResponse.json({ handover });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'handover.view' }
);
