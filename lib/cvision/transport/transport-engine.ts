import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Transportation Management Engine
 *
 * Complete transport system: routes, vehicles, assignments, requests, trips.
 * Supports capacity checks, payroll deduction integration, approval workflows.
 *
 * Collections:
 *  - cvision_transport_routes
 *  - cvision_transport_vehicles
 *  - cvision_transport_assignments
 *  - cvision_transport_requests
 *  - cvision_transport_trips
 *  - cvision_transport_allowance  (legacy, kept for backward compat)
 */

import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { v4 as uuid } from 'uuid';

/* ── Collection names ─────────────────────────────────────────────── */

const ROUTES      = 'cvision_transport_routes';
const VEHICLES    = 'cvision_transport_vehicles';
const ASSIGNMENTS = 'cvision_transport_assignments';
const REQUESTS    = 'cvision_transport_requests';
const TRIPS       = 'cvision_transport_trips';

/* ── Types ────────────────────────────────────────────────────────── */

export type RouteType      = 'BUS' | 'VAN' | 'SHUTTLE';
export type RouteStatus    = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type Direction      = 'TO_WORK' | 'FROM_WORK';
export type VehicleStatus  = 'ACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';
export type AssignmentStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
export type RequestType    = 'NEW_ASSIGNMENT' | 'CHANGE_ROUTE' | 'CHANGE_STOP' | 'CANCEL' | 'TEMPORARY';
export type RequestStatus  = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TripStatus     = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Stop {
  stopId: string;
  name: string;
  nameAr?: string;
  latitude?: number;
  longitude?: number;
  arrivalTime: string;
  order: number;
}

export interface Schedule {
  direction: Direction;
  departureTime: string;
  arrivalTime: string;
  days: string[];
}

/* ════════════════════════════════════════════════════════════════════
 *  ROUTES
 * ════════════════════════════════════════════════════════════════════ */

export async function listRoutes(db: Db, tenantId: string, filters?: { status?: string }) {
  const q: any = { tenantId };
  if (filters?.status) q.status = filters.status;
  return db.collection(ROUTES).find(q).sort({ routeNumber: 1, createdAt: -1 }).toArray();
}

export async function getRoute(db: Db, tenantId: string, routeId: string) {
  return db.collection(ROUTES).findOne({ tenantId, routeId });
}

export async function createRoute(db: Db, tenantId: string, data: any, userId: string) {
  const count = await db.collection(ROUTES).countDocuments({ tenantId });
  const routeNumber = `RT-${String(count + 1).padStart(3, '0')}`;
  const now = new Date();
  const doc = {
    tenantId,
    routeId: uuid(),
    routeNumber,
    name: data.name || '',
    nameAr: data.nameAr || '',
    type: (data.type || 'BUS') as RouteType,
    status: 'ACTIVE' as RouteStatus,
    stops: data.stops || [],
    schedule: data.schedule || [],
    capacity: data.capacity || 40,
    currentPassengers: 0,
    monthlyCostPerEmployee: data.monthlyCostPerEmployee || 0,
    description: data.description || '',
    gpsEnabled: data.gpsEnabled ?? false,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };
  await db.collection(ROUTES).insertOne(doc);
  return doc;
}

export async function updateRoute(db: Db, tenantId: string, routeId: string, updates: any, userId: string) {
  const $set: any = { updatedAt: new Date(), updatedBy: userId };
  const allowed = ['name', 'nameAr', 'type', 'status', 'stops', 'schedule', 'capacity', 'monthlyCostPerEmployee', 'description', 'gpsEnabled'];
  for (const k of allowed) {
    if (updates[k] !== undefined) $set[k] = updates[k];
  }
  await db.collection(ROUTES).updateOne({ tenantId, routeId }, { $set });
}

export async function deleteRoute(db: Db, tenantId: string, routeId: string) {
  // Check for active assignments
  const active = await db.collection(ASSIGNMENTS).countDocuments({ tenantId, routeId, status: 'ACTIVE' });
  if (active > 0) throw new Error(`Cannot delete route with ${active} active assignments`);
  await db.collection(ROUTES).updateOne(
    { tenantId, routeId },
    { $set: { status: 'INACTIVE', updatedAt: new Date() } },
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  VEHICLES
 * ════════════════════════════════════════════════════════════════════ */

export async function listVehicles(db: Db, tenantId: string, filters?: { status?: string }) {
  const q: any = { tenantId };
  if (filters?.status) q.status = filters.status;
  return db.collection(VEHICLES).find(q).sort({ vehicleNumber: 1 }).toArray();
}

export async function getVehicle(db: Db, tenantId: string, vehicleId: string) {
  return db.collection(VEHICLES).findOne({ tenantId, vehicleId });
}

export async function createVehicle(db: Db, tenantId: string, data: any, userId: string) {
  const count = await db.collection(VEHICLES).countDocuments({ tenantId });
  const vehicleNumber = `VH-${String(count + 1).padStart(3, '0')}`;
  const now = new Date();
  const doc = {
    tenantId,
    vehicleId: uuid(),
    vehicleNumber,
    plateNumber: data.plateNumber || '',
    type: data.type || 'BUS',
    make: data.make || '',
    model: data.model || '',
    year: data.year || new Date().getFullYear(),
    capacity: data.capacity || 40,
    status: 'ACTIVE' as VehicleStatus,
    driverName: data.driverName || '',
    driverPhone: data.driverPhone || '',
    assignedRouteId: data.assignedRouteId || null,
    // Insurance & registration
    insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : null,
    registrationExpiry: data.registrationExpiry ? new Date(data.registrationExpiry) : null,
    nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : null,
    lastMaintenanceDate: data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate) : null,
    mileage: data.mileage || 0,
    fuelType: data.fuelType || 'DIESEL',
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };
  await db.collection(VEHICLES).insertOne(doc);
  return doc;
}

export async function updateVehicle(db: Db, tenantId: string, vehicleId: string, updates: any, userId: string) {
  const $set: any = { updatedAt: new Date(), updatedBy: userId };
  const allowed = [
    'plateNumber', 'type', 'make', 'model', 'year', 'capacity', 'status',
    'driverName', 'driverPhone', 'assignedRouteId',
    'insuranceExpiry', 'registrationExpiry', 'nextMaintenanceDate', 'lastMaintenanceDate',
    'mileage', 'fuelType', 'notes',
  ];
  for (const k of allowed) {
    if (updates[k] !== undefined) {
      $set[k] = ['insuranceExpiry', 'registrationExpiry', 'nextMaintenanceDate', 'lastMaintenanceDate'].includes(k) && updates[k]
        ? new Date(updates[k])
        : updates[k];
    }
  }
  await db.collection(VEHICLES).updateOne({ tenantId, vehicleId }, { $set });
}

/* ════════════════════════════════════════════════════════════════════
 *  ASSIGNMENTS
 * ════════════════════════════════════════════════════════════════════ */

export async function listAssignments(db: Db, tenantId: string, filters?: { routeId?: string; status?: string }) {
  const q: any = { tenantId };
  if (filters?.routeId) q.routeId = filters.routeId;
  if (filters?.status) q.status = filters.status;
  return db.collection(ASSIGNMENTS).find(q).sort({ createdAt: -1 }).toArray();
}

export async function getEmployeeAssignment(db: Db, tenantId: string, employeeId: string) {
  return db.collection(ASSIGNMENTS).findOne({ tenantId, employeeId, status: 'ACTIVE' });
}

export async function assignEmployee(
  db: Db, tenantId: string, data: {
    employeeId: string; employeeName?: string; routeId: string;
    pickupStopId?: string; dropoffStopId?: string; monthlyDeduction?: number;
  },
  userId: string,
) {
  // 1. Check capacity
  const route = await db.collection(ROUTES).findOne({ tenantId, routeId: data.routeId });
  if (!route) throw new Error('Route not found');
  if (route.status !== 'ACTIVE') throw new Error('Route is not active');
  const currentCount = route.currentPassengers || 0;
  if (currentCount >= route.capacity) throw new Error('Route is at full capacity');

  // 2. Cancel any existing active assignment for this employee
  await db.collection(ASSIGNMENTS).updateMany(
    { tenantId, employeeId: data.employeeId, status: 'ACTIVE' },
    { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userId } },
  );

  // Also decrement old route passenger count
  const oldAssignment = await db.collection(ASSIGNMENTS).findOne({
    tenantId, employeeId: data.employeeId, status: 'CANCELLED', cancelledBy: userId,
  });
  if (oldAssignment && oldAssignment.routeId !== data.routeId) {
    await db.collection(ROUTES).updateOne(
      { tenantId, routeId: oldAssignment.routeId, currentPassengers: { $gt: 0 } },
      { $inc: { currentPassengers: -1 } },
    );
  }

  // 3. Create new assignment
  const now = new Date();
  const monthlyDeduction = data.monthlyDeduction ?? route.monthlyCostPerEmployee ?? 0;
  const doc = {
    tenantId,
    assignmentId: uuid(),
    employeeId: data.employeeId,
    employeeName: data.employeeName || '',
    routeId: data.routeId,
    routeName: route.name || '',
    pickupStopId: data.pickupStopId || '',
    dropoffStopId: data.dropoffStopId || '',
    monthlyDeduction,
    status: 'ACTIVE' as AssignmentStatus,
    startDate: now,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };
  await db.collection(ASSIGNMENTS).insertOne(doc);

  // 4. Increment route passenger count
  await db.collection(ROUTES).updateOne(
    { tenantId, routeId: data.routeId },
    { $inc: { currentPassengers: 1 }, $set: { updatedAt: now } },
  );

  return doc;
}

export async function removeEmployee(db: Db, tenantId: string, employeeId: string, userId: string) {
  const assignment = await db.collection(ASSIGNMENTS).findOne({ tenantId, employeeId, status: 'ACTIVE' });
  if (!assignment) throw new Error('No active assignment found');

  await db.collection(ASSIGNMENTS).updateOne(
    { tenantId, assignmentId: assignment.assignmentId },
    { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userId, updatedAt: new Date() } },
  );

  // Decrement route count
  await db.collection(ROUTES).updateOne(
    { tenantId, routeId: assignment.routeId, currentPassengers: { $gt: 0 } },
    { $inc: { currentPassengers: -1 }, $set: { updatedAt: new Date() } },
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  REQUESTS (Approval Workflow)
 * ════════════════════════════════════════════════════════════════════ */

export async function listRequests(db: Db, tenantId: string, filters?: { status?: string; employeeId?: string }) {
  const q: any = { tenantId };
  if (filters?.status) q.status = filters.status;
  if (filters?.employeeId) q.employeeId = filters.employeeId;
  return db.collection(REQUESTS).find(q).sort({ createdAt: -1 }).toArray();
}

export async function createRequest(
  db: Db, tenantId: string, data: {
    employeeId: string; employeeName?: string; type: RequestType;
    routeId?: string; newRouteId?: string; newPickupStopId?: string;
    newDropoffStopId?: string; reason?: string; temporaryStartDate?: string;
    temporaryEndDate?: string;
  },
  userId: string,
) {
  const now = new Date();
  const doc = {
    tenantId,
    requestId: uuid(),
    employeeId: data.employeeId,
    employeeName: data.employeeName || '',
    type: data.type,
    routeId: data.routeId || null,
    newRouteId: data.newRouteId || null,
    newPickupStopId: data.newPickupStopId || null,
    newDropoffStopId: data.newDropoffStopId || null,
    reason: data.reason || '',
    temporaryStartDate: data.temporaryStartDate ? new Date(data.temporaryStartDate) : null,
    temporaryEndDate: data.temporaryEndDate ? new Date(data.temporaryEndDate) : null,
    status: 'PENDING' as RequestStatus,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };
  await db.collection(REQUESTS).insertOne(doc);
  return doc;
}

export async function approveRequest(db: Db, tenantId: string, requestId: string, approverId: string) {
  const req = await db.collection(REQUESTS).findOne({ tenantId, requestId });
  if (!req) throw new Error('Request not found');
  if (req.status !== 'PENDING') throw new Error('Request is not pending');

  await db.collection(REQUESTS).updateOne(
    { tenantId, requestId },
    { $set: { status: 'APPROVED', approvedBy: approverId, approvedAt: new Date(), updatedAt: new Date() } },
  );

  // Auto-execute based on type
  try {
    if (req.type === 'NEW_ASSIGNMENT' && req.newRouteId) {
      await assignEmployee(db, tenantId, {
        employeeId: req.employeeId,
        employeeName: req.employeeName,
        routeId: req.newRouteId,
        pickupStopId: req.newPickupStopId || undefined,
        dropoffStopId: req.newDropoffStopId || undefined,
      }, approverId);
    } else if (req.type === 'CHANGE_ROUTE' && req.newRouteId) {
      await assignEmployee(db, tenantId, {
        employeeId: req.employeeId,
        employeeName: req.employeeName,
        routeId: req.newRouteId,
        pickupStopId: req.newPickupStopId || undefined,
        dropoffStopId: req.newDropoffStopId || undefined,
      }, approverId);
    } else if (req.type === 'CHANGE_STOP') {
      const assignment = await db.collection(ASSIGNMENTS).findOne({ tenantId, employeeId: req.employeeId, status: 'ACTIVE' });
      if (assignment) {
        const upd: any = { updatedAt: new Date() };
        if (req.newPickupStopId) upd.pickupStopId = req.newPickupStopId;
        if (req.newDropoffStopId) upd.dropoffStopId = req.newDropoffStopId;
        await db.collection(ASSIGNMENTS).updateOne(
          { tenantId, assignmentId: assignment.assignmentId },
          { $set: upd },
        );
      }
    } else if (req.type === 'CANCEL') {
      await removeEmployee(db, tenantId, req.employeeId, approverId);
    }
  } catch (err) {
    logger.error('[Transport] Auto-execute after approval failed:', err);
  }

  return { ok: true };
}

export async function rejectRequest(db: Db, tenantId: string, requestId: string, rejectedBy: string, reason?: string) {
  await db.collection(REQUESTS).updateOne(
    { tenantId, requestId, status: 'PENDING' },
    { $set: { status: 'REJECTED', rejectedBy, rejectionReason: reason || '', rejectedAt: new Date(), updatedAt: new Date() } },
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  TRIPS (Daily Trip Records)
 * ════════════════════════════════════════════════════════════════════ */

export async function listTrips(db: Db, tenantId: string, filters?: { routeId?: string; date?: string; status?: string }) {
  const q: any = { tenantId };
  if (filters?.routeId) q.routeId = filters.routeId;
  if (filters?.status) q.status = filters.status;
  if (filters?.date) {
    const d = new Date(filters.date);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    q.tripDate = { $gte: start, $lt: end };
  }
  return db.collection(TRIPS).find(q).sort({ tripDate: -1, direction: 1 }).toArray();
}

export async function recordTrip(
  db: Db, tenantId: string, data: {
    routeId: string; direction: Direction; tripDate?: string;
    vehicleId?: string; driverName?: string; passengers?: string[];
    notes?: string;
  },
  userId: string,
) {
  const route = await db.collection(ROUTES).findOne({ tenantId, routeId: data.routeId });
  if (!route) throw new Error('Route not found');

  const now = new Date();
  const tripDate = data.tripDate ? new Date(data.tripDate) : now;

  const doc = {
    tenantId,
    tripId: uuid(),
    routeId: data.routeId,
    routeName: route.name || '',
    direction: data.direction || 'TO_WORK',
    tripDate,
    vehicleId: data.vehicleId || null,
    driverName: data.driverName || '',
    status: 'COMPLETED' as TripStatus,
    passengersBoarded: data.passengers || [],
    passengerCount: data.passengers?.length || 0,
    expectedPassengers: route.currentPassengers || 0,
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };
  await db.collection(TRIPS).insertOne(doc);
  return doc;
}

export async function reportIssue(
  db: Db, tenantId: string, data: {
    tripId?: string; routeId?: string; vehicleId?: string;
    issueType: string; description: string;
  },
  userId: string,
) {
  const now = new Date();
  const doc = {
    tenantId,
    issueId: uuid(),
    tripId: data.tripId || null,
    routeId: data.routeId || null,
    vehicleId: data.vehicleId || null,
    issueType: data.issueType || 'OTHER',
    description: data.description || '',
    status: 'OPEN',
    reportedBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('cvision_transport_issues').insertOne(doc);
  return doc;
}

/* ════════════════════════════════════════════════════════════════════
 *  SCHEDULE VIEW
 * ════════════════════════════════════════════════════════════════════ */

export async function getSchedule(db: Db, tenantId: string, day?: string) {
  const routes = await db.collection(ROUTES).find({ tenantId, status: 'ACTIVE' }).toArray();
  const dayFilter = day || ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()];
  const schedule: any[] = [];
  for (const r of routes) {
    const daySchedules = (r.schedule || []).filter((s: any) => s.days?.includes(dayFilter));
    if (daySchedules.length > 0) {
      schedule.push({
        routeId: r.routeId,
        routeNumber: r.routeNumber,
        name: r.name,
        type: r.type,
        capacity: r.capacity,
        currentPassengers: r.currentPassengers || 0,
        schedules: daySchedules,
        stops: r.stops || [],
      });
    }
  }
  return schedule;
}

/* ════════════════════════════════════════════════════════════════════
 *  DASHBOARD / STATS
 * ════════════════════════════════════════════════════════════════════ */

export async function getDashboard(db: Db, tenantId: string) {
  const [routes, vehicles, assignments, recentTrips] = await Promise.all([
    db.collection(ROUTES).find({ tenantId }).toArray(),
    db.collection(VEHICLES).find({ tenantId }).toArray(),
    db.collection(ASSIGNMENTS).find({ tenantId, status: 'ACTIVE' }).toArray(),
    db.collection(TRIPS).find({ tenantId }).sort({ tripDate: -1 }).limit(30).toArray(),
  ]);

  const activeRoutes = routes.filter((r: any) => r.status === 'ACTIVE');
  const activeVehicles = vehicles.filter((v: any) => v.status === 'ACTIVE');
  const totalCapacity = activeRoutes.reduce((s: number, r: any) => s + (r.capacity || 0), 0);
  const totalPassengers = activeRoutes.reduce((s: number, r: any) => s + (r.currentPassengers || 0), 0);
  const occupancyRate = totalCapacity > 0 ? Math.round((totalPassengers / totalCapacity) * 100) : 0;
  const monthlyDeductions = assignments.reduce((s: number, a: any) => s + (a.monthlyDeduction || 0), 0);

  // Alerts
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringInsurance = vehicles.filter((v: any) => v.insuranceExpiry && new Date(v.insuranceExpiry) <= thirtyDays);
  const upcomingMaintenance = vehicles.filter((v: any) => v.nextMaintenanceDate && new Date(v.nextMaintenanceDate) <= thirtyDays);

  // Busiest routes
  const busiestRoutes = [...activeRoutes]
    .sort((a: any, b: any) => (b.currentPassengers || 0) - (a.currentPassengers || 0))
    .slice(0, 5)
    .map((r: any) => ({
      routeId: r.routeId,
      name: r.name,
      routeNumber: r.routeNumber,
      passengers: r.currentPassengers || 0,
      capacity: r.capacity || 0,
      occupancy: r.capacity ? Math.round(((r.currentPassengers || 0) / r.capacity) * 100) : 0,
    }));

  // Pending requests count
  const pendingRequests = await db.collection(REQUESTS).countDocuments({ tenantId, status: 'PENDING' });

  return {
    activeRoutes: activeRoutes.length,
    totalRoutes: routes.length,
    activeVehicles: activeVehicles.length,
    totalVehicles: vehicles.length,
    transportedEmployees: assignments.length,
    totalCapacity,
    totalPassengers,
    occupancyRate,
    monthlyDeductions,
    pendingRequests,
    busiestRoutes,
    expiringInsurance: expiringInsurance.length,
    upcomingMaintenance: upcomingMaintenance.length,
    alerts: {
      expiringInsurance: expiringInsurance.map((v: any) => ({ vehicleId: v.vehicleId, vehicleNumber: v.vehicleNumber, plateNumber: v.plateNumber, expiry: v.insuranceExpiry })),
      upcomingMaintenance: upcomingMaintenance.map((v: any) => ({ vehicleId: v.vehicleId, vehicleNumber: v.vehicleNumber, plateNumber: v.plateNumber, date: v.nextMaintenanceDate })),
    },
    recentTrips: recentTrips.slice(0, 10),
  };
}

/* ════════════════════════════════════════════════════════════════════
 *  PAYROLL INTEGRATION
 * ════════════════════════════════════════════════════════════════════ */

/**
 * Returns the monthly transport deduction for an employee.
 * Called by payroll calculator to include in payslip.
 */
export async function getTransportDeduction(db: Db, tenantId: string, employeeId: string): Promise<number> {
  const assignment = await db.collection(ASSIGNMENTS).findOne({ tenantId, employeeId, status: 'ACTIVE' });
  return assignment?.monthlyDeduction || 0;
}

/* ════════════════════════════════════════════════════════════════════
 *  ONBOARDING / OFFBOARDING HOOKS
 * ════════════════════════════════════════════════════════════════════ */

/**
 * Called during offboarding to cancel all transport assignments.
 */
export async function cancelAllAssignments(db: Db, tenantId: string, employeeId: string, userId: string) {
  const active = await db.collection(ASSIGNMENTS).find({ tenantId, employeeId, status: 'ACTIVE' }).toArray();
  for (const a of active) {
    await db.collection(ASSIGNMENTS).updateOne(
      { tenantId, assignmentId: a.assignmentId },
      { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userId, updatedAt: new Date() } },
    );
    await db.collection(ROUTES).updateOne(
      { tenantId, routeId: a.routeId, currentPassengers: { $gt: 0 } },
      { $inc: { currentPassengers: -1 }, $set: { updatedAt: new Date() } },
    );
  }
  return active.length;
}

/* ════════════════════════════════════════════════════════════════════
 *  EMPLOYEE SELF-SERVICE
 * ════════════════════════════════════════════════════════════════════ */

export async function getMyTransport(db: Db, tenantId: string, employeeId: string) {
  const assignment = await db.collection(ASSIGNMENTS).findOne({ tenantId, employeeId, status: 'ACTIVE' });
  if (!assignment) return { assigned: false, assignment: null, route: null };

  const route = await db.collection(ROUTES).findOne({ tenantId, routeId: assignment.routeId });
  const pickupStop = (route?.stops || []).find((s: any) => s.stopId === assignment.pickupStopId);
  const dropoffStop = (route?.stops || []).find((s: any) => s.stopId === assignment.dropoffStopId);

  return {
    assigned: true,
    assignment: {
      ...assignment,
      pickupStopName: pickupStop?.name || assignment.pickupStopId,
      dropoffStopName: dropoffStop?.name || assignment.dropoffStopId,
    },
    route: route ? {
      routeId: route.routeId,
      routeNumber: route.routeNumber,
      name: route.name,
      type: route.type,
      schedule: route.schedule,
      stops: route.stops,
    } : null,
  };
}
