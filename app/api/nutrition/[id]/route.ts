import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// GET /api/nutrition/[id]
export const GET = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams?.id as string;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const assessment = await prisma.nutritionalAssessment.findFirst({
      where: { id, tenantId },
    });
    if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ assessment });
  } catch (e) {
    logger.error('[NUTRITION/:id GET] Failed to fetch nutritional assessment', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to fetch nutritional assessment' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });

// PUT /api/nutrition/[id]
export const PUT = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams?.id as string;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const existing = await prisma.nutritionalAssessment.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const data: any = {};

    if (body.mustScore !== undefined) data.mustScore = body.mustScore != null ? Number(body.mustScore) : null;
    if (body.mnaScore !== undefined) data.mnaScore = body.mnaScore != null ? Number(body.mnaScore) : null;
    if (body.height !== undefined || body.weight !== undefined) {
      const h = (body.height !== undefined ? Number(body.height) : Number(existing.height) ?? 0) / 100;
      const w = body.weight !== undefined ? Number(body.weight) : Number(existing.weight) ?? 0;
      if (body.height !== undefined) data.height = Number(body.height);
      if (body.weight !== undefined) data.weight = w;
      if (h > 0 && w > 0) data.bmi = Number((w / (h * h)).toFixed(1));
    }
    if (body.idealWeight !== undefined) data.idealWeight = body.idealWeight != null ? Number(body.idealWeight) : null;
    if (body.weightChangePct !== undefined) data.weightChangePct = body.weightChangePct != null ? Number(body.weightChangePct) : null;
    if (body.appetiteStatus !== undefined) data.appetiteStatus = body.appetiteStatus;
    if (body.swallowingStatus !== undefined) data.swallowingStatus = body.swallowingStatus;
    if (body.dietaryHistory !== undefined) data.dietaryHistory = body.dietaryHistory;
    if (body.foodAllergies !== undefined) data.foodAllergies = body.foodAllergies;
    if (body.route !== undefined) data.route = body.route;
    if (body.caloricNeed !== undefined) data.caloricNeed = body.caloricNeed != null ? Number(body.caloricNeed) : null;
    if (body.proteinNeed !== undefined) data.proteinNeed = body.proteinNeed != null ? Number(body.proteinNeed) : null;
    if (body.fluidNeed !== undefined) data.fluidNeed = body.fluidNeed != null ? Number(body.fluidNeed) : null;
    if (body.recommendations !== undefined) data.recommendations = body.recommendations;
    if (body.followUpDate !== undefined) data.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null;
    if (body.assessmentDate !== undefined) data.assessmentDate = new Date(body.assessmentDate);

    const assessment = await prisma.nutritionalAssessment.update({ where: { id }, data });
    return NextResponse.json({ assessment });
  } catch (e) {
    logger.error('[NUTRITION/:id PUT] Failed to update nutritional assessment', { category: 'api', error: e instanceof Error ? e : undefined });
    return NextResponse.json({ error: 'Failed to update nutritional assessment' }, { status: 500 });
  }
}, { permissionKey: 'ipd.view' });
