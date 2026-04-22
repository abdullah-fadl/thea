import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { isBuiltinRole, isRemovedRoleKey } from '@/lib/roles';
import { requireAuth, requireRole, getRequestIP, getRequestUserAgent } from '@/lib/security/auth';
import { rateLimitAPI } from '@/lib/security/rateLimit';
import { addSecurityHeaders, handleCORSPreflight } from '@/lib/security/headers';
import { validateRequestBody, handleError } from '@/lib/security/validation';
import { logAuditEvent, createAuditContext } from '@/lib/security/audit';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: passwordSchema,
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  role: z.string().min(1).max(64).regex(/^[a-z0-9-_]+$/),
  groupId: z.string().trim().optional(),
  hospitalId: z.string().trim().optional().nullable(),
  department: z.string().max(100).trim().optional().nullable(),
  departments: z.array(z.string()).optional(),
  staffId: z.string().max(50).optional().nullable(),
  employeeNo: z.string().max(50).optional().nullable(),
  permissions: z.array(z.string()).optional(),
  platformAccess: z.object({
    sam: z.boolean().optional(),
    health: z.boolean().optional(),
    edrac: z.boolean().optional(),
    cvision: z.boolean().optional(),
  }).optional(),
});

function getPasswordStrengthFeedback(password: string): string[] {
  const feedback: string[] = [];
  if (password.length < 12) feedback.push('At least 12 characters');
  if (!/[A-Z]/.test(password)) feedback.push('One uppercase letter');
  if (!/[a-z]/.test(password)) feedback.push('One lowercase letter');
  if (!/[0-9]/.test(password)) feedback.push('One number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) feedback.push('One special character');
  return feedback;
}

async function getRoleDefinitionPermissions(tenantUuid: string, roleKey: string): Promise<string[] | null> {
  const role = await prisma.roleDefinition.findFirst({
    where: { tenantId: tenantUuid, key: roleKey },
    select: { permissions: true },
  });
  if (role && Array.isArray(role.permissions)) {
    return role.permissions;
  }
  return null;
}

async function isAllowedRole(tenantUuid: string, roleKey: string): Promise<boolean> {
  if (isRemovedRoleKey(roleKey)) return false;
  if (isBuiltinRole(roleKey)) return true;
  const role = await prisma.roleDefinition.findFirst({
    where: { tenantId: tenantUuid, key: roleKey },
    select: { id: true },
  });
  return Boolean(role);
}

export const OPTIONS = withErrorHandler(async (request: NextRequest) => {
  const corsResponse = handleCORSPreflight(request);
  if (corsResponse) {
    return corsResponse;
  }
  return addSecurityHeaders(new NextResponse(null, { status: 204 }));
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = getRequestIP(request);
    const rateLimit = await rateLimitAPI({ ip });
    if (!rateLimit.allowed) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          },
          { status: 429 }
        )
      );
    }

    // Authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return addSecurityHeaders(auth);
    }

    // Authorization - only admin can list users
    const authorized = await requireRole(request, ['admin'], auth);
    if (authorized instanceof NextResponse) {
      const errorBody = await authorized.clone().json().catch(() => ({ error: 'Unknown error' }));
      logger.error('Authorization failed', { category: 'auth', route: 'GET /api/admin/users', status: authorized.status, body: errorBody });
      logger.error('User role mismatch', { category: 'auth', route: 'GET /api/admin/users', userRole: auth.userRole, allowedRoles: ['admin'] });
      await logAuditEvent(
        createAuditContext(auth, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'GET',
          path: request.nextUrl.pathname,
        }),
        'access_denied',
        'system',
        { success: false, errorMessage: 'Insufficient role permissions' }
      );
      return addSecurityHeaders(authorized);
    }

    const { tenantId, user, userRole } = authorized;
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const hospitalId = searchParams.get('hospitalId');

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return addSecurityHeaders(NextResponse.json({ error: 'Tenant not found' }, { status: 404 }));

    // Build Prisma where clause with access control
    const where: Record<string, unknown> = { tenantId: tenant.id, role: { not: 'thea-owner' } };

    if (userRole === 'hospital-admin' && user.hospitalId) {
      where.hospitalId = user.hospitalId;
    } else if (userRole === 'group-admin' && user.groupId) {
      where.groupId = user.groupId;
      if (groupId && groupId !== user.groupId) {
        await logAuditEvent(
          createAuditContext(authorized, {
            ip,
            userAgent: getRequestUserAgent(request),
            method: 'GET',
            path: request.nextUrl.pathname,
          }),
          'scope_violation',
          'system',
          {
            success: false,
            errorMessage: `Attempted to access groupId=${groupId} but user belongs to ${user.groupId}`,
            metadata: { requestedGroupId: groupId },
          }
        );
        return addSecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
      }
      if (hospitalId) {
        // Verify hospital belongs to their group
        const hospital = await prisma.hospital.findFirst({
          where: { id: hospitalId, groupId: user.groupId, tenantId: tenant.id },
        });
        if (!hospital) {
          await logAuditEvent(
            createAuditContext(authorized, {
              ip,
              userAgent: getRequestUserAgent(request),
              method: 'GET',
              path: request.nextUrl.pathname,
            }),
            'scope_violation',
            'system',
            {
              success: false,
              errorMessage: `Hospital ${hospitalId} not found in group ${user.groupId}`,
              metadata: { requestedHospitalId: hospitalId },
            }
          );
          return addSecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
        }
        where.hospitalId = hospitalId;
      }
    } else if (userRole === 'admin') {
      if (groupId) {
        where.groupId = groupId;
      }
      if (hospitalId) {
        where.hospitalId = hospitalId;
      }
    } else {
      return addSecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        groupId: true,
        hospitalId: true,
        department: true,
        staffId: true,
        employeeNo: true,
        permissions: true,
        isActive: true,
        tenantId: true,
        platformAccessSam: true,
        platformAccessHealth: true,
        platformAccessEdrac: true,
        platformAccessCvision: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 500,
    });

    // Map platformAccess fields to the nested object format for backward compatibility
    const mappedUsers = users.map((u) => ({
      ...u,
      platformAccess: {
        sam: u.platformAccessSam,
        health: u.platformAccessHealth,
        edrac: u.platformAccessEdrac,
        cvision: u.platformAccessCvision,
      },
      platformAccessSam: undefined,
      platformAccessHealth: undefined,
      platformAccessEdrac: undefined,
      platformAccessCvision: undefined,
    }));

    return addSecurityHeaders(NextResponse.json({ users: mappedUsers }));
  } catch (error) {
    const { message, details } = handleError(error);
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Internal server error', message, ...details },
        { status: 500 }
      )
    );
  }
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = getRequestIP(request);
    const rateLimit = await rateLimitAPI({ ip });
    if (!rateLimit.allowed) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          },
          { status: 429 }
        )
      );
    }

    // Authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      if (process.env.DEBUG_AUTH === '1') {
        const errorBody = await auth.clone().json().catch(() => ({ error: 'Unknown error' }));
        logger.error('Auth failed', { category: 'auth', route: 'POST /api/admin/users', status: auth.status, body: errorBody });
      }
      return addSecurityHeaders(auth);
    }

    if (process.env.DEBUG_AUTH === '1') {
      logger.debug('Auth successful', { category: 'auth', route: 'POST /api/admin/users', userId: auth.userId, userRole: auth.userRole, tenantId: auth.tenantId });
    }

    // Authorization - only admin, group-admin, and thea-owner can create users
    const authorized = await requireRole(request, ['admin', 'group-admin', 'thea-owner'], auth);
    if (authorized instanceof NextResponse) {
      if (process.env.DEBUG_AUTH === '1') {
        logger.error('Role check failed', { category: 'auth', route: 'POST /api/admin/users', userRole: auth.userRole, allowedRoles: ['admin', 'group-admin', 'thea-owner'] });
      }
      await logAuditEvent(
        createAuditContext(auth, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'POST',
          path: request.nextUrl.pathname,
        }),
        'access_denied',
        'system',
        { success: false, errorMessage: 'Insufficient role permissions' }
      );
      return addSecurityHeaders(authorized);
    }

    const { tenantId, userId, user } = authorized;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantId),
      select: { id: true, maxUsers: true },
    });
    if (!tenant) return addSecurityHeaders(NextResponse.json({ error: 'Tenant not found' }, { status: 404 }));

    // Check user limit (enforce maxUsers)
    const currentUserCount = await prisma.user.count({ where: { tenantId: tenant.id } });
    if (currentUserCount >= tenant.maxUsers) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'User limit exceeded',
            message: `Maximum ${tenant.maxUsers} users allowed for this tenant. Current: ${currentUserCount}`
          },
          { status: 403 }
        )
      );
    }

    // Input validation with sanitization
    const validation = await validateRequestBody(request, createUserSchema);
    if (!validation.success) {
      await logAuditEvent(
        createAuditContext(authorized, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'POST',
          path: request.nextUrl.pathname,
        }),
        'user_create',
        'user',
        { success: false, errorMessage: 'Validation failed' }
      );
      const errorResponse = (validation as { success: false; response: NextResponse }).response;
      return addSecurityHeaders(errorResponse);
    }
    let { data } = validation;

    // Check if user already exists (email must be unique per tenant)
    const existingUser = await prisma.user.findFirst({
      where: { email: data.email, tenantId: tenant.id },
    });

    if (existingUser) {
      await logAuditEvent(
        createAuditContext(authorized, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'POST',
          path: request.nextUrl.pathname,
        }),
        'user_create',
        'user',
        {
          success: false,
          errorMessage: `User with email ${data.email} already exists`,
          metadata: { email: data.email },
        }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        )
      );
    }

    if (data.staffId && String(data.role || '').includes('doctor')) {
      const provider = await prisma.clinicalInfraProvider.findFirst({
        where: {
          tenantId: tenant.id,
          staffId: data.staffId,
          isArchived: { not: true },
        },
      });
      if (!provider) {
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: 'Staff ID not found in providers. Please create a provider record first or use the Doctor Onboarding wizard.',
              code: 'STAFF_ID_NOT_FOUND',
              suggestion: '/admin/doctors/onboard',
            },
            { status: 400 }
          )
        );
      }
      const existingStaffUser = await prisma.user.findFirst({
        where: { staffId: data.staffId, tenantId: tenant.id },
      });
      if (existingStaffUser) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'This Staff ID is already assigned to another user.', code: 'STAFF_ID_DUPLICATE' },
            { status: 400 }
          )
        );
      }
    }

    if (data.employeeNo) {
      const existingEmployeeNo = await prisma.user.findFirst({
        where: { employeeNo: data.employeeNo, tenantId: tenant.id },
      });
      if (existingEmployeeNo) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'User with this employee number already exists' },
            { status: 400 }
          )
        );
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    const roleKey = String(data.role || '').trim().toLowerCase();
    const allowedRole = await isAllowedRole(tenant.id, roleKey);
    if (!allowedRole) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Invalid role', message: `Role ${roleKey} is not allowed` },
          { status: 400 }
        )
      );
    }

    const roleDefaultPermissions =
      (await getRoleDefinitionPermissions(tenant.id, roleKey)) || getDefaultPermissionsForRole(roleKey);

    // Get permissions: use provided permissions or default for role
    const permissions = data.permissions && data.permissions.length > 0
      ? data.permissions
      : roleDefaultPermissions;

    // Get platformAccess from request body
    const platformAccess = (data as Record<string, unknown>).platformAccess as Record<string, boolean> | undefined;

    // Create user
    const newUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: roleKey,
        groupId: data.groupId || null,
        hospitalId: data.hospitalId || null,
        department: data.departments?.length ? data.departments.join(', ') : (data.department || null),
        staffId: data.staffId || null,
        employeeNo: data.employeeNo || null,
        permissions: permissions,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
        // Platform access fields
        ...(platformAccess?.sam !== undefined && { platformAccessSam: platformAccess.sam }),
        ...(platformAccess?.health !== undefined && { platformAccessHealth: platformAccess.health }),
        ...(platformAccess?.edrac !== undefined && { platformAccessEdrac: platformAccess.edrac }),
        ...(platformAccess?.cvision !== undefined && { platformAccessCvision: platformAccess.cvision }),
      },
    });

    // Sync departments to TenantUser (PostgreSQL) for department-based access control
    if (data.departments?.length) {
      try {
        await prisma.tenantUser.upsert({
          where: { tenantId_userId: { tenantId: tenant.id, userId: newUser.id } },
          update: { departments: data.departments },
          create: {
            tenantId: tenant.id,
            userId: newUser.id,
            displayName: `${data.firstName} ${data.lastName}`.trim(),
            email: data.email,
            roles: [roleKey],
            departments: data.departments,
            isActive: true,
          },
        });
      } catch (err) {
        logger.error('Failed to sync departments to TenantUser', { category: 'api', error: err });
      }
    }

    // Audit logging (success)
    await logAuditEvent(
      createAuditContext(authorized, {
        ip,
        userAgent: getRequestUserAgent(request),
        method: 'POST',
        path: request.nextUrl.pathname,
      }),
      'user_create',
      'user',
      {
        success: true,
        resourceId: newUser.id,
        metadata: {
          email: newUser.email,
          role: newUser.role,
          groupId: newUser.groupId,
          hospitalId: newUser.hospitalId,
        },
      }
    );

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;
    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        user: userWithoutPassword,
      }, { status: 201 })
    );
  } catch (error) {
    const { message, details } = handleError(error);
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Internal server error', message, ...details },
        { status: 500 }
      )
    );
  }
});

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = getRequestIP(request);
    const rateLimit = await rateLimitAPI({ ip });
    if (!rateLimit.allowed) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          },
          { status: 429 }
        )
      );
    }

    // Authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return addSecurityHeaders(auth);
    }

    // Authorization - only admin and group-admin can delete users
    const authorized = await requireRole(request, ['admin', 'group-admin'], auth);
    if (authorized instanceof NextResponse) {
      await logAuditEvent(
        createAuditContext(auth, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'DELETE',
          path: request.nextUrl.pathname,
        }),
        'access_denied',
        'system',
        { success: false, errorMessage: 'Insufficient role permissions' }
      );
      return addSecurityHeaders(authorized);
    }

    const { tenantId, user } = authorized;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        )
      );
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return addSecurityHeaders(NextResponse.json({ error: 'Tenant not found' }, { status: 404 }));

    // Build where clause with access control
    const where: Record<string, unknown> = { id, tenantId: tenant.id };

    if (authorized.userRole === 'group-admin' && user.groupId) {
      where.groupId = user.groupId;
    }

    // Verify user exists and user has access
    const existingUser = await prisma.user.findFirst({ where });

    if (!existingUser) {
      await logAuditEvent(
        createAuditContext(authorized, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'DELETE',
          path: request.nextUrl.pathname,
        }),
        'user_delete',
        'user',
        {
          success: false,
          resourceId: id,
          errorMessage: 'User not found or access denied',
        }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'User not found or access denied' },
          { status: 404 }
        )
      );
    }

    // Prevent deleting admin or thea-owner users
    const protectedRoles = ['admin', 'thea-owner'];
    if (protectedRoles.includes(String(existingUser.role || '').toLowerCase())) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'Cannot delete admin user',
            message: 'Admin and owner users cannot be deleted',
          },
          { status: 400 }
        )
      );
    }

    // Hard delete: actually remove the user from database
    await prisma.user.delete({ where: { id } });

    // Audit logging (success)
    await logAuditEvent(
      createAuditContext(authorized, {
        ip,
        userAgent: getRequestUserAgent(request),
        method: 'DELETE',
        path: request.nextUrl.pathname,
      }),
      'user_delete',
      'user',
      {
        success: true,
        resourceId: id,
        metadata: { deleted: true },
      }
    );

    return addSecurityHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    const { message, details } = handleError(error);
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Internal server error', message, ...details },
        { status: 500 }
      )
    );
  }
});
