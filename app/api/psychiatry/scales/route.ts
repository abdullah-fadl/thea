import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { scoreScale, getScaleDefinition, SCALE_KEYS } from '@/lib/psychiatry/scaleDefinitions';

/* ------------------------------------------------------------------ */
/*  GET /api/psychiatry/scales — list scale administrations             */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const url = new URL(req.url);
    const patientMasterId = url.searchParams.get('patientMasterId') || undefined;
    const scaleType = url.searchParams.get('scaleType') || undefined;
    const status = url.searchParams.get('status') || undefined;

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (scaleType) where.scaleType = scaleType.toUpperCase();
    if (status) where.status = status;

    const administrations = await (prisma as Record<string, any>).psychScaleAdministration.findMany({
      where,
      orderBy: { administeredAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ administrations });
  }),
  { permissionKey: 'psychiatry.view' },
);

/* ------------------------------------------------------------------ */
/*  POST /api/psychiatry/scales — create new scale administration       */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (
    req: NextRequest,
    { tenantId, userId, user }: { tenantId: string; userId: string; user: any },
  ) => {
    const body = await req.json();

    // ---- Validation ----
    if (!body.patientMasterId) {
      return NextResponse.json(
        { error: 'patientMasterId is required' },
        { status: 400 },
      );
    }

    if (!body.scaleType) {
      return NextResponse.json(
        { error: 'scaleType is required' },
        { status: 400 },
      );
    }

    const scaleTypeUpper = String(body.scaleType).toUpperCase();
    const definition = getScaleDefinition(scaleTypeUpper);
    if (!definition) {
      return NextResponse.json(
        { error: `Invalid scaleType. Must be one of: ${SCALE_KEYS.join(', ')}` },
        { status: 400 },
      );
    }

    if (!body.responses || !Array.isArray(body.responses)) {
      return NextResponse.json(
        { error: 'responses must be an array of item responses' },
        { status: 400 },
      );
    }

    // Extract numeric response values for scoring
    const responseValues: number[] = body.responses.map((r: any) => {
      if (typeof r === 'number') return r;
      if (typeof r === 'object' && r !== null && typeof r.responseValue === 'number') return r.responseValue;
      return 0;
    });

    // Validate response count matches expected items
    if (responseValues.length !== definition.items.length) {
      return NextResponse.json(
        {
          error: `Expected ${definition.items.length} responses for ${scaleTypeUpper}, received ${responseValues.length}`,
        },
        { status: 400 },
      );
    }

    // Validate each response is within valid range
    for (let i = 0; i < responseValues.length; i++) {
      const item = definition.items[i];
      const val = responseValues[i];
      if (val < item.minValue || val > item.maxValue) {
        return NextResponse.json(
          {
            error: `Item ${item.number} response (${val}) out of range [${item.minValue}-${item.maxValue}]`,
          },
          { status: 400 },
        );
      }
    }

    // ---- Auto-scoring ----
    const scoring = scoreScale(scaleTypeUpper, responseValues);
    if (!scoring) {
      return NextResponse.json(
        { error: 'Scoring failed for the given scale type' },
        { status: 500 },
      );
    }

    // Build structured response array with item text for audit trail
    const structuredResponses = definition.items.map((item, idx) => {
      const val = responseValues[idx];
      const option = item.options.find((o) => o.value === val);
      return {
        itemNumber: item.number,
        itemTextEn: item.textEn,
        itemTextAr: item.textAr,
        responseValue: val,
        responseLabelEn: option?.labelEn || String(val),
        responseLabelAr: option?.labelAr || String(val),
      };
    });

    // ---- Persist ----
    const administration = await (prisma as Record<string, any>).psychScaleAdministration.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        encounterId: body.encounterId || null,
        administeredByUserId: userId,
        administeredByName: user?.name || null,
        administeredAt: new Date(),
        // Scale identification
        scaleType: scaleTypeUpper,
        scaleName: definition.nameEn,
        scaleVersion: body.scaleVersion || null,
        // Responses & scoring
        responses: structuredResponses,
        totalScore: scoring.totalScore,
        subscaleScores: scoring.subscaleScores || null,
        // Interpretation
        severityLevel: scoring.severityLevel,
        severityLabel: scoring.severityLabel,
        interpretation: body.interpretation || null,
        // Clinical context
        clinicianNotes: body.clinicianNotes || null,
        treatmentPlanId: body.treatmentPlanId || null,
        // Status
        status: 'COMPLETED',
      },
    });

    logger.info('Psych scale administration created', {
      tenantId,
      category: 'clinical',
      route: '/api/psychiatry/scales',
      scaleType: scaleTypeUpper,
      totalScore: scoring.totalScore,
      severityLevel: scoring.severityLevel,
    });

    return NextResponse.json(
      {
        administration,
        scoring: {
          totalScore: scoring.totalScore,
          severityLevel: scoring.severityLevel,
          severityLabel: scoring.severityLabel,
          severityLabelAr: scoring.severityLabelAr,
          subscaleScores: scoring.subscaleScores || null,
        },
      },
      { status: 201 },
    );
  }),
  { permissionKey: 'psychiatry.manage' },
);
