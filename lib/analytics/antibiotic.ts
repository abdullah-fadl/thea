/**
 * Antibiotic Stewardship -- Antimicrobial usage monitoring and optimization.
 * Tracks DDD (Defined Daily Doses), de-escalation rates, and culture-guided therapy.
 */

import { prisma } from '@/lib/db/prisma';

// --- Types ------------------------------------------------------------------

export interface AntibioticUsage {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId: string;
  drugCode: string;
  drugName: string;
  drugNameAr?: string;
  category: AntibioticCategory;
  route: 'IV' | 'IM' | 'PO' | 'topical' | 'other';
  dose: number;
  doseUnit: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  durationDays: number;
  indication?: string;
  cultureGuided: boolean;
  deEscalated: boolean;
  restrictedDrug: boolean;
  prescriberId: string;
  department: string;
  ddd: number; // Defined Daily Dose
  createdAt: Date;
}

export type AntibioticCategory =
  | 'penicillins'
  | 'cephalosporins'
  | 'carbapenems'
  | 'fluoroquinolones'
  | 'aminoglycosides'
  | 'glycopeptides'
  | 'macrolides'
  | 'tetracyclines'
  | 'antifungals'
  | 'antivirals'
  | 'other';

export interface StewardshipSummary {
  period: { start: Date; end: Date };
  totalPrescriptions: number;
  totalDDD: number;
  dddPer1000PatientDays: number;
  avgDurationDays: number;
  cultureGuidedRate: number;
  deEscalationRate: number;
  ivToOralConversionRate: number;
  restrictedDrugUse: number;
  byCategory: { category: AntibioticCategory; count: number; ddd: number; pct: number }[];
  byDepartment: { department: string; count: number; ddd: number; dddRate: number }[];
  topDrugs: { drugName: string; count: number; ddd: number }[];
  monthlyTrend: { month: string; ddd: number; rate: number }[];
  alerts: StewardshipAlert[];
}

export interface StewardshipAlert {
  id: string;
  type: 'high_ddd' | 'prolonged_course' | 'restricted_drug' | 'no_culture' | 'escalation_needed';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  messageAr: string;
  patientId?: string;
  encounterId?: string;
  drugName?: string;
  createdAt: Date;
}

// --- Core Functions ---------------------------------------------------------

export async function recordAntibioticUsage(
  tenantId: string,
  data: Omit<AntibioticUsage, 'id' | 'tenantId' | 'createdAt'>,
): Promise<AntibioticUsage> {
  const row = await prisma.antibioticUsage.create({
    data: {
      tenantId,
      patientId: data.patientId,
      encounterId: data.encounterId,
      drugCode: data.drugCode,
      drugName: data.drugName,
      drugNameAr: data.drugNameAr,
      category: data.category,
      route: data.route,
      dose: data.dose,
      doseUnit: data.doseUnit,
      frequency: data.frequency,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      durationDays: data.durationDays,
      indication: data.indication,
      cultureGuided: data.cultureGuided,
      deEscalated: data.deEscalated,
      restrictedDrug: data.restrictedDrug,
      prescriberId: data.prescriberId,
      department: data.department,
      ddd: data.ddd,
    },
  });

  const record: AntibioticUsage = {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId || '',
    encounterId: row.encounterId || '',
    drugCode: row.drugCode || '',
    drugName: row.drugName || '',
    drugNameAr: row.drugNameAr || undefined,
    category: (row.category as AntibioticCategory) || 'other',
    route: (row.route as AntibioticUsage['route']) || 'other',
    dose: Number(row.dose) || 0,
    doseUnit: row.doseUnit || '',
    frequency: row.frequency || '',
    startDate: row.startDate ? row.startDate.toISOString().split('T')[0] : '',
    endDate: row.endDate ? row.endDate.toISOString().split('T')[0] : undefined,
    durationDays: row.durationDays || 0,
    indication: row.indication || undefined,
    cultureGuided: row.cultureGuided,
    deEscalated: row.deEscalated,
    restrictedDrug: row.restrictedDrug,
    prescriberId: row.prescriberId || '',
    department: row.department || '',
    ddd: Number(row.ddd) || 0,
    createdAt: row.createdAt,
  };

  // Check stewardship rules
  await checkStewardshipRules(tenantId, record);

  return record;
}

export async function getStewardshipSummary(
  tenantId: string,
  range: { start: Date; end: Date },
): Promise<StewardshipSummary> {
  const rows = await prisma.antibioticUsage.findMany({
    where: {
      tenantId,
      startDate: {
        gte: new Date(range.start.toISOString().split('T')[0]),
        lte: new Date(range.end.toISOString().split('T')[0]),
      },
    },
  });

  // Map Prisma rows to local type
  const usages: AntibioticUsage[] = rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    patientId: r.patientId || '',
    encounterId: r.encounterId || '',
    drugCode: r.drugCode || '',
    drugName: r.drugName || '',
    drugNameAr: r.drugNameAr || undefined,
    category: (r.category as AntibioticCategory) || 'other',
    route: (r.route as AntibioticUsage['route']) || 'other',
    dose: Number(r.dose) || 0,
    doseUnit: r.doseUnit || '',
    frequency: r.frequency || '',
    startDate: r.startDate ? r.startDate.toISOString().split('T')[0] : '',
    endDate: r.endDate ? r.endDate.toISOString().split('T')[0] : undefined,
    durationDays: r.durationDays || 0,
    indication: r.indication || undefined,
    cultureGuided: r.cultureGuided,
    deEscalated: r.deEscalated,
    restrictedDrug: r.restrictedDrug,
    prescriberId: r.prescriberId || '',
    department: r.department || '',
    ddd: Number(r.ddd) || 0,
    createdAt: r.createdAt,
  }));

  // Patient days estimate
  const encounterCount = await prisma.encounterCore.count({
    where: {
      tenantId,
      encounterType: 'IPD',
      createdAt: { gte: range.start, lte: range.end },
    },
  });
  const patientDays = Math.max(encounterCount * 5, 1);

  const totalDDD = usages.reduce((s, u) => s + (u.ddd || 0), 0);
  const avgDuration = usages.length > 0
    ? Math.round(usages.reduce((s, u) => s + u.durationDays, 0) / usages.length * 10) / 10
    : 0;

  const cultureGuided = usages.filter((u) => u.cultureGuided).length;
  const deEscalated = usages.filter((u) => u.deEscalated).length;
  const ivUsages = usages.filter((u) => u.route === 'IV');
  const ivConverted = ivUsages.filter((u) => u.deEscalated); // simplified
  const restricted = usages.filter((u) => u.restrictedDrug).length;

  // By category
  const catMap = new Map<string, { count: number; ddd: number }>();
  for (const u of usages) {
    const existing = catMap.get(u.category) || { count: 0, ddd: 0 };
    existing.count++;
    existing.ddd += u.ddd || 0;
    catMap.set(u.category, existing);
  }

  // By department
  const deptMap = new Map<string, { count: number; ddd: number }>();
  for (const u of usages) {
    const existing = deptMap.get(u.department) || { count: 0, ddd: 0 };
    existing.count++;
    existing.ddd += u.ddd || 0;
    deptMap.set(u.department, existing);
  }

  // Top drugs
  const drugMap = new Map<string, { count: number; ddd: number }>();
  for (const u of usages) {
    const existing = drugMap.get(u.drugName) || { count: 0, ddd: 0 };
    existing.count++;
    existing.ddd += u.ddd || 0;
    drugMap.set(u.drugName, existing);
  }

  // Monthly trend
  const monthlyTrend: { month: string; ddd: number; rate: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(range.end);
    monthStart.setMonth(monthStart.getMonth() - i, 1);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const monthUsages = usages.filter((u) => {
      const d = new Date(u.startDate);
      return d >= monthStart && d < monthEnd;
    });
    const monthDDD = monthUsages.reduce((s, u) => s + (u.ddd || 0), 0);

    monthlyTrend.push({
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      ddd: Math.round(monthDDD * 10) / 10,
      rate: Math.round((monthDDD / patientDays) * 1000 * 10) / 10,
    });
  }

  // Alerts
  const alertRows = await prisma.stewardshipAlert.findMany({
    where: {
      tenantId,
      createdAt: { gte: range.start },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const alerts: StewardshipAlert[] = alertRows.map((a) => ({
    id: a.id,
    type: (a.type as StewardshipAlert['type']) || 'high_ddd',
    severity: (a.severity as StewardshipAlert['severity']) || 'info',
    message: a.message || '',
    messageAr: a.messageAr || '',
    patientId: a.patientId || undefined,
    encounterId: a.encounterId || undefined,
    drugName: a.drugName || undefined,
    createdAt: a.createdAt,
  }));

  return {
    period: range,
    totalPrescriptions: usages.length,
    totalDDD: Math.round(totalDDD * 10) / 10,
    dddPer1000PatientDays: Math.round((totalDDD / patientDays) * 1000 * 10) / 10,
    avgDurationDays: avgDuration,
    cultureGuidedRate: usages.length > 0 ? Math.round((cultureGuided / usages.length) * 100) : 0,
    deEscalationRate: usages.length > 0 ? Math.round((deEscalated / usages.length) * 100) : 0,
    ivToOralConversionRate: ivUsages.length > 0 ? Math.round((ivConverted.length / ivUsages.length) * 100) : 0,
    restrictedDrugUse: restricted,
    byCategory: Array.from(catMap.entries())
      .map(([category, d]) => ({
        category: category as AntibioticCategory,
        count: d.count,
        ddd: Math.round(d.ddd * 10) / 10,
        pct: Math.round((d.count / usages.length) * 100),
      }))
      .sort((a, b) => b.count - a.count),
    byDepartment: Array.from(deptMap.entries()).map(([department, d]) => ({
      department,
      count: d.count,
      ddd: Math.round(d.ddd * 10) / 10,
      dddRate: Math.round((d.ddd / patientDays) * 1000 * 10) / 10,
    })),
    topDrugs: Array.from(drugMap.entries())
      .map(([drugName, d]) => ({ drugName, count: d.count, ddd: Math.round(d.ddd * 10) / 10 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    monthlyTrend,
    alerts,
  };
}

// --- Stewardship Rules ------------------------------------------------------

async function checkStewardshipRules(
  tenantId: string,
  record: AntibioticUsage,
): Promise<void> {
  const alertsData: Array<{
    type: string;
    severity: string;
    message: string;
    messageAr: string;
    patientId?: string;
    encounterId?: string;
    drugName?: string;
  }> = [];

  // Rule 1: Prolonged course (> 14 days)
  if (record.durationDays > 14) {
    alertsData.push({
      type: 'prolonged_course',
      severity: record.durationDays > 21 ? 'critical' : 'warning',
      message: `Prolonged ${record.drugName} course: ${record.durationDays} days`,
      messageAr: `\u0645\u062F\u0629 \u0639\u0644\u0627\u062C \u0637\u0648\u064A\u0644\u0629 ${record.drugName}: ${record.durationDays} \u064A\u0648\u0645`,
      patientId: record.patientId,
      encounterId: record.encounterId,
      drugName: record.drugName,
    });
  }

  // Rule 2: Restricted drug without culture
  if (record.restrictedDrug && !record.cultureGuided) {
    alertsData.push({
      type: 'no_culture',
      severity: 'warning',
      message: `Restricted drug ${record.drugName} prescribed without culture guidance`,
      messageAr: `\u0648\u0635\u0641 \u062F\u0648\u0627\u0621 \u0645\u0642\u064A\u062F ${record.drugName} \u0628\u062F\u0648\u0646 \u0632\u0631\u0627\u0639\u0629`,
      patientId: record.patientId,
      encounterId: record.encounterId,
      drugName: record.drugName,
    });
  }

  // Rule 3: Carbapenem use -- always flag for review
  if (record.category === 'carbapenems') {
    alertsData.push({
      type: 'restricted_drug',
      severity: 'info',
      message: `Carbapenem (${record.drugName}) prescribed -- stewardship review required`,
      messageAr: `\u0648\u0635\u0641 \u0643\u0627\u0631\u0628\u0627\u0628\u064A\u0646\u064A\u0645 (${record.drugName}) -- \u064A\u0644\u0632\u0645 \u0645\u0631\u0627\u062C\u0639\u0629`,
      patientId: record.patientId,
      encounterId: record.encounterId,
      drugName: record.drugName,
    });
  }

  // Insert alerts
  for (const a of alertsData) {
    await prisma.stewardshipAlert.create({
      data: {
        tenantId,
        type: a.type,
        severity: a.severity,
        message: a.message,
        messageAr: a.messageAr,
        patientId: a.patientId,
        encounterId: a.encounterId,
        drugName: a.drugName,
      },
    });
  }
}

// --- DDD Lookup -------------------------------------------------------------

/** Common DDDs for reference (WHO ATC/DDD 2024) */
export const DDD_REFERENCE: Record<string, number> = {
  amoxicillin: 1.5,
  ampicillin: 6,
  'amoxicillin-clavulanate': 1.5,
  ceftriaxone: 2,
  cefazolin: 3,
  cefuroxime: 0.5,
  ciprofloxacin: 1,
  levofloxacin: 0.5,
  meropenem: 3,
  imipenem: 2,
  vancomycin: 2,
  metronidazole: 1.5,
  azithromycin: 0.3,
  piperacillin: 14,
  'piperacillin-tazobactam': 14,
  gentamicin: 0.24,
  clindamycin: 1.2,
  doxycycline: 0.1,
  fluconazole: 0.2,
  trimethoprim: 0.4,
};

export function calculateDDD(drugName: string, dose: number, doseUnit: string): number {
  const normalizedName = drugName.toLowerCase().replace(/\s+/g, '-');
  const referenceDDD = DDD_REFERENCE[normalizedName];
  if (!referenceDDD) return 1; // fallback

  // Convert dose to grams
  let doseGrams = dose;
  if (doseUnit === 'mg') doseGrams = dose / 1000;
  if (doseUnit === 'mcg' || doseUnit === '\u00b5g') doseGrams = dose / 1000000;

  return Math.round((doseGrams / referenceDDD) * 100) / 100;
}
