/**
 * Investigation Workflow & Salary Deduction Engine
 *
 * Manages formal workplace investigations with full workflow:
 * REPORTED → UNDER_INVESTIGATION → HEARING → DECISION → CLOSED/APPEAL
 *
 * Integrates with:
 *   - cvision_disciplinary (links to existing warnings)
 *   - cvision_contracts (salary data for deduction calculations)
 *   - cvision_employees (status changes for suspension/termination)
 *
 * Compliant with Saudi Labor Law Articles 66, 80, 92.
 *
 * Collections:
 *   cvision_investigations     — Full investigation records
 *   cvision_salary_deductions  — Pending and applied salary deductions
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_COLLECTIONS } from '@/lib/cvision/constants';

// ─── Collection Helpers ─────────────────────────────────────────────────────

const INV_COL = 'cvision_investigations';
const DED_COL = 'cvision_salary_deductions';

async function invCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(INV_COL);
}

async function dedCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(DED_COL);
}

async function empCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(CVISION_COLLECTIONS.employees);
}

async function contractCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(CVISION_COLLECTIONS.contracts);
}

async function discCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(CVISION_COLLECTIONS.disciplinary);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type IncidentType =
  | 'MISCONDUCT' | 'POLICY_VIOLATION' | 'ATTENDANCE' | 'PERFORMANCE'
  | 'HARASSMENT' | 'SAFETY' | 'THEFT' | 'INSUBORDINATION' | 'OTHER';

export type InvestigationStatus =
  | 'REPORTED' | 'UNDER_INVESTIGATION' | 'HEARING_SCHEDULED'
  | 'HEARING_COMPLETED' | 'DECISION_PENDING' | 'DECISION_MADE'
  | 'APPEAL' | 'CLOSED' | 'DISMISSED';

export type DecisionOutcome =
  | 'NO_ACTION' | 'VERBAL_WARNING' | 'WRITTEN_WARNING' | 'FINAL_WARNING'
  | 'SUSPENSION' | 'DEMOTION' | 'SALARY_DEDUCTION' | 'TERMINATION';

export type DeductionType = 'FIXED_AMOUNT' | 'PERCENTAGE' | 'DAYS';

export interface Evidence {
  id: string;
  type: 'DOCUMENT' | 'WITNESS' | 'CCTV' | 'EMAIL' | 'PHOTO' | 'OTHER';
  description: string;
  addedBy: string;
  addedAt: Date;
}

export interface WitnessStatement {
  id: string;
  name: string;
  employeeId?: string;
  statement: string;
  statementDate: Date;
  recordedBy: string;
}

export interface HearingInfo {
  scheduledDate?: Date;
  scheduledTime?: string;
  location?: string;
  attendees: string[];
  employeeResponse?: string;
  employeeAttended?: boolean;
  hearingNotes?: string;
  completedAt?: Date;
}

export interface DeductionDetail {
  type: DeductionType;
  amount?: number;
  days?: number;
  effectiveMonth: string;
  description: string;
  calculatedAmount: number;
}

export interface SuspensionDetail {
  startDate: Date;
  endDate: Date;
  withPay: boolean;
}

export interface DecisionInfo {
  outcome: DecisionOutcome;
  decidedBy: string;
  decidedByName: string;
  decidedAt?: Date;
  reasoning: string;
  deduction?: DeductionDetail;
  suspension?: SuspensionDetail;
}

export interface AppealInfo {
  filedDate: Date;
  reason: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  outcome?: 'UPHELD' | 'MODIFIED' | 'OVERTURNED';
  newDecision?: string;
}

export interface TimelineEntry {
  date: Date;
  action: string;
  by: string;
  details?: string;
}

export interface Investigation {
  id: string;
  tenantId: string;
  investigationId: string;
  disciplinaryId?: string;

  employeeId: string;
  employeeName: string;
  department: string;

  incidentDate: Date;
  incidentType: IncidentType;
  incidentDescription: string;
  incidentLocation?: string;
  reportedBy: string;
  reportedByName: string;
  reportedDate: Date;

  investigator: string;
  investigatorName: string;

  status: InvestigationStatus;

  evidence: Evidence[];
  witnesses: WitnessStatement[];
  hearing: HearingInfo;
  decision: DecisionInfo;
  appeal?: AppealInfo;
  timeline: TimelineEntry[];

  laborLawArticle?: string;

  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface SalaryDeduction {
  id: string;
  tenantId: string;
  deductionId: string;
  investigationId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  type: DeductionType;
  days?: number;
  percentage?: number;
  fixedAmount?: number;
  calculatedAmount: number;
  dailyRate: number;
  effectiveMonth: string;
  description: string;
  laborLawArticle: string;
  status: 'PENDING' | 'APPLIED' | 'CANCELLED';
  appliedAt?: Date;
  appliedBy?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationStats {
  total: number;
  open: number;
  closed: number;
  dismissed: number;
  byType: { type: string; count: number }[];
  byOutcome: { outcome: string; count: number }[];
  byStatus: { status: string; count: number }[];
  avgResolutionDays: number;
  pendingDeductions: number;
  totalDeductionAmount: number;
}

// ─── Saudi Labor Law Constants ──────────────────────────────────────────────

export const SAUDI_PENALTY_SCHEDULE = {
  penalties: [
    { level: 1, type: 'VERBAL_WARNING' as const, description: 'First offense — verbal warning' },
    { level: 2, type: 'WRITTEN_WARNING' as const, description: 'Second offense — written warning' },
    { level: 3, type: 'SALARY_DEDUCTION' as const, description: 'Max deduction: 5 days salary per month (Art. 66)', maxDays: 5 },
    { level: 4, type: 'SUSPENSION' as const, description: 'Max: 5 days without pay per month (Art. 66)', maxDays: 5 },
    { level: 5, type: 'FINAL_WARNING' as const, description: 'Final warning before termination' },
    { level: 6, type: 'TERMINATION' as const, description: 'Termination — Article 80 grounds required' },
  ],
  terminationGrounds: [
    'Assault on employer or supervisor',
    'Failure to perform essential duties after warning',
    'Misconduct or dishonesty',
    'Deliberate act causing material loss',
    'Forgery to obtain employment',
    'Unjustified absence 30 consecutive or 15 non-consecutive days',
    'Disclosure of confidential information',
    'Use of position for personal gain',
  ],
  maxDeductionDaysPerIncident: 5,
  maxMonthlyDeductionPct: 0.5,
};

export const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'ATTENDANCE', label: 'Attendance Violation' },
  { value: 'MISCONDUCT', label: 'General Misconduct' },
  { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
  { value: 'PERFORMANCE', label: 'Performance Issue' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SAFETY', label: 'Safety Violation' },
  { value: 'THEFT', label: 'Theft / Fraud' },
  { value: 'INSUBORDINATION', label: 'Insubordination' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_FLOW: Record<InvestigationStatus, InvestigationStatus[]> = {
  REPORTED: ['UNDER_INVESTIGATION', 'DISMISSED'],
  UNDER_INVESTIGATION: ['HEARING_SCHEDULED', 'DECISION_PENDING', 'DISMISSED'],
  HEARING_SCHEDULED: ['HEARING_COMPLETED', 'DISMISSED'],
  HEARING_COMPLETED: ['DECISION_PENDING'],
  DECISION_PENDING: ['DECISION_MADE'],
  DECISION_MADE: ['APPEAL', 'CLOSED'],
  APPEAL: ['DECISION_MADE', 'CLOSED'],
  CLOSED: [],
  DISMISSED: [],
};

const STATUS_LABELS: Record<InvestigationStatus, string> = {
  REPORTED: 'Reported',
  UNDER_INVESTIGATION: 'Under Investigation',
  HEARING_SCHEDULED: 'Hearing Scheduled',
  HEARING_COMPLETED: 'Hearing Completed',
  DECISION_PENDING: 'Decision Pending',
  DECISION_MADE: 'Decision Made',
  APPEAL: 'Under Appeal',
  CLOSED: 'Closed',
  DISMISSED: 'Dismissed',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function nextInvId(tenantId: string): Promise<string> {
  const c = await invCol(tenantId);
  const count = await c.countDocuments({ tenantId });
  const year = new Date().getFullYear();
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function nextDedId(tenantId: string): Promise<string> {
  const c = await dedCol(tenantId);
  const count = await c.countDocuments({ tenantId });
  const year = new Date().getFullYear();
  return `DED-${year}-${String(count + 1).padStart(4, '0')}`;
}

function addTimeline(inv: Investigation, action: string, by: string, details?: string) {
  inv.timeline.push({ date: new Date(), action, by, details });
}

// ─── Salary Deduction Calculator ────────────────────────────────────────────

export function calculateDeduction(params: {
  basicSalary: number;
  housingAllowance: number;
  type: DeductionType;
  amount?: number;
  days?: number;
}): {
  calculatedAmount: number;
  dailyRate: number;
  withinIncidentLimit: boolean;
  maxPerIncident: number;
  details: string;
} {
  const monthlySalary = (params.basicSalary || 0) + (params.housingAllowance || 0);
  const dailyRate = Math.round((monthlySalary / 30) * 100) / 100;

  let calculatedAmount = 0;
  let details = '';

  switch (params.type) {
    case 'DAYS': {
      const days = params.days || 0;
      calculatedAmount = Math.round(days * dailyRate * 100) / 100;
      details = `${days} day(s) × SAR ${dailyRate.toLocaleString()} = SAR ${calculatedAmount.toLocaleString()}`;
      break;
    }
    case 'PERCENTAGE': {
      const pct = params.amount || 0;
      calculatedAmount = Math.round(monthlySalary * (pct / 100) * 100) / 100;
      details = `${pct}% of SAR ${monthlySalary.toLocaleString()} = SAR ${calculatedAmount.toLocaleString()}`;
      break;
    }
    case 'FIXED_AMOUNT': {
      calculatedAmount = params.amount || 0;
      details = `Fixed amount: SAR ${calculatedAmount.toLocaleString()}`;
      break;
    }
  }

  const maxPerIncident = dailyRate * SAUDI_PENALTY_SCHEDULE.maxDeductionDaysPerIncident;
  const withinIncidentLimit = calculatedAmount <= maxPerIncident;

  return { calculatedAmount, dailyRate, withinIncidentLimit, maxPerIncident, details };
}

export async function checkMonthlyDeductionLimit(
  tenantId: string,
  employeeId: string,
  effectiveMonth: string,
  additionalAmount: number
): Promise<{
  currentTotal: number;
  monthlySalary: number;
  maxAllowed: number;
  newTotal: number;
  withinLimit: boolean;
}> {
  const dc = await dedCol(tenantId);
  const existing = await dc.find({
    tenantId,
    employeeId,
    effectiveMonth,
    status: { $in: ['PENDING', 'APPLIED'] },
  }).toArray() as unknown as SalaryDeduction[];

  const currentTotal = existing.reduce((s: number, d) => s + (d.calculatedAmount || 0), 0);

  const cc = await contractCol(tenantId);
  const contract = await cc.findOne({ tenantId, employeeId, deletedAt: { $exists: false } }) as Record<string, unknown> | null;
  const monthlySalary = contract ? ((contract.basicSalary as number) || 0) + ((contract.housingAllowance as number) || 0) : 0;
  const maxAllowed = Math.round(monthlySalary * SAUDI_PENALTY_SCHEDULE.maxMonthlyDeductionPct * 100) / 100;

  const newTotal = currentTotal + additionalAmount;

  return { currentTotal, monthlySalary, maxAllowed, newTotal, withinLimit: newTotal <= maxAllowed };
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

export async function createInvestigation(
  tenantId: string,
  data: Partial<Investigation>,
  createdBy: string
): Promise<Investigation> {
  const c = await invCol(tenantId);
  const now = new Date();

  const inv: Investigation = {
    id: uuidv4(),
    tenantId,
    investigationId: await nextInvId(tenantId),
    disciplinaryId: data.disciplinaryId,
    employeeId: data.employeeId || '',
    employeeName: data.employeeName || '',
    department: data.department || '',
    incidentDate: data.incidentDate ? new Date(data.incidentDate) : now,
    incidentType: data.incidentType || 'OTHER',
    incidentDescription: data.incidentDescription || '',
    incidentLocation: data.incidentLocation,
    reportedBy: data.reportedBy || createdBy,
    reportedByName: data.reportedByName || '',
    reportedDate: data.reportedDate ? new Date(data.reportedDate) : now,
    investigator: data.investigator || createdBy,
    investigatorName: data.investigatorName || '',
    status: 'REPORTED',
    evidence: [],
    witnesses: [],
    hearing: { attendees: [], employeeAttended: false },
    decision: { outcome: 'NO_ACTION', decidedBy: '', decidedByName: '', reasoning: '' },
    timeline: [],
    laborLawArticle: data.laborLawArticle,
    createdAt: now,
    updatedAt: now,
  };

  addTimeline(inv, 'Investigation created', createdBy,
    `Incident: ${INCIDENT_TYPES.find(t => t.value === inv.incidentType)?.label || inv.incidentType}`);

  await c.insertOne(inv as unknown as Record<string, unknown>);
  return inv;
}

export async function getInvestigation(tenantId: string, investigationId: string): Promise<Investigation | null> {
  const c = await invCol(tenantId);
  const result = await c.findOne({
    tenantId,
    $or: [{ investigationId }, { id: investigationId }],
  });
  return (result as unknown as Investigation) || null;
}

export async function listInvestigations(
  tenantId: string,
  filters?: { status?: string; employeeId?: string; department?: string; type?: string }
): Promise<Investigation[]> {
  const c = await invCol(tenantId);
  const query: Record<string, any> = { tenantId };

  if (filters?.status) query.status = filters.status;
  if (filters?.employeeId) query.employeeId = filters.employeeId;
  if (filters?.department) query.department = filters.department;
  if (filters?.type) query.incidentType = filters.type;

  return (await c.find(query).sort({ updatedAt: -1 }).toArray()) as unknown as Investigation[];
}

// ─── Status Transitions ─────────────────────────────────────────────────────

export async function updateInvestigationStatus(
  tenantId: string,
  investigationId: string,
  newStatus: InvestigationStatus,
  updatedBy: string,
  details?: string
): Promise<Investigation> {
  const c = await invCol(tenantId);
  const inv = await getInvestigation(tenantId, investigationId);
  if (!inv) throw new Error('Investigation not found');

  const allowed = STATUS_FLOW[inv.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${inv.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`);
  }

  const label = STATUS_LABELS[newStatus];
  const now = new Date();

  const update: Record<string, any> = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === 'CLOSED' || newStatus === 'DISMISSED') {
    update.closedAt = now;
  }

  addTimeline(inv, `Status → ${label}`, updatedBy, details);
  update.timeline = inv.timeline;

  await c.updateOne(
    { tenantId, $or: [{ investigationId }, { id: investigationId }] },
    { $set: update }
  );

  return { ...inv, ...update } as Investigation;
}

// ─── Evidence ───────────────────────────────────────────────────────────────

export async function addEvidence(
  tenantId: string,
  investigationId: string,
  evidence: Omit<Evidence, 'id' | 'addedAt'>,
  addedBy: string
): Promise<Investigation> {
  const c = await invCol(tenantId);
  const inv = await getInvestigation(tenantId, investigationId);
  if (!inv) throw new Error('Investigation not found');

  const ev: Evidence = { ...evidence, id: uuidv4(), addedAt: new Date() };
  addTimeline(inv, `Evidence added: ${ev.type}`, addedBy, ev.description);

  await c.updateOne(
    { tenantId, $or: [{ investigationId }, { id: investigationId }] },
    { $push: { evidence: ev, timeline: inv.timeline[inv.timeline.length - 1] } as Record<string, unknown>, $set: { updatedAt: new Date() } }
  );

  return { ...inv, evidence: [...inv.evidence, ev] };
}

// ─── Witness Statements ─────────────────────────────────────────────────────

export async function addWitnessStatement(
  tenantId: string,
  investigationId: string,
  witness: Omit<WitnessStatement, 'id' | 'statementDate'>,
  recordedBy: string
): Promise<Investigation> {
  const c = await invCol(tenantId);
  const inv = await getInvestigation(tenantId, investigationId);
  if (!inv) throw new Error('Investigation not found');

  const ws: WitnessStatement = { ...witness, id: uuidv4(), statementDate: new Date() };
  addTimeline(inv, `Witness statement: ${ws.name}`, recordedBy);

  await c.updateOne(
    { tenantId, $or: [{ investigationId }, { id: investigationId }] },
    { $push: { witnesses: ws, timeline: inv.timeline[inv.timeline.length - 1] } as Record<string, unknown>, $set: { updatedAt: new Date() } }
  );

  return { ...inv, witnesses: [...inv.witnesses, ws] };
}

// ─── Hearing ────────────────────────────────────────────────────────────────

export async function scheduleHearing(
  tenantId: string,
  investigationId: string,
  hearing: { scheduledDate: string; scheduledTime: string; location: string; attendees: string[] },
  scheduledBy: string
): Promise<Investigation> {
  const c = await invCol(tenantId);
  const inv = await getInvestigation(tenantId, investigationId);
  if (!inv) throw new Error('Investigation not found');

  const hearingInfo: HearingInfo = {
    scheduledDate: new Date(hearing.scheduledDate),
    scheduledTime: hearing.scheduledTime,
    location: hearing.location,
    attendees: hearing.attendees,
    employeeAttended: false,
  };

  addTimeline(inv, 'Hearing scheduled', scheduledBy,
    `${hearing.scheduledDate} at ${hearing.scheduledTime}`);

  await c.updateOne(
    { tenantId, $or: [{ investigationId }, { id: investigationId }] },
    { $set: { hearing: hearingInfo, status: 'HEARING_SCHEDULED', updatedAt: new Date(), timeline: inv.timeline } }
  );

  return { ...inv, hearing: hearingInfo, status: 'HEARING_SCHEDULED' };
}

export async function recordHearing(
  tenantId: string,
  investigationId: string,
  result: { employeeAttended: boolean; employeeResponse?: string; hearingNotes?: string },
  recordedBy: string
): Promise<Investigation> {
  const c = await invCol(tenantId);
  const inv = await getInvestigation(tenantId, investigationId);
  if (!inv) throw new Error('Investigation not found');

  const updated = {
    ...inv.hearing,
    employeeAttended: result.employeeAttended,
    employeeResponse: result.employeeResponse,
    hearingNotes: result.hearingNotes,
    completedAt: new Date(),
  };

  const attended = result.employeeAttended ? 'Employee attended' : 'Employee did NOT attend';
  addTimeline(inv, `Hearing completed — ${attended}`, recordedBy);

  await c.updateOne(
    { tenantId, $or: [{ investigationId }, { id: investigationId }] },
    { $set: { hearing: updated, status: 'HEARING_COMPLETED', updatedAt: new Date(), timeline: inv.timeline } }
  );

  return { ...inv, hearing: updated, status: 'HEARING_COMPLETED' };
}

// ─── Decision ───────────────────────────────────────────────────────────────

export async function makeDecision(
  tenantId: string,
  investigationId: string,
  decision: {
    outcome: DecisionOutcome;
    reasoning: string;
    decidedBy: string;
    decidedByName: string;
    deduction?: { type: DeductionType; amount?: number; days?: number; effectiveMonth: string };
    suspension?: { startDate: string; endDate: string; withPay: boolean };
  }
): Promise<{ investigation: Investigation; sideEffects: string[] }> {
  const c = await invCol(tenantId);
  const inv = await getInvestigation(tenantId, investigationId);
  if (!inv) throw new Error('Investigation not found');

  const sideEffects: string[] = [];
  const now = new Date();

  const decisionInfo: DecisionInfo = {
    outcome: decision.outcome,
    decidedBy: decision.decidedBy,
    decidedByName: decision.decidedByName,
    decidedAt: now,
    reasoning: decision.reasoning,
  };

  // ── Handle salary deduction ──
  if (decision.outcome === 'SALARY_DEDUCTION' && decision.deduction) {
    const cc = await contractCol(tenantId);
    const contract = await cc.findOne({ tenantId, employeeId: inv.employeeId, deletedAt: { $exists: false } }) as Record<string, unknown> | null;
    const basicSalary = (contract?.basicSalary as number) || 0;
    const housingAllowance = (contract?.housingAllowance as number) || 0;

    const calc = calculateDeduction({
      basicSalary,
      housingAllowance,
      type: decision.deduction.type,
      amount: decision.deduction.amount,
      days: decision.deduction.days,
    });

    const limit = await checkMonthlyDeductionLimit(
      tenantId, inv.employeeId, decision.deduction.effectiveMonth, calc.calculatedAmount
    );

    decisionInfo.deduction = {
      type: decision.deduction.type,
      amount: decision.deduction.amount,
      days: decision.deduction.days,
      effectiveMonth: decision.deduction.effectiveMonth,
      description: calc.details,
      calculatedAmount: calc.calculatedAmount,
    };

    // Create deduction record
    const dc = await dedCol(tenantId);
    const ded: SalaryDeduction = {
      id: uuidv4(),
      tenantId,
      deductionId: await nextDedId(tenantId),
      investigationId: inv.investigationId,
      employeeId: inv.employeeId,
      employeeName: inv.employeeName,
      department: inv.department,
      type: decision.deduction.type,
      days: decision.deduction.days,
      percentage: decision.deduction.type === 'PERCENTAGE' ? decision.deduction.amount : undefined,
      fixedAmount: decision.deduction.type === 'FIXED_AMOUNT' ? decision.deduction.amount : undefined,
      calculatedAmount: calc.calculatedAmount,
      dailyRate: calc.dailyRate,
      effectiveMonth: decision.deduction.effectiveMonth,
      description: calc.details,
      laborLawArticle: 'Article 66 & 92',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    await dc.insertOne(ded as unknown as Record<string, unknown>);

    sideEffects.push(`Salary deduction of SAR ${calc.calculatedAmount.toLocaleString()} created for ${decision.deduction.effectiveMonth}`);
    if (!limit.withinLimit) {
      sideEffects.push(`WARNING: Total monthly deductions (SAR ${limit.newTotal}) exceed 50% of salary (SAR ${limit.maxAllowed})`);
    }
  }

  // ── Handle suspension ──
  if (decision.outcome === 'SUSPENSION' && decision.suspension) {
    decisionInfo.suspension = {
      startDate: new Date(decision.suspension.startDate),
      endDate: new Date(decision.suspension.endDate),
      withPay: decision.suspension.withPay,
    };
    sideEffects.push(
      `Suspension: ${decision.suspension.startDate} to ${decision.suspension.endDate}` +
      ` (${decision.suspension.withPay ? 'with pay' : 'without pay'})`
    );
  }

  // ── Handle termination ──
  if (decision.outcome === 'TERMINATION') {
    sideEffects.push('TERMINATION recommended — employee status change must be processed separately via HR.');
  }

  // ── Create linked disciplinary record if warning ──
  if (['VERBAL_WARNING', 'WRITTEN_WARNING', 'FINAL_WARNING'].includes(decision.outcome)) {
    const dc = await discCol(tenantId);
    const warningCount = await dc.countDocuments({ tenantId });
    const typeMap: Record<string, string> = {
      VERBAL_WARNING: 'VERBAL_WARNING',
      WRITTEN_WARNING: 'FIRST_WRITTEN',
      FINAL_WARNING: 'FINAL_WARNING',
    };

    await dc.insertOne({
      id: uuidv4(),
      tenantId,
      warningNumber: `WARN-${String(warningCount + 1).padStart(6, '0')}`,
      employeeId: inv.employeeId,
      employeeName: inv.employeeName,
      department: inv.department,
      type: typeMap[decision.outcome] || decision.outcome,
      severity: decision.outcome === 'FINAL_WARNING' ? 'CRITICAL' : decision.outcome === 'WRITTEN_WARNING' ? 'MODERATE' : 'MINOR',
      category: inv.incidentType,
      incidentDate: inv.incidentDate,
      incidentDescription: inv.incidentDescription,
      laborLawArticle: inv.laborLawArticle || null,
      previousWarnings: 0,
      escalationLevel: decision.outcome === 'FINAL_WARNING' ? 3 : decision.outcome === 'WRITTEN_WARNING' ? 2 : 1,
      actionTaken: decision.reasoning,
      status: 'ISSUED',
      isActive: true,
      issuedBy: decision.decidedBy,
      issuedAt: now,
      expiryDate: new Date(now.getTime() + 365 * 86_400_000),
      createdAt: now,
      updatedAt: now,
    } as Record<string, unknown>);

    sideEffects.push(`${decision.outcome.replace(/_/g, ' ')} issued and linked to disciplinary record`);
  }

  addTimeline(inv, `Decision: ${decision.outcome.replace(/_/g, ' ')}`,
    decision.decidedBy, decision.reasoning);

  await c.updateOne(
    { tenantId, $or: [{ investigationId }, { id: investigationId }] },
    { $set: { decision: decisionInfo, status: 'DECISION_MADE', updatedAt: now, timeline: inv.timeline } }
  );

  return { investigation: { ...inv, decision: decisionInfo, status: 'DECISION_MADE' }, sideEffects };
}

// ─── Appeal ─────────────────────────────────────────────────────────────────

export async function fileAppeal(
  tenantId: string,
  investigationId: string,
  reason: string,
  filedBy: string
): Promise<Investigation> {
  const c = await invCol(tenantId);
  const inv = await getInvestigation(tenantId, investigationId);
  if (!inv) throw new Error('Investigation not found');

  const appeal: AppealInfo = { filedDate: new Date(), reason };

  addTimeline(inv, 'Appeal filed', filedBy, reason);

  await c.updateOne(
    { tenantId, $or: [{ investigationId }, { id: investigationId }] },
    { $set: { appeal, status: 'APPEAL', updatedAt: new Date(), timeline: inv.timeline } }
  );

  return { ...inv, appeal, status: 'APPEAL' };
}

// ─── Deduction Management ───────────────────────────────────────────────────

export async function listDeductions(
  tenantId: string,
  filters?: { status?: string; employeeId?: string; effectiveMonth?: string }
): Promise<SalaryDeduction[]> {
  const dc = await dedCol(tenantId);
  const query: Record<string, any> = { tenantId };
  if (filters?.status) query.status = filters.status;
  if (filters?.employeeId) query.employeeId = filters.employeeId;
  if (filters?.effectiveMonth) query.effectiveMonth = filters.effectiveMonth;

  return (await dc.find(query).sort({ createdAt: -1 }).toArray()) as unknown as SalaryDeduction[];
}

export async function applyDeduction(
  tenantId: string,
  deductionId: string,
  appliedBy: string
): Promise<SalaryDeduction> {
  const dc = await dedCol(tenantId);
  const now = new Date();

  await dc.updateOne(
    { tenantId, $or: [{ deductionId }, { id: deductionId }] },
    { $set: { status: 'APPLIED', appliedAt: now, appliedBy, updatedAt: now } }
  );

  const updated = await dc.findOne({ tenantId, $or: [{ deductionId }, { id: deductionId }] });
  return updated as unknown as SalaryDeduction;
}

export async function cancelDeduction(
  tenantId: string,
  deductionId: string,
  cancelledBy: string,
  reason: string
): Promise<SalaryDeduction> {
  const dc = await dedCol(tenantId);
  const now = new Date();

  await dc.updateOne(
    { tenantId, $or: [{ deductionId }, { id: deductionId }] },
    { $set: { status: 'CANCELLED', cancelledAt: now, cancelledBy, cancelReason: reason, updatedAt: now } }
  );

  const updated = await dc.findOne({ tenantId, $or: [{ deductionId }, { id: deductionId }] });
  return updated as unknown as SalaryDeduction;
}

// ─── Statistics ─────────────────────────────────────────────────────────────

export async function getInvestigationStats(tenantId: string): Promise<InvestigationStats> {
  const c = await invCol(tenantId);
  const all = await c.find({ tenantId }).toArray() as unknown as Investigation[];

  const openStatuses: InvestigationStatus[] = ['REPORTED', 'UNDER_INVESTIGATION', 'HEARING_SCHEDULED', 'HEARING_COMPLETED', 'DECISION_PENDING', 'APPEAL'];
  const open = all.filter(i => openStatuses.includes(i.status));
  const closed = all.filter(i => i.status === 'CLOSED');
  const dismissed = all.filter(i => i.status === 'DISMISSED');

  const byType = new Map<string, number>();
  const byOutcome = new Map<string, number>();
  const byStatus = new Map<string, number>();
  let totalDays = 0;
  let resolvedCount = 0;

  for (const inv of all) {
    byType.set(inv.incidentType, (byType.get(inv.incidentType) || 0) + 1);
    byStatus.set(inv.status, (byStatus.get(inv.status) || 0) + 1);
    if (inv.status === 'CLOSED' || inv.status === 'DECISION_MADE') {
      byOutcome.set(inv.decision?.outcome || 'UNKNOWN', (byOutcome.get(inv.decision?.outcome || 'UNKNOWN') || 0) + 1);
    }
    if (inv.closedAt && inv.createdAt) {
      const days = (new Date(inv.closedAt).getTime() - new Date(inv.createdAt).getTime()) / 86_400_000;
      if (days > 0 && days < 365) { totalDays += days; resolvedCount++; }
    }
  }

  const dc = await dedCol(tenantId);
  const pendingDeds = await dc.find({ tenantId, status: 'PENDING' }).toArray() as unknown as SalaryDeduction[];
  const totalDedAmount = pendingDeds.reduce((s: number, d) => s + (d.calculatedAmount || 0), 0);

  return {
    total: all.length,
    open: open.length,
    closed: closed.length,
    dismissed: dismissed.length,
    byType: [...byType].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    byOutcome: [...byOutcome].map(([outcome, count]) => ({ outcome, count })).sort((a, b) => b.count - a.count),
    byStatus: [...byStatus].map(([status, count]) => ({ status, count })),
    avgResolutionDays: resolvedCount > 0 ? Math.round(totalDays / resolvedCount * 10) / 10 : 0,
    pendingDeductions: pendingDeds.length,
    totalDeductionAmount: Math.round(totalDedAmount),
  };
}
