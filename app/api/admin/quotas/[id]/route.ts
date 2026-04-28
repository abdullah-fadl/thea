import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { updateQuotaSchema } from '@/lib/validation/admin.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/admin/quotas/[id]
 * Update quota (limit, status, endsAt)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(
    withErrorHandler(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    const groupId = user.groupId;

    // Authorization: Only admin and group-admin can update quotas
    if (!['admin', 'group-admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
    const { id } = paramsObj as { id: string };

    const body = await req.json();
    const v = validateBody(body, updateQuotaSchema);
    if ('error' in v) return v.error;
    const parsed = v.data;

    // Find quota with tenant isolation
    const quota = await prisma.usageQuota.findFirst({
      where: { tenantId, id },
    });

    if (!quota) {
      return NextResponse.json(
        { error: 'Quota not found' },
        { status: 404 }
      );
    }

    // Group admin can only update quotas for their group
    if (role === 'group-admin' && groupId) {
      if (quota.scopeType === 'group' && quota.scopeId !== groupId) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Group admin can only update quotas for their own group' },
          { status: 403 }
        );
      }
    }

    // Build update object
    const update: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (parsed.limit !== undefined && parsed.limit > 0) {
      update.limit = parsed.limit;
    }

    if (parsed.status !== undefined) {
      update.status = parsed.status;
      if (parsed.status === 'locked') {
        update.lockedAt = new Date();
      } else if (parsed.status === 'active') {
        update.lockedAt = null;
      }
    }

    if (parsed.endsAt !== undefined) {
      update.endsAt = parsed.endsAt ? new Date(parsed.endsAt) : null;
    }

    // Validation: After update, at least limit or endsAt must remain
    const willHaveLimit = (parsed.limit !== undefined && parsed.limit > 0) ||
                          (parsed.limit === undefined && quota.limit && quota.limit > 0 && quota.limit < 999999);
    const willHaveEndsAt = (parsed.endsAt !== undefined && parsed.endsAt !== null) ||
                            (parsed.endsAt === undefined && quota.endsAt);

    if (parsed.endsAt === null && !willHaveLimit) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Either limit or endsAt (or both) must be provided' },
        { status: 400 }
      );
    }

    if (parsed.limit !== undefined && parsed.limit <= 0 && !willHaveEndsAt) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Either limit or endsAt (or both) must be provided' },
        { status: 400 }
      );
    }

    // Update quota
    const updatedQuota = await prisma.usageQuota.update({
      where: { id: quota.id },
      data: update,
    });

    return NextResponse.json({
      success: true,
      quota: {
        id: updatedQuota.id,
        scopeType: updatedQuota.scopeType,
        scopeId: updatedQuota.scopeId,
        featureKey: updatedQuota.featureKey,
        limit: updatedQuota.limit,
        used: updatedQuota.used,
        status: updatedQuota.status,
        startsAt: updatedQuota.startsAt,
        endsAt: updatedQuota.endsAt,
        lockedAt: updatedQuota.lockedAt,
        createdAt: updatedQuota.createdAt,
        updatedAt: updatedQuota.updatedAt,
      },
    });
  }),
    { tenantScoped: true, permissionKey: 'admin.quotas.access' }
  )(request, { params });
}
