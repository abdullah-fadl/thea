import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const episodeId = url.searchParams.get('episodeId') || undefined;

    const where: any = { tenantId };
    if (episodeId) {
      where.episodeId = episodeId;
    }

    const events = await (prisma as Record<string, any>).icuCodeBlue.findMany({
      where,
      orderBy: { codeCalledAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ events });
  }),
  { permissionKey: 'icu.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();

    const {
      episodeId,
      location,
      initialRhythm,
      teamLeader,
      cprProvider1,
      cprProvider2,
      airwayManager,
      medicationNurse,
      recorder,
    } = body;

    if (!location) {
      return NextResponse.json({ error: 'Missing location' }, { status: 400 });
    }

    const event = await (prisma as Record<string, any>).icuCodeBlue.create({
      data: {
        tenantId,
        episodeId: episodeId || null,
        codeCalledAt: new Date(),
        calledBy: userId,
        location,
        initialRhythm: initialRhythm || 'UNKNOWN',
        status: 'ACTIVE',
        outcome: null,
        teamLeader: teamLeader || null,
        cprProvider1: cprProvider1 || null,
        cprProvider2: cprProvider2 || null,
        airwayManager: airwayManager || null,
        medicationNurse: medicationNurse || null,
        recorder: recorder || null,
        timelineEvents: JSON.stringify([]),
        defibrillations: JSON.stringify([]),
        medications: JSON.stringify([]),
        airwayType: null,
        intubationTime: null,
        intubatedBy: null,
        roscTime: null,
        timeOfDeath: null,
        postRoscPlan: null,
        familyNotified: false,
        familyNotifiedAt: null,
        familyNotifiedBy: null,
        debriefDone: false,
        debriefNotes: null,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  }),
  { permissionKey: 'icu.view' },
);
