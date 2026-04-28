import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

/* ------------------------------------------------------------------ */
/*  GET /api/psychiatry/risk-assessment — list risk assessments        */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const url = new URL(req.url);
    const patientMasterId = url.searchParams.get('patientMasterId') || undefined;
    const overallRiskLevel = url.searchParams.get('overallRiskLevel') || undefined;
    const assessmentType = url.searchParams.get('assessmentType') || undefined;

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (overallRiskLevel) where.overallRiskLevel = overallRiskLevel;
    if (assessmentType) where.assessmentType = assessmentType;

    const assessments = await (prisma as Record<string, any>).psychRiskAssessment.findMany({
      where,
      orderBy: { assessedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ assessments });
  }),
  { permissionKey: 'psychiatry.view' },
);

/* ------------------------------------------------------------------ */
/*  POST /api/psychiatry/risk-assessment — create risk assessment      */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }) => {
    const body = await req.json();

    if (!body.patientMasterId || !body.assessmentType) {
      return NextResponse.json(
        { error: 'patientMasterId and assessmentType are required' },
        { status: 400 },
      );
    }

    // Auto-calculate Broset score
    let brosetScore: number | null = null;
    if (
      body.brosetConfusion !== undefined ||
      body.brosetIrritability !== undefined ||
      body.brosetBoisterousness !== undefined ||
      body.brosetVerbalThreats !== undefined ||
      body.brosetPhysicalThreats !== undefined ||
      body.brosetAttackObjects !== undefined
    ) {
      brosetScore =
        (body.brosetConfusion ? 1 : 0) +
        (body.brosetIrritability ? 1 : 0) +
        (body.brosetBoisterousness ? 1 : 0) +
        (body.brosetVerbalThreats ? 1 : 0) +
        (body.brosetPhysicalThreats ? 1 : 0) +
        (body.brosetAttackObjects ? 1 : 0);
    }

    const assessment = await (prisma as Record<string, any>).psychRiskAssessment.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        encounterId: body.encounterId || null,
        assessedByUserId: userId,
        assessedByName: user?.name || null,
        assessedAt: new Date(),
        assessmentType: body.assessmentType,
        // C-SSRS
        suicideIdeation: body.suicideIdeation ?? null,
        ideationType: body.ideationType || null,
        ideationIntensity: body.ideationIntensity ?? null,
        suicideBehavior: body.suicideBehavior ?? null,
        behaviorType: body.behaviorType || null,
        nonSuicidalSelfInjury: body.nonSuicidalSelfInjury ?? null,
        // PHQ-9
        phq9Score: body.phq9Score ?? null,
        phq9Item9: body.phq9Item9 ?? null,
        // Broset
        brosetConfusion: body.brosetConfusion ?? null,
        brosetIrritability: body.brosetIrritability ?? null,
        brosetBoisterousness: body.brosetBoisterousness ?? null,
        brosetVerbalThreats: body.brosetVerbalThreats ?? null,
        brosetPhysicalThreats: body.brosetPhysicalThreats ?? null,
        brosetAttackObjects: body.brosetAttackObjects ?? null,
        brosetScore: brosetScore,
        // Factors
        staticFactors: body.staticFactors || null,
        dynamicFactors: body.dynamicFactors || null,
        protectiveFactors: body.protectiveFactors || null,
        // Risk levels
        suicideRiskLevel: body.suicideRiskLevel || null,
        violenceRiskLevel: body.violenceRiskLevel || null,
        overallRiskLevel: body.overallRiskLevel || null,
        // Safety plan
        safetyPlanCreated: body.safetyPlanCreated ?? false,
        safetyPlan: body.safetyPlan || null,
        // Interventions
        interventions: body.interventions || null,
        dispositionPlan: body.dispositionPlan || null,
        supervisionLevel: body.supervisionLevel || null,
        environmentalSafety: body.environmentalSafety ?? null,
        // Follow-up
        reassessmentDue: body.reassessmentDue ? new Date(body.reassessmentDue) : null,
        notes: body.notes || null,
      },
    });

    logger.info('Risk assessment created', { tenantId, category: 'clinical', route: '/api/psychiatry/risk-assessment' });

    return NextResponse.json({ assessment }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);
