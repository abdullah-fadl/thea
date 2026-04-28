import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/cssd/dispatches/[id] — fetch a single dispatch
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const dispatch = await prisma.cssdDispatch.findFirst({
      where: { id, tenantId },
      include: {
        cycle: {
          select: {
            loadNumber: true,
            machine: true,
            method: true,
            status: true,
            tray: { select: { trayName: true, trayCode: true } },
          },
        },
      },
    });

    if (!dispatch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ dispatch });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);

// PUT /api/cssd/dispatches/[id] — receive or return a dispatched tray
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const existing = await prisma.cssdDispatch.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 });

    let body: any = {};
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action } = body; // 'receive' | 'return'
    const VALID_ACTIONS = new Set(['receive', 'return']);
    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'action must be "receive" or "return"' }, { status: 400 });
    }

    if (action === 'receive') {
      if (existing.status !== 'DISPATCHED') {
        return NextResponse.json({ error: 'Dispatch must be in DISPATCHED status to receive' }, { status: 400 });
      }
      const updated = await prisma.cssdDispatch.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedBy: userId,
          receivedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, dispatch: updated });
    }

    if (action === 'return') {
      if (!['RECEIVED', 'DISPATCHED'].includes(existing.status)) {
        return NextResponse.json({ error: 'Dispatch must be in RECEIVED or DISPATCHED status to return' }, { status: 400 });
      }
      const updated = await prisma.cssdDispatch.update({
        where: { id },
        data: {
          status: 'RETURNED',
          returnedBy: userId,
          returnedAt: new Date(),
          ...(body.notes !== undefined && { notes: body.notes ? String(body.notes) : existing.notes }),
        },
      });
      return NextResponse.json({ success: true, dispatch: updated });
    }

    return NextResponse.json({ error: 'Unhandled action' }, { status: 400 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.manage' }
);
