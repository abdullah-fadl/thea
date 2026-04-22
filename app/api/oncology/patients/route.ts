import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const where: any = { tenantId };
    if (status) where.status = status;
    const patients = await prisma.oncologyPatient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ patients });
  }),
  { permissionKey: 'oncology.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    const patient = await prisma.oncologyPatient.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        diagnosis: body.diagnosis,
        icdCode: body.icdCode ?? null,
        stage: body.stage ?? null,
        histology: body.histology ?? null,
        primarySite: body.primarySite ?? null,
        diagnosisDate: body.diagnosisDate ? new Date(body.diagnosisDate) : null,
        ecogStatus: body.ecogStatus != null ? Number(body.ecogStatus) : null,
        oncologistId: body.oncologistId || userId,
        notes: body.notes ?? null,
      },
    });
    return NextResponse.json({ patient }, { status: 201 });
  }),
  { permissionKey: 'oncology.manage' },
);
