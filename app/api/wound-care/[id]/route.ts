import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// GET /api/wound-care/[id]
export const GET = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams?.id as string;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const assessment = await prisma.woundAssessment.findFirst({
      where: { id, tenantId },
    });
    if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ assessment });
  } catch (e) {
    logger.error('[WOUND-CARE/:id GET] Failed to fetch wound assessment', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to fetch wound assessment' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });

// PUT /api/wound-care/[id]
export const PUT = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams?.id as string;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const existing = await prisma.woundAssessment.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const {
      woundType, woundLocation, stage, length, width, depth,
      tunneling, undermining, woundBed, exudate, periwoundSkin,
      odor, painScore, treatment, healingTrajectory, notes,
      assessmentDate, photoAttachmentId,
    } = body;

    const data: any = {};
    if (woundType !== undefined) data.woundType = woundType;
    if (woundLocation !== undefined) data.woundLocation = woundLocation;
    if (stage !== undefined) data.stage = stage;
    if (length !== undefined) data.length = length != null ? Number(length) : null;
    if (width !== undefined) data.width = width != null ? Number(width) : null;
    if (depth !== undefined) data.depth = depth != null ? Number(depth) : null;
    if (tunneling !== undefined) data.tunneling = tunneling;
    if (undermining !== undefined) data.undermining = undermining;
    if (woundBed !== undefined) data.woundBed = woundBed;
    if (exudate !== undefined) data.exudate = exudate;
    if (periwoundSkin !== undefined) data.periwoundSkin = periwoundSkin;
    if (odor !== undefined) data.odor = odor;
    if (painScore !== undefined) data.painScore = painScore != null ? Number(painScore) : null;
    if (treatment !== undefined) data.treatment = treatment;
    if (healingTrajectory !== undefined) data.healingTrajectory = healingTrajectory;
    if (notes !== undefined) data.notes = notes;
    if (assessmentDate !== undefined) data.assessmentDate = new Date(assessmentDate);
    if (photoAttachmentId !== undefined) data.photoAttachmentId = photoAttachmentId;

    const assessment = await prisma.woundAssessment.update({ where: { id }, data });
    return NextResponse.json({ assessment });
  } catch (e) {
    logger.error('[WOUND-CARE/:id PUT] Failed to update wound assessment', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to update wound assessment' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });
