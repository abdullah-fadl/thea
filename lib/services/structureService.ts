/**
 * Structure Service - Patient Experience
 *
 * Unified service layer for Floors, Departments, and Rooms (Patient Experience module)
 * Migrated from MongoDB to Prisma / raw PostgreSQL.
 *
 * TODO: Create Prisma models for Floor, FloorDepartment, FloorRoom to replace raw SQL.
 */

import { prisma } from '@/lib/db/prisma';
import { Floor, FloorDepartment, FloorRoom } from '@/lib/models/Floor';

// ============================================================================
// Floor Operations
// ============================================================================

export async function getAllFloors(tenantId?: string): Promise<Floor[]> {
  const where: any = { active: true };
  if (tenantId) {
    where.OR = [
      { tenantId },
      { tenantId: null },
      { tenantId: '' },
    ];
  }

  // TODO: Replace with prisma.floor.findMany once Floor model is created.
  const floors: any[] = await prisma.$queryRaw`
    SELECT * FROM floors
    WHERE active = true
      AND (${tenantId}::text IS NULL OR "tenantId" = ${tenantId ?? ''} OR "tenantId" IS NULL OR "tenantId" = '')
    ORDER BY number ASC
  `;

  return floors.map((floor: any) => ({
    id: floor.id,
    number: floor.number,
    name: floor.name,
    key: floor.key,
    label_en: floor.label_en,
    label_ar: floor.label_ar,
    active: floor.active !== false,
    tenantId: floor.tenantId,
    createdAt: floor.createdAt,
    updatedAt: floor.updatedAt,
    createdBy: floor.createdBy,
    updatedBy: floor.updatedBy,
  })) as Floor[];
}

export async function getFloorById(id: string, tenantId?: string): Promise<Floor | null> {
  const floors: any[] = await prisma.$queryRaw`
    SELECT * FROM floors
    WHERE id = ${id} AND active = true
      AND (${tenantId ?? ''}::text = '' OR "tenantId" = ${tenantId ?? ''} OR "tenantId" IS NULL OR "tenantId" = '')
    LIMIT 1
  `;

  if (!floors.length) return null;
  const floor = floors[0];

  return {
    id: floor.id,
    number: floor.number,
    name: floor.name,
    key: floor.key,
    label_en: floor.label_en,
    label_ar: floor.label_ar,
    active: floor.active !== false,
    tenantId: floor.tenantId,
    createdAt: floor.createdAt,
    updatedAt: floor.updatedAt,
    createdBy: floor.createdBy,
    updatedBy: floor.updatedBy,
  } as Floor;
}

export async function createFloor(data: {
  number: string;
  name?: string;
  label_en: string;
  label_ar: string;
  key?: string;
  createdBy: string;
  tenantId?: string;
}): Promise<Floor> {
  const { v4: uuidv4 } = await import('uuid');

  const floorId = uuidv4();
  const floorKey = data.key || `FLOOR_${data.number}`;
  const now = new Date();

  const floor: Floor = {
    id: floorId,
    number: data.number,
    name: data.name,
    key: floorKey,
    label_en: data.label_en,
    label_ar: data.label_ar,
    active: true,
    tenantId: data.tenantId || '',
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy,
    updatedBy: data.createdBy,
  };

  await prisma.$executeRaw`
    INSERT INTO floors (id, number, name, key, label_en, label_ar, active, "tenantId", "createdAt", "updatedAt", "createdBy", "updatedBy")
    VALUES (${floor.id}, ${floor.number}, ${floor.name ?? null}, ${floor.key}, ${floor.label_en}, ${floor.label_ar}, true, ${floor.tenantId}, ${now}, ${now}, ${floor.createdBy ?? null}, ${floor.updatedBy ?? null})
  `;

  return floor;
}

export async function updateFloor(
  id: string,
  data: Partial<{
    number: string;
    name: string;
    label_en: string;
    label_ar: string;
    updatedBy: string;
  }>
): Promise<Floor | null> {
  // Use parameterized query to prevent SQL injection
  await prisma.$executeRaw`
    UPDATE floors SET
      "updatedAt" = NOW(),
      number = COALESCE(${data.number ?? null}, number),
      name = COALESCE(${data.name ?? null}, name),
      label_en = COALESCE(${data.label_en ?? null}, label_en),
      label_ar = COALESCE(${data.label_ar ?? null}, label_ar),
      "updatedBy" = COALESCE(${data.updatedBy ?? null}, "updatedBy")
    WHERE id = ${id} AND active = true
  `;

  return getFloorById(id);
}

export async function deleteFloor(id: string, updatedBy: string, hardDelete: boolean = true): Promise<boolean> {
  if (hardDelete) {
    const result = await prisma.$executeRaw`DELETE FROM floors WHERE id = ${id}`;
    return result > 0;
  } else {
    const result = await prisma.$executeRaw`
      UPDATE floors SET active = false, "updatedAt" = NOW(), "updatedBy" = ${updatedBy}
      WHERE id = ${id} AND active = true
    `;
    return result > 0;
  }
}

// ============================================================================
// Department Operations
// ============================================================================

export async function getAllDepartments(tenantId?: string): Promise<FloorDepartment[]> {
  const departments: any[] = await prisma.$queryRaw`
    SELECT * FROM floor_departments
    WHERE active = true
      AND (${tenantId ?? ''}::text = '' OR "tenantId" = ${tenantId ?? ''} OR "tenantId" IS NULL OR "tenantId" = '')
    ORDER BY label_en ASC
  `;

  return departments.map((dept: any) => ({
    id: dept.id,
    floorId: dept.floorId,
    floorKey: dept.floorKey,
    departmentId: dept.departmentId,
    departmentKey: dept.departmentKey,
    departmentName: dept.departmentName,
    key: dept.key,
    label_en: dept.label_en || dept.labelEn,
    label_ar: dept.label_ar || dept.labelAr,
    active: dept.active !== false,
    tenantId: dept.tenantId,
    createdAt: dept.createdAt,
    updatedAt: dept.updatedAt,
    createdBy: dept.createdBy,
    updatedBy: dept.updatedBy,
  })) as FloorDepartment[];
}

export async function getDepartmentsByFloor(floorKey: string, tenantId?: string): Promise<FloorDepartment[]> {
  const departments: any[] = await prisma.$queryRaw`
    SELECT * FROM floor_departments
    WHERE "floorKey" = ${floorKey} AND active = true
      AND (${tenantId ?? ''}::text = '' OR "tenantId" = ${tenantId ?? ''} OR "tenantId" IS NULL OR "tenantId" = '')
    ORDER BY label_en ASC
  `;

  return departments.map((dept: any) => ({
    id: dept.id,
    floorId: dept.floorId,
    floorKey: dept.floorKey,
    departmentId: dept.departmentId,
    departmentKey: dept.departmentKey,
    departmentName: dept.departmentName,
    key: dept.key,
    label_en: dept.label_en || dept.labelEn,
    label_ar: dept.label_ar || dept.labelAr,
    active: dept.active !== false,
    tenantId: dept.tenantId,
    createdAt: dept.createdAt,
    updatedAt: dept.updatedAt,
    createdBy: dept.createdBy,
    updatedBy: dept.updatedBy,
  })) as FloorDepartment[];
}

export async function createDepartment(data: {
  floorId?: string;
  floorKey?: string;
  departmentId?: string;
  departmentKey: string;
  departmentName?: string;
  label_en: string;
  label_ar: string;
  key?: string;
  createdBy: string;
  tenantId?: string;
}): Promise<FloorDepartment> {
  const { v4: uuidv4 } = await import('uuid');

  const deptId = uuidv4();
  const deptKey = data.key || data.departmentKey || `DEPT_${deptId.slice(0, 8).toUpperCase()}`;
  const now = new Date();

  const department: FloorDepartment = {
    id: deptId,
    floorId: data.floorId || '',
    floorKey: data.floorKey || '',
    departmentId: data.departmentId || deptId,
    departmentKey: data.departmentKey,
    departmentName: data.departmentName,
    key: deptKey,
    label_en: data.label_en,
    label_ar: data.label_ar,
    active: true,
    tenantId: data.tenantId || '',
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy,
    updatedBy: data.createdBy,
  };

  await prisma.$executeRaw`
    INSERT INTO floor_departments (id, "floorId", "floorKey", "departmentId", "departmentKey", "departmentName", key, label_en, label_ar, active, "tenantId", "createdAt", "updatedAt", "createdBy", "updatedBy")
    VALUES (${department.id}, ${department.floorId}, ${department.floorKey}, ${department.departmentId}, ${department.departmentKey}, ${department.departmentName ?? null}, ${department.key}, ${department.label_en}, ${department.label_ar}, true, ${department.tenantId}, ${now}, ${now}, ${department.createdBy ?? null}, ${department.updatedBy ?? null})
  `;

  return department;
}

export async function updateDepartment(
  id: string,
  data: Partial<{
    floorKey: string;
    departmentKey: string;
    departmentName: string;
    label_en: string;
    label_ar: string;
    updatedBy: string;
    tenantId?: string;
  }>,
  tenantId?: string
): Promise<FloorDepartment | null> {
  const effectiveTenantId = data.tenantId || tenantId || '';

  // Use parameterized query to prevent SQL injection
  await prisma.$executeRaw`
    UPDATE floor_departments SET
      "updatedAt" = NOW(),
      "floorKey" = COALESCE(${data.floorKey ?? null}, "floorKey"),
      "departmentKey" = COALESCE(${data.departmentKey ?? null}, "departmentKey"),
      "departmentName" = COALESCE(${data.departmentName ?? null}, "departmentName"),
      label_en = COALESCE(${data.label_en ?? null}, label_en),
      label_ar = COALESCE(${data.label_ar ?? null}, label_ar),
      "updatedBy" = COALESCE(${data.updatedBy ?? null}, "updatedBy")
    WHERE id = ${id} AND active = true
      AND (${effectiveTenantId}::text = '' OR "tenantId" = ${effectiveTenantId} OR "tenantId" IS NULL OR "tenantId" = '')
  `;

  // Re-fetch
  const rows: any[] = await prisma.$queryRaw`SELECT * FROM floor_departments WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return null;

  const updated = rows[0];
  return {
    id: updated.id,
    floorId: updated.floorId,
    floorKey: updated.floorKey,
    departmentId: updated.departmentId,
    departmentKey: updated.departmentKey,
    departmentName: updated.departmentName,
    key: updated.key,
    label_en: updated.label_en,
    label_ar: updated.label_ar,
    active: updated.active !== false,
    tenantId: updated.tenantId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    createdBy: updated.createdBy,
    updatedBy: updated.updatedBy,
  } as FloorDepartment;
}

export async function deleteDepartment(id: string, updatedBy: string, tenantId?: string, hardDelete: boolean = true): Promise<boolean> {
  const effectiveTenantId = tenantId || '';

  if (hardDelete) {
    const result = await prisma.$executeRaw`
      DELETE FROM floor_departments
      WHERE id = ${id}
        AND (${effectiveTenantId}::text = '' OR "tenantId" = ${effectiveTenantId} OR "tenantId" IS NULL OR "tenantId" = '')
    `;
    return result > 0;
  } else {
    const result = await prisma.$executeRaw`
      UPDATE floor_departments SET active = false, "updatedAt" = NOW(), "updatedBy" = ${updatedBy}
      WHERE id = ${id} AND active = true
        AND (${effectiveTenantId}::text = '' OR "tenantId" = ${effectiveTenantId} OR "tenantId" IS NULL OR "tenantId" = '')
    `;
    return result > 0;
  }
}

// ============================================================================
// Room Operations
// ============================================================================

export async function getAllRooms(tenantId?: string): Promise<FloorRoom[]> {
  const rooms: any[] = await prisma.$queryRaw`
    SELECT * FROM floor_rooms
    WHERE active = true
      AND (${tenantId ?? ''}::text = '' OR "tenantId" = ${tenantId ?? ''} OR "tenantId" IS NULL OR "tenantId" = '')
    ORDER BY "roomNumber" ASC
  `;

  return rooms.map((room: any) => ({
    id: room.id,
    floorId: room.floorId,
    floorKey: room.floorKey,
    departmentId: room.departmentId,
    departmentKey: room.departmentKey,
    roomNumber: room.roomNumber,
    roomName: room.roomName,
    key: room.key,
    label_en: room.label_en || room.labelEn,
    label_ar: room.label_ar || room.labelAr,
    active: room.active !== false,
    tenantId: room.tenantId,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    createdBy: room.createdBy,
    updatedBy: room.updatedBy,
  })) as FloorRoom[];
}

export async function getRoomsByFloorAndDepartment(
  floorKey: string,
  departmentKey: string,
  tenantId?: string
): Promise<FloorRoom[]> {
  const rooms: any[] = await prisma.$queryRaw`
    SELECT * FROM floor_rooms
    WHERE "floorKey" = ${floorKey} AND "departmentKey" = ${departmentKey} AND active = true
      AND (${tenantId ?? ''}::text = '' OR "tenantId" = ${tenantId ?? ''} OR "tenantId" IS NULL OR "tenantId" = '')
    ORDER BY "roomNumber" ASC
  `;

  return rooms.map((room: any) => ({
    id: room.id,
    floorId: room.floorId,
    floorKey: room.floorKey,
    departmentId: room.departmentId,
    departmentKey: room.departmentKey,
    roomNumber: room.roomNumber,
    roomName: room.roomName,
    key: room.key,
    label_en: room.label_en || room.labelEn,
    label_ar: room.label_ar || room.labelAr,
    active: room.active !== false,
    tenantId: room.tenantId,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    createdBy: room.createdBy,
    updatedBy: room.updatedBy,
  })) as FloorRoom[];
}

export async function createRoom(data: {
  floorId: string;
  floorKey: string;
  departmentId: string;
  departmentKey: string;
  roomNumber: string;
  roomName?: string;
  label_en: string;
  label_ar: string;
  key?: string;
  createdBy: string;
  tenantId?: string;
}): Promise<FloorRoom> {
  const { v4: uuidv4 } = await import('uuid');

  const roomId = uuidv4();
  const roomKey = data.key || `ROOM_${data.roomNumber.replace(/\s+/g, '_').toUpperCase()}`;
  const now = new Date();

  const room: FloorRoom = {
    id: roomId,
    floorId: data.floorId,
    floorKey: data.floorKey,
    departmentId: data.departmentId,
    departmentKey: data.departmentKey,
    roomNumber: data.roomNumber,
    roomName: data.roomName,
    key: roomKey,
    label_en: data.label_en,
    label_ar: data.label_ar,
    active: true,
    tenantId: data.tenantId || '',
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy,
    updatedBy: data.createdBy,
  };

  await prisma.$executeRaw`
    INSERT INTO floor_rooms (id, "floorId", "floorKey", "departmentId", "departmentKey", "roomNumber", "roomName", key, label_en, label_ar, active, "tenantId", "createdAt", "updatedAt", "createdBy", "updatedBy")
    VALUES (${room.id}, ${room.floorId}, ${room.floorKey}, ${room.departmentId}, ${room.departmentKey}, ${room.roomNumber}, ${room.roomName ?? null}, ${room.key}, ${room.label_en}, ${room.label_ar}, true, ${room.tenantId}, ${now}, ${now}, ${room.createdBy ?? null}, ${room.updatedBy ?? null})
  `;

  return room;
}

export async function updateRoom(
  id: string,
  data: Partial<{
    floorKey: string;
    departmentKey: string;
    roomNumber: string;
    roomName: string;
    label_en: string;
    label_ar: string;
    updatedBy: string;
  }>
): Promise<FloorRoom | null> {
  // Use parameterized query to prevent SQL injection
  await prisma.$executeRaw`
    UPDATE floor_rooms SET
      "updatedAt" = NOW(),
      "floorKey" = COALESCE(${data.floorKey ?? null}, "floorKey"),
      "departmentKey" = COALESCE(${data.departmentKey ?? null}, "departmentKey"),
      "roomNumber" = COALESCE(${data.roomNumber ?? null}, "roomNumber"),
      "roomName" = COALESCE(${data.roomName ?? null}, "roomName"),
      label_en = COALESCE(${data.label_en ?? null}, label_en),
      label_ar = COALESCE(${data.label_ar ?? null}, label_ar),
      "updatedBy" = COALESCE(${data.updatedBy ?? null}, "updatedBy")
    WHERE id = ${id} AND active = true
  `;

  const rows: any[] = await prisma.$queryRaw`SELECT * FROM floor_rooms WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return null;

  const updated = rows[0];
  return {
    id: updated.id,
    floorId: updated.floorId,
    floorKey: updated.floorKey,
    departmentId: updated.departmentId,
    departmentKey: updated.departmentKey,
    roomNumber: updated.roomNumber,
    roomName: updated.roomName,
    key: updated.key,
    label_en: updated.label_en,
    label_ar: updated.label_ar,
    active: updated.active !== false,
    tenantId: updated.tenantId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    createdBy: updated.createdBy,
    updatedBy: updated.updatedBy,
  } as FloorRoom;
}

export async function deleteRoom(id: string, updatedBy: string): Promise<boolean> {
  const result = await prisma.$executeRaw`
    UPDATE floor_rooms SET active = false, "updatedAt" = NOW(), "updatedBy" = ${updatedBy}
    WHERE id = ${id} AND active = true
  `;
  return result > 0;
}
