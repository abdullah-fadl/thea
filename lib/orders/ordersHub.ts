import { createAuditLog } from '@/lib/utils/audit';
import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';

export type OrderKind = 'LAB' | 'RADIOLOGY' | 'PROCEDURE' | 'MEDICATION';
export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'RESULT_READY'
  | 'CANCELLED'
  | 'COMPLETED';

export type OrderEventType =
  | 'PLACE'
  | 'ACCEPT'
  | 'START'
  | 'RESULT_READY'
  | 'COMPLETE'
  | 'CANCEL'
  | 'ACK_RESULT'
  | 'ASSIGN';

export interface MedicationOrderMeta {
  medicationCatalogId: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: string;
  instructions?: string;
  indication?: string;
  prn?: boolean;
  prescribedById: string;
  prescribedAt: string;
  form?: string;
  strength?: string;
}

export const ORDER_KIND_TO_DEPARTMENT: Record<OrderKind, string> = {
  LAB: 'laboratory',
  RADIOLOGY: 'radiology',
  PROCEDURE: 'operating-room',
  MEDICATION: 'pharmacy',
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['RESULT_READY', 'CANCELLED'],
  RESULT_READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function normalizeDepartmentKey(value?: string | null): string | null {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  const allowed = new Set(['laboratory', 'radiology', 'operating-room', 'cath-lab', 'pharmacy']);
  return allowed.has(key) ? key : null;
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'CANCELLED') return from !== 'COMPLETED' && from !== 'CANCELLED';
  return TRANSITIONS[from]?.includes(to) || false;
}

const ORDER_EVENT_TYPE_MAP: Record<OrderEventType, string> = {
  PLACE: 'ORDERED',
  ACCEPT: 'ACCEPTED',
  START: 'IN_PROGRESS',
  RESULT_READY: 'RESULTED',
  COMPLETE: 'COMPLETED',
  CANCEL: 'CANCELLED',
  ACK_RESULT: 'ACK_RESULT',
  ASSIGN: 'ASSIGN',
};

export async function appendOrderEvent(args: {
  db?: unknown; // ignored — kept for backward compat
  tenantId: string;
  orderId: string;
  encounterCoreId: string;
  type: OrderEventType;
  time?: Date;
  actorUserId?: string | null;
  actorDisplay?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const now = args.time || new Date();
  const eventType = ORDER_EVENT_TYPE_MAP[args.type] ?? args.type;
  const toStatus = eventType;
  const note = args.payload ? JSON.stringify(args.payload) : null;
  const event = {
    id: uuidv4(),
    tenantId: args.tenantId,
    orderId: args.orderId,
    eventType,
    fromStatus: null,
    toStatus,
    note,
    performedBy: args.actorUserId || null,
    createdAt: now,
  };
  await prisma.orderEvent.create({ data: event });
  return { ...event, type: args.type, payload: args.payload };
}

export async function auditOrder(args: {
  tenantId: string;
  orderId: string;
  action: string;
  userId?: string | null;
  userEmail?: string | null;
  changes?: Record<string, unknown>;
}) {
  await createAuditLog(
    'orders_hub',
    args.orderId,
    args.action,
    args.userId || 'system',
    args.userEmail || undefined,
    args.changes,
    args.tenantId
  );
}

export async function transitionOrderStatus(args: {
  db?: unknown; // ignored — kept for backward compat
  tenantId: string;
  orderId: string;
  nextStatus: OrderStatus;
  action: OrderEventType;
  userId?: string | null;
  userEmail?: string | null;
  actorDisplay?: string | null;
  cancelReason?: string | null;
  _version?: number | null;
}) {
  const order = await prisma.ordersHub.findFirst({
    where: { tenantId: args.tenantId, id: args.orderId },
  });
  if (!order) {
    return { error: 'Order not found', status: 404 as const };
  }

  const currentStatus = String(order.status || '') as OrderStatus;
  if (currentStatus === args.nextStatus) {
    return { order, noOp: true };
  }
  if (!canTransition(currentStatus, args.nextStatus)) {
    return { error: 'Invalid transition', status: 400 as const, currentStatus };
  }

  // Optimistic locking: reject if version doesn't match
  if (args._version != null && order.version != null) {
    if (Number(args._version) !== Number(order.version)) {
      return { error: 'Version conflict — order was modified by another user', status: 409 as const, code: 'VERSION_CONFLICT' };
    }
  }

  const now = new Date();
  const patch: Record<string, unknown> = {
    status: args.nextStatus,
    updatedAt: now,
  };
  if (args.nextStatus === 'ACCEPTED') patch.acceptedAt = now;
  if (args.nextStatus === 'IN_PROGRESS') patch.inProgressAt = now;
  if (args.nextStatus === 'RESULT_READY') patch.resultedAt = now;
  if (args.nextStatus === 'COMPLETED') patch.completedAt = now;
  if (args.nextStatus === 'CANCELLED') {
    patch.cancelledAt = now;
    patch.cancelReason = args.cancelReason || null;
  }

  const updated = await prisma.ordersHub.update({
    where: { id: args.orderId },
    data: {
      ...patch,
      version: { increment: 1 },
    },
  });

  await appendOrderEvent({
    tenantId: args.tenantId,
    orderId: args.orderId,
    encounterCoreId: updated.encounterCoreId || '',
    type: args.action,
    time: now,
    actorUserId: args.userId || null,
    actorDisplay: args.actorDisplay || null,
    payload: args.nextStatus === 'CANCELLED' ? { cancelReason: args.cancelReason || null } : null,
  });
  await auditOrder({
    tenantId: args.tenantId,
    orderId: args.orderId,
    action: args.action,
    userId: args.userId || null,
    userEmail: args.userEmail || null,
    changes: { before: order, after: updated },
  });

  return { order: updated };
}

export async function assignOrder(args: {
  db?: unknown; // ignored — kept for backward compat
  tenantId: string;
  orderId: string;
  assignedTo: { userId?: string | null; display?: string | null };
  userId?: string | null;
  userEmail?: string | null;
  actorDisplay?: string | null;
}) {
  const order = await prisma.ordersHub.findFirst({
    where: { tenantId: args.tenantId, id: args.orderId },
  });
  if (!order) {
    return { error: 'Order not found', status: 404 as const };
  }
  const currentStatus = String(order.status || '') as OrderStatus;
  if (currentStatus === 'CANCELLED' || currentStatus === 'COMPLETED') {
    return { error: 'Cannot assign completed/cancelled order', status: 409 as const, currentStatus };
  }

  const normalizedUserId = args.assignedTo.userId ? String(args.assignedTo.userId) : null;
  const normalizedDisplay = args.assignedTo.display ? String(args.assignedTo.display) : null;
  const existingUserId = order.assignedToUserId || null;
  if (String(existingUserId || '') === String(normalizedUserId || '')) {
    return { order, noOp: true };
  }

  const now = new Date();
  // Store assignedTo userId in the dedicated column, display in meta JSON
  const currentMeta = (order.meta as Record<string, unknown>) || {};
  const updated = await prisma.ordersHub.update({
    where: { id: args.orderId },
    data: {
      assignedToUserId: normalizedUserId,
      meta: { ...currentMeta, assignedToDisplay: normalizedDisplay },
      updatedAt: now,
      version: { increment: 1 },
    },
  });

  await appendOrderEvent({
    tenantId: args.tenantId,
    orderId: args.orderId,
    encounterCoreId: updated.encounterCoreId || '',
    type: 'ASSIGN',
    time: now,
    actorUserId: args.userId || null,
    actorDisplay: args.actorDisplay || null,
    payload: { assignedTo: { userId: normalizedUserId, display: normalizedDisplay } },
  });
  await auditOrder({
    tenantId: args.tenantId,
    orderId: args.orderId,
    action: 'ASSIGN',
    userId: args.userId || null,
    userEmail: args.userEmail || null,
    changes: { before: order, after: updated },
  });

  return { order: updated };
}
