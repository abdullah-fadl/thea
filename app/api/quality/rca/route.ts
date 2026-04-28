// =============================================================================
// Quality RCA — List & Create
// GET  /api/quality/rca
// POST /api/quality/rca
// =============================================================================
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }: { tenantId: string }) => {
    const analyses = await prisma.rcaAnalysis.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ analyses });
  }),
  { permissionKey: 'quality.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    const analysis = await prisma.rcaAnalysis.create({
      data: {
        tenantId,
        incidentId: body.incidentId ?? null,
        title: body.title,
        incidentDate: new Date(body.incidentDate ?? Date.now()),
        analysisDate: new Date(body.analysisDate ?? Date.now()),
        facilitatorId: body.facilitatorId ?? userId,
        teamMembers: body.teamMembers ?? [],
        problemStatement: body.problemStatement ?? '',
        timeline: body.timeline ?? null,
        fishbone: body.fishbone ?? null,
        whyChain: body.whyChain ?? null,
        rootCauses: body.rootCauses ?? [],
        contributingFactors: body.contributingFactors ?? null,
        recommendations: body.recommendations ?? [],
        lessonsLearned: body.lessonsLearned ?? null,
        createdByUserId: userId,
      },
    });
    return NextResponse.json({ analysis }, { status: 201 });
  }),
  { permissionKey: 'quality.manage' },
);
