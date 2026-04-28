/**
 * Transport Engine — Core business logic for Patient Transport Management
 *
 * Handles:
 * - Transport request lifecycle (create → assign → in_transit → complete)
 * - Auto-assignment of nearest available transport staff by zone
 * - Status validation state machine
 * - Metrics and KPI calculations
 * - Staff workload management
 * - Estimated transport time based on historical data
 */

import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransportRequestType = 'intra_facility' | 'inter_facility' | 'ambulance' | 'discharge';
export type TransportUrgency = 'stat' | 'urgent' | 'routine' | 'scheduled';
export type TransportStatus = 'pending' | 'assigned' | 'in_transit' | 'completed' | 'cancelled';
export type TransportMode = 'wheelchair' | 'stretcher' | 'bed' | 'ambulatory' | 'ambulance' | 'neonatal_isolette';
export type StaffStatus = 'available' | 'busy' | 'off_duty' | 'break';
export type IsolationType = 'contact' | 'droplet' | 'airborne';

export interface CreateTransportRequestInput {
  tenantId: string;
  patientId: string;
  patientName?: string;
  encounterId?: string;
  requestType: TransportRequestType;
  urgency: TransportUrgency;
  origin: string;
  originDetails?: string;
  destination: string;
  destinationDetails?: string;
  requestedBy: string;
  requestedByName?: string;
  scheduledAt?: Date;
  transportMode: TransportMode;
  oxygenRequired?: boolean;
  monitorRequired?: boolean;
  ivPumpRequired?: boolean;
  isolationRequired?: boolean;
  isolationType?: IsolationType;
  nurseEscort?: boolean;
  specialInstructions?: string;
  notes?: string;
}

export interface UpdateTransportStatusInput {
  requestId: string;
  tenantId: string;
  status: TransportStatus;
  userId?: string;
  cancelReason?: string;
}

export interface TransportMetrics {
  totalRequests: number;
  pendingCount: number;
  assignedCount: number;
  inTransitCount: number;
  completedCount: number;
  cancelledCount: number;
  avgResponseTimeMinutes: number | null;
  avgTransportTimeMinutes: number | null;
  completionRate: number;
  byUrgency: Record<string, number>;
  byMode: Record<string, number>;
  byRequestType: Record<string, number>;
}

export interface StaffWorkload {
  id: string;
  name: string;
  nameAr: string | null;
  status: string;
  zone: string | null;
  currentTask: string | null;
  completedToday: number;
  avgTransportTime: number | null;
}

// ---------------------------------------------------------------------------
// Valid status transitions (state machine)
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<TransportStatus, TransportStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_transit', 'pending', 'cancelled'], // can go back to pending (unassign)
  in_transit: ['completed', 'cancelled'],
  completed: [], // terminal state
  cancelled: [], // terminal state
};

// Stat escalation threshold in minutes
const STAT_ESCALATION_THRESHOLD_MINUTES = 5;

// ---------------------------------------------------------------------------
// Create Transport Request
// ---------------------------------------------------------------------------

export async function createTransportRequest(input: CreateTransportRequestInput) {
  const {
    tenantId,
    patientId,
    patientName,
    encounterId,
    requestType,
    urgency,
    origin,
    originDetails,
    destination,
    destinationDetails,
    requestedBy,
    requestedByName,
    scheduledAt,
    transportMode,
    oxygenRequired = false,
    monitorRequired = false,
    ivPumpRequired = false,
    isolationRequired = false,
    isolationType,
    nurseEscort = false,
    specialInstructions,
    notes,
  } = input;

  // Estimate duration based on historical data
  const estimatedDuration = await estimateTransportTime(tenantId, origin, destination);

  const request = await prisma.transportRequest.create({
    data: {
      tenantId,
      patientId,
      patientName: patientName ?? null,
      encounterId: encounterId ?? null,
      requestType,
      urgency,
      status: 'pending',
      origin,
      originDetails: originDetails ?? null,
      destination,
      destinationDetails: destinationDetails ?? null,
      requestedBy,
      requestedByName: requestedByName ?? null,
      scheduledAt: scheduledAt ?? null,
      transportMode,
      oxygenRequired,
      monitorRequired,
      ivPumpRequired,
      isolationRequired,
      isolationType: isolationRequired ? (isolationType ?? null) : null,
      nurseEscort,
      specialInstructions: specialInstructions ?? null,
      estimatedDuration,
      notes: notes ?? null,
    },
  });

  // Attempt auto-assignment for stat/urgent requests
  if (urgency === 'stat' || urgency === 'urgent') {
    try {
      const assigned = await autoAssignTransporter(request.id, tenantId, origin);
      if (assigned) {
        logger.info('[Transport] Auto-assigned transporter', {
          category: 'clinical' as const,
          tenantId,
          requestId: request.id,
          assignedTo: assigned.assignedTo,
        });
        return assigned;
      }
    } catch (e) {
      logger.warn('[Transport] Auto-assignment failed, request left as pending', {
        category: 'clinical' as const,
        error: e instanceof Error ? e : undefined,
      });
    }
  }

  return request;
}

// ---------------------------------------------------------------------------
// Auto-Assign Transporter
// ---------------------------------------------------------------------------

export async function autoAssignTransporter(
  requestId: string,
  tenantId: string,
  originZone?: string,
) {
  // Find available transport staff, preferring same zone
  const availableStaff = await prisma.transportStaff.findMany({
    where: {
      tenantId,
      status: 'available',
      isActive: true,
      currentTask: null,
    },
    orderBy: { updatedAt: 'asc' }, // least recently updated = idle longest
    take: 500,
  });

  if (availableStaff.length === 0) {
    return null;
  }

  // Prefer staff in the same zone
  let bestMatch = availableStaff[0];
  if (originZone) {
    const zoneNorm = originZone.toLowerCase().trim();
    const sameZone = availableStaff.find(
      (s) => s.zone && s.zone.toLowerCase().trim() === zoneNorm,
    );
    if (sameZone) bestMatch = sameZone;
  }

  // Assign staff to the request
  const [updatedRequest] = await prisma.$transaction([
    prisma.transportRequest.update({
      where: { id: requestId },
      data: {
        status: 'assigned',
        assignedTo: bestMatch.userId,
        assignedToName: bestMatch.name,
        dispatchedAt: new Date(),
      },
    }),
    prisma.transportStaff.update({
      where: { id: bestMatch.id },
      data: {
        status: 'busy',
        currentTask: requestId,
      },
    }),
  ]);

  return updatedRequest;
}

// ---------------------------------------------------------------------------
// Update Transport Status (State Machine)
// ---------------------------------------------------------------------------

export async function updateTransportStatus(input: UpdateTransportStatusInput) {
  const { requestId, tenantId, status, userId, cancelReason } = input;

  const request = await prisma.transportRequest.findFirst({
    where: { id: requestId, tenantId },
  });

  if (!request) {
    throw new Error('Transport request not found');
  }

  const currentStatus = request.status as TransportStatus;
  const allowedNext = VALID_TRANSITIONS[currentStatus];

  if (!allowedNext || !allowedNext.includes(status)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${status}. Allowed: ${allowedNext?.join(', ') || 'none'}`,
    );
  }

  // Build update data based on target status
  const now = new Date();
  const updateData: Record<string, unknown> = { status };

  switch (status) {
    case 'assigned':
      updateData.dispatchedAt = now;
      break;
    case 'in_transit':
      updateData.pickedUpAt = now;
      break;
    case 'completed':
      updateData.completedAt = now;
      updateData.arrivedAt = now;
      // Calculate actual duration
      if (request.dispatchedAt) {
        updateData.actualDuration = Math.round(
          (now.getTime() - new Date(request.dispatchedAt).getTime()) / 60000,
        );
      }
      break;
    case 'cancelled':
      updateData.cancelledAt = now;
      updateData.cancelReason = cancelReason ?? null;
      break;
  }

  const updated = await prisma.transportRequest.update({
    where: { id: requestId },
    data: updateData,
  });

  // Release transport staff when completed or cancelled
  if ((status === 'completed' || status === 'cancelled') && request.assignedTo) {
    try {
      await prisma.transportStaff.updateMany({
        where: {
          tenantId,
          userId: request.assignedTo,
          currentTask: requestId,
        },
        data: {
          status: 'available',
          currentTask: null,
        },
      });
    } catch (e) {
      logger.warn('[Transport] Failed to release staff', {
        category: 'clinical' as const,
        error: e instanceof Error ? e : undefined,
      });
    }
  }

  // If going back to pending (unassignment), release staff
  if (status === 'pending' && request.assignedTo) {
    try {
      await prisma.transportStaff.updateMany({
        where: {
          tenantId,
          userId: request.assignedTo,
          currentTask: requestId,
        },
        data: {
          status: 'available',
          currentTask: null,
        },
      });
    } catch (e) {
      logger.warn('[Transport] Failed to release staff on unassignment', {
        category: 'clinical' as const,
        error: e instanceof Error ? e : undefined,
      });
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Get Active Transports
// ---------------------------------------------------------------------------

export async function getActiveTransports(tenantId: string) {
  return prisma.transportRequest.findMany({
    where: {
      tenantId,
      status: { in: ['pending', 'assigned', 'in_transit'] },
    },
    orderBy: [
      { urgency: 'asc' }, // stat first
      { createdAt: 'asc' },
    ],
    take: 200,
  });
}

// ---------------------------------------------------------------------------
// Get Transport Requests (with filtering)
// ---------------------------------------------------------------------------

export async function getTransportRequests(
  tenantId: string,
  filters?: {
    status?: string;
    urgency?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  },
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters?.status) where.status = filters.status;
  if (filters?.urgency) where.urgency = filters.urgency;
  if (filters?.dateFrom || filters?.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  return prisma.transportRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 200,
  });
}

// ---------------------------------------------------------------------------
// Get Transport Metrics
// ---------------------------------------------------------------------------

export async function getTransportMetrics(
  tenantId: string,
  dateRange?: { from: Date; to: Date },
): Promise<TransportMetrics> {
  const dateFilter = dateRange
    ? { createdAt: { gte: dateRange.from, lte: dateRange.to } }
    : {};

  const requests = await prisma.transportRequest.findMany({
    where: { tenantId, ...dateFilter },
    select: {
      status: true,
      urgency: true,
      transportMode: true,
      requestType: true,
      createdAt: true,
      dispatchedAt: true,
      completedAt: true,
      actualDuration: true,
    },
    take: 500,
  });

  const totalRequests = requests.length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const assignedCount = requests.filter((r) => r.status === 'assigned').length;
  const inTransitCount = requests.filter((r) => r.status === 'in_transit').length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;
  const cancelledCount = requests.filter((r) => r.status === 'cancelled').length;

  // Average response time (created → dispatched)
  const responseTimes = requests
    .filter((r) => r.dispatchedAt && r.createdAt)
    .map((r) => (new Date(r.dispatchedAt!).getTime() - new Date(r.createdAt).getTime()) / 60000);
  const avgResponseTimeMinutes =
    responseTimes.length > 0
      ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
      : null;

  // Average transport time (actual duration)
  const transportTimes = requests
    .filter((r) => r.actualDuration != null)
    .map((r) => r.actualDuration!);
  const avgTransportTimeMinutes =
    transportTimes.length > 0
      ? Math.round((transportTimes.reduce((a, b) => a + b, 0) / transportTimes.length) * 10) / 10
      : null;

  // Completion rate
  const finishedCount = completedCount + cancelledCount;
  const completionRate =
    finishedCount > 0
      ? Math.round((completedCount / finishedCount) * 1000) / 10
      : 0;

  // Group by urgency
  const byUrgency: Record<string, number> = {};
  for (const r of requests) {
    byUrgency[r.urgency] = (byUrgency[r.urgency] || 0) + 1;
  }

  // Group by mode
  const byMode: Record<string, number> = {};
  for (const r of requests) {
    byMode[r.transportMode] = (byMode[r.transportMode] || 0) + 1;
  }

  // Group by request type
  const byRequestType: Record<string, number> = {};
  for (const r of requests) {
    byRequestType[r.requestType] = (byRequestType[r.requestType] || 0) + 1;
  }

  return {
    totalRequests,
    pendingCount,
    assignedCount,
    inTransitCount,
    completedCount,
    cancelledCount,
    avgResponseTimeMinutes,
    avgTransportTimeMinutes,
    completionRate,
    byUrgency,
    byMode,
    byRequestType,
  };
}

// ---------------------------------------------------------------------------
// Get Staff Workload
// ---------------------------------------------------------------------------

export async function getStaffWorkload(tenantId: string): Promise<StaffWorkload[]> {
  const staff = await prisma.transportStaff.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
    take: 500,
  });

  // Get today's completed counts per staff
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const completedToday = await prisma.transportRequest.findMany({
    where: {
      tenantId,
      status: 'completed',
      completedAt: { gte: todayStart },
      assignedTo: { not: null },
    },
    select: {
      assignedTo: true,
      actualDuration: true,
    },
    take: 500,
  });

  // Build workload map
  const workloadMap: Record<string, { count: number; durations: number[] }> = {};
  for (const req of completedToday) {
    if (!req.assignedTo) continue;
    if (!workloadMap[req.assignedTo]) {
      workloadMap[req.assignedTo] = { count: 0, durations: [] };
    }
    workloadMap[req.assignedTo].count++;
    if (req.actualDuration != null) {
      workloadMap[req.assignedTo].durations.push(req.actualDuration);
    }
  }

  return staff.map((s) => {
    const wl = workloadMap[s.userId] || { count: 0, durations: [] };
    const avgTransportTime =
      wl.durations.length > 0
        ? Math.round((wl.durations.reduce((a, b) => a + b, 0) / wl.durations.length) * 10) / 10
        : null;

    return {
      id: s.id,
      name: s.name,
      nameAr: s.nameAr,
      status: s.status,
      zone: s.zone,
      currentTask: s.currentTask,
      completedToday: wl.count,
      avgTransportTime,
    };
  });
}

// ---------------------------------------------------------------------------
// Estimate Transport Time
// ---------------------------------------------------------------------------

export async function estimateTransportTime(
  tenantId: string,
  origin: string,
  destination: string,
): Promise<number | null> {
  // Look for historical data matching similar origin → destination
  const historical = await prisma.transportRequest.findMany({
    where: {
      tenantId,
      status: 'completed',
      origin,
      destination,
      actualDuration: { not: null },
    },
    select: { actualDuration: true },
    orderBy: { completedAt: 'desc' },
    take: 20,
  });

  if (historical.length === 0) {
    // Try broader matching (any origin→destination) for a rough baseline
    const allCompleted = await prisma.transportRequest.findMany({
      where: {
        tenantId,
        status: 'completed',
        actualDuration: { not: null },
      },
      select: { actualDuration: true },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    if (allCompleted.length === 0) return null;
    const durations = allCompleted.map((r) => r.actualDuration!);
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }

  const durations = historical.map((r) => r.actualDuration!);
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

// ---------------------------------------------------------------------------
// Check Stat Escalation
// ---------------------------------------------------------------------------

export async function checkStatEscalation(tenantId: string): Promise<Array<{
  id: string;
  patientName: string | null;
  origin: string;
  destination: string;
  minutesPending: number;
}>> {
  const threshold = new Date(Date.now() - STAT_ESCALATION_THRESHOLD_MINUTES * 60 * 1000);

  const overdue = await prisma.transportRequest.findMany({
    where: {
      tenantId,
      urgency: 'stat',
      status: 'pending',
      createdAt: { lte: threshold },
    },
    take: 100,
    select: {
      id: true,
      patientName: true,
      origin: true,
      destination: true,
      createdAt: true,
    },
  });

  return overdue.map((r) => ({
    id: r.id,
    patientName: r.patientName,
    origin: r.origin,
    destination: r.destination,
    minutesPending: Math.round((Date.now() - new Date(r.createdAt).getTime()) / 60000),
  }));
}

// ---------------------------------------------------------------------------
// Assign Transporter (Manual)
// ---------------------------------------------------------------------------

export async function assignTransporter(
  requestId: string,
  tenantId: string,
  staffId: string,
) {
  const request = await prisma.transportRequest.findFirst({
    where: { id: requestId, tenantId },
  });

  if (!request) throw new Error('Transport request not found');
  if (request.status !== 'pending' && request.status !== 'assigned') {
    throw new Error(`Cannot assign transporter when status is ${request.status}`);
  }

  const staff = await prisma.transportStaff.findFirst({
    where: { id: staffId, tenantId, isActive: true },
  });

  if (!staff) throw new Error('Transport staff not found');
  if (staff.status !== 'available') {
    throw new Error(`Staff member is currently ${staff.status}`);
  }

  // Release previous assignee if re-assigning
  if (request.assignedTo) {
    await prisma.transportStaff.updateMany({
      where: {
        tenantId,
        userId: request.assignedTo,
        currentTask: requestId,
      },
      data: {
        status: 'available',
        currentTask: null,
      },
    });
  }

  const [updatedRequest] = await prisma.$transaction([
    prisma.transportRequest.update({
      where: { id: requestId },
      data: {
        status: 'assigned',
        assignedTo: staff.userId,
        assignedToName: staff.name,
        dispatchedAt: new Date(),
      },
    }),
    prisma.transportStaff.update({
      where: { id: staffId },
      data: {
        status: 'busy',
        currentTask: requestId,
      },
    }),
  ]);

  return updatedRequest;
}
