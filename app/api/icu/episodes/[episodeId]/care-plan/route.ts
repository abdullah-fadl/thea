import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) return NextResponse.json({ error: 'Missing episodeId' }, { status: 400 });
    const plans = await prisma.icuCarePlan.findMany({
      where: { episodeId, tenantId },
      orderBy: { date: 'desc' },
      take: 30,
    });
    return NextResponse.json({ plans });
  }),
  { permissionKey: 'ipd.nursing.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) return NextResponse.json({ error: 'Missing episodeId' }, { status: 400 });
    const body = await req.json();
    const plan = await prisma.icuCarePlan.create({
      data: {
        tenantId,
        episodeId,
        date: body.date ? new Date(body.date) : new Date(),
        shift: body.shift || 'MORNING',
        nurseId: body.nurseId || userId,
        dailyGoals: body.dailyGoals ?? [],
        careBundle: body.careBundle ?? null,
        sedationLevel: body.sedationLevel || null,
        painScore: body.painScore != null ? Number(body.painScore) : null,
        deliriumScreen: body.deliriumScreen || null,
        mobilityGoal: body.mobilityGoal || null,
        nutritionStatus: body.nutritionStatus || null,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ plan }, { status: 201 });
  }),
  { permissionKey: 'ipd.nursing.write' },
);
