import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

/* ------------------------------------------------------------------ */
/*  GET /api/psychiatry/restraints — list restraint logs              */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const interventionType = url.searchParams.get('interventionType') || undefined;
    const patientMasterId = url.searchParams.get('patientMasterId') || undefined;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (interventionType) where.interventionType = interventionType;
    if (patientMasterId) where.patientMasterId = patientMasterId;

    const restraints = await (prisma as Record<string, any>).psychRestraintLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ restraints });
  }),
  { permissionKey: 'psychiatry.view' },
);

/* ------------------------------------------------------------------ */
/*  POST /api/psychiatry/restraints — create new restraint log        */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }) => {
    const body = await req.json();

    if (!body.patientMasterId || !body.interventionType || !body.reason) {
      return NextResponse.json(
        { error: 'patientMasterId, interventionType, and reason are required' },
        { status: 400 },
      );
    }

    const now = new Date();

    const restraint = await (prisma as Record<string, any>).psychRestraintLog.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        encounterId: body.encounterId || null,
        orderedByUserId: userId,
        orderedByName: user?.name || null,
        orderedAt: now,
        orderExpiry: body.orderExpiry ? new Date(body.orderExpiry) : null,
        interventionType: body.interventionType,
        restraintType: body.restraintType || null,
        seclusionRoom: body.seclusionRoom || null,
        reason: body.reason,
        behaviorDescription: body.behaviorDescription || null,
        alternativesAttempted: body.alternativesAttempted || null,
        startedAt: now,
        monitoringFreqMin: body.monitoringFreqMin ?? 15,
        monitoringChecks: [],
        status: 'ACTIVE',
      },
    });

    logger.info('Restraint log created', { tenantId, category: 'clinical', route: '/api/psychiatry/restraints' });

    return NextResponse.json({ restraint }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);
