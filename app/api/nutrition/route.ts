import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// GET /api/nutrition
// Query: patientMasterId, episodeId, mustScore (min)
export const GET = withAuthTenant(async (req, { tenantId }) => {
  try {
    const url = new URL(req.url);
    const patientMasterId = url.searchParams.get('patientMasterId');
    const episodeId = url.searchParams.get('episodeId');

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (episodeId) where.episodeId = episodeId;

    const assessments = await prisma.nutritionalAssessment.findMany({
      where,
      orderBy: { assessmentDate: 'desc' },
      take: 200,
    });

    // KPI counters
    const total = assessments.length;
    const atRisk = assessments.filter(a => (a.mustScore ?? 0) >= 2).length;
    const malnourished = assessments.filter(a => (a.mustScore ?? 0) >= 3).length;

    return NextResponse.json({ assessments, kpis: { total, atRisk, malnourished } });
  } catch (e) {
    logger.error('[NUTRITION GET] Failed to fetch nutritional assessments', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to fetch nutritional assessments' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });

// POST /api/nutrition
export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  try {
    const body = await req.json();
    const {
      patientMasterId, episodeId,
      assessmentDate, mustScore, mnaScore,
      height, weight, weightChangePct, idealWeight,
      appetiteStatus, swallowingStatus,
      dietaryHistory, foodAllergies,
      route, caloricNeed, proteinNeed, fluidNeed,
      recommendations, followUpDate,
    } = body;

    if (!patientMasterId) {
      return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
    }

    // Auto-calc BMI
    const h = height ? Number(height) / 100 : null; // cm → m
    const w = weight ? Number(weight) : null;
    const bmi = h && w && h > 0 ? Number((w / (h * h)).toFixed(1)) : null;

    const assessment = await prisma.nutritionalAssessment.create({
      data: {
        tenantId,
        patientMasterId,
        episodeId: episodeId ?? null,
        assessedBy: userId,
        assessmentDate: assessmentDate ? new Date(assessmentDate) : new Date(),
        mustScore: mustScore != null ? Number(mustScore) : null,
        mnaScore: mnaScore != null ? Number(mnaScore) : null,
        height: height != null ? Number(height) : null,
        weight: w,
        bmi,
        idealWeight: idealWeight != null ? Number(idealWeight) : null,
        weightChangePct: weightChangePct != null ? Number(weightChangePct) : null,
        appetiteStatus: appetiteStatus ?? null,
        swallowingStatus: swallowingStatus ?? null,
        dietaryHistory: dietaryHistory ?? null,
        foodAllergies: foodAllergies ?? null,
        route: route ?? null,
        caloricNeed: caloricNeed != null ? Number(caloricNeed) : null,
        proteinNeed: proteinNeed != null ? Number(proteinNeed) : null,
        fluidNeed: fluidNeed != null ? Number(fluidNeed) : null,
        recommendations: recommendations ?? null,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
      },
    });

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (e) {
    logger.error('[NUTRITION POST] Failed to create nutritional assessment', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to create nutritional assessment' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });
