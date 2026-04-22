import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');
    const where: any = { tenantId };
    if (patientId) where.patientMasterId = patientId;
    if (status) where.status = status;
    const partograms = await prisma.partogram.findMany({
      where,
      orderBy: { admissionTime: 'desc' },
      take: 50,
    });
    return NextResponse.json({ partograms });
  }),
  { permissionKey: 'obgyn.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();
    const partogram = await prisma.partogram.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        admissionTime: new Date(body.admissionTime || Date.now()),
        gestationalAge: body.gestationalAge != null ? Number(body.gestationalAge) : null,
        gravidaPara: body.gravidaPara || null,
        membraneStatus: body.membraneStatus || null,
        ruptureTime: body.ruptureTime ? new Date(body.ruptureTime) : null,
        cervixOnAdmission: body.cervixOnAdmission != null ? Number(body.cervixOnAdmission) : null,
        presentingPart: body.presentingPart || null,
        fetalPosition: body.fetalPosition || null,
      },
    });
    return NextResponse.json({ partogram }, { status: 201 });
  }),
  { permissionKey: 'obgyn.manage' },
);
