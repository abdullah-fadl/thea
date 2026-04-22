/**
 * Admin EHR Users API
 * POST /api/admin/ehr/users
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { EHRUser } from '@/lib/ehr/models';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateEmail, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ehrUserSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, ehrUserSchema);
    if ('error' in v) return v.error;

    // Validation
    const requiredFields = ['userId', 'email', 'firstName', 'lastName'];
    const validationErrors = validateRequired(body, requiredFields);

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    if (body.email && !validateEmail(body.email)) {
      return NextResponse.json(
        { error: 'Validation failed', details: [{ field: 'email', message: 'Invalid email format' }] },
        { status: 400 }
      );
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Check if user already exists (with tenant isolation)
    const existingUser = await prisma.ehrUser.findFirst({
      where: { tenantId: tenant.id, userId: body.userId },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this userId' },
        { status: 400 }
      );
    }

    // Create EHR user
    const ehrUser = await prisma.ehrUser.create({
      data: {
        tenantId: tenant.id,
        userId: body.userId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        licenseNumber: body.licenseNumber || null,
        specialty: body.specialty || null,
        department: body.department || null,
        role: body.role || null,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_EHR_USER',
      resourceType: 'ehr_user',
      resourceId: ehrUser.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, user: ehrUser },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Create EHR user error', { category: 'api', route: 'POST /api/admin/ehr/users', error });

    try {
      await createAuditLog({
        action: 'CREATE_EHR_USER',
        resourceType: 'ehr_user',
        userId: user.id,
        tenantId,
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to create EHR user' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.users.access' });
