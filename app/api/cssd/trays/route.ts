import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const department = searchParams.get('department') || undefined;
    const activeOnly = searchParams.get('active') !== 'false';

    const trays = await prisma.cssdTray.findMany({
      where: {
        tenantId,
        ...(department ? { department } : {}),
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: { trayName: 'asc' },
    });

    return NextResponse.json({ trays });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { trayName, trayCode, department, instruments, totalInstruments } = body;

    if (!trayName || !trayCode) {
      return NextResponse.json({ error: 'trayName and trayCode are required' }, { status: 400 });
    }

    const tray = await prisma.cssdTray.create({
      data: {
        tenantId,
        trayName: String(trayName),
        trayCode: String(trayCode),
        department: department ? String(department) : null,
        instruments: instruments ?? [],
        totalInstruments: Number(totalInstruments) || 0,
        active: true,
      },
    });

    return NextResponse.json({ success: true, id: tray.id, tray });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);
