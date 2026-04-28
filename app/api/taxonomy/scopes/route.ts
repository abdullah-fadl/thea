import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { requireTenantId } from '@/lib/tenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const createScopeSchema = z.object({
  name: z.string().min(1),
}).passthrough();

export const GET = withErrorHandler(async (request: NextRequest) => {
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) return tenantIdResult;
    const tenantId = tenantIdResult;

    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId) });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const items = await prisma.taxonomyScope.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: items });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) return authResult;

    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) return tenantIdResult;
    const tenantId = tenantIdResult;

    const body = await request.json();
    const v = validateBody(body, createScopeSchema);
    if ('error' in v) return v.error;
    const { name } = v.data;

    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId) });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const existing = await prisma.taxonomyScope.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true,
        name: { equals: name.trim(), mode: 'insensitive' },
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'Scope with this name already exists' }, { status: 409 });
    }

    const item = await prisma.taxonomyScope.create({
      data: {
        tenantId: tenant.id,
        name: name.trim(),
        isActive: true,
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
});
