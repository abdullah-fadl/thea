import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const cases = await prisma.tumorBoardCase.findMany({
      where: { tenantId },
      orderBy: { caseDate: 'desc' },
      take: 50,
    });
    return NextResponse.json({ cases });
  }),
  { permissionKey: 'oncology.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    const tbc = await prisma.tumorBoardCase.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        caseDate: new Date(body.caseDate),
        presentedBy: body.presentedBy || userId,
        attendees: body.attendees ?? [],
        clinicalSummary: body.clinicalSummary,
        imagingFindings: body.imagingFindings ?? null,
        pathologyFindings: body.pathologyFindings ?? null,
        discussion: body.discussion ?? null,
        recommendation: body.recommendation,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
      },
    });
    return NextResponse.json({ case: tbc }, { status: 201 });
  }),
  { permissionKey: 'oncology.manage' },
);
