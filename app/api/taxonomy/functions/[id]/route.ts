import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { requireTenantId } from '@/lib/tenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { withErrorHandler } from '@/lib/core/errors';

/**
 * DELETE /api/taxonomy/functions/[id]
 * Delete (soft delete) a function
 */
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Function ID is required' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId) });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const existing = await prisma.taxonomyFunction.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Function not found' }, { status: 404 });
    }

    await prisma.taxonomyFunction.update({
      where: { id: existing.id },
      data: { isActive: false, updatedBy: authResult.userId },
    });

    return NextResponse.json({ success: true });
});
