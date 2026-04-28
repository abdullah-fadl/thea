/**
 * IMDAD Dashboard — Enable Platform for Tenant
 *
 * POST /api/imdad/dashboard/enable-platform
 *
 * Sets enabledScm = true on the tenant's subscription contract.
 * Requires admin or owner role.
 * This is needed because the IMDAD dashboard APIs require the platform to be enabled
 * in the subscription contract, and it defaults to false.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const POST = withAuthTenant(
  async (_req, { tenantId, role }) => {
    const roleLower = String(role || '').toLowerCase();
    if (roleLower !== 'admin' && roleLower !== 'tenant-admin' && roleLower !== 'thea-owner') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only admin/owner can enable platforms' },
        { status: 403 },
      );
    }

    try {
      // Find the tenant record first
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { id: true },
      });

      if (!tenant) {
        // Try by tenantId field
        const tenantByKey = await prisma.tenant.findFirst({
          where: { tenantId },
          select: { id: true },
        });
        if (!tenantByKey) {
          return NextResponse.json(
            { error: 'Not Found', message: 'Tenant not found' },
            { status: 404 },
          );
        }
      }

      const effectiveTenantId = tenant?.id ?? tenantId;

      // Update subscription contract to enable SCM/IMDAD
      const updated = await prisma.subscriptionContract.updateMany({
        where: { tenantId: effectiveTenantId },
        data: { enabledScm: true } as any,
      });

      if (updated.count === 0) {
        // No contract exists — create one
        await prisma.subscriptionContract.create({
          data: {
            tenantId: effectiveTenantId,
            status: 'active',
            planType: 'enterprise',
            enabledSam: true,
            enabledTheaHealth: true,
            enabledCvision: false,
            enabledEdrac: false,
            enabledScm: true,
            maxUsers: 100,
            currentUsers: 0,
            enabledFeatures: {},
            storageLimit: BigInt(1000000000),
            aiQuota: { monthlyLimit: 1000, currentUsage: 0, resetDate: new Date() },
            subscriptionStartsAt: new Date(),
          } as any,
        });

        return NextResponse.json({
          message: 'IMDAD platform enabled (new subscription contract created)',
          tenantId: effectiveTenantId,
        });
      }

      return NextResponse.json({
        message: 'IMDAD platform enabled successfully',
        updated: updated.count,
        tenantId: effectiveTenantId,
      });
    } catch (err: any) {
      console.error('[IMDAD] enable-platform error:', err?.message || err);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: err?.message || 'Failed to enable IMDAD platform',
        },
        { status: 500 },
      );
    }
  },
  {
    tenantScoped: true,
    // No platformKey check — this route enables the platform
  },
);
