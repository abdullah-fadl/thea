/**
 * CVision Time & Project Tracking Engine
 * Timesheets, projects, utilization, billing
 */
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

export const TIMESHEET_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;
export const PROJECT_STATUSES = ['ACTIVE', 'COMPLETED', 'ON_HOLD'] as const;

const TS_COL = 'cvision_timesheets';
const PROJ_COL = 'cvision_projects';

// ── Timesheet ───────────────────────────────────────────────────────────

export async function createEntry(db: Db, tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  const weekStart = new Date(data.weekStartDate);
  // Check if timesheet for this week exists
  let ts = await db.collection(TS_COL).findOne({ tenantId, employeeId: data.employeeId, weekStartDate: weekStart });
  if (!ts) {
    await db.collection(TS_COL).insertOne({
      id, tenantId, employeeId: data.employeeId, employeeName: data.employeeName,
      weekStartDate: weekStart, entries: [],
      totalHours: 0, billableHours: 0, nonBillableHours: 0, totalAmount: 0,
      status: 'DRAFT', createdAt: new Date(), updatedAt: new Date(),
    });
    ts = await db.collection(TS_COL).findOne({ tenantId, employeeId: data.employeeId, weekStartDate: weekStart });
  }
  const entry = {
    date: new Date(data.date), projectId: data.projectId, projectName: data.projectName,
    taskDescription: data.taskDescription || '', hours: data.hours || 0,
    billable: data.billable !== false, rate: data.rate || 0,
    amount: (data.hours || 0) * (data.rate || 0), notes: data.notes,
  };
  await db.collection(TS_COL).updateOne({ _id: ts!._id, tenantId }, {
    $push: { entries: entry } as Record<string, unknown>,
    $inc: {
      totalHours: entry.hours,
      billableHours: entry.billable ? entry.hours : 0,
      nonBillableHours: entry.billable ? 0 : entry.hours,
      totalAmount: entry.amount,
    },
    $set: { updatedAt: new Date() },
  });
  return { id: ts!.id };
}

export async function submitWeek(db: Db, tenantId: string, timesheetId: string): Promise<{ success: boolean }> {
  await db.collection(TS_COL).updateOne({ tenantId, id: timesheetId }, { $set: { status: 'SUBMITTED', updatedAt: new Date() } });
  return { success: true };
}

export async function approveTimesheet(db: Db, tenantId: string, timesheetId: string, approvedBy: string): Promise<{ success: boolean }> {
  await db.collection(TS_COL).updateOne({ tenantId, id: timesheetId }, {
    $set: { status: 'APPROVED', approvedBy, approvedAt: new Date(), updatedAt: new Date() },
  });
  return { success: true };
}

export async function rejectTimesheet(db: Db, tenantId: string, timesheetId: string): Promise<{ success: boolean }> {
  await db.collection(TS_COL).updateOne({ tenantId, id: timesheetId }, { $set: { status: 'REJECTED', updatedAt: new Date() } });
  return { success: true };
}

export async function getMyTimesheet(db: Db, tenantId: string, employeeId: string, weekStartDate?: string): Promise<any> {
  const query: any = { tenantId, employeeId };
  if (weekStartDate) query.weekStartDate = new Date(weekStartDate);
  return db.collection(TS_COL).find(query).sort({ weekStartDate: -1 }).limit(1).toArray();
}

export async function getTeamTimesheets(db: Db, tenantId: string, status?: string): Promise<any[]> {
  const query: any = { tenantId };
  if (status) query.status = status;
  return db.collection(TS_COL).find(query).sort({ weekStartDate: -1, employeeName: 1 }).toArray();
}

export async function getPendingApproval(db: Db, tenantId: string): Promise<any[]> {
  return db.collection(TS_COL).find({ tenantId, status: 'SUBMITTED' }).sort({ weekStartDate: -1 }).toArray();
}

// ── Projects ────────────────────────────────────────────────────────────

export async function createProject(db: Db, tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  await db.collection(PROJ_COL).insertOne({
    id, tenantId, projectId: `PRJ-${Date.now()}`,
    name: data.name, clientName: data.clientName || '',
    budget: data.budget || { hours: 0, amount: 0 },
    consumed: { hours: 0, amount: 0 },
    remaining: data.budget || { hours: 0, amount: 0 },
    team: data.team || [],
    startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : null,
    status: 'ACTIVE', createdAt: new Date(),
  });
  return { id };
}

export async function updateProject(db: Db, tenantId: string, projectId: string, data: any): Promise<{ success: boolean }> {
  const updates: any = {};
  for (const k of ['name', 'clientName', 'budget', 'team', 'endDate', 'status']) {
    if (data[k] !== undefined) updates[k] = data[k];
  }
  await db.collection(PROJ_COL).updateOne({ tenantId, id: projectId }, { $set: updates });
  return { success: true };
}

export async function getProjectHours(db: Db, tenantId: string, projectId: string): Promise<any> {
  const timesheets = await db.collection(TS_COL).find({ tenantId, 'entries.projectId': projectId }).toArray();
  let totalHours = 0; let billableHours = 0; let totalAmount = 0;
  for (const ts of timesheets) {
    for (const e of (ts.entries || [])) {
      if (e.projectId === projectId) { totalHours += e.hours; if (e.billable) billableHours += e.hours; totalAmount += e.amount || 0; }
    }
  }
  return { projectId, totalHours, billableHours, totalAmount };
}

export async function listProjects(db: Db, tenantId: string, status?: string): Promise<any[]> {
  const query: any = { tenantId };
  if (status) query.status = status;
  return db.collection(PROJ_COL).find(query).sort({ createdAt: -1 }).toArray();
}

export async function getUtilizationReport(db: Db, tenantId: string): Promise<any[]> {
  const timesheets = await db.collection(TS_COL).find({ tenantId, status: { $in: ['SUBMITTED', 'APPROVED'] } }).toArray();
  const byEmployee: Record<string, { name: string; total: number; billable: number }> = {};
  for (const ts of timesheets) {
    if (!byEmployee[ts.employeeId]) byEmployee[ts.employeeId] = { name: ts.employeeName, total: 0, billable: 0 };
    byEmployee[ts.employeeId].total += ts.totalHours || 0;
    byEmployee[ts.employeeId].billable += ts.billableHours || 0;
  }
  return Object.entries(byEmployee).map(([id, data]) => ({
    employeeId: id, employeeName: data.name, totalHours: data.total, billableHours: data.billable,
    utilization: data.total > 0 ? Math.round((data.billable / data.total) * 100) : 0,
  }));
}

export async function getBillingReport(db: Db, tenantId: string): Promise<any[]> {
  const projects = await db.collection(PROJ_COL).find({ tenantId }).toArray();
  const result = [];
  for (const p of projects) {
    const hours = await getProjectHours(db, tenantId, p.id);
    result.push({ ...p, consumed: hours });
  }
  return result;
}

export async function getStats(db: Db, tenantId: string) {
  const projects = await db.collection(PROJ_COL).countDocuments({ tenantId, status: 'ACTIVE' });
  const pending = await db.collection(TS_COL).countDocuments({ tenantId, status: 'SUBMITTED' });
  const totalHours = await db.collection(TS_COL).find({ tenantId }).toArray();
  const hours = totalHours.reduce((s: number, t: any) => s + (t.totalHours || 0), 0);
  return { activeProjects: projects, pendingApprovals: pending, totalHoursLogged: hours };
}
