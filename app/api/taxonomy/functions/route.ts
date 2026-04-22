import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { requireTenantId } from '@/lib/tenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const createFunctionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  code: z.string().optional(),
}).passthrough();

/**
 * GET /api/taxonomy/functions
 * List all functions
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId) });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const functions = await prisma.taxonomyFunction.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: functions });
});

/**
 * POST /api/taxonomy/functions
 * Create a new function
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const body = await request.json();
    const v = validateBody(body, createFunctionSchema);
    if ('error' in v) return v.error;
    const { name, description, code } = v.data;

    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId) });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const nameConditions: any[] = [
      { name: { equals: name.trim(), mode: 'insensitive' } },
    ];
    if (code) {
      nameConditions.push({ code: { equals: code, mode: 'insensitive' } });
    }

    const existing = await prisma.taxonomyFunction.findFirst({
      where: { tenantId: tenant.id, isActive: true, OR: nameConditions },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Function with this name or code already exists' },
        { status: 409 }
      );
    }

    const func = await prisma.taxonomyFunction.create({
      data: {
        tenantId: tenant.id,
        name: name.trim(),
        code: code?.trim() || name.trim().toUpperCase().replace(/\s+/g, '_'),
        description: description?.trim() || '',
        isActive: true,
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      },
    });

    return NextResponse.json({ success: true, data: func }, { status: 201 });
});
