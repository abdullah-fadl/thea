/**
 * CVision Asset Management Engine
 *
 * Handles:
 *  - IT/Physical asset tracking
 *  - Assignment to employees & return
 *  - Depreciation calculation
 *  - Maintenance logging
 *  - Warranty tracking
 */

import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Types ───────────────────────────────────────────────────────────────

export interface Asset {
  _id?: string;
  id: string;
  tenantId: string;
  assetId: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  specifications?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  depreciationMethod?: 'STRAIGHT_LINE' | 'DECLINING';
  usefulLifeYears?: number;
  warrantyExpiry?: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedDate?: string;
  returnDate?: string;
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED' | 'RETIRED';
  status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED' | 'LOST';
  assignmentHistory: AssignmentHistoryEntry[];
  maintenanceLog: MaintenanceEntry[];
  location?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentHistoryEntry {
  employeeId: string;
  employeeName: string;
  assignedDate: string;
  returnedDate?: string;
  conditionAtAssign: string;
  conditionAtReturn?: string;
  notes?: string;
}

export interface MaintenanceEntry {
  id: string;
  date: string;
  type: string;
  description: string;
  cost?: number;
  vendor?: string;
}

// ── Constants ───────────────────────────────────────────────────────────

export const ASSET_CATEGORIES = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'PRINTER', label: 'Printer' },
  { value: 'CAR', label: 'Car / Vehicle' },
  { value: 'BADGE', label: 'Access Badge' },
  { value: 'KEY', label: 'Key' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'SOFTWARE_LICENSE', label: 'Software License' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const ASSET_CONDITIONS = [
  { value: 'NEW', label: 'New', color: 'bg-green-100 text-green-700' },
  { value: 'GOOD', label: 'Good', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'FAIR', label: 'Fair', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'POOR', label: 'Poor', color: 'bg-orange-100 text-orange-700' },
  { value: 'DAMAGED', label: 'Damaged', color: 'bg-red-100 text-red-700' },
  { value: 'RETIRED', label: 'Retired', color: 'bg-gray-100 text-gray-500' },
] as const;

export const ASSET_STATUSES = [
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-700' },
  { value: 'ASSIGNED', label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  { value: 'MAINTENANCE', label: 'In Maintenance', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'RETIRED', label: 'Retired', color: 'bg-gray-100 text-gray-500' },
  { value: 'LOST', label: 'Lost', color: 'bg-red-100 text-red-700' },
] as const;

// ── Depreciation ────────────────────────────────────────────────────────

export function calculateCurrentValue(purchasePrice: number, purchaseDate: string, usefulLifeYears: number, method: string = 'STRAIGHT_LINE'): number {
  if (!purchasePrice || !purchaseDate || !usefulLifeYears) return purchasePrice || 0;
  const years = (Date.now() - new Date(purchaseDate).getTime()) / (365.25 * 86400000);
  if (years >= usefulLifeYears) return 0;

  if (method === 'DECLINING') {
    const rate = 2 / usefulLifeYears;
    return Math.round(purchasePrice * Math.pow(1 - rate, years));
  }
  // Straight line
  const annualDep = purchasePrice / usefulLifeYears;
  return Math.round(Math.max(0, purchasePrice - annualDep * years));
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function createAsset(
  db: Db, tenantId: string, data: any,
): Promise<{ id: string; assetId: string }> {
  const now = new Date();
  const id = uuidv4();
  const count = await db.collection('cvision_assets').countDocuments({ tenantId });
  const assetId = `AST-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const doc = {
    id,
    tenantId,
    assetId,
    name: data.name,
    category: data.category || 'OTHER',
    brand: data.brand || '',
    model: data.model || '',
    serialNumber: data.serialNumber || '',
    specifications: data.specifications || '',
    purchaseDate: data.purchaseDate || null,
    purchasePrice: data.purchasePrice || 0,
    currentValue: data.purchasePrice || 0,
    depreciationMethod: data.depreciationMethod || 'STRAIGHT_LINE',
    usefulLifeYears: data.usefulLifeYears || 5,
    warrantyExpiry: data.warrantyExpiry || null,
    assignedTo: null,
    assignedToName: null,
    assignedDate: null,
    returnDate: null,
    condition: data.condition || 'NEW',
    status: 'AVAILABLE',
    assignmentHistory: [],
    maintenanceLog: [],
    location: data.location || '',
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('cvision_assets').insertOne(doc);
  return { id, assetId };
}

export async function assignAsset(
  db: Db, tenantId: string, assetId: string, employeeId: string, employeeName: string, notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const asset = await db.collection('cvision_assets').findOne({
    tenantId, $or: [{ id: assetId }, { assetId }],
  });
  if (!asset) return { success: false, error: 'Asset not found' };
  if (asset.status === 'ASSIGNED') return { success: false, error: 'Asset already assigned' };
  if (asset.status === 'RETIRED') return { success: false, error: 'Asset is retired' };

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const historyEntry: AssignmentHistoryEntry = {
    employeeId,
    employeeName,
    assignedDate: dateStr,
    conditionAtAssign: asset.condition,
    notes: notes || '',
  };

  await db.collection('cvision_assets').updateOne(
    { tenantId, _id: asset._id },
    {
      $set: {
        assignedTo: employeeId,
        assignedToName: employeeName,
        assignedDate: dateStr,
        returnDate: null,
        status: 'ASSIGNED',
        updatedAt: now,
      },
      $push: { assignmentHistory: historyEntry } as Record<string, unknown>,
    },
  );
  return { success: true };
}

export async function returnAsset(
  db: Db, tenantId: string, assetId: string, condition: string, notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const asset = await db.collection('cvision_assets').findOne({
    tenantId, $or: [{ id: assetId }, { assetId }],
  });
  if (!asset) return { success: false, error: 'Asset not found' };
  if (asset.status !== 'ASSIGNED') return { success: false, error: 'Asset is not assigned' };

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // Update last history entry
  const history = asset.assignmentHistory || [];
  if (history.length > 0) {
    const last = history[history.length - 1];
    last.returnedDate = dateStr;
    last.conditionAtReturn = condition;
    if (notes) last.notes = (last.notes || '') + ` Return: ${notes}`;
  }

  await db.collection('cvision_assets').updateOne(
    { tenantId, _id: asset._id },
    {
      $set: {
        assignedTo: null,
        assignedToName: null,
        returnDate: dateStr,
        condition,
        status: 'AVAILABLE',
        assignmentHistory: history,
        updatedAt: now,
      },
    },
  );
  return { success: true };
}

export async function addMaintenance(
  db: Db, tenantId: string, assetId: string, data: { type: string; description: string; cost?: number; vendor?: string },
): Promise<{ success: boolean }> {
  const now = new Date();
  const entry: MaintenanceEntry = {
    id: uuidv4(),
    date: now.toISOString().split('T')[0],
    type: data.type,
    description: data.description,
    cost: data.cost || 0,
    vendor: data.vendor || '',
  };

  await db.collection('cvision_assets').updateOne(
    { tenantId, $or: [{ id: assetId }, { assetId }] },
    {
      $set: { status: 'MAINTENANCE', updatedAt: now },
      $push: { maintenanceLog: entry } as Record<string, unknown>,
    },
  );
  return { success: true };
}

export async function retireAsset(
  db: Db, tenantId: string, assetId: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_assets').updateOne(
    { tenantId, $or: [{ id: assetId }, { assetId }] },
    { $set: { status: 'RETIRED', condition: 'RETIRED', currentValue: 0, updatedAt: now } },
  );
  return { success: true };
}

// ── Queries ─────────────────────────────────────────────────────────────

export async function listAssets(
  db: Db, tenantId: string, filters: { status?: string; category?: string; assignedTo?: string } = {},
): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  if (filters.assignedTo) query.assignedTo = filters.assignedTo;
  return db.collection('cvision_assets').find(query).sort({ createdAt: -1 }).limit(1000).toArray();
}

export async function getEmployeeAssets(db: Db, tenantId: string, employeeId: string): Promise<any[]> {
  return db.collection('cvision_assets').find({ tenantId, assignedTo: employeeId, status: 'ASSIGNED' }).toArray();
}

export async function getStats(db: Db, tenantId: string) {
  const all = await db.collection('cvision_assets').find({ tenantId }).toArray();
  const now = new Date();
  const totalValue = all.reduce((s: number, a: any) => {
    if (a.purchasePrice && a.purchaseDate && a.usefulLifeYears) {
      return s + calculateCurrentValue(a.purchasePrice, a.purchaseDate, a.usefulLifeYears, a.depreciationMethod);
    }
    return s + (a.currentValue || 0);
  }, 0);

  const warrantyExpiring = all.filter((a: any) => {
    if (!a.warrantyExpiry) return false;
    const exp = new Date(a.warrantyExpiry);
    return exp > now && exp < new Date(now.getTime() + 30 * 86400000);
  }).length;

  return {
    totalAssets: all.length,
    assigned: all.filter((a: any) => a.status === 'ASSIGNED').length,
    available: all.filter((a: any) => a.status === 'AVAILABLE').length,
    maintenance: all.filter((a: any) => a.status === 'MAINTENANCE').length,
    retired: all.filter((a: any) => a.status === 'RETIRED').length,
    lost: all.filter((a: any) => a.status === 'LOST').length,
    totalValue,
    warrantyExpiring,
  };
}
