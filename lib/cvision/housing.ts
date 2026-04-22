/**
 * CVision Housing & Accommodation Engine
 *
 * Handles:
 *  - Housing unit CRUD
 *  - Employee assignment / check-out
 *  - Occupancy tracking
 *  - Maintenance requests
 *  - Utility recording
 *  - Housing policy (eligibility by marital status & grade)
 */

import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Types ───────────────────────────────────────────────────────────────

export interface HousingUnit {
  _id?: string;
  id: string;
  tenantId: string;
  unitId: string;
  buildingName: string;
  buildingAddress: string;
  unitNumber: string;
  type: 'APARTMENT' | 'ROOM' | 'VILLA' | 'SHARED_ROOM' | 'BED_SPACE';
  floor?: number;
  maxOccupants: number;
  currentOccupants: number;
  amenities: string[];
  assignedTo: OccupantEntry[];
  monthlyRent: number;
  employeeContribution: number;
  maintenanceRequests: MaintenanceRequest[];
  utilities: UtilityEntry[];
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
  createdAt: Date;
  updatedAt: Date;
}

export interface OccupantEntry {
  employeeId: string;
  employeeName: string;
  checkInDate: Date;
  checkOutDate?: Date;
  monthlyRate?: number;
  status: 'ACTIVE' | 'CHECKED_OUT';
}

export interface MaintenanceRequest {
  requestId: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  reportedBy: string;
  reportedAt: Date;
  resolvedAt?: Date;
}

export interface UtilityEntry {
  month: string;
  electricity: number;
  water: number;
  internet: number;
  total: number;
}

// ── Constants ───────────────────────────────────────────────────────────

export const UNIT_TYPES = [
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'ROOM', label: 'Room' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'SHARED_ROOM', label: 'Shared Room' },
  { value: 'BED_SPACE', label: 'Bed Space' },
] as const;

export const UNIT_STATUSES = [
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-700' },
  { value: 'OCCUPIED', label: 'Occupied', color: 'bg-blue-100 text-blue-700' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'RESERVED', label: 'Reserved', color: 'bg-purple-100 text-purple-700' },
] as const;

export const AMENITIES = [
  { value: 'FURNISHED', label: 'Furnished' },
  { value: 'AC', label: 'Air Conditioning' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'LAUNDRY', label: 'Laundry' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'WIFI', label: 'WiFi' },
  { value: 'TV', label: 'TV' },
  { value: 'GYM', label: 'Gym' },
] as const;

export const MAINTENANCE_PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'bg-green-100 text-green-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-100 text-red-700' },
] as const;

export const HOUSING_POLICY = {
  eligibility: {
    SINGLE_MALE: ['SHARED_ROOM', 'BED_SPACE', 'ROOM'],
    SINGLE_FEMALE: ['ROOM', 'APARTMENT'],
    MARRIED: ['APARTMENT', 'VILLA'],
    FAMILY: ['APARTMENT', 'VILLA'],
  } as Record<string, string[]>,
  gradeAllocation: {
    SENIOR: 'APARTMENT',
    MANAGER: 'APARTMENT',
    DIRECTOR: 'VILLA',
    JUNIOR: 'SHARED_ROOM',
  } as Record<string, string>,
  maxStayMonths: 12,
};

// ── Unit CRUD ────────────────────────────────────────────────────────────

export async function createUnit(db: Db, tenantId: string, data: any): Promise<{ id: string; unitId: string }> {
  const now = new Date();
  const id = uuidv4();
  const count = await db.collection('cvision_housing').countDocuments({ tenantId });
  const unitId = `HSG-${String(count + 1).padStart(3, '0')}`;

  const doc = {
    id, tenantId, unitId,
    buildingName: data.buildingName,
    buildingAddress: data.buildingAddress || '',
    unitNumber: data.unitNumber,
    type: data.type || 'ROOM',
    floor: data.floor || null,
    maxOccupants: data.maxOccupants || 1,
    currentOccupants: 0,
    amenities: data.amenities || [],
    assignedTo: [],
    monthlyRent: data.monthlyRent || 0,
    employeeContribution: data.employeeContribution || 0,
    maintenanceRequests: [],
    utilities: [],
    status: 'AVAILABLE',
    createdAt: now, updatedAt: now,
  };

  await db.collection('cvision_housing').insertOne(doc);
  return { id, unitId };
}

export async function assignEmployee(
  db: Db, tenantId: string, unitId: string, data: any,
): Promise<{ success: boolean; error?: string }> {
  const unit = await db.collection('cvision_housing').findOne({ tenantId, $or: [{ id: unitId }, { unitId }] });
  if (!unit) return { success: false, error: 'Unit not found' };

  const activeOccupants = (unit.assignedTo || []).filter((o: any) => o.status === 'ACTIVE').length;
  if (activeOccupants >= unit.maxOccupants) return { success: false, error: 'Unit is full' };

  const now = new Date();
  const occupant: OccupantEntry = {
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    checkInDate: data.checkInDate ? new Date(data.checkInDate) : now,
    monthlyRate: data.monthlyRate || unit.employeeContribution || 0,
    status: 'ACTIVE',
  };

  const newCount = activeOccupants + 1;
  const newStatus = newCount >= unit.maxOccupants ? 'OCCUPIED' : unit.status === 'AVAILABLE' ? 'OCCUPIED' : unit.status;

  await db.collection('cvision_housing').updateOne(
    { tenantId, _id: unit._id },
    {
      $set: { currentOccupants: newCount, status: newStatus, updatedAt: now },
      $push: { assignedTo: occupant } as Record<string, unknown>,
    },
  );
  return { success: true };
}

export async function checkOutEmployee(
  db: Db, tenantId: string, unitId: string, employeeId: string,
): Promise<{ success: boolean }> {
  const unit = await db.collection('cvision_housing').findOne({ tenantId, $or: [{ id: unitId }, { unitId }] });
  if (!unit) return { success: false };

  const now = new Date();
  const assignedTo = (unit.assignedTo || []).map((o: any) =>
    o.employeeId === employeeId && o.status === 'ACTIVE'
      ? { ...o, status: 'CHECKED_OUT', checkOutDate: now }
      : o
  );

  const activeCount = assignedTo.filter((o: any) => o.status === 'ACTIVE').length;
  const newStatus = activeCount === 0 ? 'AVAILABLE' : 'OCCUPIED';

  await db.collection('cvision_housing').updateOne(
    { tenantId, _id: unit._id },
    { $set: { assignedTo, currentOccupants: activeCount, status: newStatus, updatedAt: now } },
  );
  return { success: true };
}

// ── Maintenance ──────────────────────────────────────────────────────────

export async function submitMaintenanceRequest(
  db: Db, tenantId: string, unitId: string, data: any,
): Promise<{ success: boolean; requestId: string }> {
  const now = new Date();
  const requestId = `MNT-${Date.now()}`;

  const request: MaintenanceRequest = {
    requestId,
    description: data.description,
    priority: data.priority || 'MEDIUM',
    status: 'OPEN',
    reportedBy: data.reportedBy || '',
    reportedAt: now,
  };

  await db.collection('cvision_housing').updateOne(
    { tenantId, $or: [{ id: unitId }, { unitId }] },
    {
      $push: { maintenanceRequests: request } as Record<string, unknown>,
      $set: { updatedAt: now },
    },
  );
  return { success: true, requestId };
}

export async function resolveMaintenanceRequest(
  db: Db, tenantId: string, unitId: string, requestId: string,
): Promise<{ success: boolean }> {
  const unit = await db.collection('cvision_housing').findOne({ tenantId, $or: [{ id: unitId }, { unitId }] });
  if (!unit) return { success: false };

  const now = new Date();
  const requests = (unit.maintenanceRequests || []).map((r: any) =>
    r.requestId === requestId ? { ...r, status: 'COMPLETED', resolvedAt: now } : r
  );

  await db.collection('cvision_housing').updateOne(
    { tenantId, _id: unit._id },
    { $set: { maintenanceRequests: requests, updatedAt: now } },
  );
  return { success: true };
}

// ── Utilities ────────────────────────────────────────────────────────────

export async function recordUtility(
  db: Db, tenantId: string, unitId: string, data: any,
): Promise<{ success: boolean }> {
  const now = new Date();
  const entry: UtilityEntry = {
    month: data.month,
    electricity: data.electricity || 0,
    water: data.water || 0,
    internet: data.internet || 0,
    total: (data.electricity || 0) + (data.water || 0) + (data.internet || 0),
  };

  await db.collection('cvision_housing').updateOne(
    { tenantId, $or: [{ id: unitId }, { unitId }] },
    {
      $push: { utilities: entry } as Record<string, unknown>,
      $set: { updatedAt: now },
    },
  );
  return { success: true };
}

// ── Queries ──────────────────────────────────────────────────────────────

export async function listUnits(db: Db, tenantId: string, filters: { status?: string; type?: string } = {}): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;
  return db.collection('cvision_housing').find(query).sort({ unitId: 1 }).limit(500).toArray();
}

export async function getEmployeeHousing(db: Db, tenantId: string, employeeId: string): Promise<any> {
  return db.collection('cvision_housing').findOne({
    tenantId, 'assignedTo.employeeId': employeeId, 'assignedTo.status': 'ACTIVE',
  });
}

export async function getOccupancyReport(db: Db, tenantId: string): Promise<any> {
  const units = await db.collection('cvision_housing').find({ tenantId }).limit(5000).toArray();
  const total = units.length;
  const totalBeds = units.reduce((s: number, u: any) => s + (u.maxOccupants || 0), 0);
  const occupied = units.reduce((s: number, u: any) => s + (u.currentOccupants || 0), 0);
  const available = units.filter((u: any) => u.status === 'AVAILABLE').length;
  const maintenance = units.filter((u: any) => u.status === 'MAINTENANCE').length;

  const byType: Record<string, { total: number; occupied: number }> = {};
  for (const u of units) {
    if (!byType[u.type]) byType[u.type] = { total: 0, occupied: 0 };
    byType[u.type].total++;
    if (u.currentOccupants > 0) byType[u.type].occupied++;
  }

  const byBuilding: Record<string, { total: number; occupied: number }> = {};
  for (const u of units) {
    const b = u.buildingName || 'Unknown';
    if (!byBuilding[b]) byBuilding[b] = { total: 0, occupied: 0 };
    byBuilding[b].total++;
    if (u.currentOccupants > 0) byBuilding[b].occupied++;
  }

  const totalRent = units.reduce((s: number, u: any) => s + (u.monthlyRent || 0), 0);

  return {
    totalUnits: total, totalBeds, occupiedBeds: occupied,
    occupancyRate: totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0,
    availableUnits: available, maintenanceUnits: maintenance,
    byType, byBuilding, totalMonthlyRent: totalRent,
  };
}

export async function getMaintenanceRequests(db: Db, tenantId: string, status?: string): Promise<any[]> {
  const units = await db.collection('cvision_housing').find({ tenantId }).limit(5000).toArray();
  const requests: any[] = [];

  for (const u of units) {
    for (const r of (u.maintenanceRequests || [])) {
      if (!status || r.status === status) {
        requests.push({ ...r, unitId: u.unitId, buildingName: u.buildingName, unitNumber: u.unitNumber });
      }
    }
  }

  return requests.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
}

export async function getStats(db: Db, tenantId: string) {
  const units = await db.collection('cvision_housing').find({ tenantId }).limit(5000).toArray();
  const totalBeds = units.reduce((s: number, u: any) => s + (u.maxOccupants || 0), 0);
  const occupiedBeds = units.reduce((s: number, u: any) => s + (u.currentOccupants || 0), 0);
  const openMaintenance = units.reduce((s: number, u: any) =>
    s + (u.maintenanceRequests || []).filter((r: any) => r.status !== 'COMPLETED').length, 0);
  const totalRent = units.reduce((s: number, u: any) => s + (u.monthlyRent || 0), 0);

  return {
    totalUnits: units.length,
    totalBeds,
    occupiedBeds,
    availableUnits: units.filter((u: any) => u.status === 'AVAILABLE').length,
    occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    openMaintenance,
    totalMonthlyRent: totalRent,
  };
}
