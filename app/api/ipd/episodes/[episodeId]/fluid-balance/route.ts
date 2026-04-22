import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// GET /api/ipd/episodes/[episodeId]/fluid-balance
// Query params: shiftDate (YYYY-MM-DD)
export const GET = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const episodeId = resolvedParams?.episodeId as string;
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId required' }, { status: 400 });
    }
    const url = new URL(req.url);
    const shiftDate = url.searchParams.get('shiftDate');

    const where: any = { tenantId, episodeId };
    if (shiftDate) {
      // shiftDate stored as Date; filter by date string
      where.shiftDate = new Date(shiftDate);
    }

    const entries = await prisma.fluidBalanceEntry.findMany({
      where,
      orderBy: [{ shiftDate: 'desc' }, { shift: 'asc' }],
      take: 200,
    });

    // Compute 24-hour cumulative for the queried date
    const totalIntake24h = entries.reduce((sum, e) => sum + (e.totalIntake ?? 0), 0);
    const totalOutput24h = entries.reduce((sum, e) => sum + (e.totalOutput ?? 0), 0);
    const netBalance24h = totalIntake24h - totalOutput24h;

    return NextResponse.json({ entries, totals: { totalIntake24h, totalOutput24h, netBalance24h } });
  } catch (e) {
    logger.error('[FLUID-BALANCE GET] Failed to fetch fluid balance entries', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to fetch fluid balance entries' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });

// POST /api/ipd/episodes/[episodeId]/fluid-balance
export const POST = withAuthTenant(async (req, { tenantId, userId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const episodeId = resolvedParams?.episodeId as string;
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId required' }, { status: 400 });
    }
    const body = await req.json();
    const { shift, shiftDate, intakes = [], outputs = [], notes } = body;
    if (!shift || !shiftDate) {
      return NextResponse.json({ error: 'shift and shiftDate are required' }, { status: 400 });
    }

    const totalIntake = intakes.reduce((sum: number, i: { volume?: number }) => sum + (Number(i.volume) || 0), 0);
    const totalOutput = outputs.reduce((sum: number, o: { volume?: number }) => sum + (Number(o.volume) || 0), 0);
    const netBalance = totalIntake - totalOutput;

    const entry = await prisma.fluidBalanceEntry.create({
      data: {
        tenantId,
        episodeId,
        enteredBy: userId,
        shift,
        shiftDate: new Date(shiftDate),
        intakes,
        outputs,
        totalIntake,
        totalOutput,
        netBalance,
        notes: notes ?? null,
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    logger.error('[FLUID-BALANCE POST] Failed to create fluid balance entry', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to create fluid balance entry' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });

// PUT /api/ipd/episodes/[episodeId]/fluid-balance
// Body: { id, intakes, outputs, notes }
export const PUT = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const episodeId = resolvedParams?.episodeId as string;
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId required' }, { status: 400 });
    }
    const body = await req.json();
    const { id, intakes, outputs, notes } = body;
    if (!id) {
      return NextResponse.json({ error: 'Entry id required' }, { status: 400 });
    }
    const existing = await prisma.fluidBalanceEntry.findFirst({ where: { id, tenantId, episodeId } });
    if (!existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const newIntakes = intakes ?? (existing.intakes as unknown[]) ?? [];
    const newOutputs = outputs ?? (existing.outputs as unknown[]) ?? [];
    const totalIntake = (newIntakes as { volume?: number }[]).reduce((sum, i) => sum + (Number(i.volume) || 0), 0);
    const totalOutput = (newOutputs as { volume?: number }[]).reduce((sum, o) => sum + (Number(o.volume) || 0), 0);
    const netBalance = totalIntake - totalOutput;

    const entry = await prisma.fluidBalanceEntry.update({
      where: { id },
      data: {
        intakes: newIntakes,
        outputs: newOutputs,
        totalIntake,
        totalOutput,
        netBalance,
        notes: notes !== undefined ? notes : existing.notes,
      },
    });
    return NextResponse.json({ entry });
  } catch (e) {
    logger.error('[FLUID-BALANCE PUT] Failed to update fluid balance entry', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to update fluid balance entry' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });
