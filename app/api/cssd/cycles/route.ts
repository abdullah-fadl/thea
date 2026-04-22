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
    const status = searchParams.get('status') || undefined;
    const trayId = searchParams.get('trayId') || undefined;

    const cycles = await prisma.cssdCycle.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(trayId ? { trayId } : {}),
      },
      orderBy: { startTime: 'desc' },
      take: 100,
      include: {
        tray: {
          select: { trayName: true, trayCode: true, department: true },
        },
      },
    });

    return NextResponse.json({ cycles });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { trayId, loadNumber, machine, method, temperature, pressure, duration, biologicalIndicator, chemicalIndicator } = body;

    if (!trayId || !loadNumber || !machine || !method) {
      return NextResponse.json({ error: 'trayId, loadNumber, machine, and method are required' }, { status: 400 });
    }

    const tray = await prisma.cssdTray.findFirst({ where: { id: String(trayId), tenantId } });
    if (!tray) {
      return NextResponse.json({ error: 'Tray not found' }, { status: 404 });
    }

    // Generate a simple cycle number
    const cycleNumber = Date.now().toString();

    const cycle = await prisma.cssdCycle.create({
      data: {
        tenantId,
        trayId: String(trayId),
        loadNumber: String(loadNumber),
        machine: String(machine),
        method: String(method),
        cycleNumber,
        temperature: temperature != null ? Number(temperature) : null,
        pressure: pressure != null ? Number(pressure) : null,
        duration: duration != null ? Number(duration) : null,
        // biologicalIndicator is Boolean in schema
        biologicalIndicator: Boolean(biologicalIndicator),
        chemicalIndicator: chemicalIndicator ? String(chemicalIndicator) : null,
        startTime: new Date(),
        operator: userId,
        status: 'IN_PROGRESS',
      },
    });

    return NextResponse.json({ success: true, id: cycle.id, cycle });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);
