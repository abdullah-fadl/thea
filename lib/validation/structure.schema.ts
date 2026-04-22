import { z } from 'zod';

// ─── Create Department ───────────────────────────────────
export const createDepartmentSchema = z.object({
  floorId: z.string().optional(),
  floorKey: z.string().optional(),
  departmentKey: z.string().min(1, 'departmentKey is required'),
  departmentName: z.string().optional(),
  label_en: z.string().optional(),
  label_ar: z.string().optional(),
});

// ─── Update Department ───────────────────────────────────
export const updateDepartmentSchema = z.object({
  departmentName: z.string().optional(),
  label_en: z.string().optional(),
  label_ar: z.string().optional(),
  floorId: z.string().optional(),
  floorKey: z.string().optional(),
});

// ─── Create Floor ────────────────────────────────────────
export const createFloorSchema = z.object({
  label_en: z.string().min(1, 'label_en is required'),
  label_ar: z.string().optional(),
  floorKey: z.string().min(1, 'floorKey is required'),
});

// ─── Update Floor ────────────────────────────────────────
export const updateFloorSchema = z.object({
  label_en: z.string().optional(),
  label_ar: z.string().optional(),
  floorKey: z.string().optional(),
});

// ─── Create Room ─────────────────────────────────────────
export const createRoomSchema = z.object({
  label: z.string().min(1, 'label is required'),
  roomNumber: z.string().optional(),
  location: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  departmentId: z.string().optional(),
  floorId: z.string().optional(),
});

// ─── Update Room ─────────────────────────────────────────
export const updateRoomSchema = z.object({
  label: z.string().optional(),
  roomNumber: z.string().optional(),
  location: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

// ─── Create Org Node ─────────────────────────────────────
export const createOrgNodeSchema = z.object({
  type: z.string().min(1, 'type is required'),
  name: z.string().min(1, 'name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

// ─── Update Org Node ─────────────────────────────────────
export const updateOrgNodeSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
});

// ─── Move Org Node ───────────────────────────────────────
export const moveOrgNodeSchema = z.object({
  parentId: z.string().optional(),
});

// ─── Equipment ───────────────────────────────────────────
export const equipmentSchema = z.object({
  name: z.string().min(1, 'name is required'),
  code: z.string().optional(),
  type: z.string().min(1, 'type is required'),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  department: z.string().optional(),
});
