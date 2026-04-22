import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }, params?: unknown) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const tc = await prisma.transplantCase.findFirst({
      where: { id, tenantId },
      include: {
        followUps: { orderBy: { visitDate: 'desc' } },
        rejectionEpisodes: { orderBy: { onsetDate: 'desc' } },
      },
    });
    if (!tc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ case: tc });
  }),
  { permissionKey: 'transplant.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }, params?: unknown) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const existing = await prisma.transplantCase.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await prisma.transplantCase.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        transplantDate: body.transplantDate ? new Date(body.transplantDate) : existing.transplantDate,
        crossmatchResult: body.crossmatchResult ?? existing.crossmatchResult,
        coldIschemiaTime: body.coldIschemiaTime != null ? Number(body.coldIschemiaTime) : existing.coldIschemiaTime,
        notes: body.notes ?? existing.notes,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ case: updated });
  }),
  { permissionKey: 'transplant.manage' },
);
