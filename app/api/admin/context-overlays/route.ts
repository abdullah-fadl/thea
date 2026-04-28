import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { OVERLAY_TYPES } from '@/lib/sam/tenantContext';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const overlaySchema = z.object({
  type: z.enum(OVERLAY_TYPES as [string, ...string[]]),
  payload: z.record(z.string(), z.any()),
});

export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, overlaySchema);
    if ('error' in v) return v.error;
    const { type, payload } = v.data;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const overlay = await prisma.tenantContextOverlay.create({
      data: {
        tenantId: tenant.id,
        type,
        payload: payload as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });

    return NextResponse.json({ success: true, data: overlay });
  } catch (error: any) {
    logger.error('Context overlay create error', { category: 'api', route: 'POST /api/admin/context-overlays', error });
    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to add overlay' },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });

export const DELETE = withAuthTenant(async (req, { tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Overlay id is required' }, { status: 400 });
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const existing = await prisma.tenantContextOverlay.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Overlay not found' }, { status: 404 });
    }

    await prisma.tenantContextOverlay.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Context overlay delete error', { category: 'api', route: 'DELETE /api/admin/context-overlays', error });
    return NextResponse.json(
      { error: 'Failed to remove overlay' },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });
