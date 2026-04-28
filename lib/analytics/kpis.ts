/**
 * Clinical KPIs -- Key Performance Indicators for healthcare quality.
 * Tracks JCI / CBAHI-aligned quality measures.
 */

import { prisma } from '@/lib/db/prisma';

// --- Types ------------------------------------------------------------------

export interface KpiDefinition {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  description: string;
  unit: string;
  target: number;
  warningThreshold: number;
  criticalThreshold: number;
  direction: 'lower_is_better' | 'higher_is_better';
  formula: string;
}

export interface KpiResult {
  kpiId: string;
  name: string;
  nameAr: string;
  category: string;
  value: number;
  target: number;
  unit: string;
  status: 'green' | 'yellow' | 'red';
  trend: 'improving' | 'declining' | 'stable';
  previousValue?: number;
  sparkline: number[];
}

export interface KpiDashboard {
  period: { start: Date; end: Date };
  kpis: KpiResult[];
  overallScore: number;
  categoryScores: { category: string; score: number; kpiCount: number }[];
}

// --- Default KPI Definitions ------------------------------------------------

export const DEFAULT_KPIS: KpiDefinition[] = [
  // Patient Safety
  {
    id: 'kpi-fall-rate',
    name: 'Inpatient Fall Rate',
    nameAr: '\u0645\u0639\u062F\u0644 \u0633\u0642\u0648\u0637 \u0627\u0644\u0645\u0631\u0636\u0649',
    category: 'Patient Safety',
    description: 'Falls per 1000 patient days',
    unit: 'per 1000 days',
    target: 2.0,
    warningThreshold: 3.0,
    criticalThreshold: 5.0,
    direction: 'lower_is_better',
    formula: '(total_falls / patient_days) * 1000',
  },
  {
    id: 'kpi-med-error',
    name: 'Medication Error Rate',
    nameAr: '\u0645\u0639\u062F\u0644 \u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u0623\u062F\u0648\u064A\u0629',
    category: 'Patient Safety',
    description: 'Medication errors per 1000 prescriptions',
    unit: 'per 1000 Rx',
    target: 1.0,
    warningThreshold: 2.0,
    criticalThreshold: 4.0,
    direction: 'lower_is_better',
    formula: '(med_errors / total_prescriptions) * 1000',
  },
  {
    id: 'kpi-hand-hygiene',
    name: 'Hand Hygiene Compliance',
    nameAr: '\u0627\u0644\u0627\u0644\u062A\u0632\u0627\u0645 \u0628\u0646\u0638\u0627\u0641\u0629 \u0627\u0644\u064A\u062F\u064A\u0646',
    category: 'Patient Safety',
    description: 'Percentage of hand hygiene compliance observations',
    unit: '%',
    target: 95,
    warningThreshold: 85,
    criticalThreshold: 75,
    direction: 'higher_is_better',
    formula: '(compliant_observations / total_observations) * 100',
  },

  // Clinical Effectiveness
  {
    id: 'kpi-readmission',
    name: '30-Day Readmission Rate',
    nameAr: '\u0645\u0639\u062F\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062F\u062E\u0648\u0644 30 \u064A\u0648\u0645',
    category: 'Clinical Effectiveness',
    description: 'Unplanned readmissions within 30 days',
    unit: '%',
    target: 5,
    warningThreshold: 8,
    criticalThreshold: 12,
    direction: 'lower_is_better',
    formula: '(readmissions_30d / total_discharges) * 100',
  },
  {
    id: 'kpi-mortality',
    name: 'Inpatient Mortality Rate',
    nameAr: '\u0645\u0639\u062F\u0644 \u0627\u0644\u0648\u0641\u064A\u0627\u062A',
    category: 'Clinical Effectiveness',
    description: 'Deaths per 1000 discharges',
    unit: 'per 1000',
    target: 3.0,
    warningThreshold: 5.0,
    criticalThreshold: 8.0,
    direction: 'lower_is_better',
    formula: '(total_deaths / total_discharges) * 1000',
  },
  {
    id: 'kpi-sepsis-bundle',
    name: 'Sepsis Bundle Compliance',
    nameAr: '\u0627\u0644\u0627\u0644\u062A\u0632\u0627\u0645 \u0628\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0627\u0644\u0625\u0646\u062A\u0627\u0646',
    category: 'Clinical Effectiveness',
    description: 'Percentage of sepsis cases with complete hour-1 bundle',
    unit: '%',
    target: 90,
    warningThreshold: 75,
    criticalThreshold: 60,
    direction: 'higher_is_better',
    formula: '(compliant_cases / total_sepsis_cases) * 100',
  },

  // Operational Efficiency
  {
    id: 'kpi-er-wait',
    name: 'ER Door-to-Doctor Time',
    nameAr: '\u0648\u0642\u062A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0641\u064A \u0627\u0644\u0637\u0648\u0627\u0631\u0626',
    category: 'Operational Efficiency',
    description: 'Median time from arrival to provider in minutes',
    unit: 'minutes',
    target: 15,
    warningThreshold: 25,
    criticalThreshold: 45,
    direction: 'lower_is_better',
    formula: 'median(door_to_doctor_minutes)',
  },
  {
    id: 'kpi-or-utilization',
    name: 'OR Utilization Rate',
    nameAr: '\u0645\u0639\u062F\u0644 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u063A\u0631\u0641 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A',
    category: 'Operational Efficiency',
    description: 'Percentage of scheduled OR time actually used',
    unit: '%',
    target: 80,
    warningThreshold: 65,
    criticalThreshold: 50,
    direction: 'higher_is_better',
    formula: '(used_or_minutes / available_or_minutes) * 100',
  },
  {
    id: 'kpi-bed-turnover',
    name: 'Bed Turnover Rate',
    nameAr: '\u0645\u0639\u062F\u0644 \u062F\u0648\u0631\u0627\u0646 \u0627\u0644\u0623\u0633\u0631\u0629',
    category: 'Operational Efficiency',
    description: 'Average admissions per bed per month',
    unit: 'per bed/month',
    target: 6,
    warningThreshold: 4,
    criticalThreshold: 2,
    direction: 'higher_is_better',
    formula: 'total_admissions / total_beds',
  },

  // Patient Experience
  {
    id: 'kpi-satisfaction',
    name: 'Patient Satisfaction Score',
    nameAr: '\u0645\u0639\u062F\u0644 \u0631\u0636\u0627 \u0627\u0644\u0645\u0631\u0636\u0649',
    category: 'Patient Experience',
    description: 'Average patient satisfaction rating',
    unit: '/5',
    target: 4.5,
    warningThreshold: 4.0,
    criticalThreshold: 3.5,
    direction: 'higher_is_better',
    formula: 'avg(satisfaction_score)',
  },
  {
    id: 'kpi-complaints',
    name: 'Patient Complaints Rate',
    nameAr: '\u0645\u0639\u062F\u0644 \u0627\u0644\u0634\u0643\u0627\u0648\u0649',
    category: 'Patient Experience',
    description: 'Complaints per 1000 encounters',
    unit: 'per 1000',
    target: 5,
    warningThreshold: 10,
    criticalThreshold: 20,
    direction: 'lower_is_better',
    formula: '(total_complaints / total_encounters) * 1000',
  },

  // Lab TAT
  {
    id: 'kpi-lab-tat',
    name: 'Lab TAT (Routine)',
    nameAr: '\u0648\u0642\u062A \u062A\u0633\u0644\u064A\u0645 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0645\u062E\u062A\u0628\u0631',
    category: 'Lab Performance',
    description: 'Percentage of routine labs resulted within target TAT',
    unit: '%',
    target: 90,
    warningThreshold: 80,
    criticalThreshold: 70,
    direction: 'higher_is_better',
    formula: '(within_tat / total_routine_labs) * 100',
  },
  {
    id: 'kpi-critical-notify',
    name: 'Critical Value Notification',
    nameAr: '\u0625\u0628\u0644\u0627\u063A \u0627\u0644\u0642\u064A\u0645 \u0627\u0644\u062D\u0631\u062C\u0629',
    category: 'Lab Performance',
    description: 'Percentage of critical values notified within 15 minutes',
    unit: '%',
    target: 95,
    warningThreshold: 85,
    criticalThreshold: 75,
    direction: 'higher_is_better',
    formula: '(notified_within_15min / total_critical_values) * 100',
  },
];

// --- KPI Computation --------------------------------------------------------

function evaluateKpiStatus(
  def: KpiDefinition,
  value: number,
): 'green' | 'yellow' | 'red' {
  if (def.direction === 'lower_is_better') {
    if (value <= def.target) return 'green';
    if (value <= def.warningThreshold) return 'yellow';
    return 'red';
  }
  // higher_is_better
  if (value >= def.target) return 'green';
  if (value >= def.warningThreshold) return 'yellow';
  return 'red';
}

function evaluateTrend(
  def: KpiDefinition,
  current: number,
  previous?: number,
): 'improving' | 'declining' | 'stable' {
  if (previous === undefined) return 'stable';
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return 'stable';
  if (def.direction === 'lower_is_better') {
    return diff < 0 ? 'improving' : 'declining';
  }
  return diff > 0 ? 'improving' : 'declining';
}

export async function computeKpis(
  tenantId: string,
  range: { start: Date; end: Date },
): Promise<KpiDashboard> {
  // Load KPI definitions (custom + defaults)
  const customDefs = await prisma.analyticsKpiDefinition.findMany({
    where: { tenantId },
    take: 200,
  });
  const allDefs: KpiDefinition[] = customDefs.length > 0
    ? customDefs.map((d) => ({
        id: d.id,
        name: d.name,
        nameAr: d.nameAr || '',
        category: d.category || '',
        description: d.description || '',
        unit: d.unit || '',
        target: Number(d.target) || 0,
        warningThreshold: Number(d.warningThreshold) || 0,
        criticalThreshold: Number(d.criticalThreshold) || 0,
        direction: (d.direction as 'lower_is_better' | 'higher_is_better') || 'lower_is_better',
        formula: d.formula || '',
      }))
    : DEFAULT_KPIS;

  // Gather raw data for computations
  const encounters = await prisma.encounterCore.count({
    where: {
      tenantId,
      createdAt: { gte: range.start, lte: range.end },
    },
  });

  // NOTE: EncounterCore doesn't have waitMinutes field; ER wait times would need
  // to be fetched from ErEncounter or OPD-specific tables. Using empty array as placeholder.
  const erEncounters = await prisma.encounterCore.findMany({
    where: {
      tenantId,
      encounterType: 'ER',
      createdAt: { gte: range.start, lte: range.end },
    },
    take: 5000,
  });

  const labResults = await prisma.labResult.findMany({
    where: {
      tenantId,
      createdAt: { gte: range.start, lte: range.end },
    },
    take: 5000,
  });

  const orders = await prisma.ordersHub.findMany({
    where: {
      tenantId,
      createdAt: { gte: range.start, lte: range.end },
    },
    take: 5000,
  });

  // Compute each KPI
  const kpis: KpiResult[] = [];

  for (const def of allDefs) {
    let value = 0;

    switch (def.id) {
      case 'kpi-er-wait': {
        // EncounterCore does not have waitMinutes. Use ErEncounter (startedAt) +
        // ErTriageAssessment (triageEndAt) to approximate door-to-doctor time:
        //   wait = triageEndAt - startedAt  (triage completion is a proxy for first provider contact)
        // If triage data is unavailable, fall back to the first ErDoctorNote timestamp.
        try {
          const erEncs = await prisma.erEncounter.findMany({
            where: {
              tenantId,
              startedAt: { gte: range.start, lte: range.end },
            },
            include: { triage: true, doctorNotes: { orderBy: { createdAt: 'asc' }, take: 1 } },
            take: 5000,
          });

          const waitMinutes: number[] = [];
          for (const er of erEncs) {
            const arrival = new Date(er.startedAt).getTime();
            // Best proxy: triage end time; fallback: first doctor note
            const providerTime = er.triage?.triageEndAt
              ? new Date(er.triage.triageEndAt).getTime()
              : er.doctorNotes?.[0]?.createdAt
                ? new Date(er.doctorNotes[0].createdAt).getTime()
                : null;
            if (providerTime && providerTime > arrival) {
              waitMinutes.push((providerTime - arrival) / 60000);
            }
          }

          if (waitMinutes.length > 0) {
            // Median calculation
            waitMinutes.sort((a, b) => a - b);
            const mid = Math.floor(waitMinutes.length / 2);
            value = waitMinutes.length % 2 === 0
              ? Math.round((waitMinutes[mid - 1] + waitMinutes[mid]) / 2)
              : Math.round(waitMinutes[mid]);
          }
        } catch {
          // ER tables may not be populated yet; graceful fallback to 0
          value = 0;
        }
        break;
      }
      case 'kpi-lab-tat': {
        // LabResult model has resultedAt but no orderedAt or targetTat fields directly
        // Use collectedAt as a proxy for order time
        const routine = labResults.filter((l) => {
          // No priority field on LabResult model -- treat all as routine
          return true;
        });
        const withinTat = routine.filter((l) => {
          if (!l.resultedAt || !l.collectedAt) return false;
          const tat = (new Date(l.resultedAt).getTime() - new Date(l.collectedAt).getTime()) / 60000;
          return tat <= 120; // default 120 min target
        });
        value = routine.length > 0 ? Math.round((withinTat.length / routine.length) * 100) : 100;
        break;
      }
      case 'kpi-critical-notify': {
        // LabResult has a `parameters` JSON column that may contain `{ abnormal: 'HH' | 'LL' | 'critical', ... }`.
        // Critical values are identified by abnormal flags HH, LL, or the literal "critical".
        // Notification tracking is not on LabResult; we use whether the result has been verified
        // (verifiedAt set) within 15 minutes of resultedAt as a proxy for timely notification.
        const criticalResults = labResults.filter((l) => {
          if (!l.parameters) return false;
          const params = Array.isArray(l.parameters) ? l.parameters : [];
          return (params as Array<Record<string, unknown>>).some((p) => {
            const flag = String(p.abnormal || '').toUpperCase();
            return flag === 'HH' || flag === 'LL' || flag === 'CRITICAL';
          });
        });

        if (criticalResults.length === 0) {
          value = 100; // No critical values in period — 100% compliance by default
        } else {
          const notifiedInTime = criticalResults.filter((l) => {
            if (!l.resultedAt || !l.verifiedAt) return false;
            const diffMin = (new Date(l.verifiedAt).getTime() - new Date(l.resultedAt).getTime()) / 60000;
            return diffMin <= 15;
          });
          value = Math.round((notifiedInTime.length / criticalResults.length) * 100);
        }
        break;
      }
      case 'kpi-med-error': {
        const totalRx = orders.filter((o) => o.kind === 'MEDICATION').length;
        const errors = await prisma.medicationError.count({
          where: {
            tenantId,
            createdAt: { gte: range.start, lte: range.end },
          },
        });
        value = totalRx > 0 ? Math.round((errors / totalRx) * 1000 * 10) / 10 : 0;
        break;
      }
      case 'kpi-readmission': {
        // EncounterCore uses enum status; check for CLOSED as discharge proxy
        const discharges = await prisma.encounterCore.count({
          where: {
            tenantId,
            status: 'CLOSED',
            closedAt: { gte: range.start, lte: range.end },
          },
        });
        // Use the ReadmissionRecord model from quality.prisma which tracks actual
        // readmissions with daysBetween. Count records where the readmit date falls
        // within the reporting period and is within 30 days of the original discharge.
        let readmissions = 0;
        try {
          readmissions = await prisma.readmissionRecord.count({
            where: {
              tenantId,
              readmitDate: { gte: range.start, lte: range.end },
              daysBetween: { lte: 30 },
            },
          });
        } catch {
          // ReadmissionRecord table may not exist yet; graceful fallback
          readmissions = 0;
        }
        value = discharges > 0 ? Math.round((readmissions / discharges) * 100 * 10) / 10 : 0;
        break;
      }
      default: {
        // For KPIs without direct data source, use stored values
        const stored = await prisma.analyticsKpiValue.findFirst({
          where: {
            tenantId,
            kpiId: def.id,
            periodStart: { gte: range.start },
          },
          orderBy: { periodStart: 'desc' },
        });
        value = stored?.value ? Number(stored.value) : 0;
      }
    }

    // Get previous period value for trend
    const prevDays = Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
    const prevRange = {
      start: new Date(range.start.getTime() - prevDays * 24 * 60 * 60 * 1000),
      end: range.start,
    };
    const prevStored = await prisma.analyticsKpiValue.findFirst({
      where: {
        tenantId,
        kpiId: def.id,
        periodStart: { gte: prevRange.start, lte: prevRange.end },
      },
      orderBy: { periodStart: 'desc' },
    });

    const previousValue = prevStored?.value ? Number(prevStored.value) : undefined;

    kpis.push({
      kpiId: def.id,
      name: def.name,
      nameAr: def.nameAr,
      category: def.category,
      value,
      target: def.target,
      unit: def.unit,
      status: evaluateKpiStatus(def, value),
      trend: evaluateTrend(def, value, previousValue),
      previousValue,
      sparkline: [],
    });
  }

  // Category scores
  const catMap = new Map<string, { total: number; green: number }>();
  for (const kpi of kpis) {
    const existing = catMap.get(kpi.category) || { total: 0, green: 0 };
    existing.total++;
    if (kpi.status === 'green') existing.green++;
    catMap.set(kpi.category, existing);
  }

  const categoryScores = Array.from(catMap.entries()).map(([category, d]) => ({
    category,
    score: Math.round((d.green / d.total) * 100),
    kpiCount: d.total,
  }));

  const overallScore = kpis.length > 0
    ? Math.round((kpis.filter((k) => k.status === 'green').length / kpis.length) * 100)
    : 0;

  return { period: range, kpis, overallScore, categoryScores };
}

// --- Store KPI value --------------------------------------------------------

export async function storeKpiValue(
  tenantId: string,
  kpiId: string,
  value: number,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  await prisma.analyticsKpiValue.upsert({
    where: {
      tenantId_kpiId_periodStart: { tenantId, kpiId, periodStart },
    },
    update: {
      value,
      periodEnd,
    },
    create: {
      tenantId,
      kpiId,
      value,
      periodStart,
      periodEnd,
    },
  });
}
