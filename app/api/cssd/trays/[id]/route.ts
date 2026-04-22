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

    const tray = await prisma.cssdTray.findFirst({ where: { id, tenantId } });
    if (!tray) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ tray });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const existing = await prisma.cssdTray.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updated = await prisma.cssdTray.update({
      where: { id },
      data: {
        ...(body.trayName !== undefined && { trayName: String(body.trayName) }),
        ...(body.trayCode !== undefined && { trayCode: String(body.trayCode) }),
        ...(body.department !== undefined && { department: body.department ? String(body.department) : null }),
        ...(body.instruments !== undefined && { instruments: body.instruments }),
        ...(body.totalInstruments !== undefined && { totalInstruments: Number(body.totalInstruments) }),
        ...(body.active !== undefined && { active: Boolean(body.active) }),
      },
    });

    return NextResponse.json({ success: true, tray: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);
