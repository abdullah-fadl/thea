/**
 * CVision Grievance Management Engine
 *
 * Handles:
 *  - Anonymous / named grievance submission
 *  - Investigation workflow with timeline
 *  - Resolution & appeal process
 *  - SLA tracking (deadlines)
 *  - Confidentiality-based access control
 */

import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Types ───────────────────────────────────────────────────────────────

export interface Grievance {
  _id?: string;
  id: string;
  tenantId: string;
  grievanceId: string;
  reporterId?: string;
  reporterName?: string;
  anonymous: boolean;
  category: string;
  subject: string;
  description: string;
  dateOfIncident?: string;
  locationOfIncident?: string;
  accusedId?: string;
  accusedName?: string;
  witnesses?: string[];
  attachments: { fileName: string; fileUrl: string }[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedTo?: string;
  assignedToName?: string;
  investigation: InvestigationEntry[];
  resolution?: Resolution;
  appealed: boolean;
  appealDetails?: { reason: string; submittedAt: Date; outcome?: string; decidedAt?: Date };
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED' | 'ESCALATED' | 'WITHDRAWN';
  confidentialityLevel: 'STANDARD' | 'RESTRICTED' | 'HIGHLY_RESTRICTED';
  accessList: string[];
  slaDeadline: Date;
  slaBreached: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationEntry {
  id: string;
  date: Date;
  action: string;
  by: string;
  notes: string;
}

export interface Resolution {
  outcome: 'RESOLVED' | 'UNSUBSTANTIATED' | 'PARTIALLY_RESOLVED' | 'ESCALATED' | 'WITHDRAWN';
  description: string;
  actionsTaken: string[];
  resolvedBy: string;
  resolvedAt: Date;
  appealDeadline?: Date;
}

// ── Constants ───────────────────────────────────────────────────────────

export const GRIEVANCE_CATEGORIES = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'DISCRIMINATION', label: 'Discrimination' },
  { value: 'BULLYING', label: 'Bullying' },
  { value: 'SAFETY', label: 'Safety Concern' },
  { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
  { value: 'MANAGEMENT', label: 'Management Issue' },
  { value: 'PAY_DISPUTE', label: 'Pay Dispute' },
  { value: 'WORKLOAD', label: 'Workload Issue' },
  { value: 'ENVIRONMENT', label: 'Work Environment' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const SEVERITY_LEVELS = [
  { value: 'LOW', label: 'Low', color: 'bg-green-100 text-green-700', slaDays: 14 },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-700', slaDays: 10 },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-700', slaDays: 7 },
  { value: 'CRITICAL', label: 'Critical', color: 'bg-red-100 text-red-700', slaDays: 3 },
] as const;

export const RESOLUTION_OUTCOMES = [
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'UNSUBSTANTIATED', label: 'Unsubstantiated' },
  { value: 'PARTIALLY_RESOLVED', label: 'Partially Resolved' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
] as const;

function getSlaDays(severity: string): number {
  return SEVERITY_LEVELS.find(s => s.value === severity)?.slaDays || 10;
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function submitGrievance(
  db: Db, tenantId: string, data: any,
): Promise<{ id: string; grievanceId: string }> {
  const now = new Date();
  const id = uuidv4();
  const count = await db.collection('cvision_grievances').countDocuments({ tenantId });
  const grievanceId = `GRV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const slaDays = getSlaDays(data.severity || 'MEDIUM');
  const slaDeadline = new Date(now.getTime() + slaDays * 86400000);

  const doc = {
    id,
    tenantId,
    grievanceId,
    reporterId: data.anonymous ? null : (data.reporterId || null),
    reporterName: data.anonymous ? 'Anonymous' : (data.reporterName || ''),
    anonymous: data.anonymous || false,
    category: data.category || 'OTHER',
    subject: data.subject,
    description: data.description,
    dateOfIncident: data.dateOfIncident || null,
    locationOfIncident: data.locationOfIncident || '',
    accusedId: data.accusedId || null,
    accusedName: data.accusedName || '',
    witnesses: data.witnesses || [],
    attachments: data.attachments || [],
    severity: data.severity || 'MEDIUM',
    assignedTo: null,
    assignedToName: null,
    investigation: [],
    resolution: null,
    appealed: false,
    appealDetails: null,
    status: 'SUBMITTED',
    confidentialityLevel: data.confidentialityLevel || 'STANDARD',
    accessList: data.accessList || [],
    slaDeadline,
    slaBreached: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('cvision_grievances').insertOne(doc);

  // Notify HR
  await db.collection('cvision_notifications').insertOne({
    id: uuidv4(),
    tenantId,
    type: 'GRIEVANCE_SUBMITTED',
    title: 'New Grievance Filed',
    message: `Grievance ${grievanceId}: ${data.subject} (${data.severity})`,
    targetRole: 'HR',
    relatedId: grievanceId,
    isRead: false,
    createdAt: now,
  });

  return { id, grievanceId };
}

export async function assignGrievance(
  db: Db, tenantId: string, grievanceId: string, assignedTo: string, assignedToName: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_grievances').updateOne(
    { tenantId, $or: [{ id: grievanceId }, { grievanceId }] },
    {
      $set: { assignedTo, assignedToName, status: 'UNDER_REVIEW', updatedAt: now },
      $push: {
        investigation: {
          id: uuidv4(), date: now, action: 'Case assigned', by: assignedToName, notes: `Assigned to ${assignedToName}`,
        },
      } as Record<string, unknown>,
    },
  );
  return { success: true };
}

export async function addInvestigationNote(
  db: Db, tenantId: string, grievanceId: string, data: { action: string; by: string; notes: string },
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_grievances').updateOne(
    { tenantId, $or: [{ id: grievanceId }, { grievanceId }] },
    {
      $set: { status: 'INVESTIGATING', updatedAt: now },
      $push: {
        investigation: { id: uuidv4(), date: now, action: data.action, by: data.by, notes: data.notes },
      } as Record<string, unknown>,
    },
  );
  return { success: true };
}

export async function resolveGrievance(
  db: Db, tenantId: string, grievanceId: string, resolution: any,
): Promise<{ success: boolean }> {
  const now = new Date();
  const appealDeadline = new Date(now.getTime() + 14 * 86400000); // 14 days to appeal

  await db.collection('cvision_grievances').updateOne(
    { tenantId, $or: [{ id: grievanceId }, { grievanceId }] },
    {
      $set: {
        status: 'RESOLVED',
        resolution: {
          outcome: resolution.outcome || 'RESOLVED',
          description: resolution.description || '',
          actionsTaken: resolution.actionsTaken || [],
          resolvedBy: resolution.resolvedBy || '',
          resolvedAt: now,
          appealDeadline,
        },
        updatedAt: now,
      },
    },
  );
  return { success: true };
}

export async function appealGrievance(
  db: Db, tenantId: string, grievanceId: string, reason: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_grievances').updateOne(
    { tenantId, $or: [{ id: grievanceId }, { grievanceId }] },
    {
      $set: {
        appealed: true,
        appealDetails: { reason, submittedAt: now },
        status: 'UNDER_REVIEW',
        updatedAt: now,
      },
    },
  );
  return { success: true };
}

export async function escalateGrievance(
  db: Db, tenantId: string, grievanceId: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_grievances').updateOne(
    { tenantId, $or: [{ id: grievanceId }, { grievanceId }] },
    { $set: { status: 'ESCALATED', updatedAt: now } },
  );
  return { success: true };
}

export async function withdrawGrievance(
  db: Db, tenantId: string, grievanceId: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_grievances').updateOne(
    { tenantId, $or: [{ id: grievanceId }, { grievanceId }] },
    { $set: { status: 'WITHDRAWN', updatedAt: now } },
  );
  return { success: true };
}

export async function closeGrievance(
  db: Db, tenantId: string, grievanceId: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_grievances').updateOne(
    { tenantId, $or: [{ id: grievanceId }, { grievanceId }] },
    { $set: { status: 'CLOSED', updatedAt: now } },
  );
  return { success: true };
}

// ── Queries ─────────────────────────────────────────────────────────────

export async function listGrievances(
  db: Db, tenantId: string, filters: { status?: string; severity?: string; category?: string; employeeId?: string } = {},
): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.severity) query.severity = filters.severity;
  if (filters.category) query.category = filters.category;
  if (filters.employeeId) query.reporterId = filters.employeeId;
  return db.collection('cvision_grievances').find(query).sort({ createdAt: -1 }).limit(500).toArray();
}

export async function getStats(db: Db, tenantId: string) {
  const all = await db.collection('cvision_grievances').find({ tenantId }).toArray();
  const now = new Date();
  const open = all.filter((g: any) => !['CLOSED', 'WITHDRAWN', 'RESOLVED'].includes(g.status));
  const breached = all.filter((g: any) => !['CLOSED', 'WITHDRAWN', 'RESOLVED'].includes(g.status) && new Date(g.slaDeadline) < now);

  // Mark breached
  if (breached.length > 0) {
    const ids = breached.map((g: any) => g._id);
    await db.collection('cvision_grievances').updateMany(
      { tenantId, _id: { $in: ids } },
      { $set: { slaBreached: true } },
    );
  }

  return {
    total: all.length,
    open: open.length,
    submitted: all.filter((g: any) => g.status === 'SUBMITTED').length,
    investigating: all.filter((g: any) => g.status === 'INVESTIGATING').length,
    resolved: all.filter((g: any) => g.status === 'RESOLVED').length,
    escalated: all.filter((g: any) => g.status === 'ESCALATED').length,
    slaBreached: breached.length,
    anonymous: all.filter((g: any) => g.anonymous).length,
    critical: all.filter((g: any) => g.severity === 'CRITICAL' && !['CLOSED', 'WITHDRAWN', 'RESOLVED'].includes(g.status)).length,
  };
}
