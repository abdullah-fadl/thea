// =============================================================================
// Quality FMEA — List & Create
// GET  /api/quality/fmea
// POST /api/quality/fmea
// =============================================================================
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }: { tenantId: string }) => {
    const analyses = await prisma.fmeaAnalysis.findMany({
      where: { tenantId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ analyses });
  }),
  { permissionKey: 'quality.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    const analysis = await prisma.fmeaAnalysis.create({
      data: {
        tenantId,
        processName: body.processName,
        processScope: body.processScope ?? null,
        team: body.team ?? [],
        conductedDate: new Date(body.conductedDate ?? Date.now()),
        facilitatorId: body.facilitatorId ?? userId,
        summary: body.summary ?? null,
        createdByUserId: userId,
      },
    });
    return NextResponse.json({ analysis }, { status: 201 });
  }),
  { permissionKey: 'quality.manage' },
);
