/**
 * Admin EHR Privileges API
 * POST /api/admin/ehr/privileges/grant
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Privilege } from '@/lib/ehr/models';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ehrGrantPrivilegeSchema = z.object({
  userId: z.string().min(1),
  resource: z.string().min(1),
  action: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, ehrGrantPrivilegeSchema);
    if ('error' in v) return v.error;

    // Validation
    const requiredFields = ['userId', 'resource', 'action'];
    const validationErrors = validateRequired(body, requiredFields);

    if (body.expiresAt && !validateISOTimestamp(body.expiresAt)) {
      validationErrors.push({ field: 'expiresAt', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Create privilege - with tenant isolation
    const privilege = await prisma.ehrPrivilege.create({
      data: {
        tenantId: tenant.id,
        userId: body.userId,
        grantedBy: user.id,
        resource: body.resource,
        action: body.action,
        scope: body.scope || null,
        departmentId: body.departmentId || null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        isActive: true,
      },
    });

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'GRANT_PRIVILEGE',
      resourceType: 'privilege',
      resourceId: privilege.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId,
      changes: [
        { field: 'userId', newValue: body.userId },
        { field: 'resource', newValue: body.resource },
        { field: 'action', newValue: body.action },
      ],
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, privilege },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Grant privilege error', { category: 'api', route: 'POST /api/admin/ehr/privileges/grant', error });
    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to grant privilege' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.ehr.privileges' });
