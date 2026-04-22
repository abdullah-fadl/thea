import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ------------------------------------------------------------------ */
/*  GET  /api/icu/episodes/[episodeId]/sedation                       */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
    }

    const assessments = await (prisma as Record<string, any>).icuSedationAssessment.findMany({
      where: { tenantId, episodeId },
      orderBy: { assessedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ assessments });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' },
);

/* ------------------------------------------------------------------ */
/*  POST  /api/icu/episodes/[episodeId]/sedation                      */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
    }

    const body = await req.json();

    const scaleType = body.scaleType || 'RASS'; // RASS | SAS
    const score = Number(body.score ?? 0);
    const targetScore = body.targetScore != null ? Number(body.targetScore) : null;
    const onTarget = targetScore != null ? score === targetScore : null;

    const assessment = await (prisma as Record<string, any>).icuSedationAssessment.create({
      data: {
        tenantId,
        episodeId,
        assessedAt: new Date(),
        assessedBy: body.assessedBy || userId,
        scaleType,
        score,
        targetScore,
        onTarget,
        painScore: body.painScore != null ? Number(body.painScore) : null,
        painTool: body.painTool || null,
        sedationDrugs: body.sedationDrugs || [],
        interventions: body.interventions || [],
        notes: body.notes || null,
      },
    });

    return NextResponse.json({ assessment }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' },
);
