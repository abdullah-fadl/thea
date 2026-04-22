/**
 * Admin EHR Privileges API
 * POST /api/admin/ehr/privileges/revoke
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ehrRevokePrivilegeSchema = z.object({
  privilegeId: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, ehrRevokePrivilegeSchema);
    if ('error' in v) return v.error;

    // Validation
    const requiredFields = ['privilegeId'];
    const validationErrors = validateRequired(body, requiredFields);

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Find and revoke privilege - with tenant isolation
    const privilege = await prisma.ehrPrivilege.findFirst({
      where: { tenantId: tenant.id, id: body.privilegeId },
    });

    if (!privilege) {
      return NextResponse.json({ error: 'Privilege not found' }, { status: 404 });
    }

    if (!privilege.isActive) {
      return NextResponse.json({ error: 'Privilege is already revoked' }, { status: 400 });
    }

    // Update privilege - with tenant isolation
    const now = new Date();
    await prisma.ehrPrivilege.update({
      where: { id: body.privilegeId },
      data: {
        isActive: false,
        revokedAt: now,
        revokedBy: user.id,
      },
    });

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'REVOKE_PRIVILEGE',
      resourceType: 'privilege',
      resourceId: body.privilegeId,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId,
      changes: [
        { field: 'isActive', oldValue: true, newValue: false },
        { field: 'revokedAt', newValue: now.toISOString() },
        { field: 'revokedBy', newValue: user.id },
      ],
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, message: 'Privilege revoked successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Revoke privilege error', { category: 'api', route: 'POST /api/admin/ehr/privileges/revoke', error });
    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to revoke privilege' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.ehr.privileges' });
