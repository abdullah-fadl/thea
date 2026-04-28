// =============================================================================
// Quality Sentinel Events — List & Create
// GET  /api/quality/sentinel-events
// POST /api/quality/sentinel-events
// =============================================================================
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }: { tenantId: string }) => {
    const events = await prisma.sentinelEvent.findMany({
      where: { tenantId },
      orderBy: { eventDate: 'desc' },
      take: 100,
    });
    return NextResponse.json({ events });
  }),
  { permissionKey: 'quality.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    if (!body.eventDate || !body.eventType || !body.description) {
      return NextResponse.json(
        { error: 'eventDate, eventType, and description are required' },
        { status: 400 },
      );
    }
    const event = await prisma.sentinelEvent.create({
      data: {
        tenantId,
        reportedBy: body.reportedBy ?? userId,
        reportDate: new Date(body.reportDate ?? Date.now()),
        eventDate: new Date(body.eventDate),
        eventType: body.eventType,
        description: body.description,
        patientMasterId: body.patientMasterId ?? null,
        immediateActions: body.immediateActions ?? null,
        jciCategory: body.jciCategory ?? null,
        createdByUserId: userId,
      },
    });
    return NextResponse.json({ event }, { status: 201 });
  }),
  { permissionKey: 'quality.manage' },
);
