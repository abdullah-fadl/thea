import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createQuotaSchema } from '@/lib/validation/admin.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/admin/quotas
 * Create a new quota
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId, role }) => {
  const groupId = user.groupId;

  // Authorization: Only platform admin and group-admin can create quotas
  if (!['admin', 'group-admin'].includes(role)) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const body = await req.json();

  // Parse and validate
  const v = validateBody(body, createQuotaSchema);
  if ('error' in v) return v.error;
  const parsed = v.data;

  // Authorization check for group-admin (after parsing)
  if (role === 'group-admin' && groupId) {
    if (parsed.scopeType === 'group' && parsed.scopeId !== groupId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Group admin can only create quotas for their own group' },
        { status: 403 }
      );
    }
  }

  // Check if quota already exists (with tenant isolation)
  const existing = await prisma.usageQuota.findFirst({
    where: {
      tenantId,
      scopeType: parsed.scopeType,
      scopeId: parsed.scopeId,
      featureKey: parsed.featureKey,
      status: 'active',
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Quota already exists for this scope and feature' },
      { status: 409 }
    );
  }

  // Create quota
  // If no limit provided, set a very high default (999999) - quota will be controlled by endsAt only
  const quotaLimit = parsed.limit || 999999;
  const now = new Date();

  const quota = await prisma.usageQuota.create({
    data: {
      id: uuidv4(),
      tenantId,
      scopeType: parsed.scopeType,
      scopeId: parsed.scopeId,
      featureKey: parsed.featureKey,
      limit: quotaLimit,
      used: 0,
      status: parsed.status || 'active',
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      createdAt: now,
      createdBy: userId,
    },
  });

  return NextResponse.json({
    success: true,
    quota: {
      id: quota.id,
      scopeType: quota.scopeType,
      scopeId: quota.scopeId,
      featureKey: quota.featureKey,
      limit: quota.limit,
      used: quota.used,
      status: quota.status,
      startsAt: quota.startsAt,
      endsAt: quota.endsAt,
      createdAt: quota.createdAt,
    },
  }, { status: 201 });
}),
  { tenantScoped: true, permissionKey: 'admin.quotas.access' }
);

/**
 * GET /api/admin/quotas
 * List quotas (tenant-scoped, with optional filtering)
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, role }) => {
  // Authorization: Only admin and group-admin can list quotas
  if (!['admin', 'group-admin'].includes(role)) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const scopeType = searchParams.get('scopeType') as 'group' | 'user' | null;
  const scopeId = searchParams.get('scopeId');
  const featureKey = searchParams.get('featureKey');

  const where: any = { tenantId };

  // Group admin can only see quotas for their group
  const groupId = user.groupId;
  if (role === 'group-admin' && groupId) {
    where.OR = [
      { scopeType: 'group', scopeId: groupId },
      { scopeType: 'user' }, // Can see user quotas (they may belong to their group)
    ];
  }

  if (scopeType) {
    where.scopeType = scopeType;
  }

  if (scopeId) {
    where.scopeId = scopeId;
  }

  if (featureKey) {
    where.featureKey = featureKey;
  }

  const quotas = await prisma.usageQuota.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({
    quotas: quotas.map((q: any) => ({
      id: q.id,
      scopeType: q.scopeType,
      scopeId: q.scopeId,
      featureKey: q.featureKey,
      limit: q.limit,
      used: q.used,
      status: q.status,
      startsAt: q.startsAt,
      endsAt: q.endsAt,
      lockedAt: q.lockedAt,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    })),
  });
}),
  { tenantScoped: true, permissionKey: 'admin.quotas.access' }
);
