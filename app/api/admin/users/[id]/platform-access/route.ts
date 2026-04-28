import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/security/auth';
import { validateBody } from '@/lib/validation/helpers';
import { platformAccessSchema } from '@/lib/validation/admin.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/users/[id]/platform-access
 * Update user platform access (admin only)
 *
 * Body: { sam?, health?, edrac?, cvision? }
 */
export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) => {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Authorization - only admin users
    const authorized = await requireRole(request, ['admin']);
    if (authorized instanceof NextResponse) {
      return authorized;
    }

    const { tenantId, userId: adminUserId } = authorized;

    // Get user ID from params (handle both Promise and direct object)
    const resolvedParams = params instanceof Promise ? await params : params;
    const targetUserId = resolvedParams.id;

    logger.info('Updating user platform access', { category: 'api', route: 'PATCH /api/admin/users/[id]/platform-access', targetUserId, tenantId, userId: adminUserId });

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const v = validateBody(body, platformAccessSchema);
    if ('error' in v) return v.error;

    const platformAccess = v.data;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Get user (tenant-safe)
    const user = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId: tenant.id },
    });

    logger.debug('User lookup result', { category: 'api', route: 'PATCH /api/admin/users/[id]/platform-access', targetUserId, tenantId, found: !!user });

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found',
          details: `User ${targetUserId} not found in tenant ${tenantId}`
        },
        { status: 404 }
      );
    }

    // Build update data for platform access
    const updateData: any = {
      updatedBy: adminUserId,
    };

    // Explicitly set each platform access value (including false)
    if (platformAccess.sam !== undefined) {
      updateData.platformAccessSam = platformAccess.sam;
    }
    if (platformAccess.health !== undefined) {
      updateData.platformAccessHealth = platformAccess.health;
    }
    if (platformAccess.edrac !== undefined) {
      updateData.platformAccessEdrac = platformAccess.edrac;
    }
    if (platformAccess.cvision !== undefined) {
      updateData.platformAccessCvision = platformAccess.cvision;
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        platformAccessSam: true,
        platformAccessHealth: true,
        platformAccessEdrac: true,
        platformAccessCvision: true,
      },
    });

    logger.info('Platform access update result', { category: 'api', route: 'PATCH /api/admin/users/[id]/platform-access', targetUserId, tenantId });

    await createAuditLog(
      'user',
      targetUserId,
      'USER_PLATFORM_ACCESS_UPDATED',
      adminUserId || 'system',
      undefined,
      {
        targetUserId,
        platformAccess,
      },
      tenantId
    );

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      platformAccess: {
        sam: updatedUser.platformAccessSam,
        health: updatedUser.platformAccessHealth,
        edrac: updatedUser.platformAccessEdrac,
        cvision: updatedUser.platformAccessCvision,
      },
      message: 'Platform access updated. User must log out and log back in for changes to take effect.',
    });
});
