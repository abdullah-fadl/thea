/**
 * CVision Branch Management Engine
 *
 * CRUD helpers, stats, and seed logic for multi-branch organizations.
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type { CVisionEmployee } from '@/lib/cvision/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BranchType =
  | 'HEADQUARTERS'
  | 'BRANCH'
  | 'REGIONAL_OFFICE'
  | 'WAREHOUSE'
  | 'CLINIC'
  | 'REMOTE';

export interface BranchAddress {
  street?: string;
  district?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  coordinates?: { lat: number; lng: number };
  nationalAddress?: string;
}

export interface CVisionBranch {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  type: BranchType;
  address: BranchAddress;
  phone?: string;
  email?: string;
  crNumber?: string;             // Commercial Registration number (سجل تجاري)
  branchManager?: string;
  branchManagerName?: string;
  timezone: string;
  workDays: number[];
  workHoursStart: string;
  workHoursEnd: string;
  employeeCount?: number;
  departmentCount?: number;
  isActive: boolean;
  isHeadquarters: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface BranchStats {
  employees: number;
  departments: string[];
  avgSalary: number;
  saudizationRate: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function branchCollection(tenantId: string) {
  return getCVisionCollection<CVisionBranch>(tenantId, 'branches');
}

async function nextBranchId(tenantId: string): Promise<string> {
  const coll = await branchCollection(tenantId);
  const count = await coll.countDocuments({ tenantId });
  return `BRN-${String(count + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createBranch(
  tenantId: string,
  data: Partial<CVisionBranch>,
  userId?: string,
): Promise<CVisionBranch> {
  const coll = await branchCollection(tenantId);
  const now = new Date();
  const branch: CVisionBranch = {
    id: uuidv4(),
    tenantId,
    branchId: data.branchId || await nextBranchId(tenantId),
    name: data.name || 'New Branch',
    type: data.type || 'BRANCH',
    address: data.address || { city: '', country: 'SA' },
    phone: data.phone,
    email: data.email,
    crNumber: data.crNumber,
    branchManager: data.branchManager,
    branchManagerName: data.branchManagerName,
    timezone: data.timezone || 'Asia/Riyadh',
    workDays: data.workDays ?? [0, 1, 2, 3, 4],
    workHoursStart: data.workHoursStart || '08:00',
    workHoursEnd: data.workHoursEnd || '17:00',
    isActive: data.isActive ?? true,
    isHeadquarters: data.isHeadquarters ?? false,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  };

  await coll.insertOne(branch);
  return branch;
}

export async function updateBranch(
  tenantId: string,
  branchId: string,
  updates: Partial<CVisionBranch>,
  userId?: string,
): Promise<CVisionBranch | null> {
  const coll = await branchCollection(tenantId);
  const filter = { tenantId, id: branchId };
  const $set: Record<string, unknown> = { ...updates, updatedAt: new Date() };
  if (userId) $set.updatedBy = userId;
  delete $set.id;
  delete $set.tenantId;

  const result = await coll.findOneAndUpdate(filter, { $set }, { returnDocument: 'after' });
  return (result as unknown as CVisionBranch | null) ?? null;
}

export async function listBranches(tenantId: string, includeInactive = false): Promise<CVisionBranch[]> {
  const coll = await branchCollection(tenantId);
  const filter: Record<string, unknown> = { tenantId };
  if (!includeInactive) filter.isActive = true;
  return coll.find(filter).sort({ isHeadquarters: -1, name: 1 }).toArray() as Promise<CVisionBranch[]>;
}

export async function getBranch(tenantId: string, branchId: string): Promise<CVisionBranch | null> {
  const coll = await branchCollection(tenantId);
  return coll.findOne({ tenantId, id: branchId }) as Promise<CVisionBranch | null>;
}

export async function deleteBranch(tenantId: string, branchId: string): Promise<{ deleted: boolean; reason?: string }> {
  const empColl = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
  const empCount = await empColl.countDocuments({ tenantId, branchId, isArchived: { $ne: true } });
  if (empCount > 0) {
    return { deleted: false, reason: `Cannot delete branch with ${empCount} assigned employees. Reassign them first.` };
  }
  const coll = await branchCollection(tenantId);
  await coll.updateOne({ tenantId, id: branchId }, { $set: { isActive: false, updatedAt: new Date() } });
  return { deleted: true };
}

export async function assignEmployeeToBranch(tenantId: string, employeeId: string, branchId: string | null): Promise<void> {
  const empColl = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
  await empColl.updateOne(
    { tenantId, id: employeeId },
    { $set: { branchId: branchId, updatedAt: new Date() } },
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getBranchStats(tenantId: string, branchId: string): Promise<BranchStats> {
  const empColl = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
  const employees = await empColl.find({
    tenantId,
    branchId,
    isArchived: { $ne: true },
  }).toArray();

  const deptSet = new Set<string>();
  let salarySum = 0;
  let salaryCount = 0;
  let saudiCount = 0;

  for (const emp of employees) {
    if (emp.departmentId) deptSet.add(emp.departmentId);
    const meta = emp.metadata as Record<string, unknown> | null | undefined;
    if (meta?.basicSalary) {
      salarySum += Number(meta.basicSalary);
      salaryCount++;
    }
    const nat = (emp.nationality || '').toUpperCase();
    if (nat === 'SA' || nat === 'SAUDI' || nat === 'SAUDI ARABIAN') saudiCount++;
  }

  return {
    employees: employees.length,
    departments: Array.from(deptSet),
    avgSalary: salaryCount > 0 ? Math.round(salarySum / salaryCount) : 0,
    saudizationRate: employees.length > 0 ? Math.round((saudiCount / employees.length) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Enrichment: attach employee counts to branches
// ---------------------------------------------------------------------------

export async function enrichBranchesWithCounts(tenantId: string, branches: CVisionBranch[]): Promise<CVisionBranch[]> {
  const empColl = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
  const employees = await empColl.find({ tenantId, isArchived: { $ne: true } }).toArray();

  const countByBranch = new Map<string, number>();
  const deptByBranch = new Map<string, Set<string>>();
  for (const emp of employees) {
    const bid = emp.branchId;
    if (bid) {
      countByBranch.set(bid, (countByBranch.get(bid) || 0) + 1);
      if (!deptByBranch.has(bid)) deptByBranch.set(bid, new Set());
      deptByBranch.get(bid)!.add(emp.departmentId);
    }
  }

  return branches.map(b => ({
    ...b,
    employeeCount: countByBranch.get(b.id) || 0,
    departmentCount: deptByBranch.get(b.id)?.size || 0,
  }));
}

// ---------------------------------------------------------------------------
// Seed default HQ
// ---------------------------------------------------------------------------

export async function seedDefaultBranch(tenantId: string, userId?: string): Promise<CVisionBranch | null> {
  const existing = await listBranches(tenantId, true);
  if (existing.length > 0) return null;

  return createBranch(tenantId, {
    branchId: 'BRN-001',
    name: 'Riyadh HQ',
    type: 'HEADQUARTERS',
    isHeadquarters: true,
    address: {
      city: 'Riyadh',
      region: 'Riyadh Region',
      country: 'SA',
    },
    workDays: [0, 1, 2, 3, 4],
    workHoursStart: '08:00',
    workHoursEnd: '17:00',
    isActive: true,
  }, userId);
}
