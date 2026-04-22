import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');
    const where: any = { tenantId };
    if (patientId) where.patientId = patientId;
    const cycles = await prisma.chemoCycle.findMany({
      where,
      orderBy: [{ patientId: 'asc' }, { cycleNumber: 'asc' }],
      take: 200,
    });
    return NextResponse.json({ cycles });
  }),
  { permissionKey: 'oncology.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    const cycle = await prisma.chemoCycle.create({
      data: {
        tenantId,
        patientId: body.patientId,
        cycleNumber: Number(body.cycleNumber),
        protocolName: body.protocolName,
        scheduledDate: new Date(body.scheduledDate),
        drugs: body.drugs ?? [],
        premedications: body.premedications ?? null,
        bsa: body.bsa ? Number(body.bsa) : null,
        weight: body.weight ? Number(body.weight) : null,
        administeredBy: body.administeredBy || userId,
      },
    });
    return NextResponse.json({ cycle }, { status: 201 });
  }),
  { permissionKey: 'oncology.manage' },
);
