import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const cycle = await prisma.cssdCycle.findFirst({
      where: { id, tenantId },
      include: {
        tray: { select: { trayName: true, trayCode: true, department: true } },
        dispatches: { orderBy: { dispatchedAt: 'desc' } },
      },
    });

    if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ cycle });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const existing = await prisma.cssdCycle.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const VALID_STATUSES = new Set(['IN_PROGRESS', 'COMPLETED', 'FAILED', 'RECALLED']);
    if (body.status && !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const now = new Date();
    const updated = await prisma.cssdCycle.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: String(body.status) }),
        ...(body.biologicalResult !== undefined && { biologicalResult: body.biologicalResult ? String(body.biologicalResult) : null }),
        ...(body.status === 'COMPLETED' && !existing.endTime && { endTime: now }),
        ...(body.status === 'FAILED' && !existing.endTime && { endTime: now }),
        ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null }),
      },
    });

    return NextResponse.json({ success: true, cycle: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);
