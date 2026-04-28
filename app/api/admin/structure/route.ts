import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { createAuditLog } from '@/lib/utils/audit';

// Schemas

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const createFloorSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

const createDepartmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(['OPD', 'IPD', 'BOTH']),
  floorId: z.string().min(1), // Floor ID is required
});

const createRoomSchema = z.object({
  floorId: z.string().min(1),
  departmentId: z.string().min(1),
  roomNumber: z.string().min(1),
  roomName: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - Fetch all floors, departments, and rooms
export const GET = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userRole = authResult.userRole;

    // Fetch user permissions from DB
    const user = await prisma.user.findFirst({
      where: { id: authResult.userId },
      select: { permissions: true },
    });
    const userPermissions = user?.permissions || [];

    // Allow if user has admin.structure-management.view, admin.users permissions, or admin role
    const hasPermission =
      userRole === 'admin' ||
      userPermissions.includes('admin.structure-management.view') ||
      userPermissions.includes('admin.users.view') ||
      userPermissions.includes('admin.users') ||
      userPermissions.some(p => p.startsWith('admin.'));

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Resolve tenant
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const [floors, departments, rooms] = await Promise.all([
      prisma.clinicalInfraFloor.findMany({
        where: { tenantId: tenant.id, status: 'active' },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      prisma.department.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      prisma.clinicalInfraRoom.findMany({
        where: { tenantId: tenant.id, status: 'active' },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ]);

    if (process.env.DEBUG_TENANT === '1') {
      logger.debug('Structure data fetched', { category: 'api', route: 'GET /api/admin/structure', tenantId, floorsCount: floors.length, departmentsCount: departments.length, roomsCount: rooms.length });
    }

    return NextResponse.json({ floors, departments, rooms });
});

// POST - Create floor, department, or room
export const POST = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userRole = authResult.userRole;

    // Fetch user permissions from DB
    const user = await prisma.user.findFirst({
      where: { id: authResult.userId },
      select: { permissions: true },
    });
    const userPermissions = user?.permissions || [];

    const hasPermission =
      userRole === 'admin' ||
      userPermissions.includes('admin.structure-management.create') ||
      userPermissions.includes('admin.users.view') ||
      userPermissions.includes('admin.users') ||
      userPermissions.some(p => p.startsWith('admin.'));

    if (!hasPermission) {
      logger.warn('Permission check failed', { category: 'auth', route: 'POST /api/admin/structure', userId: authResult.userId, userRole, permissions: userPermissions });
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to create' }, { status: 403 });
    }

    // Resolve tenant
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = await request.json();
    const { type, data } = body;

    if (type === 'floor') {
      const vf = validateBody(data, createFloorSchema);
      if ('error' in vf) return vf.error;
      const validated = vf.data;

      // Check for duplicate floor number within tenant
      const existingFloor = await prisma.clinicalInfraFloor.findFirst({
        where: { tenantId: tenant.id, shortCode: `FLOOR_${validated.number}`, status: 'active' },
      });

      if (existingFloor) {
        return NextResponse.json(
          { error: 'الطابق موجود بالفعل' },
          { status: 400 }
        );
      }

      const floor = await prisma.clinicalInfraFloor.create({
        data: {
          tenantId: tenant.id,
          name: validated.label_en,
          shortCode: `FLOOR_${validated.number}`,
          level: parseInt(validated.number, 10) || 0,
          status: 'active',
          createdBy: authResult.userId,
          updatedBy: authResult.userId,
        },
      });

      await createAuditLog('clinical_infra_floor', floor.id, 'FLOOR_CREATED', authResult.userId, undefined, { number: validated.number, label_en: validated.label_en }, tenantId);

      // Return with backward-compatible fields
      return NextResponse.json({
        success: true,
        floor: {
          ...floor,
          number: validated.number,
          key: `FLOOR_${validated.number}`,
          label_en: validated.label_en,
          label_ar: validated.label_ar,
          active: true,
        },
      });
    }

    if (type === 'department') {
      const vd = validateBody(data, createDepartmentSchema);
      if ('error' in vd) return vd.error;
      const validated = vd.data;

      // Verify floor exists within tenant
      const floor = await prisma.clinicalInfraFloor.findFirst({
        where: { tenantId: tenant.id, id: validated.floorId },
      });
      if (!floor) {
        return NextResponse.json(
          { error: 'Floor not found' },
          { status: 400 }
        );
      }

      // Check for duplicate department name or code
      const existingDept = await prisma.department.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
          OR: [
            { name: validated.name },
            { code: validated.code },
          ],
        },
      });

      if (existingDept) {
        if (existingDept.name === validated.name) {
          return NextResponse.json(
            { error: 'اسم القسم موجود بالفعل في هذا الطابق' },
            { status: 400 }
          );
        }
        if (existingDept.code === validated.code) {
          return NextResponse.json(
            { error: 'رمز القسم موجود بالفعل في هذا الطابق' },
            { status: 400 }
          );
        }
      }

      const department = await prisma.department.create({
        data: {
          tenantId: tenant.id,
          name: validated.name,
          code: validated.code,
          type: validated.type,
          isActive: true,
        },
      });

      await createAuditLog('department', department.id, 'DEPARTMENT_CREATED', authResult.userId, undefined, { name: validated.name, code: validated.code, type: validated.type }, tenantId);

      return NextResponse.json({ success: true, department });
    }

    if (type === 'room') {
      const vr = validateBody(data, createRoomSchema);
      if ('error' in vr) return vr.error;
      const validated = vr.data;

      // Verify floor and department exist within tenant
      const floor = await prisma.clinicalInfraFloor.findFirst({
        where: { tenantId: tenant.id, id: validated.floorId },
      });
      const department = await prisma.department.findFirst({
        where: { tenantId: tenant.id, id: validated.departmentId },
      });

      if (!floor || !department) {
        return NextResponse.json(
          { error: 'Floor or Department not found' },
          { status: 400 }
        );
      }

      // Check for duplicate room
      const existingRoom = await prisma.clinicalInfraRoom.findFirst({
        where: {
          tenantId: tenant.id,
          floorId: validated.floorId,
          shortCode: `ROOM_${validated.roomNumber}`,
          status: 'active',
        },
      });

      if (existingRoom) {
        return NextResponse.json(
          { error: 'رقم الغرفة موجود بالفعل في هذا القسم والطابق' },
          { status: 400 }
        );
      }

      const room = await prisma.clinicalInfraRoom.create({
        data: {
          tenantId: tenant.id,
          floorId: validated.floorId,
          name: validated.label_en,
          shortCode: `ROOM_${validated.roomNumber}`,
          roomType: 'general',
          status: 'active',
          createdBy: authResult.userId,
          updatedBy: authResult.userId,
        },
      });

      await createAuditLog('clinical_infra_room', room.id, 'ROOM_CREATED', authResult.userId, undefined, { roomNumber: validated.roomNumber, label_en: validated.label_en }, tenantId);

    return NextResponse.json({
        success: true,
        room: {
          ...room,
          roomNumber: validated.roomNumber,
          roomName: validated.roomName || '',
          key: `ROOM_${validated.roomNumber}`,
          label_en: validated.label_en,
          label_ar: validated.label_ar,
          active: true,
          departmentId: validated.departmentId,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid type. Must be floor, department, or room' },
      { status: 400 }
    );
});

/**
 * Check dependencies for Floor before deactivation
 */
async function checkFloorDependencies(tenantUuid: string, floorId: string): Promise<{ departments: number; rooms: number }> {
  const [departmentsCount, roomsCount] = await Promise.all([
    prisma.department.count({ where: { tenantId: tenantUuid, isActive: true } }),
    prisma.clinicalInfraRoom.count({ where: { tenantId: tenantUuid, floorId, status: 'active' } }),
  ]);

  return { departments: departmentsCount, rooms: roomsCount };
}

/**
 * Check dependencies for Department before deactivation
 */
async function checkDepartmentDependencies(tenantUuid: string, departmentId: string): Promise<{ rooms: number; clinics: number; patientExperience: number }> {
  const roomsCount = await prisma.clinicalInfraRoom.count({
    where: { tenantId: tenantUuid, status: 'active' },
  });

  // Clinics and patient experience are not yet fully migrated, so return 0 for now
  return {
    rooms: roomsCount,
    clinics: 0,
    patientExperience: 0,
  };
}

/**
 * Check dependencies for Room before deactivation
 */
async function checkRoomDependencies(tenantUuid: string, roomId: string): Promise<{ clinics: number }> {
  // Clinics not yet fully migrated
  return { clinics: 0 };
}

// DELETE - Delete floor, department, or room
export const DELETE = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userRole = authResult.userRole;

    // Fetch user permissions from DB
    const user = await prisma.user.findFirst({
      where: { id: authResult.userId },
      select: { permissions: true },
    });
    const userPermissions = user?.permissions || [];

    const hasPermission =
      userRole === 'admin' ||
      userPermissions.includes('admin.structure-management.delete') ||
      userPermissions.includes('admin.users.view') ||
      userPermissions.includes('admin.users') ||
      userPermissions.some(p => p.startsWith('admin.'));

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to delete' }, { status: 403 });
    }

    // Resolve tenant
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantIdKey = tenantIdResult;

    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantIdKey), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const dryRun = searchParams.get('dryRun') === '1' || searchParams.get('dryRun') === 'true';

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Type and ID are required' },
        { status: 400 }
      );
    }

    if (type === 'floor') {
      const dependencies = await checkFloorDependencies(tenant.id, id);
      const totalDependencies = dependencies.departments + dependencies.rooms;

      if (totalDependencies > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'HAS_DEPENDENCIES',
            message: 'Cannot deactivate floor because it has linked records.',
            dependencies,
            ...(dryRun && { dryRun: true }),
          },
          { status: 409 }
        );
      }

      if (dryRun) {
        return NextResponse.json({
          ok: true,
          dryRun: true,
          dependencies,
          message: 'No dependencies found. Deletion would succeed.',
        });
      }

      await prisma.clinicalInfraFloor.update({
        where: { id },
        data: { status: 'inactive', updatedBy: authResult.userId },
      });
      await createAuditLog('clinical_infra_floor', id, 'FLOOR_DEACTIVATED', authResult.userId, undefined, {}, tenantIdKey);
      return NextResponse.json({ success: true });
    }

    if (type === 'department') {
      const dependencies = await checkDepartmentDependencies(tenant.id, id);
      const totalDependencies = dependencies.rooms + dependencies.clinics + dependencies.patientExperience;

      if (totalDependencies > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'HAS_DEPENDENCIES',
            message: 'Cannot deactivate department because it has linked records.',
            dependencies,
            ...(dryRun && { dryRun: true }),
          },
          { status: 409 }
        );
      }

      if (dryRun) {
        return NextResponse.json({
          ok: true,
          dryRun: true,
          dependencies,
          message: 'No dependencies found. Deletion would succeed.',
        });
      }

      await prisma.department.update({
        where: { id },
        data: { isActive: false },
      });
      await createAuditLog('department', id, 'DEPARTMENT_DEACTIVATED', authResult.userId, undefined, {}, tenantIdKey);
      return NextResponse.json({ success: true });
    }

    if (type === 'room') {
      // Get room to check it exists
      const room = await prisma.clinicalInfraRoom.findFirst({
        where: { tenantId: tenant.id, id },
      });

      if (!room) {
        return NextResponse.json(
          { error: 'Room not found' },
          { status: 404 }
        );
      }

      const dependencies = await checkRoomDependencies(tenant.id, id);
      const totalDependencies = dependencies.clinics;

      if (totalDependencies > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'HAS_DEPENDENCIES',
            message: 'Cannot deactivate room because it has linked records.',
            dependencies,
            ...(dryRun && { dryRun: true }),
          },
          { status: 409 }
        );
      }

      if (dryRun) {
        return NextResponse.json({
          ok: true,
          dryRun: true,
          dependencies,
          message: 'No dependencies found. Deletion would succeed.',
        });
      }

      await prisma.clinicalInfraRoom.update({
        where: { id },
        data: { status: 'inactive', updatedBy: authResult.userId },
      });
      await createAuditLog('clinical_infra_room', id, 'ROOM_DEACTIVATED', authResult.userId, undefined, {}, tenantIdKey);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid type' },
      { status: 400 }
    );
});
