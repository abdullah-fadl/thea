import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// GET /api/wound-care
// Query: patientMasterId, episodeId, woundType, healingTrajectory
export const GET = withAuthTenant(async (req, { tenantId }) => {
  try {
    const url = new URL(req.url);
    const patientMasterId = url.searchParams.get('patientMasterId');
    const episodeId = url.searchParams.get('episodeId');
    const woundType = url.searchParams.get('woundType');
    const healingTrajectory = url.searchParams.get('healingTrajectory');

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (episodeId) where.episodeId = episodeId;
    if (woundType) where.woundType = woundType;
    if (healingTrajectory) where.healingTrajectory = healingTrajectory;

    const assessments = await prisma.woundAssessment.findMany({
      where,
      orderBy: { assessmentDate: 'desc' },
      take: 200,
    });

    return NextResponse.json({ assessments });
  } catch (e) {
    logger.error('[WOUND-CARE GET] Failed to fetch wound assessments', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to fetch wound assessments' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });

// POST /api/wound-care
export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  try {
    const body = await req.json();
    const {
      patientMasterId, episodeId, encounterId,
      assessmentDate, woundType, woundLocation, stage,
      length, width, depth, tunneling, undermining,
      woundBed, exudate, periwoundSkin, odor, painScore,
      treatment, healingTrajectory, notes, photoAttachmentId,
    } = body;

    if (!patientMasterId || !woundType || !woundLocation) {
      return NextResponse.json(
        { error: 'patientMasterId, woundType, and woundLocation are required' },
        { status: 400 }
      );
    }

    const assessment = await prisma.woundAssessment.create({
      data: {
        tenantId,
        patientMasterId,
        episodeId: episodeId ?? null,
        encounterId: encounterId ?? null,
        assessedBy: userId,
        assessmentDate: assessmentDate ? new Date(assessmentDate) : new Date(),
        woundType,
        woundLocation,
        stage: stage ?? null,
        length: length != null ? Number(length) : null,
        width: width != null ? Number(width) : null,
        depth: depth != null ? Number(depth) : null,
        tunneling: tunneling ?? false,
        undermining: undermining ?? false,
        woundBed: woundBed ?? null,
        exudate: exudate ?? null,
        periwoundSkin: periwoundSkin ?? null,
        odor: odor ?? null,
        painScore: painScore != null ? Number(painScore) : null,
        treatment: treatment ?? null,
        healingTrajectory: healingTrajectory ?? null,
        notes: notes ?? null,
        photoAttachmentId: photoAttachmentId ?? null,
      },
    });

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (e) {
    logger.error('[WOUND-CARE POST] Failed to create wound assessment', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to create wound assessment' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });
