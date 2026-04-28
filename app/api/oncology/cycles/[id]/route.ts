import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }, params?: unknown) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const cycle = await prisma.chemoCycle.findFirst({ where: { id, tenantId } });
    if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ cycle });
  }),
  { permissionKey: 'oncology.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }, params?: unknown) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const existing = await prisma.chemoCycle.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await prisma.chemoCycle.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        administeredDate: body.administeredDate ? new Date(body.administeredDate) : existing.administeredDate,
        toxicity: body.toxicity ?? existing.toxicity,
        vitals: body.vitals ?? existing.vitals,
        notes: body.notes ?? existing.notes,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ cycle: updated });
  }),
  { permissionKey: 'oncology.manage' },
);
