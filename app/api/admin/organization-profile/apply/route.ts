import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';

const applySchema = z.object({
  suggestionId: z.string().min(1),
  type: z.enum(['ACCREDITATION', 'REQUIRED_DOCS', 'GLOSSARY', 'RULES']),
  payload: z.record(z.string(), z.any()),
});

export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  try {
    const v = validateBody(await req.json(), applySchema);
    if ('error' in v) return v.error;
    const body = v.data;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    await prisma.tenantContextOverlay.create({
      data: {
        tenantId: tenant.id,
        type: body.type,
        payload: {
          ...body.payload,
          suggestionId: body.suggestionId,
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to apply suggestion' },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });
