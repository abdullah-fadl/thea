import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validateBody } from '@/lib/validation/helpers';
import { updateOwnerIntegrationsSchema } from '@/lib/validation/owner.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/owner/tenants/[tenantId]/integrations
 * Update tenant integration settings (owner only)
 */
export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantIdParam = resolvedParams.tenantId;

    const body = await request.json();
    const v = validateBody(body, updateOwnerIntegrationsSchema);
    if ('error' in v) return v.error;

    const { samHealth } = v.data;

    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantIdParam) });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const currentIntegrations = (tenant.integrations as Record<string, unknown>) || {};
    const updatedIntegrations = {
      ...currentIntegrations,
      ...(samHealth ? { samHealth } : {}),
    };

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        integrations: updatedIntegrations as Prisma.InputJsonValue,
        updatedBy: userId,
      },
    });

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    });
});
