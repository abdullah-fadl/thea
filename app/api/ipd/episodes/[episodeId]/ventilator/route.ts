import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// GET /api/ipd/episodes/[episodeId]/ventilator
export const GET = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const episodeId = resolvedParams?.episodeId as string;
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId required' }, { status: 400 });
    }
    const records = await prisma.ventilatorRecord.findMany({
      where: { tenantId, episodeId },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ records });
  } catch (e) {
    logger.error('[VENTILATOR GET] Failed to fetch ventilator records', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to fetch ventilator records' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });

// POST /api/ipd/episodes/[episodeId]/ventilator
export const POST = withAuthTenant(async (req, { tenantId, userId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const episodeId = resolvedParams?.episodeId as string;
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId required' }, { status: 400 });
    }
    const body = await req.json();
    const { mode, settings, recordings, weaningPlan, extubationTime, extubationNote, startedAt, endedAt } = body;
    if (!mode || !settings) {
      return NextResponse.json({ error: 'mode and settings are required' }, { status: 400 });
    }
    const record = await prisma.ventilatorRecord.create({
      data: {
        tenantId,
        episodeId,
        recordedBy: userId,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: endedAt ? new Date(endedAt) : null,
        mode,
        settings,
        recordings: recordings ?? [],
        weaningPlan: weaningPlan ?? null,
        extubationTime: extubationTime ? new Date(extubationTime) : null,
        extubationNote: extubationNote ?? null,
      },
    });
    return NextResponse.json({ record }, { status: 201 });
  } catch (e) {
    logger.error('[VENTILATOR POST] Failed to create ventilator record', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to create ventilator record' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });

// PUT /api/ipd/episodes/[episodeId]/ventilator
// Body: { id, ...fieldsToUpdate }
export const PUT = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const episodeId = resolvedParams?.episodeId as string;
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId required' }, { status: 400 });
    }
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: 'Record id required for update' }, { status: 400 });
    }
    // Ensure the record belongs to this tenant + episode
    const existing = await prisma.ventilatorRecord.findFirst({
      where: { id, tenantId, episodeId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    const data: any = {};
    if (updates.mode !== undefined) data.mode = updates.mode;
    if (updates.settings !== undefined) data.settings = updates.settings;
    if (updates.recordings !== undefined) data.recordings = updates.recordings;
    if (updates.weaningPlan !== undefined) data.weaningPlan = updates.weaningPlan;
    if (updates.extubationNote !== undefined) data.extubationNote = updates.extubationNote;
    if (updates.extubationTime !== undefined) data.extubationTime = updates.extubationTime ? new Date(updates.extubationTime) : null;
    if (updates.endedAt !== undefined) data.endedAt = updates.endedAt ? new Date(updates.endedAt) : null;
    const record = await prisma.ventilatorRecord.update({ where: { id }, data });
    return NextResponse.json({ record });
  } catch (e) {
    logger.error('[VENTILATOR PUT] Failed to update ventilator record', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to update ventilator record' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });
