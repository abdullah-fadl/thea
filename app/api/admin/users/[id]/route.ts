import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/utils/audit';
import { isBuiltinRole, isRemovedRoleKey } from '@/lib/roles';
import { validateBody } from '@/lib/validation/helpers';
import { updateUserSchema } from '@/lib/validation/admin.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validatePassword } from '@/lib/security/passwordPolicy';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

/**
 * PATCH /api/admin/users/:id
 * Update user permissions and other fields
 */
export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) => {
    // Authenticate and get user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const operatorRole = String(authResult.userRole || '').toLowerCase();
    const canFullUpdate = ['admin', 'group-admin'].includes(operatorRole);
    const canChangePasswordOnly = operatorRole === 'it';

    if (!canFullUpdate && !canChangePasswordOnly) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId, userId, user } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const body = await request.json();
    logger.debug('Update user request', { category: 'api', route: 'PATCH /api/admin/users/[id]', body });
    const v = validateBody(body, updateUserSchema);
    if ('error' in v) return v.error;
    let data = v.data;

    // IT can only update password (and optionally isActive)
    if (canChangePasswordOnly) {
      const allowedKeys = new Set(['password', 'isActive']);
      const sentKeys = Object.keys(data);
      const disallowed = sentKeys.filter((k) => !allowedKeys.has(k));
      if (disallowed.length > 0) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'IT role can only change user password' },
          { status: 403 }
        );
      }
      data = { password: data.password, isActive: data.isActive } as typeof data;
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Build query with access control
    const where: any = { id, tenantId: tenant.id };

    if (authResult.userRole === 'group-admin' && user.groupId) {
      where.groupId = user.groupId;
    }

    // Verify user exists and user has access
    const existingUser = await prisma.user.findFirst({ where });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found or access denied' },
        { status: 404 }
      );
    }

    // Validate hospitalId based on role - only validate if role or hospitalId is being updated
    const isUpdatingRoleOrHospitalId = data.role !== undefined || data.hospitalId !== undefined;

    if (isUpdatingRoleOrHospitalId) {
      const targetRole = data.role !== undefined ? String(data.role || '').trim().toLowerCase() : existingUser.role;
      const targetHospitalId = data.hospitalId !== undefined ? data.hospitalId : existingUser.hospitalId;

      logger.debug('Validation (role/hospitalId update)', { category: 'api', route: 'PATCH /api/admin/users/[id]', targetRole, targetHospitalId, existingUserRole: existingUser.role, existingUserHospitalId: existingUser.hospitalId, dataHospitalId: data.hospitalId });

      if (targetRole === 'hospital-admin') {
        if (!targetHospitalId) {
          logger.error('Validation failed: hospitalId required', { category: 'api', route: 'PATCH /api/admin/users/[id]', targetRole });
          return NextResponse.json(
            { error: 'hospitalId is required for hospital-admin role' },
            { status: 400 }
          );
        }
      } else if (targetRole === 'group-admin') {
        if (targetHospitalId !== null && targetHospitalId !== undefined) {
          return NextResponse.json(
            { error: 'hospitalId must be null for group-admin role' },
            { status: 400 }
          );
        }
      }
    }

    // If groupId is being updated, verify it exists and belongs to tenant
    const targetGroupId = data.groupId !== undefined ? data.groupId : existingUser.groupId;
    if (data.groupId !== undefined) {
      const group = await prisma.orgGroup.findFirst({
        where: { id: data.groupId, tenantId: tenant.id },
      });

      if (!group) {
        return NextResponse.json(
          { error: 'Group not found or access denied' },
          { status: 404 }
        );
      }

      // If group-admin, verify they can only update users in their group
      if (authResult.userRole === 'group-admin' && user.groupId !== data.groupId) {
        return NextResponse.json(
          { error: 'Cannot move user to another group' },
          { status: 403 }
        );
      }
    }

    // If hospitalId is being updated, verify it exists and belongs to the group
    if (data.hospitalId !== undefined && data.hospitalId !== null) {
      const hospital = await prisma.hospital.findFirst({
        where: { id: data.hospitalId, groupId: targetGroupId || undefined, tenantId: tenant.id },
      });

      if (!hospital) {
        return NextResponse.json(
          { error: 'Hospital not found or does not belong to the specified group' },
          { status: 404 }
        );
      }
    }

    const targetRole = data.role !== undefined ? String(data.role || '').trim().toLowerCase() : existingUser.role;
    const targetStaffId =
      data.staffId !== undefined ? String(data.staffId || '').trim() : String(existingUser.staffId || '').trim();
    if (targetRole.includes('doctor') && targetStaffId) {
      const provider = await prisma.clinicalInfraProvider.findFirst({
        where: {
          tenantId: tenant.id,
          staffId: targetStaffId,
          isArchived: { not: true },
        },
      });
      if (!provider) {
        return NextResponse.json(
          {
            error: 'Staff ID not found in providers. Please create a provider record first or use the Doctor Onboarding wizard.',
            code: 'STAFF_ID_NOT_FOUND',
            suggestion: '/admin/doctors/onboard',
          },
          { status: 400 }
        );
      }
      const existingStaffUser = await prisma.user.findFirst({
        where: {
          staffId: targetStaffId,
          tenantId: tenant.id,
          NOT: { id: existingUser.id },
        },
      });
      if (existingStaffUser) {
        return NextResponse.json(
          { error: 'This Staff ID is already assigned to another user.', code: 'STAFF_ID_DUPLICATE' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: any = {
      updatedBy: userId,
    };

    if (data.permissions !== undefined) {
      updateData.permissions = data.permissions;
    }

    if (data.password) {
      const passwordValidation = validatePassword(data.password, { email: existingUser.email ?? undefined });
      if (!passwordValidation.valid) {
        return NextResponse.json(
          {
            error: 'Password policy violation',
            message: passwordValidation.errors[0]?.messageEn || 'Password does not meet requirements',
            errors: passwordValidation.errors,
          },
          { status: 400 }
        );
      }
      updateData.password = await hashPassword(data.password);
    }

    if (data.role !== undefined) {
      const roleKey = String(data.role || '').trim().toLowerCase();
      const allowedRole = await isAllowedRole(tenant.id, roleKey);
      if (!allowedRole) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      // [SEC-02] Role hierarchy: prevent escalation beyond operator's level
      const PRIVILEGED_ROLES = ['admin', 'group-admin', 'hospital-admin', 'thea-owner'];
      const operatorRole = String(authResult.userRole || '').toLowerCase();
      if (PRIVILEGED_ROLES.includes(roleKey) && operatorRole !== 'admin' && operatorRole !== 'thea-owner') {
        return NextResponse.json(
          { error: 'Only admin or owner can assign privileged roles', code: 'ROLE_ESCALATION_DENIED' },
          { status: 403 }
        );
      }
      updateData.role = roleKey;
      // If role changed and no permissions provided, update to default for new role
      if (data.permissions === undefined) {
        updateData.permissions =
          (await getRoleDefinitionPermissions(tenant.id, roleKey)) || getDefaultPermissionsForRole(roleKey);
      }
    }

    if (data.groupId !== undefined) {
      updateData.groupId = data.groupId;
    }

    if (data.hospitalId !== undefined) {
      updateData.hospitalId = data.hospitalId;
    }

    if (data.departments !== undefined) {
      updateData.department = data.departments.length ? data.departments.join(', ') : (data.department || null);
    } else if (data.department !== undefined) {
      updateData.department = data.department;
    }

    if (data.staffId !== undefined) {
      updateData.staffId = data.staffId;
    }

    if (data.employeeNo !== undefined) {
      const employeeNo = String(data.employeeNo || '').trim();
      if (employeeNo) {
        const existingEmployeeNo = await prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            employeeNo,
            NOT: { id },
          },
        });
        if (existingEmployeeNo) {
          return NextResponse.json(
            { error: 'User with this employee number already exists' },
            { status: 400 }
          );
        }
        updateData.employeeNo = employeeNo;
      } else {
        updateData.employeeNo = null;
      }
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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
    });

    // Sync departments to TenantUser (PostgreSQL) for department-based access control
    if (data.departments !== undefined) {
      try {
        await prisma.tenantUser.upsert({
          where: { tenantId_userId: { tenantId: tenant.id, userId: id } },
          update: { departments: data.departments },
          create: {
            tenantId: tenant.id,
            userId: id,
            displayName: `${existingUser.firstName || ''} ${existingUser.lastName || ''}`.trim(),
            email: existingUser.email || '',
            roles: [String(existingUser.role || '')],
            departments: data.departments,
            isActive: true,
          },
        });
      } catch (err) {
        logger.error('Failed to sync departments to TenantUser', { category: 'api', error: err });
      }
    }

    // Create audit log (exclude password from changes)
    const changesForAudit = { ...updateData };
    delete changesForAudit.password;
    await createAuditLog('user', id, 'update', userId, authResult.userEmail, changesForAudit, tenantId);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
});
