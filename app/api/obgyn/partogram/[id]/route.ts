import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const partogram = await prisma.partogram.findFirst({
      where: { id, tenantId },
      include: { observations: { orderBy: { observedAt: 'asc' } } },
    });
    if (!partogram) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ partogram });
  }),
  { permissionKey: 'obgyn.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const existing = await prisma.partogram.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await prisma.partogram.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        deliveryTime: body.deliveryTime ? new Date(body.deliveryTime) : existing.deliveryTime,
        deliveryMode: body.deliveryMode ?? existing.deliveryMode,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ partogram: updated });
  }),
  { permissionKey: 'obgyn.manage' },
);
