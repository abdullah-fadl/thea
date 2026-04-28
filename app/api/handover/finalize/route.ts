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

function canFinalize(role: string, user: any, _tenantId: string, handover: any) {
  const roleLower = String(role || user?.role || '').toLowerCase();
  if (handover?.fromUserId && handover.fromUserId === user?.id) return true;
  return roleLower.includes('charge') || roleLower.includes('admin');
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
    handoverId: z.string().min(1),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const handoverId = String(body.handoverId || '').trim();
  if (!handoverId) {
    return NextResponse.json({ error: 'handoverId is required' }, { status: 400 });
  }

  const existing = await prisma.clinicalHandover.findFirst({
    where: { tenantId, id: handoverId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Handover not found' }, { status: 404 });
  }

  if (!canFinalize(String(role || ''), user, tenantId, existing)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const guard = await ensureHandoverWriteAllowed({
    tenantId,
    encounterCoreId: String(existing.encounterCoreId || ''),
  });
  if (guard) return guard;

  if (existing.status === 'FINALIZED') {
    return NextResponse.json({ success: true, noOp: true, handover: existing });
  }

  const now = new Date();
  const handover = await prisma.clinicalHandover.update({
    where: { id: handoverId },
    data: { status: 'FINALIZED', finalizedAt: now },
  });

  await createAuditLog(
    'clinical_handover',
    handoverId,
    'FINALIZE',
    userId || 'system',
    user?.email,
    { before: existing, after: handover },
    tenantId
  );

  if (handover.toUserId) {
    await emitNotification({
      tenantId,
      recipientUserId: String(handover.toUserId),
      recipientRole: handover.toRole,
      scope: 'SYSTEM',
      kind: 'HANDOVER_FINALIZED',
      severity: 'INFO',
      title: 'Handover finalized',
      message: handover.summary || 'Handover finalized',
      entity: {
        type: 'clinical_handover',
        id: handover.id,
        encounterCoreId: handover.encounterCoreId,
        link: '/handover',
      },
      dedupeKey: `handover:${handover.id}:final:${handover.toUserId}`,
      actorUserId: userId || null,
      actorUserEmail: user?.email || null,
    });
  } else {
    await emitNotificationToRole({
      tenantId,
      recipientRole: handover.toRole,
      scope: 'SYSTEM',
      kind: 'HANDOVER_FINALIZED',
      severity: 'INFO',
      title: 'Handover finalized',
      message: handover.summary || 'Handover finalized',
      entity: {
        type: 'clinical_handover',
        id: handover.id,
        encounterCoreId: handover.encounterCoreId,
        link: '/handover',
      },
      dedupeKey: `handover:${handover.id}:final:${handover.toRole}`,
      actorUserId: userId || null,
      actorUserEmail: user?.email || null,
    });
  }

  return NextResponse.json({ handover });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'handover.view' }
);
