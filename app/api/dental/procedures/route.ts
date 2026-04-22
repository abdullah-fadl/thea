import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');
    const where: any = { tenantId };
    if (patientId) where.patientId = patientId;
    const procedures = await prisma.dentalProcedure.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ procedures });
  }),
  { permissionKey: 'dental.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const procedure = await prisma.dentalProcedure.create({
      data: {
        tenantId,
        patientId: body.patientId,
        treatmentId: body.treatmentId || null,
        toothNumber: body.toothNumber,
        surface: body.surface || null,
        procedureCode: body.procedureCode || null,
        procedureName: body.procedureName,
        procedureNameAr: body.procedureNameAr || null,
        anesthesiaType: body.anesthesiaType || null,
        duration: body.duration != null ? Number(body.duration) : null,
        materials: body.materials ?? null,
        performedBy: body.performedBy || userId,
        performedAt: body.performedAt ? new Date(body.performedAt) : new Date(),
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ procedure }, { status: 201 });
  }),
  { permissionKey: 'dental.manage' },
);
