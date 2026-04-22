import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }, params?: unknown) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const patient = await prisma.oncologyPatient.findFirst({
      where: { id, tenantId },
      include: { protocols: true, cycles: { orderBy: { cycleNumber: 'asc' } } },
    });
    if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ patient });
  }),
  { permissionKey: 'oncology.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }, params?: unknown) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const existing = await prisma.oncologyPatient.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await prisma.oncologyPatient.update({
      where: { id },
      data: {
        diagnosis: body.diagnosis ?? existing.diagnosis,
        stage: body.stage ?? existing.stage,
        ecogStatus: body.ecogStatus != null ? Number(body.ecogStatus) : existing.ecogStatus,
        status: body.status ?? existing.status,
        notes: body.notes ?? existing.notes,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ patient: updated });
  }),
  { permissionKey: 'oncology.manage' },
);
