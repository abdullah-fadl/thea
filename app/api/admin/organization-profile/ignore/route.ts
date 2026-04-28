import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';

const ignoreSchema = z.object({
  suggestionId: z.string().min(1),
  suggestionType: z.enum(['ACCREDITATION', 'REQUIRED_DOCS', 'GLOSSARY', 'RULES']).optional(),
});

export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  try {
    const v = validateBody(await req.json(), ignoreSchema);
    if ('error' in v) return v.error;
    const body = v.data;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    await prisma.tenantContextOverlay.create({
      data: {
        tenantId: tenant.id,
        type: 'SUGGESTION_PREFS',
        payload: {
          suggestionId: body.suggestionId,
          suggestionType: body.suggestionType,
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to ignore suggestion' },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });
