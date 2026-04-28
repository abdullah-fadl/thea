import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/lib/security/auth';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { isBuiltinRole, isRemovedRoleKey } from '@/lib/roles';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateRoleSchema = z.object({
  label: z.string().max(120).optional(),
  labelAr: z.string().max(120).optional(),
  permissions: z.array(z.string()).min(1).optional(),
});

function normalizeRoleKey(value: string) {
  return String(value || '').trim().toLowerCase();
}

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ roleKey: string }> | { roleKey: string } }
) => {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const authorized = await requireRole(request, ['admin'], auth);
    if (authorized instanceof NextResponse) return authorized;

    const { tenantId: tenantKey, userId } = authorized;
    const resolvedParams = params instanceof Promise ? await params : params;
    const roleKey = normalizeRoleKey(resolvedParams.roleKey);
    if (isRemovedRoleKey(roleKey)) {
      return NextResponse.json({ error: 'Role key is not allowed' }, { status: 410 });
    }

    const body = await request.json();
    const v = validateBody(body, updateRoleSchema);
    if ('error' in v) return v.error;
    const data = v.data;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantKey), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const existing = await prisma.roleDefinition.findFirst({
      where: { tenantId: tenant.id, key: roleKey },
    });
    if (!existing && !isBuiltinRole(roleKey)) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Upsert role definition
    const role = await prisma.roleDefinition.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: roleKey } },
      update: {
        label: data.label ?? existing?.label ?? null,
        labelAr: data.labelAr ?? existing?.labelAr ?? null,
        permissions: data.permissions ?? existing?.permissions ?? [],
        updatedBy: userId,
      },
      create: {
        tenantId: tenant.id,
        key: roleKey,
        label: data.label ?? null,
        labelAr: data.labelAr ?? null,
        permissions: data.permissions ?? [],
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Propagate permission changes to all users with this role
    if (data.permissions) {
      try {
        const now = new Date();
        // Update all users with this role in the tenant
        const result = await prisma.user.updateMany({
          where: { tenantId: tenant.id, role: roleKey },
          data: { permissions: data.permissions, updatedBy: userId },
        });
        logger.info('Propagated permissions to users', { category: 'api', route: 'PATCH /api/admin/roles/[roleKey]', modifiedCount: result.count, roleKey });

        // Also update tenant_users areas to match new permissions
        const affectedUsers = await prisma.user.findMany({
          where: { tenantId: tenant.id, role: roleKey },
          select: { id: true },
        });
        if (affectedUsers.length > 0) {
          const userIds = affectedUsers.map((u: any) => u.id);
          // Derive areas from the new permissions
          const areas: string[] = [];
          for (const perm of data.permissions) {
            if (perm.startsWith('er.') && !areas.includes('ER')) areas.push('ER');
            else if (perm.startsWith('opd.') && !areas.includes('OPD')) areas.push('OPD');
            else if (perm.startsWith('ipd.') && !areas.includes('IPD')) areas.push('IPD');
            else if (perm.startsWith('orders.') && !areas.includes('ORDERS')) areas.push('ORDERS');
            else if (perm.startsWith('billing.') && !areas.includes('BILLING')) areas.push('BILLING');
            else if ((perm.startsWith('registration.') || perm.startsWith('patients.') || perm.startsWith('encounters.')) && !areas.includes('REGISTRATION')) areas.push('REGISTRATION');
            else if (perm.startsWith('results.') && !areas.includes('RESULTS')) areas.push('RESULTS');
            else if (perm.startsWith('tasks.') && !areas.includes('TASKS')) areas.push('TASKS');
            else if (perm.startsWith('handover.') && !areas.includes('HANDOVER')) areas.push('HANDOVER');
            else if (perm.startsWith('notifications.') && !areas.includes('NOTIFICATIONS')) areas.push('NOTIFICATIONS');
            else if (perm.startsWith('mortuary.') && !areas.includes('MORTUARY')) areas.push('MORTUARY');
          }
          // Update TenantUser areas for all affected users
          await prisma.tenantUser.updateMany({
            where: { tenantId: tenant.id, userId: { in: userIds } },
            data: { areas },
          });
          logger.info('Updated areas for tenant_users', { category: 'api', route: 'PATCH /api/admin/roles/[roleKey]', userCount: userIds.length, areas });
        }
      } catch (propError) {
        // Log but don't fail the role update
        logger.error('Permission propagation error', { category: 'api', route: 'PATCH /api/admin/roles/[roleKey]', error: propError });
      }
    }

    await createAuditLog(
      'role_definition',
      role.id,
      'ROLE_UPDATED',
      userId || 'system',
      undefined,
      { roleKey, permissions: data.permissions, label: data.label },
      tenantKey
    );

    return NextResponse.json({ success: true, role });
});

export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ roleKey: string }> | { roleKey: string } }
) => {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const authorized = await requireRole(request, ['admin'], auth);
    if (authorized instanceof NextResponse) return authorized;

    const { tenantId: tenantKey, userEmail, userId } = authorized;
    const resolvedParams = params instanceof Promise ? await params : params;
    const roleKey = normalizeRoleKey(resolvedParams.roleKey);
    const mode = request.nextUrl.searchParams.get('mode');

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantKey), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Never allow deleting the admin role (would lock the tenant out).
    // Resetting is still allowed (removes override doc, keeps builtin defaults).
    if (roleKey === 'admin' && mode !== 'reset') {
      return NextResponse.json({ error: 'Cannot delete admin role' }, { status: 400 });
    }

    const takTheaEmails = new Set(['tak@thea.com.sa', 'thea@thea.com.sa']);
    const isTakThea = takTheaEmails.has(String(userEmail || '').trim().toLowerCase());
    if (!isTakThea) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.roleDefinition.findFirst({
      where: { tenantId: tenant.id, key: roleKey },
    });

    // If a removed role key exists in DB as a custom/override, allow deleting the document.
    if (isRemovedRoleKey(roleKey)) {
      if (existing) {
        await prisma.roleDefinition.delete({ where: { id: existing.id } });
      }
      await createAuditLog('role_definition', roleKey, 'ROLE_DELETED', userId || 'system', userEmail, { roleKey, removed: true }, tenantKey);
      return NextResponse.json({ success: true, deleted: true });
    }

    if (mode === 'reset') {
      if (existing) {
        await prisma.roleDefinition.delete({ where: { id: existing.id } });
      }
      await createAuditLog('role_definition', roleKey, 'ROLE_RESET', userId || 'system', userEmail, { roleKey }, tenantKey);
      return NextResponse.json({ success: true, reset: true });
    }

    if (isBuiltinRole(roleKey)) {
      // Soft-delete builtin roles by marking isActive=false
      await prisma.roleDefinition.upsert({
        where: { tenantId_key: { tenantId: tenant.id, key: roleKey } },
        update: {
          isActive: false,
          updatedBy: userId,
        },
        create: {
          tenantId: tenant.id,
          key: roleKey,
          isActive: false,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      await createAuditLog('role_definition', roleKey, 'ROLE_DEACTIVATED', userId || 'system', userEmail, { roleKey, builtin: true }, tenantKey);
      return NextResponse.json({ success: true, deleted: true });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    await prisma.roleDefinition.delete({ where: { id: existing.id } });
    await createAuditLog('role_definition', roleKey, 'ROLE_DELETED', userId || 'system', userEmail, { roleKey }, tenantKey);
    return NextResponse.json({ success: true, deleted: true });
});
