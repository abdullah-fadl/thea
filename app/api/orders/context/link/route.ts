import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { linkOrderContextSchema } from '@/lib/validation/orders.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, linkOrderContextSchema);
    if ('error' in v) return v.error;

    const missing: string[] = [];
    const orderId = String(body.orderId || '').trim();
    const noteId = String(body.noteId || '').trim();
    const encounterCoreId = String(body.encounterCoreId || '').trim();
    const reason = body.reason ? String(body.reason || '').trim() : null;
    const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey || '').trim() : null;

    if (!orderId) missing.push('orderId');
    if (!noteId) missing.push('noteId');
    if (!encounterCoreId) missing.push('encounterCoreId');
    if (missing.length) {
      return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });
    }

    const encounter = await prisma.encounterCore.findFirst({
      where: { tenantId, id: encounterCoreId },
    });
    if (!encounter) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
    }
    if (String((encounter as any).status || '') === 'CLOSED') {
      return NextResponse.json({ error: 'Encounter is closed', code: 'ENCOUNTER_CLOSED' }, { status: 409 });
    }

    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;

    const discharge = await prisma.dischargeSummary.findFirst({
      where: { tenantId, encounterCoreId },
    });
    if (discharge) {
      return NextResponse.json(
        { error: 'Discharge already finalized', code: 'DISCHARGE_FINALIZED' },
        { status: 409 }
      );
    }

    const order = await prisma.ordersHub.findFirst({
      where: { tenantId, id: orderId },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const note = await prisma.clinicalNote.findFirst({
      where: { tenantId, id: noteId },
    });
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (String((order as any).encounterCoreId || '') !== encounterCoreId || String((note as any).encounterCoreId || '') !== encounterCoreId) {
      return NextResponse.json(
        { error: 'Order and note must belong to same encounter', code: 'ENCOUNTER_MISMATCH' },
        { status: 409 }
      );
    }

    const noteType =
      ['OPD', 'ER', 'IPD'].includes(String((note as any).area || '').toUpperCase())
        ? String((note as any).area || '').toUpperCase()
        : String((encounter as any).encounterType || 'OPD').toUpperCase();

    const existing = await prisma.orderContextLink.findFirst({
      where: { tenantId, orderId },
    });
    if (existing && (existing as any).noteId === noteId) {
      return NextResponse.json({ success: true, noOp: true, link: existing });
    }
    if (idempotencyKey && existing && (existing as any).idempotencyKey === idempotencyKey) {
      return NextResponse.json({ success: true, noOp: true, link: existing });
    }

    const now = new Date();
    let link = null as any;
    if (existing) {
      const update = {
        noteId,
        noteType,
        encounterCoreId,
        reason,
        linkedByUserId: userId || null,
        linkedAt: now,
        updatedAt: now,
        updatedByUserId: userId || null,
        idempotencyKey: idempotencyKey || null,
      };
      await prisma.orderContextLink.updateMany({
        where: { tenantId, orderId },
        data: update,
      });
      link = { ...existing, ...update };
      await createAuditLog(
        'order_context_link',
        link.id || orderId,
        'LINK',
        userId || 'system',
        user?.email,
        { before: existing, after: link, reason },
        tenantId
      );
      return NextResponse.json({ success: true, replaced: true, link });
    }

    link = await prisma.orderContextLink.create({
      data: {
        tenantId,
        orderId,
        encounterCoreId,
        noteId,
        noteType,
        reason,
        linkedByUserId: userId || null,
        linkedAt: now,
        createdAt: now,
        createdByUserId: userId || null,
        updatedAt: now,
        updatedByUserId: userId || null,
        idempotencyKey: idempotencyKey || null,
      },
    });

    await createAuditLog(
      'order_context_link',
      link.id,
      'LINK',
      userId || 'system',
      user?.email,
      { after: link },
      tenantId
    );

    return NextResponse.json({ success: true, link });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'orders.hub.view' }
);
