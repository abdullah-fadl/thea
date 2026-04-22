/**
 * Care Gap Scanner — Identifies preventive care, screening, medication, and
 * follow-up gaps across the patient population.
 *
 * Built-in rules cover 15 clinical scenarios aligned with CBAHI and
 * international quality standards. Each rule queries real Prisma models
 * (PatientMaster, EncounterCore, OrdersHub, OrderResult, IpdEpisode, etc.)
 * to determine if a gap exists.
 *
 * The scanner is idempotent — running it twice will not create duplicate gaps
 * for the same patient + rule + gapType combination.
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CareGapRuleDefinition {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  category: string;
  gapType: string;
  severity: string;
  frequency: string;
  criteria: Record<string, any>;
}

export interface ScanResult {
  totalPatients: number;
  gapsFound: number;
  gapsCreated: number;
  gapsSkipped: number;
  rulesEvaluated: number;
  durationMs: number;
  errors: string[];
}

export interface GapFilters {
  patientId?: string;
  category?: string;
  severity?: string;
  status?: string;
  gapType?: string;
  page?: number;
  limit?: number;
}

export interface GapStatistics {
  totalOpen: number;
  totalAddressed: number;
  totalDismissed: number;
  bySeverity: { low: number; moderate: number; high: number; critical: number };
  byCategory: Record<string, number>;
  byGapType: Record<string, number>;
  addressedThisMonth: number;
  closureRate: number;
  trend: { period: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Default Rules (15 built-in clinical rules)
// ---------------------------------------------------------------------------

export function getDefaultRules(): CareGapRuleDefinition[] {
  return [
    // ── Preventive Care ──
    {
      id: 'rule_hba1c_overdue',
      name: 'Diabetic HbA1c Overdue',
      nameAr: 'فحص HbA1c للسكري متأخر',
      description: 'HbA1c test overdue for diabetic patients (>3 months since last)',
      descriptionAr: 'فحص الهيموجلوبين السكري متأخر (أكثر من 3 أشهر)',
      category: 'preventive',
      gapType: 'lab_overdue',
      severity: 'high',
      frequency: 'monthly',
      criteria: { diagnosisPrefix: 'E11', labCode: 'HBA1C', intervalMonths: 3 },
    },
    {
      id: 'rule_diabetic_eye_exam',
      name: 'Diabetic Eye Exam Overdue',
      nameAr: 'فحص العين للسكري متأخر',
      description: 'Annual dilated eye exam overdue for diabetic patients (>12 months)',
      descriptionAr: 'فحص العين السنوي للسكري متأخر (أكثر من 12 شهر)',
      category: 'preventive',
      gapType: 'screening_overdue',
      severity: 'moderate',
      frequency: 'monthly',
      criteria: { diagnosisPrefix: 'E11', orderKind: 'PROCEDURE', orderNamePattern: 'eye exam|dilated fundus|fundoscopy', intervalMonths: 12 },
    },
    {
      id: 'rule_diabetic_foot_exam',
      name: 'Diabetic Foot Exam Overdue',
      nameAr: 'فحص القدم للسكري متأخر',
      description: 'Annual foot exam overdue for diabetic patients (>12 months)',
      descriptionAr: 'فحص القدم السنوي للسكري متأخر (أكثر من 12 شهر)',
      category: 'preventive',
      gapType: 'screening_overdue',
      severity: 'moderate',
      frequency: 'monthly',
      criteria: { diagnosisPrefix: 'E11', orderKind: 'PROCEDURE', orderNamePattern: 'foot exam|podiatry|monofilament', intervalMonths: 12 },
    },
    {
      id: 'rule_hypertension_followup',
      name: 'Hypertension Follow-up Overdue',
      nameAr: 'متابعة ارتفاع الضغط متأخرة',
      description: 'Follow-up visit overdue for hypertensive patients (>3 months)',
      descriptionAr: 'زيارة المتابعة لمرضى ارتفاع ضغط الدم متأخرة (أكثر من 3 أشهر)',
      category: 'preventive',
      gapType: 'follow_up_missed',
      severity: 'high',
      frequency: 'monthly',
      criteria: { diagnosisPrefix: 'I10', intervalMonths: 3 },
    },
    {
      id: 'rule_lipid_panel_cvd',
      name: 'Lipid Panel Overdue (CVD)',
      nameAr: 'فحص الدهون متأخر (أمراض القلب)',
      description: 'Lipid panel overdue for cardiovascular patients (>12 months)',
      descriptionAr: 'فحص الدهون متأخر لمرضى القلب (أكثر من 12 شهر)',
      category: 'preventive',
      gapType: 'lab_overdue',
      severity: 'moderate',
      frequency: 'monthly',
      criteria: { diagnosisPrefixes: ['I20', 'I21', 'I25', 'I50', 'I63', 'I64'], labCode: 'LIPID', intervalMonths: 12 },
    },

    // ── Screening ──
    {
      id: 'rule_mammography',
      name: 'Mammography Overdue',
      nameAr: 'تصوير الثدي متأخر',
      description: 'Mammography overdue for females >40 years (>24 months)',
      descriptionAr: 'تصوير الثدي الشعاعي متأخر للنساء فوق 40 سنة (أكثر من 24 شهر)',
      category: 'screening',
      gapType: 'screening_overdue',
      severity: 'high',
      frequency: 'monthly',
      criteria: { gender: 'FEMALE', ageMin: 40, orderKind: 'RADIOLOGY', orderNamePattern: 'mammogra|breast screen', intervalMonths: 24 },
    },
    {
      id: 'rule_colonoscopy',
      name: 'Colonoscopy Overdue',
      nameAr: 'منظار القولون متأخر',
      description: 'Colonoscopy overdue for patients >50 years (>10 years, or >5 years if polyps)',
      descriptionAr: 'منظار القولون متأخر للمرضى فوق 50 سنة',
      category: 'screening',
      gapType: 'screening_overdue',
      severity: 'moderate',
      frequency: 'monthly',
      criteria: { ageMin: 50, orderKind: 'PROCEDURE', orderNamePattern: 'colonoscop', intervalMonths: 120 },
    },
    {
      id: 'rule_cervical_screening',
      name: 'Cervical Screening Overdue',
      nameAr: 'فحص عنق الرحم متأخر',
      description: 'Cervical screening overdue for females 25-65 years (>36 months)',
      descriptionAr: 'فحص عنق الرحم متأخر للنساء 25-65 سنة (أكثر من 36 شهر)',
      category: 'screening',
      gapType: 'screening_overdue',
      severity: 'moderate',
      frequency: 'monthly',
      criteria: { gender: 'FEMALE', ageMin: 25, ageMax: 65, orderKind: 'LAB', orderNamePattern: 'pap smear|cervical|hpv', intervalMonths: 36 },
    },
    {
      id: 'rule_bone_density',
      name: 'Bone Density Screening Overdue',
      nameAr: 'فحص كثافة العظام متأخر',
      description: 'Bone density screening overdue for females >65 years (>24 months)',
      descriptionAr: 'فحص كثافة العظام للنساء فوق 65 سنة (أكثر من 24 شهر)',
      category: 'screening',
      gapType: 'screening_overdue',
      severity: 'low',
      frequency: 'monthly',
      criteria: { gender: 'FEMALE', ageMin: 65, orderKind: 'RADIOLOGY', orderNamePattern: 'dexa|bone density|densitometry', intervalMonths: 24 },
    },

    // ── Medication ──
    {
      id: 'rule_medication_refill',
      name: 'Chronic Medication Refill Overdue',
      nameAr: 'إعادة صرف الدواء المزمن متأخر',
      description: 'Chronic medication not refilled within expected window',
      descriptionAr: 'لم يتم إعادة صرف الدواء المزمن في الوقت المتوقع',
      category: 'medication',
      gapType: 'medication_refill',
      severity: 'high',
      frequency: 'weekly',
      criteria: { medicationStatus: 'ACTIVE', refillWindowDays: 7 },
    },
    {
      id: 'rule_statin_diabetic',
      name: 'Statin Not Prescribed (Diabetic >40)',
      nameAr: 'لم يُوصف ستاتين (سكري >40)',
      description: 'Statin not prescribed for diabetic patients over 40',
      descriptionAr: 'لم يتم وصف ستاتين لمرضى السكري فوق 40 سنة',
      category: 'medication',
      gapType: 'preventive_care',
      severity: 'moderate',
      frequency: 'monthly',
      criteria: { diagnosisPrefix: 'E11', ageMin: 40, medicationClassRequired: 'statin' },
    },
    {
      id: 'rule_acei_arb_diabetic_htn',
      name: 'ACE/ARB Not Prescribed (Diabetic + HTN)',
      nameAr: 'لم يُوصف ACE/ARB (سكري + ضغط)',
      description: 'ACE inhibitor or ARB not prescribed for diabetic patients with hypertension',
      descriptionAr: 'لم يتم وصف مثبطات ACE أو ARB لمرضى السكري مع ارتفاع الضغط',
      category: 'medication',
      gapType: 'preventive_care',
      severity: 'high',
      frequency: 'monthly',
      criteria: { diagnosisPrefixes: ['E11', 'I10'], medicationClassRequired: 'acei_arb' },
    },

    // ── Follow-up ──
    {
      id: 'rule_post_discharge_followup',
      name: 'Post-Discharge Follow-up Missed',
      nameAr: 'متابعة ما بعد الخروج فائتة',
      description: 'No outpatient visit within 7 days of hospital discharge',
      descriptionAr: 'لا توجد زيارة عيادية خلال 7 أيام من الخروج من المستشفى',
      category: 'follow_up',
      gapType: 'follow_up_missed',
      severity: 'critical',
      frequency: 'daily',
      criteria: { postDischargeDays: 7 },
    },
    {
      id: 'rule_referral_pending',
      name: 'Referral Pending >30 Days',
      nameAr: 'تحويل معلق أكثر من 30 يوم',
      description: 'Referral order pending for more than 30 days',
      descriptionAr: 'طلب تحويل معلق لأكثر من 30 يوم',
      category: 'follow_up',
      gapType: 'referral_pending',
      severity: 'moderate',
      frequency: 'weekly',
      criteria: { pendingDays: 30 },
    },
    {
      id: 'rule_abnormal_lab_no_followup',
      name: 'Abnormal Lab Without Follow-up',
      nameAr: 'نتيجة تحليل غير طبيعية بدون متابعة',
      description: 'Abnormal lab result without follow-up action within 14 days',
      descriptionAr: 'نتيجة تحليل غير طبيعية بدون إجراء متابعة خلال 14 يوم',
      category: 'follow_up',
      gapType: 'lab_overdue',
      severity: 'high',
      frequency: 'daily',
      criteria: { abnormalResultDays: 14 },
    },
  ];
}

// ---------------------------------------------------------------------------
// Core Scanner Functions
// ---------------------------------------------------------------------------

/**
 * Scan a single patient for care gaps using all active rules.
 */
export async function scanPatientForGaps(
  patientId: string,
  tenantId: string,
  rules?: CareGapRuleDefinition[]
): Promise<{ gapsFound: number; gapsCreated: number }> {
  const activeRules = rules || getDefaultRules();
  let gapsFound = 0;
  let gapsCreated = 0;

  // Fetch patient data once
  const patient = await prisma.patientMaster.findFirst({
    where: { id: patientId, tenantId },
  });

  if (!patient || patient.status === 'MERGED') {
    return { gapsFound: 0, gapsCreated: 0 };
  }

  const patientAge = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  for (const rule of activeRules) {
    try {
      const hasGap = await evaluateRule(rule, patient, patientAge, tenantId);
      if (hasGap) {
        gapsFound++;
        const created = await createFindingIfNotExists(tenantId, patientId, rule, patient);
        if (created) gapsCreated++;
      }
    } catch (err: any) {
      logger.error(`[CareGapScanner] Rule ${rule.id} failed for patient ${patientId}: ${err.message}`, { category: 'quality' });
    }
  }

  return { gapsFound, gapsCreated };
}

/**
 * Bulk scan all active patients in a tenant.
 */
export async function runBulkGapScan(
  tenantId: string,
  options?: { patientId?: string; ruleIds?: string[] }
): Promise<ScanResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let totalPatients = 0;
  let gapsFound = 0;
  let gapsCreated = 0;
  let gapsSkipped = 0;

  // Load rules — combine default + tenant custom
  const defaultRules = getDefaultRules();
  const customDbRules = await prisma.careGapRule.findMany({
    where: { tenantId, isActive: true },
    take: 200,
  });

  // Convert DB rules to definitions
  const customRules: CareGapRuleDefinition[] = customDbRules.map((r) => ({
    id: r.id,
    name: r.name,
    nameAr: r.nameAr || '',
    description: r.description,
    descriptionAr: r.descriptionAr || '',
    category: r.category,
    gapType: r.gapType,
    severity: r.severity,
    frequency: r.frequency,
    criteria: (r.criteria as Record<string, any>) || {},
  }));

  const allRules = [...defaultRules, ...customRules];
  const filteredRules = options?.ruleIds
    ? allRules.filter((r) => options.ruleIds!.includes(r.id))
    : allRules;

  // Find patients to scan (exclude merged patients)
  const patientWhere: any = { tenantId, status: { not: 'MERGED' } };
  if (options?.patientId) {
    patientWhere.id = options.patientId;
  }

  const patients = await prisma.patientMaster.findMany({
    where: patientWhere,
    select: { id: true },
    take: 5000, // Safety limit
  });

  totalPatients = patients.length;

  for (const patient of patients) {
    try {
      const result = await scanPatientForGaps(patient.id, tenantId, filteredRules);
      gapsFound += result.gapsFound;
      gapsCreated += result.gapsCreated;
      gapsSkipped += result.gapsFound - result.gapsCreated;
    } catch (err: any) {
      errors.push(`Patient ${patient.id}: ${err.message}`);
    }
  }

  // Update lastRunAt on custom rules
  if (customDbRules.length > 0) {
    const now = new Date();
    for (const rule of customDbRules) {
      try {
        await prisma.careGapRule.update({
          where: { id: rule.id },
          data: { lastRunAt: now },
        });
      } catch {
        // Non-critical
      }
    }
  }

  return {
    totalPatients,
    gapsFound,
    gapsCreated,
    gapsSkipped,
    rulesEvaluated: filteredRules.length,
    durationMs: Date.now() - startTime,
    errors,
  };
}

/**
 * Query open care gap findings with filters.
 */
export async function getOpenGaps(tenantId: string, filters?: GapFilters) {
  const where: any = { tenantId };
  if (filters?.patientId) where.patientId = filters.patientId;
  if (filters?.category) where.category = filters.category;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.status) where.status = filters.status;
  if (filters?.gapType) where.gapType = filters.gapType;

  const page = Math.max(filters?.page || 1, 1);
  const limit = Math.min(Math.max(filters?.limit || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.careGapFinding.findMany({
      where,
      orderBy: [
        { severity: 'asc' }, // critical first (alphabetical: critical < high < low < moderate — we sort in code)
        { identifiedAt: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.careGapFinding.count({ where }),
  ]);

  // Sort by severity priority: critical > high > moderate > low
  const severityOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
  items.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Mark a care gap finding as addressed.
 */
export async function addressGap(gapId: string, userId: string, tenantId: string) {
  const gap = await prisma.careGapFinding.findFirst({
    where: { id: gapId, tenantId },
  });
  if (!gap) return null;

  return prisma.careGapFinding.update({
    where: { id: gapId },
    data: {
      status: 'addressed',
      addressedAt: new Date(),
      addressedBy: userId,
    },
  });
}

/**
 * Dismiss a care gap finding with a reason.
 */
export async function dismissGap(gapId: string, reason: string, userId: string, tenantId: string) {
  const gap = await prisma.careGapFinding.findFirst({
    where: { id: gapId, tenantId },
  });
  if (!gap) return null;

  return prisma.careGapFinding.update({
    where: { id: gapId },
    data: {
      status: 'dismissed',
      dismissedReason: reason,
      addressedBy: userId,
      addressedAt: new Date(),
    },
  });
}

/**
 * Get dashboard statistics for care gap findings.
 */
export async function getGapStatistics(tenantId: string): Promise<GapStatistics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOpen,
    totalAddressed,
    totalDismissed,
    severityLow,
    severityModerate,
    severityHigh,
    severityCritical,
    addressedThisMonth,
  ] = await Promise.all([
    prisma.careGapFinding.count({ where: { tenantId, status: 'open' } }),
    prisma.careGapFinding.count({ where: { tenantId, status: 'addressed' } }),
    prisma.careGapFinding.count({ where: { tenantId, status: 'dismissed' } }),
    prisma.careGapFinding.count({ where: { tenantId, status: 'open', severity: 'low' } }),
    prisma.careGapFinding.count({ where: { tenantId, status: 'open', severity: 'moderate' } }),
    prisma.careGapFinding.count({ where: { tenantId, status: 'open', severity: 'high' } }),
    prisma.careGapFinding.count({ where: { tenantId, status: 'open', severity: 'critical' } }),
    prisma.careGapFinding.count({
      where: { tenantId, status: 'addressed', addressedAt: { gte: monthStart } },
    }),
  ]);

  const totalLifetime = totalOpen + totalAddressed + totalDismissed;
  const closureRate = totalLifetime > 0 ? Math.round(((totalAddressed + totalDismissed) / totalLifetime) * 100) : 0;

  // Category breakdown
  const categories = ['preventive', 'chronic_disease', 'medication', 'follow_up', 'screening'];
  const byCategory: Record<string, number> = {};
  for (const cat of categories) {
    byCategory[cat] = await prisma.careGapFinding.count({
      where: { tenantId, status: 'open', category: cat },
    });
  }

  // Gap type breakdown
  const gapTypes = ['screening_overdue', 'follow_up_missed', 'lab_overdue', 'medication_refill', 'referral_pending', 'preventive_care'];
  const byGapType: Record<string, number> = {};
  for (const gt of gapTypes) {
    byGapType[gt] = await prisma.careGapFinding.count({
      where: { tenantId, status: 'open', gapType: gt },
    });
  }

  // Trend: last 6 months of created gaps
  const trend: { period: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = await prisma.careGapFinding.count({
      where: { tenantId, identifiedAt: { gte: start, lt: end } },
    });
    trend.push({
      period: start.toISOString().slice(0, 7), // YYYY-MM
      count,
    });
  }

  return {
    totalOpen,
    totalAddressed,
    totalDismissed,
    bySeverity: { low: severityLow, moderate: severityModerate, high: severityHigh, critical: severityCritical },
    byCategory,
    byGapType,
    addressedThisMonth,
    closureRate,
    trend,
  };
}

// ---------------------------------------------------------------------------
// Rule Evaluation Engine (private helpers)
// ---------------------------------------------------------------------------

async function evaluateRule(
  rule: CareGapRuleDefinition,
  patient: any,
  patientAge: number | null,
  tenantId: string
): Promise<boolean> {
  const c = rule.criteria;

  // Age checks
  if (c.ageMin && (patientAge === null || patientAge < c.ageMin)) return false;
  if (c.ageMax && (patientAge === null || patientAge > c.ageMax)) return false;

  // Gender check
  if (c.gender && patient.gender !== c.gender) return false;

  // Rule-specific logic
  switch (rule.id) {
    case 'rule_hba1c_overdue':
    case 'rule_lipid_panel_cvd':
      return evaluateLabOverdueRule(patient.id, tenantId, c);

    case 'rule_diabetic_eye_exam':
    case 'rule_diabetic_foot_exam':
    case 'rule_mammography':
    case 'rule_colonoscopy':
    case 'rule_cervical_screening':
    case 'rule_bone_density':
      return evaluateOrderOverdueRule(patient.id, tenantId, c);

    case 'rule_hypertension_followup':
      return evaluateFollowupOverdueRule(patient.id, tenantId, c);

    case 'rule_medication_refill':
      return evaluateMedicationRefillRule(patient.id, tenantId, c);

    case 'rule_statin_diabetic':
    case 'rule_acei_arb_diabetic_htn':
      return evaluateMedicationMissingRule(patient.id, tenantId, c);

    case 'rule_post_discharge_followup':
      return evaluatePostDischargeRule(patient.id, tenantId, c);

    case 'rule_referral_pending':
      return evaluateReferralPendingRule(patient.id, tenantId, c);

    case 'rule_abnormal_lab_no_followup':
      return evaluateAbnormalLabRule(patient.id, tenantId, c);

    default:
      // Custom rules: check by gapType
      return evaluateCustomRule(patient.id, tenantId, c, rule.gapType);
  }
}

/**
 * Check if patient has a diagnosis matching prefix and an overdue lab.
 */
async function evaluateLabOverdueRule(
  patientId: string,
  tenantId: string,
  criteria: Record<string, any>
): Promise<boolean> {
  const prefixes = criteria.diagnosisPrefixes || (criteria.diagnosisPrefix ? [criteria.diagnosisPrefix] : []);
  if (prefixes.length === 0) return false;

  // Check if patient has relevant diagnosis (from encounters)
  const hasDiagnosis = await checkPatientDiagnosis(patientId, tenantId, prefixes);
  if (!hasDiagnosis) return false;

  // Check if they had a recent lab order
  const intervalMs = (criteria.intervalMonths || 3) * 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - intervalMs);

  const recentLab = await prisma.ordersHub.findFirst({
    where: {
      tenantId,
      patientMasterId: patientId,
      kind: 'LAB',
      status: { in: ['RESULTED', 'COMPLETED'] },
      completedAt: { gte: cutoff },
      ...(criteria.labCode
        ? { orderCode: { contains: criteria.labCode, mode: 'insensitive' as const } }
        : {}),
    },
    orderBy: { completedAt: 'desc' },
    select: { id: true },
  });

  return !recentLab; // Gap exists if NO recent lab
}

/**
 * Check if patient is overdue for a specific order/procedure.
 */
async function evaluateOrderOverdueRule(
  patientId: string,
  tenantId: string,
  criteria: Record<string, any>
): Promise<boolean> {
  // Diagnosis check if specified
  if (criteria.diagnosisPrefix) {
    const hasDx = await checkPatientDiagnosis(patientId, tenantId, [criteria.diagnosisPrefix]);
    if (!hasDx) return false;
  }

  const intervalMs = (criteria.intervalMonths || 12) * 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - intervalMs);

  const namePattern = criteria.orderNamePattern || '';
  const namePatterns = namePattern.split('|').filter(Boolean);

  // Build OR condition for order name matching
  const orderNameConditions = namePatterns.length > 0
    ? namePatterns.map((p: string) => ({
        orderName: { contains: p.trim(), mode: 'insensitive' as const },
      }))
    : [];

  const where: any = {
    tenantId,
    patientMasterId: patientId,
    status: { in: ['RESULTED', 'COMPLETED'] },
    completedAt: { gte: cutoff },
  };

  if (criteria.orderKind) {
    where.kind = criteria.orderKind;
  }

  if (orderNameConditions.length > 0) {
    where.OR = orderNameConditions;
  }

  const recentOrder = await prisma.ordersHub.findFirst({
    where,
    select: { id: true },
  });

  return !recentOrder; // Gap exists if NO recent matching order
}

/**
 * Check if patient with chronic condition has had a follow-up visit recently.
 */
async function evaluateFollowupOverdueRule(
  patientId: string,
  tenantId: string,
  criteria: Record<string, any>
): Promise<boolean> {
  const prefixes = criteria.diagnosisPrefixes || (criteria.diagnosisPrefix ? [criteria.diagnosisPrefix] : []);
  if (prefixes.length === 0) return false;

  const hasDx = await checkPatientDiagnosis(patientId, tenantId, prefixes);
  if (!hasDx) return false;

  const intervalMs = (criteria.intervalMonths || 3) * 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - intervalMs);

  const recentVisit = await prisma.encounterCore.findFirst({
    where: {
      tenantId,
      patientId,
      encounterType: 'OPD',
      status: 'CLOSED',
      closedAt: { gte: cutoff },
    },
    select: { id: true },
  });

  return !recentVisit;
}

/**
 * Check if a chronic medication is overdue for refill.
 */
async function evaluateMedicationRefillRule(
  patientId: string,
  tenantId: string,
  criteria: Record<string, any>
): Promise<boolean> {
  const refillWindowDays = criteria.refillWindowDays || 7;
  const cutoff = new Date(Date.now() - refillWindowDays * 24 * 60 * 60 * 1000);

  // Look for MEDICATION orders that are overdue (ordered but not recently filled)
  const overdueMeds = await prisma.ordersHub.findFirst({
    where: {
      tenantId,
      patientMasterId: patientId,
      kind: 'MEDICATION',
      status: 'ORDERED',
      orderedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  return !!overdueMeds;
}

/**
 * Check if a patient with specific diagnoses is missing a required medication class.
 */
async function evaluateMedicationMissingRule(
  patientId: string,
  tenantId: string,
  criteria: Record<string, any>
): Promise<boolean> {
  const prefixes = criteria.diagnosisPrefixes || (criteria.diagnosisPrefix ? [criteria.diagnosisPrefix] : []);
  if (prefixes.length === 0) return false;

  // Must have ALL diagnoses (for combined conditions like DM + HTN)
  for (const prefix of prefixes) {
    const hasDx = await checkPatientDiagnosis(patientId, tenantId, [prefix]);
    if (!hasDx) return false;
  }

  // Check if medication class is prescribed
  const medClass = criteria.medicationClassRequired || '';
  const medPatterns = getMedicationPatterns(medClass);

  if (medPatterns.length === 0) return false;

  const recentMed = await prisma.ordersHub.findFirst({
    where: {
      tenantId,
      patientMasterId: patientId,
      kind: 'MEDICATION',
      status: { in: ['ORDERED', 'IN_PROGRESS', 'COMPLETED'] },
      OR: medPatterns.map((p) => ({
        orderName: { contains: p, mode: 'insensitive' as const },
      })),
    },
    select: { id: true },
  });

  return !recentMed; // Gap exists if NOT prescribed
}

/**
 * Check post-discharge follow-up: patient discharged from IPD without subsequent OPD visit.
 */
async function evaluatePostDischargeRule(
  patientId: string,
  tenantId: string,
  criteria: Record<string, any>
): Promise<boolean> {
  const postDischargeDays = criteria.postDischargeDays || 7;
  const now = Date.now();
  const windowStart = new Date(now - 60 * 24 * 60 * 60 * 1000); // Only check discharges within last 60 days
  const cutoff = new Date(now - postDischargeDays * 24 * 60 * 60 * 1000);

  // Find discharges within the window that are past the follow-up deadline
  const recentDischarges = await prisma.ipdEpisode.findMany({
    where: {
      tenantId,
      patient: { path: ['id'], equals: patientId },
      status: 'DISCHARGED',
      closedAt: { gte: windowStart, lte: cutoff },
    },
    select: { closedAt: true },
    take: 5,
  });

  if (recentDischarges.length === 0) return false;

  // Check if there's an OPD visit after the most recent discharge
  const latestDischarge = recentDischarges[0]?.closedAt;
  if (!latestDischarge) return false;

  const followupVisit = await prisma.encounterCore.findFirst({
    where: {
      tenantId,
      patientId,
      encounterType: 'OPD',
      openedAt: { gte: latestDischarge },
    },
    select: { id: true },
  });

  return !followupVisit; // Gap if no follow-up visit found
}

/**
 * Check for referral orders pending longer than threshold.
 */
async function evaluateReferralPendingRule(
  patientId: string,
  tenantId: string,
  criteria: Record<string, any>
): Promise<boolean> {
  const pendingDays = criteria.pendingDays || 30;
  const cutoff = new Date(Date.now() - pendingDays * 24 * 60 * 60 * 1000);

  const pendingReferral = await prisma.ordersHub.findFirst({
    where: {
      tenantId,
      patientMasterId: patientId,
      kind: 'CONSULTATION',
      status: 'ORDERED',
      orderedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  return !!pendingReferral;
}

/**
 * Check for abnormal lab results without follow-up action.
 */
async function evaluateAbnormalLabRule(
  patientId: string,
  tenantId: string,
  criteria: Record<string, any>
): Promise<boolean> {
  const abnormalDays = criteria.abnormalResultDays || 14;
  const cutoff = new Date(Date.now() - abnormalDays * 24 * 60 * 60 * 1000);

  // Find abnormal results (flagged in OrderResult data)
  const abnormalResults = await prisma.orderResult.findMany({
    where: {
      tenantId,
      order: { patientMasterId: patientId, kind: 'LAB' },
      status: 'FINAL',
      createdAt: { lte: cutoff },
    },
    select: { id: true, data: true, orderId: true, createdAt: true },
    take: 20,
  });

  // Check if any result has abnormal flags in its data
  for (const result of abnormalResults) {
    const data = (result.data as Record<string, unknown>) || {};
    const isAbnormal =
      data.flag === 'H' || data.flag === 'HH' ||
      data.flag === 'L' || data.flag === 'LL' ||
      data.abnormal === true ||
      data.status === 'ABNORMAL' ||
      data.interpretation === 'ABNORMAL';

    if (!isAbnormal) continue;

    // Check if there was a follow-up order or encounter after this result
    const followupAction = await prisma.ordersHub.findFirst({
      where: {
        tenantId,
        patientMasterId: patientId,
        orderedAt: { gte: result.createdAt },
        id: { not: result.orderId }, // Different from the original order
      },
      select: { id: true },
    });

    if (!followupAction) return true; // Gap: abnormal result with no follow-up
  }

  return false;
}

/**
 * Evaluate a custom rule based on gapType.
 */
async function evaluateCustomRule(
  patientId: string,
  tenantId: string,
  criteria: Record<string, any>,
  gapType: string
): Promise<boolean> {
  // Custom rules use generic evaluation based on type
  switch (gapType) {
    case 'lab_overdue':
      return evaluateLabOverdueRule(patientId, tenantId, criteria);
    case 'screening_overdue':
      return evaluateOrderOverdueRule(patientId, tenantId, criteria);
    case 'follow_up_missed':
      return evaluateFollowupOverdueRule(patientId, tenantId, criteria);
    case 'medication_refill':
      return evaluateMedicationRefillRule(patientId, tenantId, criteria);
    case 'referral_pending':
      return evaluateReferralPendingRule(patientId, tenantId, criteria);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if patient has encounters with any of the specified diagnosis code prefixes.
 */
async function checkPatientDiagnosis(
  patientId: string,
  tenantId: string,
  prefixes: string[]
): Promise<boolean> {
  if (prefixes.length === 0) return true;

  // Check EhrEncounter diagnoses
  const encounters = await prisma.ehrEncounter.findMany({
    where: {
      tenantId,
      patientId,
    },
    select: { primaryDiagnosis: true, diagnosisCodes: true },
    take: 50,
  });

  for (const enc of encounters) {
    for (const prefix of prefixes) {
      if (enc.primaryDiagnosis && enc.primaryDiagnosis.toUpperCase().startsWith(prefix.toUpperCase())) {
        return true;
      }
      for (const code of enc.diagnosisCodes || []) {
        if (code.toUpperCase().startsWith(prefix.toUpperCase())) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Get medication name patterns for a drug class.
 */
function getMedicationPatterns(medClass: string): string[] {
  switch (medClass) {
    case 'statin':
      return ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'fluvastatin', 'lovastatin', 'statin'];
    case 'acei_arb':
      return [
        'lisinopril', 'enalapril', 'ramipril', 'captopril', 'perindopril', 'benazepril',
        'losartan', 'valsartan', 'irbesartan', 'candesartan', 'telmisartan', 'olmesartan',
        'ACE', 'ARB',
      ];
    default:
      return [];
  }
}

/**
 * Create a care gap finding record if one doesn't already exist
 * for the same patient + rule + gapType (idempotent).
 */
async function createFindingIfNotExists(
  tenantId: string,
  patientId: string,
  rule: CareGapRuleDefinition,
  patient: any
): Promise<boolean> {
  try {
    await prisma.careGapFinding.create({
      data: {
        tenantId,
        patientId,
        patientName: patient.fullName || `${patient.firstName} ${patient.lastName}`,
        gapType: rule.gapType,
        category: rule.category,
        description: rule.description,
        descriptionAr: rule.descriptionAr,
        severity: rule.severity,
        status: 'open',
        ruleId: rule.id,
        metadata: { ruleName: rule.name, ruleNameAr: rule.nameAr },
      },
    });
    return true;
  } catch (err: any) {
    // P2002 = unique constraint (tenantId + patientId + ruleId + gapType)
    if (err.code === 'P2002') return false;
    throw err;
  }
}
