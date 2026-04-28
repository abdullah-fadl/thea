import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing cycle id' }, { status: 400 });

    const cycle = await prisma.cssdCycle.findFirst({ where: { id, tenantId } });
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

    if (cycle.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Can only dispatch completed cycles' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { dispatchedTo, notes } = body;

    if (!dispatchedTo) {
      return NextResponse.json({ error: 'dispatchedTo is required' }, { status: 400 });
    }

    const dispatch = await prisma.cssdDispatch.create({
      data: {
        tenantId,
        cycleId: id,
        trayId: cycle.trayId,
        dispatchedTo: String(dispatchedTo),
        dispatchedBy: userId,
        dispatchedAt: new Date(),
        status: 'DISPATCHED',
        notes: notes ? String(notes) : null,
      },
    });

    return NextResponse.json({ success: true, id: dispatch.id, dispatch });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);
