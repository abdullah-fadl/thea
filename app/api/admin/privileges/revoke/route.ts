/**
 * Admin EHR Privileges API
 * POST /api/admin/privileges/revoke
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const revokePrivilegeSchema = z.object({
  privilegeId: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, revokePrivilegeSchema);
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

    // Find privilege (with tenant isolation)
    const privilege = await prisma.ehrPrivilege.findFirst({
      where: { tenantId: tenant.id, id: body.privilegeId },
    });

    if (!privilege) {
      return NextResponse.json(
        { error: 'Privilege not found' },
        { status: 404 }
      );
    }

    if (!privilege.isActive) {
      return NextResponse.json(
        { error: 'Privilege is already revoked' },
        { status: 400 }
      );
    }

    // Update privilege (with tenant isolation)
    const updatedPrivilege = await prisma.ehrPrivilege.update({
      where: { id: body.privilegeId },
      data: {
        isActive: false,
        revokedAt: new Date(),
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
        { field: 'revokedAt', newValue: new Date().toISOString() },
        { field: 'revokedBy', newValue: user.id },
      ],
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      privilege: updatedPrivilege,
    });
  } catch (error: any) {
    logger.error('Revoke privilege error', { category: 'api', route: 'POST /api/admin/privileges/revoke', error });

    // Audit log for failure
    try {
      await createAuditLog({
        action: 'REVOKE_PRIVILEGE',
        resourceType: 'privilege',
        userId: user.id,
        tenantId,
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to revoke privilege' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.privileges.access' });
