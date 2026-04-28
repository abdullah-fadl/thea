import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validateBody } from '@/lib/validation/helpers';
import { updateEntitlementsSchema } from '@/lib/validation/owner.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/owner/tenants/[tenantId]/entitlements
 * Update tenant entitlements (owner only)
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
    const v = validateBody(body, updateEntitlementsSchema);
    if ('error' in v) return v.error;

    const { entitlements } = v.data;

    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantIdParam),
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        entitlementSam: entitlements.sam ?? tenant.entitlementSam,
        entitlementHealth: entitlements.health ?? tenant.entitlementHealth,
        entitlementEdrac: entitlements.edrac ?? tenant.entitlementEdrac,
        entitlementCvision: entitlements.cvision ?? tenant.entitlementCvision,
        entitlementScm: entitlements.imdad ?? (tenant as any).entitlementScm,
        updatedBy: userId,
      },
    });

    // Sync subscription contract so checkSubscription() and other code see the same entitlements
    const sam = entitlements.sam ?? tenant.entitlementSam;
    const health = entitlements.health ?? tenant.entitlementHealth;
    const edrac = entitlements.edrac ?? tenant.entitlementEdrac;
    const cvision = entitlements.cvision ?? tenant.entitlementCvision;
    const imdad = entitlements.imdad ?? (tenant as any).entitlementScm;
    await prisma.subscriptionContract.updateMany({
      where: { tenantId: tenant.id },
      data: {
        enabledSam: sam ?? false,
        enabledTheaHealth: health ?? false,
        enabledEdrac: edrac ?? false,
        enabledCvision: cvision ?? false,
        enabledImdad: imdad ?? false,
      },
    });

    return NextResponse.json({
      success: true,
      tenant: {
        ...updatedTenant,
        entitlements: {
          sam: updatedTenant.entitlementSam,
          health: updatedTenant.entitlementHealth,
          edrac: updatedTenant.entitlementEdrac,
          cvision: updatedTenant.entitlementCvision,
          imdad: (updatedTenant as any).entitlementScm,
        },
      },
    });
});

