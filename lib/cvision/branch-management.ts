/**
 * CVision Multi-Branch / Multi-Entity Engine
 * Branch CRUD, transfers, comparison, settings override
 */
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

export const BRANCH_TYPES = ['HEADQUARTERS', 'BRANCH', 'SATELLITE', 'WAREHOUSE', 'FACTORY'] as const;
export const BRANCH_STATUSES = ['ACTIVE', 'INACTIVE', 'TEMPORARY'] as const;
export const TRANSFER_STATUSES = ['REQUESTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] as const;

const BR_COL = 'cvision_branches';
const TR_COL = 'cvision_branch_transfers';
const EMP_COL = 'cvision_employees';

export async function createBranch(db: Db, tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  await db.collection(BR_COL).insertOne({
    id, tenantId, branchId: data.code || `BR-${Date.now()}`,
    name: data.name, nameAr: data.nameAr, code: data.code,
    type: data.type || 'BRANCH',
    address: data.address, addressAr: data.addressAr, city: data.city, region: data.region,
    country: data.country || 'Saudi Arabia', coordinates: data.coordinates,
    phone: data.phone, email: data.email, managerName: data.managerName, managerId: data.managerId,
    settings: data.settings || { workingDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'], workingHours: { start: '08:00', end: '17:00' }, timezone: 'Asia/Riyadh' },
    headcount: 0, departments: [],
    status: 'ACTIVE', crNumber: data.crNumber, municipalityLicense: data.municipalityLicense,
    createdAt: new Date(), updatedAt: new Date(),
  });
  return { id };
}

export async function updateBranch(db: Db, tenantId: string, branchId: string, data: any): Promise<{ success: boolean }> {
  const updates: any = { updatedAt: new Date() };
  for (const k of ['name', 'nameAr', 'address', 'city', 'region', 'phone', 'email', 'managerName', 'managerId', 'type', 'crNumber', 'municipalityLicense', 'coordinates']) {
    if (data[k] !== undefined) updates[k] = data[k];
  }
  await db.collection(BR_COL).updateOne({ tenantId, id: branchId }, { $set: updates });
  return { success: true };
}

export async function updateSettings(db: Db, tenantId: string, branchId: string, settings: any): Promise<{ success: boolean }> {
  await db.collection(BR_COL).updateOne({ tenantId, id: branchId }, { $set: { settings, updatedAt: new Date() } });
  return { success: true };
}

export async function deactivateBranch(db: Db, tenantId: string, branchId: string): Promise<{ success: boolean }> {
  await db.collection(BR_COL).updateOne({ tenantId, id: branchId }, { $set: { status: 'INACTIVE', updatedAt: new Date() } });
  return { success: true };
}

export async function transferEmployee(db: Db, tenantId: string, data: any): Promise<{ transferId: string }> {
  const id = uuidv4();
  const transferId = `TRF-${Date.now()}`;
  await db.collection(TR_COL).insertOne({
    id, tenantId, transferId,
    employeeId: data.employeeId, employeeName: data.employeeName,
    fromBranchId: data.fromBranchId, fromBranchName: data.fromBranchName,
    toBranchId: data.toBranchId, toBranchName: data.toBranchName,
    reason: data.reason || '',
    effectiveDate: new Date(data.effectiveDate),
    relocationSupport: data.relocationSupport || false,
    relocationBudget: data.relocationBudget, housingArranged: data.housingArranged,
    status: 'REQUESTED', approvals: [],
    createdAt: new Date(),
  });
  return { transferId };
}

export async function approveTransfer(db: Db, tenantId: string, transferId: string, step: string, decision: string): Promise<{ success: boolean }> {
  await db.collection(TR_COL).updateOne({ tenantId, $or: [{ id: transferId }, { transferId }] }, {
    $push: { approvals: { step, decision, date: new Date() } } as Record<string, unknown>,
    $set: { status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
  });
  return { success: true };
}

// Queries
export async function listBranches(db: Db, tenantId: string, filters: any = {}): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;
  const branches = await db.collection(BR_COL).find(query).sort({ name: 1 }).toArray();
  // Enrich with live headcount
  for (const b of branches) {
    b.headcount = await db.collection(EMP_COL).countDocuments({ tenantId, branchId: b.id, status: 'ACTIVE' });
  }
  return branches;
}

export async function getBranchDetail(db: Db, tenantId: string, branchId: string): Promise<any> {
  return db.collection(BR_COL).findOne({ tenantId, id: branchId });
}

export async function getBranchEmployees(db: Db, tenantId: string, branchId: string): Promise<any[]> {
  return db.collection(EMP_COL).find({ tenantId, branchId, status: { $ne: 'TERMINATED' } }).sort({ firstName: 1 }).toArray();
}

export async function getBranchStats(db: Db, tenantId: string, branchId: string) {
  const total = await db.collection(EMP_COL).countDocuments({ tenantId, branchId });
  const active = await db.collection(EMP_COL).countDocuments({ tenantId, branchId, status: 'ACTIVE' });
  const departments = await db.collection(EMP_COL).distinct('departmentName', { tenantId, branchId });
  return { totalEmployees: total, activeEmployees: active, departments: departments.length };
}

export async function getBranchComparison(db: Db, tenantId: string): Promise<any[]> {
  const branches = await db.collection(BR_COL).find({ tenantId, status: 'ACTIVE' }).toArray();
  const result = [];
  for (const b of branches) {
    const headcount = await db.collection(EMP_COL).countDocuments({ tenantId, branchId: b.id, status: 'ACTIVE' });
    const depts = await db.collection(EMP_COL).distinct('departmentName', { tenantId, branchId: b.id });
    result.push({ id: b.id, name: b.name, code: b.code, type: b.type, city: b.city, headcount, departments: depts.length });
  }
  return result;
}

export async function getTransfers(db: Db, tenantId: string, status?: string): Promise<any[]> {
  const query: any = { tenantId };
  if (status) query.status = status;
  return db.collection(TR_COL).find(query).sort({ createdAt: -1 }).toArray();
}

export async function getStats(db: Db, tenantId: string) {
  const total = await db.collection(BR_COL).countDocuments({ tenantId });
  const active = await db.collection(BR_COL).countDocuments({ tenantId, status: 'ACTIVE' });
  const pendingTransfers = await db.collection(TR_COL).countDocuments({ tenantId, status: 'REQUESTED' });
  return { totalBranches: total, activeBranches: active, pendingTransfers };
}
