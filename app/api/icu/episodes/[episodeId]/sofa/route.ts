import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) return NextResponse.json({ error: 'Missing episodeId' }, { status: 400 });
    const scores = await prisma.sofaScore.findMany({
      where: { episodeId, tenantId },
      orderBy: { scoredAt: 'desc' },
      take: 30,
    });
    return NextResponse.json({ scores });
  }),
  { permissionKey: 'ipd.nursing.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) return NextResponse.json({ error: 'Missing episodeId' }, { status: 400 });
    const body = await req.json();
    const respiratory = Number(body.respiratory || 0);
    const coagulation = Number(body.coagulation || 0);
    const liver = Number(body.liver || 0);
    const cardiovascular = Number(body.cardiovascular || 0);
    const cns = Number(body.cns || 0);
    const renal = Number(body.renal || 0);
    const totalScore = respiratory + coagulation + liver + cardiovascular + cns + renal;
    const score = await prisma.sofaScore.create({
      data: {
        tenantId,
        episodeId,
        scoredAt: new Date(),
        scoredBy: body.scoredBy || userId,
        respiratory,
        coagulation,
        liver,
        cardiovascular,
        cns,
        renal,
        totalScore,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ score }, { status: 201 });
  }),
  { permissionKey: 'ipd.nursing.write' },
);
