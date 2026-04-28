import { NextRequest, NextResponse } from 'next/server';
import { withTenantOwner } from '@/lib/core/guards/withTenantOwner';
import { prisma } from '@/lib/db/prisma';

/**
 * PATCH /api/tenant-owner/hospitals/[hospitalId]/entitlements
 * Update platform entitlements for one hospital under the caller's tenant.
 * Uses the Phase 2.1 HospitalEntitlement model (upsert).
 *
 * Body: { entitlementSam?, entitlementHealth?, entitlementEdrac?, entitlementCvision?, entitlementImdad? }
 * Response: 200 { hospitalId, ...flags }
 */
export const PATCH = withTenantOwner(
  async (req, { tenantId, userId }, params) => {
    const hospitalId = String((params as Record<string, string>)?.hospitalId ?? '');
    if (!hospitalId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'hospitalId param missing' },
        { status: 400 },
      );
    }

    // Verify hospital belongs to caller's tenant (cross-tenant guard)
    const hospital = await prisma.hospital.findFirst({
      where: { id: hospitalId, tenantId },
      select: { id: true },
    });
    if (!hospital) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Hospital not found in this tenant' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const flags: Record<string, boolean | null> = {};
    const boolFields = [
      'entitlementSam',
      'entitlementHealth',
      'entitlementEdrac',
      'entitlementCvision',
      'entitlementImdad',
    ] as const;

    for (const field of boolFields) {
      if (field in body) {
        flags[field] = body[field] === null ? null : Boolean(body[field]);
      }
    }

    const entitlement = await (prisma as any).hospitalEntitlement.upsert({
      where: { hospitalId },
      create: { hospitalId, tenantId, ...flags, updatedBy: userId },
      update: { ...flags, updatedBy: userId },
      select: {
        hospitalId: true,
        entitlementSam: true,
        entitlementHealth: true,
        entitlementEdrac: true,
        entitlementCvision: true,
        entitlementImdad: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(entitlement);
  },
);
