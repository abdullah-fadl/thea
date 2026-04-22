import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const cases = await prisma.transplantCase.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ cases });
  }),
  { permissionKey: 'transplant.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    const tc = await prisma.transplantCase.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        organType: body.organType,
        transplantType: body.transplantType || 'DECEASED_DONOR',
        surgeonId: body.surgeonId || userId,
        evaluationDate: body.evaluationDate ? new Date(body.evaluationDate) : null,
        pra: body.pra ? Number(body.pra) : null,
        hlaMatch: body.hlaMatch ?? null,
        notes: body.notes ?? null,
      },
    });
    return NextResponse.json({ case: tc }, { status: 201 });
  }),
  { permissionKey: 'transplant.manage' },
);
