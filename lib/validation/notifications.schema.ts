import { z } from 'zod';

// ─── Emit Notification ───────────────────────────────────
export const emitNotificationSchema = z.object({
  scope: z.string().min(1, 'scope is required'),
  kind: z.string().min(1, 'kind is required'),
  severity: z.string().optional(),
  title: z.string().min(1, 'title is required'),
  message: z.string().optional(),
  entity: z.string().optional(),
  dedupeKey: z.string().optional(),
  recipientUserId: z.string().optional(),
  recipientRole: z.string().optional(),
});

// ─── Tasks ───────────────────────────────────────────────
export const createTaskSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  title: z.string().min(1, 'title is required'),
  taskType: z.string().min(1, 'taskType is required'),
  priority: z.string().optional(),
  dueAt: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const cancelTaskSchema = z.object({
  reason: z.string().optional(),
});

export const notDoneTaskSchema = z.object({
  reason: z.string().optional(),
});

// ─── Department Entry ────────────────────────────────────
export const departmentEntrySchema = z.object({
  departmentId: z.string().min(1, 'departmentId is required'),
  userId: z.string().min(1, 'userId is required'),
});
