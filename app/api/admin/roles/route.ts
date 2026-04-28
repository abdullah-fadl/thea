import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/lib/security/auth';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { getBuiltinRoleDefinitions, isBuiltinRole, isRemovedRoleKey } from '@/lib/roles';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createRoleSchema = z.object({
  key: z.string().min(2).max(64).regex(/^[a-z0-9-_]+$/),
  label: z.string().max(120).optional(),
  labelAr: z.string().max(120).optional(),
  permissions: z.array(z.string()).min(1),
});

function normalizeRoleKey(value: string) {
  return String(value || '').trim().toLowerCase();
}

export const GET = withErrorHandler(async (request: NextRequest) => {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const authorized = await requireRole(request, ['admin'], auth);
    if (authorized instanceof NextResponse) return authorized;

    const { tenantId: tenantKey } = authorized;
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantKey),
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    const tenantIdUuid = tenant.id;

    const roleDocs = await prisma.roleDefinition.findMany({
      where: { tenantId: tenantIdUuid },
      take: 500,
    });
    const visibleRoleDocs = roleDocs.filter((role: any) => !isRemovedRoleKey(normalizeRoleKey(role.key)));

    const customByKey = new Map(
      visibleRoleDocs.map((role: any) => [normalizeRoleKey(role.key), role])
    );
    const deletedKeys = new Set(
      visibleRoleDocs
        .filter((role: any) => !role.isActive)
        .map((role: any) => normalizeRoleKey(role.key))
    );

    const builtin = getBuiltinRoleDefinitions()
      .filter((role) => !deletedKeys.has(role.key))
      .map((role) => {
        const override = customByKey.get(role.key);
        if (override && override.isActive !== false) {
          return {
            key: role.key,
            label: override.label || null,
            labelAr: override.labelAr || null,
            permissions: Array.isArray(override.permissions) ? override.permissions : role.permissions,
            source: 'override',
            updatedAt: override.updatedAt || null,
          };
        }
        return {
          key: role.key,
          label: null,
          labelAr: null,
          permissions: role.permissions,
          source: 'builtin',
          updatedAt: null,
        };
      });

    const customOnly = roleDocs
      .filter((role: any) => !isBuiltinRole(normalizeRoleKey(role.key)))
      .filter((role: any) => !isRemovedRoleKey(normalizeRoleKey(role.key)))
      .filter((role: any) => role.isActive !== false)
      .map((role: any) => ({
        key: normalizeRoleKey(role.key),
        label: role.label || null,
        labelAr: role.labelAr || null,
        permissions: Array.isArray(role.permissions) ? role.permissions : [],
        source: 'custom',
        updatedAt: role.updatedAt || null,
      }));

    return NextResponse.json({
      roles: [...builtin, ...customOnly],
    });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const authorized = await requireRole(request, ['admin'], auth);
    if (authorized instanceof NextResponse) return authorized;

    const { tenantId: tenantKey, userId } = authorized;
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantKey),
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    const tenantIdUuid = tenant.id;

    const body = await request.json();
    logger.debug('POST role definition', { category: 'api', route: 'POST /api/admin/roles', key: body?.key, permCount: body?.permissions?.length });
    const v = validateBody(body, createRoleSchema);
    if ('error' in v) return v.error;
    const data = v.data;
    const key = normalizeRoleKey(data.key);
    logger.debug('POST normalized role key', { category: 'api', route: 'POST /api/admin/roles', key, isRemoved: isRemovedRoleKey(key) });
    if (isRemovedRoleKey(key)) {
      return NextResponse.json(
        {
          error: 'Role key is not allowed',
          code: 'ROLE_KEY_BLOCKED',
          key,
        },
        { status: 400 }
      );
    }

    // Upsert role definition
    const role = await prisma.roleDefinition.upsert({
      where: { tenantId_key: { tenantId: tenantIdUuid, key } },
      update: {
        label: data.label || null,
        labelAr: data.labelAr || null,
        permissions: data.permissions,
        updatedBy: userId,
        isActive: true,
      },
      create: {
        tenantId: tenantIdUuid,
        key,
        label: data.label || null,
        labelAr: data.labelAr || null,
        permissions: data.permissions,
        createdBy: userId,
        updatedBy: userId,
        isActive: true,
      },
    });

    await createAuditLog(
      'role_definition',
      role.id,
      'ROLE_CREATED',
      userId || 'system',
      undefined,
      { key, permissions: data.permissions, label: data.label },
      tenantKey
    );

    return NextResponse.json({ success: true, role });
});
