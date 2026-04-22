/**
 * Population Health -- Chronic disease registries, risk stratification, and care gaps.
 * Provides population-level insights for proactive care management.
 */

import { prisma } from '@/lib/db/prisma';

// --- Types ------------------------------------------------------------------

export interface PatientRiskProfile {
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  activeConditions: string[];
  medicationCount: number;
  lastVisitDate?: string;
  daysSinceLastVisit: number;
  careGaps: CareGap[];
  registries: string[];
}

export interface CareGap {
  id: string;
  type: string;
  description: string;
  descriptionAr: string;
  priority: 'routine' | 'important' | 'urgent';
  dueDate?: string;
  isOverdue: boolean;
}

export interface DiseaseRegistry {
  id: string;
  name: string;
  nameAr: string;
  icdCodes: string[];
  totalPatients: number;
  controlledCount: number;
  uncontrolledCount: number;
  controlRate: number;
  careGapCount: number;
}

export interface PopulationSummary {
  totalPatients: number;
  riskDistribution: { level: string; count: number; pct: number }[];
  registries: DiseaseRegistry[];
  topCareGaps: { type: string; count: number; pct: number }[];
  ageDistribution: { range: string; count: number }[];
  genderDistribution: { gender: string; count: number }[];
  highRiskPatients: PatientRiskProfile[];
  readmissionRiskPatients: PatientRiskProfile[];
}

// --- Care Gap Definitions ---------------------------------------------------

const CARE_GAP_DEFINITIONS = [
  { type: 'hba1c_overdue', description: 'HbA1c test overdue (>3 months)', descriptionAr: '\u0641\u062D\u0635 HbA1c \u0645\u062A\u0623\u062E\u0631', registry: 'diabetes', intervalDays: 90 },
  { type: 'eye_exam_overdue', description: 'Annual eye exam overdue', descriptionAr: '\u0641\u062D\u0635 \u0627\u0644\u0639\u064A\u0646 \u0627\u0644\u0633\u0646\u0648\u064A \u0645\u062A\u0623\u062E\u0631', registry: 'diabetes', intervalDays: 365 },
  { type: 'foot_exam_overdue', description: 'Annual foot exam overdue', descriptionAr: '\u0641\u062D\u0635 \u0627\u0644\u0642\u062F\u0645 \u0627\u0644\u0633\u0646\u0648\u064A \u0645\u062A\u0623\u062E\u0631', registry: 'diabetes', intervalDays: 365 },
  { type: 'bp_check_overdue', description: 'BP check overdue (>1 month)', descriptionAr: '\u0642\u064A\u0627\u0633 \u0627\u0644\u0636\u063A\u0637 \u0645\u062A\u0623\u062E\u0631', registry: 'hypertension', intervalDays: 30 },
  { type: 'lipid_panel_overdue', description: 'Lipid panel overdue (>6 months)', descriptionAr: '\u0641\u062D\u0635 \u0627\u0644\u062F\u0647\u0648\u0646 \u0645\u062A\u0623\u062E\u0631', registry: 'cardiovascular', intervalDays: 180 },
  { type: 'mammogram_overdue', description: 'Screening mammogram overdue', descriptionAr: '\u062A\u0635\u0648\u064A\u0631 \u0627\u0644\u062B\u062F\u064A \u0645\u062A\u0623\u062E\u0631', registry: 'screening', intervalDays: 365 },
  { type: 'flu_vaccine_overdue', description: 'Annual flu vaccine overdue', descriptionAr: '\u062A\u0637\u0639\u064A\u0645 \u0627\u0644\u0625\u0646\u0641\u0644\u0648\u0646\u0632\u0627 \u0645\u062A\u0623\u062E\u0631', registry: 'general', intervalDays: 365 },
  { type: 'renal_function_overdue', description: 'Renal function check overdue (>6 months)', descriptionAr: '\u0641\u062D\u0635 \u0648\u0638\u0627\u0626\u0641 \u0627\u0644\u0643\u0644\u0649 \u0645\u062A\u0623\u062E\u0631', registry: 'ckd', intervalDays: 180 },
];

// --- Population Functions ---------------------------------------------------

export async function getPopulationSummary(
  tenantId: string,
): Promise<PopulationSummary> {
  const patients = await prisma.patientMaster.findMany({
    where: { tenantId },
    take: 5000,
  });
  const totalPatients = patients.length;
  const now = new Date();

  // Risk distribution — approximate using lightweight heuristics instead of calling
  // computePatientRiskScore() for every patient (which would be O(N) DB-heavy).
  // Heuristic: patients with 3+ active conditions = high/critical; 1-2 = moderate; 0 = low.
  // Known limitation: a dedicated patient_risk_profiles table would allow pre-computed
  // scores; currently risk is estimated from active problem counts.
  const problemCounts = await prisma.patientProblem.groupBy({
    by: ['patientId'],
    where: { tenantId, status: 'active' },
    _count: { id: true },
  });
  const problemCountMap = new Map(problemCounts.map((p) => [p.patientId, p._count.id]));
  const riskCounts = { low: 0, moderate: 0, high: 0, critical: 0 };
  for (const patient of patients) {
    const condCount = problemCountMap.get(patient.id) || 0;
    const age = patient.dob
      ? Math.floor((now.getTime() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 0;
    if (condCount >= 4 || (condCount >= 3 && age > 65)) riskCounts.critical++;
    else if (condCount >= 3 || (condCount >= 2 && age > 65)) riskCounts.high++;
    else if (condCount >= 1) riskCounts.moderate++;
    else riskCounts.low++;
  }

  const riskDistribution = Object.entries(riskCounts).map(([level, count]) => ({
    level,
    count,
    pct: totalPatients > 0 ? Math.round((count / totalPatients) * 100) : 0,
  }));

  // Disease registries
  const registryDefs = [
    { id: 'diabetes', name: 'Diabetes', nameAr: '\u0627\u0644\u0633\u0643\u0631\u064A', icdCodes: ['E10', 'E11', 'E13'] },
    { id: 'hypertension', name: 'Hypertension', nameAr: '\u0627\u0631\u062A\u0641\u0627\u0639 \u0627\u0644\u0636\u063A\u0637', icdCodes: ['I10', 'I11', 'I12', 'I13'] },
    { id: 'asthma', name: 'Asthma', nameAr: '\u0627\u0644\u0631\u0628\u0648', icdCodes: ['J45', 'J46'] },
    { id: 'ckd', name: 'Chronic Kidney Disease', nameAr: '\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0643\u0644\u0649', icdCodes: ['N18'] },
    { id: 'cardiovascular', name: 'Cardiovascular Disease', nameAr: '\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0642\u0644\u0628', icdCodes: ['I20', 'I21', 'I25', 'I48', 'I50'] },
    { id: 'copd', name: 'COPD', nameAr: '\u0627\u0644\u0627\u0646\u0633\u062F\u0627\u062F \u0627\u0644\u0631\u0626\u0648\u064A', icdCodes: ['J44'] },
  ];

  const registries: DiseaseRegistry[] = [];
  for (const def of registryDefs) {
    // Use PatientProblem model to find patients with matching ICD codes
    // PatientProblem has icdCode field and status
    const regPatients = await prisma.patientProblem.count({
      where: {
        tenantId,
        icdCode: {
          // Match any code starting with the registry ICD prefixes
          in: def.icdCodes, // Simplified: exact match on prefix
        },
        status: 'active',
      },
    });

    // Known limitation: PatientProblem does not have an isControlled field.
    // As a proxy, count patients whose most recent lab result for a registry-relevant
    // test (e.g. HbA1c for diabetes) is within normal range. Since correlating
    // specific lab codes per registry is complex and data-dependent, we use a
    // heuristic: patients with a "resolved" or "inactive" problem status are
    // considered controlled. Active problems with recent encounters (last 90 days)
    // suggest active management (treated as "controlled" from a registry view).
    const recentlyManaged = await prisma.encounterCore.count({
      where: {
        tenantId,
        patientId: { in: (await prisma.patientProblem.findMany({
          where: { tenantId, icdCode: { in: def.icdCodes }, status: 'active' },
          select: { patientId: true },
          distinct: ['patientId'],
          take: 5000,
        })).map((p) => p.patientId) },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
    });
    // Rough proxy: patients seen within 90 days are considered under active management
    const controlled = Math.min(recentlyManaged, regPatients);

    registries.push({
      id: def.id,
      name: def.name,
      nameAr: def.nameAr,
      icdCodes: def.icdCodes,
      totalPatients: regPatients,
      controlledCount: controlled,
      uncontrolledCount: regPatients - controlled,
      controlRate: regPatients > 0 ? Math.round((controlled / regPatients) * 100) : 0,
      careGapCount: 0, // computed separately
    });
  }

  // Age distribution
  const ageBuckets = [
    { range: '0-17', min: 0, max: 17 },
    { range: '18-30', min: 18, max: 30 },
    { range: '31-45', min: 31, max: 45 },
    { range: '46-60', min: 46, max: 60 },
    { range: '61-75', min: 61, max: 75 },
    { range: '76+', min: 76, max: 200 },
  ];

  const ageDistribution = ageBuckets.map((bucket) => {
    const count = patients.filter((p) => {
      if (!p.dob) return false;
      const age = Math.floor((now.getTime() - new Date(p.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return age >= bucket.min && age <= bucket.max;
    }).length;
    return { range: bucket.range, count };
  });

  // Gender distribution
  const genderMap = new Map<string, number>();
  for (const p of patients) {
    const g = p.gender || 'Unknown';
    genderMap.set(g, (genderMap.get(g) || 0) + 1);
  }

  // Top care gaps -- use the CareGap model from care_gaps.prisma
  const careGapDocs = await prisma.careGap.findMany({
    where: {
      tenantId,
      status: 'OPEN',
    },
    take: 5000,
  });

  const gapTypeMap = new Map<string, number>();
  for (const gap of careGapDocs) {
    gapTypeMap.set(gap.gapType, (gapTypeMap.get(gap.gapType) || 0) + 1);
  }

  return {
    totalPatients,
    riskDistribution,
    registries,
    topCareGaps: Array.from(gapTypeMap.entries())
      .map(([type, count]) => ({ type, count, pct: totalPatients > 0 ? Math.round((count / totalPatients) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    ageDistribution,
    genderDistribution: Array.from(genderMap.entries()).map(([gender, count]) => ({ gender, count })),
    // Known limitation: Without a materialized patient_risk_profiles table,
    // we cannot efficiently return pre-sorted high-risk patients. The caller
    // should use computePatientRiskScore() for individual patient risk lookups.
    highRiskPatients: [],
    readmissionRiskPatients: [],
  };
}

// --- Risk Scoring -----------------------------------------------------------

export async function computePatientRiskScore(
  tenantId: string,
  patientId: string,
): Promise<PatientRiskProfile | null> {
  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientId },
  });
  if (!patient) return null;

  let riskScore = 0;
  const factors: string[] = [];

  // Age factor
  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 0;
  if (age > 75) { riskScore += 20; factors.push('Age >75'); }
  else if (age > 65) { riskScore += 10; factors.push('Age >65'); }

  // Chronic conditions -- use PatientProblem model
  const conditions = await prisma.patientProblem.findMany({
    where: {
      tenantId,
      patientId,
      status: 'active',
    },
    take: 100,
  });

  riskScore += Math.min(conditions.length * 5, 30);
  if (conditions.length > 3) factors.push(`${conditions.length} active conditions`);

  // Medication count
  const meds = await prisma.ordersHub.count({
    where: {
      tenantId,
      patientMasterId: patientId,
      kind: 'MEDICATION',
      status: { in: ['ORDERED', 'IN_PROGRESS'] },
    },
  });
  if (meds >= 10) { riskScore += 15; factors.push('Polypharmacy (10+)'); }
  else if (meds >= 5) { riskScore += 5; factors.push('Multiple medications'); }

  // Recent admissions
  const recentAdmissions = await prisma.encounterCore.count({
    where: {
      tenantId,
      patientId,
      encounterType: 'IPD',
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });
  if (recentAdmissions >= 2) { riskScore += 20; factors.push(`${recentAdmissions} admissions in 90d`); }

  // Last visit
  const lastVisit = await prisma.encounterCore.findFirst({
    where: { tenantId, patientId },
    orderBy: { createdAt: 'desc' },
  });
  const daysSince = lastVisit
    ? Math.floor((Date.now() - new Date(lastVisit.createdAt).getTime()) / (24 * 60 * 60 * 1000))
    : 999;
  if (daysSince > 180) { riskScore += 10; factors.push('No visit in 6+ months'); }

  // Cap score
  riskScore = Math.min(riskScore, 100);

  let riskLevel: PatientRiskProfile['riskLevel'];
  if (riskScore >= 70) riskLevel = 'critical';
  else if (riskScore >= 50) riskLevel = 'high';
  else if (riskScore >= 25) riskLevel = 'moderate';
  else riskLevel = 'low';

  // Care gaps -- use CareGap model
  const careGapRows = await prisma.careGap.findMany({
    where: {
      tenantId,
      patientMasterId: patientId,
      status: 'OPEN',
    },
    take: 100,
  });

  const careGaps: CareGap[] = careGapRows.map((g) => ({
    id: g.id,
    type: g.gapType,
    description: g.reason || g.sourceOrderName || '',
    descriptionAr: g.reasonAr || '',
    priority: g.priority === 'STAT' ? 'urgent' : g.priority === 'URGENT' ? 'important' : 'routine',
    dueDate: g.dueAt ? g.dueAt.toISOString().split('T')[0] : undefined,
    isOverdue: g.status === 'OPEN' && g.dueAt ? g.dueAt < new Date() : false,
  }));

  const profile: PatientRiskProfile = {
    patientId,
    patientName: patient.fullName || '',
    age,
    gender: patient.gender || '',
    riskScore,
    riskLevel,
    activeConditions: conditions.map((c) => c.problemName || c.icdCode || ''),
    medicationCount: meds,
    lastVisitDate: lastVisit?.createdAt?.toISOString(),
    daysSinceLastVisit: daysSince,
    careGaps,
    registries: [],
  };

  // Known limitation: No dedicated patient_risk_profiles table exists.
  // Risk profiles are computed on-the-fly via computePatientRiskScore().
  // To persist scores for dashboards and bulk queries, create a materialized
  // PatientRiskProfile model with periodic batch recomputation (e.g. nightly cron).

  return profile;
}

// --- Care Gap Detection -----------------------------------------------------

export async function detectCareGaps(
  tenantId: string,
  patientId: string,
): Promise<CareGap[]> {
  const conditions = await prisma.patientProblem.findMany({
    where: {
      tenantId,
      patientId,
      status: 'active',
    },
    take: 100,
  });

  const conditionCodes = conditions.map((c) => (c.icdCode || '').substring(0, 3));
  const gaps: CareGap[] = [];

  for (const def of CARE_GAP_DEFINITIONS) {
    // Check if patient is in the relevant registry
    let inRegistry = def.registry === 'general';
    if (!inRegistry) {
      // Check condition codes
      const registryDef = [
        { id: 'diabetes', codes: ['E10', 'E11', 'E13'] },
        { id: 'hypertension', codes: ['I10', 'I11'] },
        { id: 'ckd', codes: ['N18'] },
        { id: 'cardiovascular', codes: ['I20', 'I21', 'I25'] },
      ].find((r) => r.id === def.registry);

      if (registryDef) {
        inRegistry = conditionCodes.some((c) => registryDef.codes.includes(c));
      }
    }

    if (!inRegistry) continue;

    // Check if the care gap action was done within interval.
    // Known limitation: No dedicated patient_care_actions model exists.
    // We use OrdersHub as the best available proxy — a completed/resulted order
    // for this patient within the care gap interval implies the action was performed.
    // For better accuracy, match on order kind + name keywords per gap type.
    const cutoff = new Date(Date.now() - def.intervalDays * 24 * 60 * 60 * 1000);

    // Map gap types to order search hints for more targeted matching
    const gapOrderHints: Record<string, { kind?: string; namePattern?: string }> = {
      hba1c_overdue: { kind: 'LAB', namePattern: 'hba1c' },
      eye_exam_overdue: { kind: 'REFERRAL', namePattern: 'eye' },
      foot_exam_overdue: { kind: 'PROCEDURE', namePattern: 'foot' },
      bp_check_overdue: { kind: 'PROCEDURE', namePattern: 'blood pressure' },
      lipid_panel_overdue: { kind: 'LAB', namePattern: 'lipid' },
      mammogram_overdue: { kind: 'RADIOLOGY', namePattern: 'mammo' },
      flu_vaccine_overdue: { kind: 'MEDICATION', namePattern: 'influenza' },
      renal_function_overdue: { kind: 'LAB', namePattern: 'renal' },
    };

    const hint = gapOrderHints[def.type];
    const recentOrder = await prisma.ordersHub.findFirst({
      where: {
        tenantId,
        patientMasterId: patientId,
        status: { in: ['COMPLETED', 'RESULTED'] },
        completedAt: { gte: cutoff },
        ...(hint?.kind ? { kind: hint.kind } : {}),
        ...(hint?.namePattern ? { orderName: { contains: hint.namePattern, mode: 'insensitive' as const } } : {}),
      },
    });

    if (!recentOrder) {
      gaps.push({
        id: `gap_${def.type}_${patientId}`,
        type: def.type,
        description: def.description,
        descriptionAr: def.descriptionAr,
        priority: def.intervalDays <= 30 ? 'urgent' : def.intervalDays <= 90 ? 'important' : 'routine',
        isOverdue: true,
      });
    }
  }

  // Upsert care gaps using the CareGap model
  for (const gap of gaps) {
    // Use CareGap model -- upsert by tenantId + sourceOrderId (using gap.id as a synthetic key)
    // Since CareGap has @@unique([tenantId, sourceOrderId]), we use the gap type+patient as a key
    try {
      await prisma.careGap.upsert({
        where: {
          tenantId_sourceOrderId: {
            tenantId,
            sourceOrderId: `care_gap_${gap.type}_${patientId}`,
          },
        },
        update: {
          status: 'OPEN',
          priority: gap.priority === 'urgent' ? 'STAT' : gap.priority === 'important' ? 'URGENT' : 'ROUTINE',
          reason: gap.description,
          reasonAr: gap.descriptionAr,
          gapType: gap.type === 'hba1c_overdue' ? 'LAB_OVERDUE' : 'FOLLOWUP_MISSED',
        },
        create: {
          tenantId,
          patientMasterId: patientId,
          gapType: gap.type === 'hba1c_overdue' ? 'LAB_OVERDUE' : 'FOLLOWUP_MISSED',
          sourceOrderId: `care_gap_${gap.type}_${patientId}`,
          sourceOrderName: gap.description,
          sourceOrderNameAr: gap.descriptionAr,
          reason: gap.description,
          reasonAr: gap.descriptionAr,
          priority: gap.priority === 'urgent' ? 'STAT' : gap.priority === 'important' ? 'URGENT' : 'ROUTINE',
          status: 'OPEN',
        },
      });
    } catch {
      // Ignore upsert conflicts for care gaps
    }
  }

  return gaps;
}
