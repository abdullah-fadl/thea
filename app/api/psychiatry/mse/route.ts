import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

/* ------------------------------------------------------------------ */
/*  GET /api/psychiatry/mse — list mental status exams                 */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const url = new URL(req.url);
    const patientMasterId = url.searchParams.get('patientMasterId') || undefined;

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;

    const exams = await (prisma as Record<string, any>).psychMentalStatusExam.findMany({
      where,
      orderBy: { assessedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ exams });
  }),
  { permissionKey: 'psychiatry.view' },
);

/* ------------------------------------------------------------------ */
/*  POST /api/psychiatry/mse — create new MSE                         */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }) => {
    const body = await req.json();

    if (!body.patientMasterId) {
      return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
    }

    const exam = await (prisma as Record<string, any>).psychMentalStatusExam.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        encounterId: body.encounterId || null,
        assessedByUserId: userId,
        assessedByName: user?.name || null,
        assessedAt: new Date(),
        // Appearance
        appearance: body.appearance || null,
        // Behavior
        behavior: body.behavior || null,
        // Speech
        speech: body.speech || null,
        // Mood & Affect
        moodReported: body.moodReported || null,
        affectObserved: body.affectObserved || null,
        affectCongruence: body.affectCongruence || null,
        affectRange: body.affectRange || null,
        // Thought Process
        thoughtProcess: body.thoughtProcess || null,
        // Thought Content
        thoughtContent: body.thoughtContent || null,
        delusionType: body.delusionType || null,
        // Perceptions
        perceptions: body.perceptions || null,
        // Cognition
        cognition: body.cognition || null,
        mmseScore: body.mmseScore ?? null,
        mocaScore: body.mocaScore ?? null,
        // Insight & Judgment
        insight: body.insight || null,
        judgment: body.judgment || null,
        // Reliability
        reliability: body.reliability || null,
        // Summary
        summary: body.summary || null,
        clinicalImpression: body.clinicalImpression || null,
        notes: body.notes || null,
      },
    });

    logger.info('MSE created', { tenantId, category: 'clinical', route: '/api/psychiatry/mse' });

    return NextResponse.json({ exam }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);
