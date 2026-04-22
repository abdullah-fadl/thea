import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// PATCH — update bed (label, ward, room, unit, isActive)
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const bedId = String((params as Record<string, unknown>)?.bedId || '').trim();
    if (!bedId) return NextResponse.json({ error: 'bedId required' }, { status: 400 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const existing = await prisma.ipdBed.findFirst({ where: { id: bedId, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Bed not found' }, { status: 404 });

    const updated = await prisma.ipdBed.update({
      where: { id: bedId },
      data: {
        ...(body.bedLabel !== undefined ? { bedLabel: String(body.bedLabel).trim() } : {}),
        ...(body.ward !== undefined ? { ward: body.ward ? String(body.ward).trim() : null } : {}),
        ...(body.room !== undefined ? { room: body.room ? String(body.room).trim() : null } : {}),
        ...(body.unit !== undefined ? { unit: body.unit ? String(body.unit).trim() : null } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      },
    });

    return NextResponse.json({ bed: updated });
  }),
  { tenantScoped: true, permissionKey: 'ipd.admin.edit' }
);

// DELETE — soft-deactivate (set isActive = false)
export const DELETE = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const bedId = String((params as Record<string, unknown>)?.bedId || '').trim();
    if (!bedId) return NextResponse.json({ error: 'bedId required' }, { status: 400 });

    const existing = await prisma.ipdBed.findFirst({ where: { id: bedId, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Bed not found' }, { status: 404 });

    await prisma.ipdBed.update({ where: { id: bedId }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  }),
  { tenantScoped: true, permissionKey: 'ipd.admin.edit' }
);
