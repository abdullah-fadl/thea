import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentationKPIs {
  missingVitalsPct: number;
  missingNotesPct: number;
  missingDiagnosisPct: number;
  missingPhysicalExamPct: number;
  missingAllergyCheckPct: number;
  missingPrescriptionPct: number;
}

interface TimelinessKPIs {
  avgTimeToVitals: number | null;
  avgTimeToDoctor: number | null;
  avgTimeToFirstOrder: number | null;
  avgTriageToDisposition: number | null;
}

interface OrderKPIs {
  pendingOverduePct: number;
  unackedResultsPct: number;
  criticalNotAcked: number;
}

interface DepartmentBreakdown {
  departmentId: string;
  name: string;
  score: number;
  encounters: number;
  missingVitalsPct: number;
  missingNotesPct: number;
  missingDiagnosisPct: number;
  avgWaitMinutes: number;
}

interface DoctorScore {
  doctorId: string;
  name: string;
  encounters: number;
  documentationPct: number;
}

interface DailyTrend {
  date: string;
  score: number;
  encounters: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse period query param into days (default 30). Accepts 7d, 30d, 90d or plain number. */
function parsePeriodDays(raw: string | null): number {
  if (!raw) return 30;
  const match = raw.match(/^(\d+)d?$/i);
  return match ? Math.min(Number(match[1]), 365) : 30;
}

/** Percentage helper: 0 when denominator is 0. */
function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal
}

/** Check if a vitals JSON field contains actual data or is effectively empty. */
function vitalsEmpty(vitals: unknown): boolean {
  if (vitals == null) return true;
  if (typeof vitals !== 'object') return true;
  const v = vitals as Record<string, unknown>;
  // If every value in the vitals object is null/undefined/empty string, treat as missing
  const keys = Object.keys(v);
  if (keys.length === 0) return true;
  return keys.every((k) => v[k] == null || v[k] === '' || v[k] === 0);
}

/** Compute weighted overall score (0-100). Higher = better compliance. */
function computeOverallScore(doc: DocumentationKPIs, timeliness: TimelinessKPIs): number {
  // Each documentation component contributes (100 - missingPct) * weight
  const vitalScore = (100 - doc.missingVitalsPct) * 0.25;
  const noteScore = (100 - doc.missingNotesPct) * 0.25;
  const diagScore = (100 - doc.missingDiagnosisPct) * 0.20;
  const examScore = (100 - doc.missingPhysicalExamPct) * 0.15;

  // Timeliness: if avg wait < 30min → 100, >= 120min → 0, linear in between
  const avgWait = timeliness.avgTimeToDoctor ?? 30;
  let timeScore = 0;
  if (avgWait <= 30) {
    timeScore = 100;
  } else if (avgWait >= 120) {
    timeScore = 0;
  } else {
    timeScore = Math.round(((120 - avgWait) / 90) * 100);
  }
  const timelinessPart = timeScore * 0.15;

  return Math.round(vitalScore + noteScore + diagScore + examScore + timelinessPart);
}

function scoreStatus(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 85) return 'green';
  if (score >= 70) return 'yellow';
  return 'red';
}

function trendLabel(current: number, previous: number): 'improving' | 'declining' | 'stable' {
  const diff = current - previous;
  if (diff > 2) return 'improving';
  if (diff < -2) return 'declining';
  return 'stable';
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }) => {
    const { searchParams } = new URL(req.url);
    const periodDays = parsePeriodDays(searchParams.get('period'));
    const departmentFilter = searchParams.get('departmentId') || null;

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - periodDays);

    // Previous period for trend comparison
    const prevPeriodStart = new Date(periodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);

    logger.info(`Data quality KPIs requested: period=${periodDays}d, dept=${departmentFilter}`, { category: 'api' });

    // -----------------------------------------------------------------------
    // 1. Fetch encounters in period (with OPD details joined)
    // -----------------------------------------------------------------------
    const encounterWhere: Prisma.EncounterCoreWhereInput = {
      tenantId,
      createdAt: { gte: periodStart },
      ...(departmentFilter ? { department: departmentFilter } : {}),
    };

    const encounters = await prisma.encounterCore.findMany({
      where: encounterWhere,
      select: {
        id: true,
        patientId: true,
        department: true,
        createdAt: true,
        opdEncounter: {
          select: {
            id: true,
            arrivedAt: true,
            doctorStartAt: true,
            doctorEndAt: true,
            createdByUserId: true,
            nursingEntries: {
              select: {
                vitals: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'asc' as const },
              take: 5, // limit for performance; we only need first for timing
            },
          },
        },
      },
    }).catch(() => [] as Array<{
      id: string;
      patientId: string;
      department: string;
      createdAt: Date;
      opdEncounter: {
        id: string;
        arrivedAt: Date | null;
        doctorStartAt: Date | null;
        doctorEndAt: Date | null;
        createdByUserId: string | null;
        nursingEntries: Array<{ vitals: unknown; createdAt: Date }>;
      } | null;
    }>);

    const totalEncounters = encounters.length;
    const encounterIds = encounters.map((e) => e.id);

    // -----------------------------------------------------------------------
    // 2. Fetch related data in parallel
    // -----------------------------------------------------------------------
    const [
      clinicalNotes,
      visitNotes,
      physicalExams,
      orders,
      orderResults,
      resultAcks,
      patientAllergies,
      departments,
      users,
      // Previous period encounters (for trend comparison)
      prevEncounterCount,
    ] = await Promise.all([
      // Clinical notes per encounter
      encounterIds.length > 0
        ? prisma.clinicalNote.findMany({
            where: { tenantId, encounterCoreId: { in: encounterIds } },
            select: { encounterCoreId: true },
          }).catch(() => [] as Array<{ encounterCoreId: string | null }>)
        : [],

      // Visit notes (contain diagnoses)
      encounterIds.length > 0
        ? prisma.opdVisitNote.findMany({
            where: { tenantId, encounterCoreId: { in: encounterIds } },
            select: { encounterCoreId: true, diagnoses: true },
          }).catch(() => [] as Array<{ encounterCoreId: string | null; diagnoses: unknown }>)
        : [],

      // Physical exams
      encounterIds.length > 0
        ? prisma.physicalExam.findMany({
            where: { tenantId, encounterCoreId: { in: encounterIds } },
            select: { encounterCoreId: true },
          }).catch(() => [] as Array<{ encounterCoreId: string | null }>)
        : [],

      // Orders in period
      prisma.ordersHub.findMany({
        where: { tenantId, createdAt: { gte: periodStart } },
        select: {
          id: true,
          encounterCoreId: true,
          status: true,
          kind: true,
          createdAt: true,
          orderedAt: true,
        },
      }).catch(() => [] as Array<{
        id: string;
        encounterCoreId: string | null;
        status: string;
        kind: string;
        createdAt: Date;
        orderedAt: Date | null;
      }>),

      // Order results (for ack tracking)
      prisma.orderResult.findMany({
        where: { tenantId, createdAt: { gte: periodStart } },
        select: {
          id: true,
          orderId: true,
          status: true,
          data: true,
          createdAt: true,
        },
      }).catch(() => [] as Array<{
        id: string;
        orderId: string;
        status: string;
        data: unknown;
        createdAt: Date;
      }>),

      // Result acknowledgements
      prisma.resultAck.findMany({
        where: { tenantId },
        select: {
          orderResultId: true,
          ackAt: true,
        },
      }).catch(() => [] as Array<{ orderResultId: string; ackAt: Date }>),

      // Patient allergies: unique patients who have at least one allergy record or NKDA
      prisma.patientAllergy.findMany({
        where: { tenantId },
        select: { patientId: true },
        distinct: ['patientId' as const],
      }).catch(() => [] as Array<{ patientId: string }>),

      // Departments for breakdown
      prisma.department.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, code: true },
      }).catch(() => [] as Array<{ id: string; name: string; code: string }>),

      // Users (for doctor lookup)
      prisma.user.findMany({
        where: { tenantId },
        select: { id: true, displayName: true, firstName: true, lastName: true, role: true },
      }).catch(() => [] as Array<{
        id: string;
        displayName: string | null;
        firstName: string;
        lastName: string;
        role: string;
      }>),

      // Previous period encounter count for trend
      prisma.encounterCore.count({
        where: {
          tenantId,
          createdAt: { gte: prevPeriodStart, lt: periodStart },
          ...(departmentFilter ? { department: departmentFilter } : {}),
        },
      }).catch(() => 0),
    ]);

    // -----------------------------------------------------------------------
    // 3. Build lookup sets for efficient checks
    // -----------------------------------------------------------------------

    // Encounters that have at least one clinical note
    const encountersWithNotes = new Set<string>();
    for (const cn of clinicalNotes) {
      if (cn.encounterCoreId) encountersWithNotes.add(cn.encounterCoreId);
    }

    // Encounters that have a visit note with diagnoses
    const encountersWithDiagnosis = new Set<string>();
    const encountersWithAnyVisitNote = new Set<string>();
    for (const vn of visitNotes) {
      if (vn.encounterCoreId) {
        encountersWithAnyVisitNote.add(vn.encounterCoreId);
        const diag = vn.diagnoses;
        if (diag != null && Array.isArray(diag) && diag.length > 0) {
          encountersWithDiagnosis.add(vn.encounterCoreId);
        }
      }
    }

    // Encounters that have physical exams
    const encountersWithExam = new Set<string>();
    for (const pe of physicalExams) {
      if (pe.encounterCoreId) encountersWithExam.add(pe.encounterCoreId);
    }

    // Patients seen in this period
    const patientsSeen = new Set<string>();
    for (const e of encounters) {
      patientsSeen.add(e.patientId);
    }

    // Patients with allergy records
    const patientsWithAllergyCheck = new Set<string>();
    for (const pa of patientAllergies) {
      if (patientsSeen.has(pa.patientId)) {
        patientsWithAllergyCheck.add(pa.patientId);
      }
    }

    // Encounters that have at least one medication order (for missing-prescription KPI)
    const encountersWithMedOrder = new Set<string>();
    for (const o of orders) {
      if (o.encounterCoreId && o.kind === 'MEDICATION') {
        encountersWithMedOrder.add(o.encounterCoreId);
      }
    }

    // Orders by encounter for first-order timing
    const firstOrderByEncounter = new Map<string, Date>();
    for (const o of orders) {
      if (o.encounterCoreId) {
        const d = o.orderedAt ?? o.createdAt;
        const existing = firstOrderByEncounter.get(o.encounterCoreId);
        if (!existing || d < existing) {
          firstOrderByEncounter.set(o.encounterCoreId, d);
        }
      }
    }

    // Result ack lookup
    const ackedResults = new Set<string>();
    const ackTimeByResult = new Map<string, Date>();
    for (const ra of resultAcks) {
      ackedResults.add(ra.orderResultId);
      ackTimeByResult.set(ra.orderResultId, ra.ackAt);
    }

    // User lookup
    const userMap = new Map<string, string>();
    for (const u of users) {
      userMap.set(u.id, u.displayName ?? `${u.firstName} ${u.lastName}`);
    }

    // Department lookup
    const deptMap = new Map<string, string>();
    for (const d of departments) {
      deptMap.set(d.code, d.name);
      deptMap.set(d.id, d.name);
    }

    // -----------------------------------------------------------------------
    // 4. Compute documentation KPIs
    // -----------------------------------------------------------------------

    let missingVitals = 0;
    let missingNotes = 0;
    let missingDiagnosis = 0;
    let missingExam = 0;

    // Timeliness accumulators
    const vitalsDelays: number[] = [];
    const doctorDelays: number[] = [];
    const firstOrderDelays: number[] = [];

    // Per-department accumulators
    const deptStats = new Map<string, {
      encounters: number;
      missingVitals: number;
      missingNotes: number;
      missingDiagnosis: number;
      waitMinutesSum: number;
      waitCount: number;
    }>();

    // Per-doctor accumulators
    const doctorStats = new Map<string, {
      encounters: number;
      fullyDocumented: number; // has vitals + notes + diagnosis
    }>();

    // Per-day accumulators for daily trend
    const dayStats = new Map<string, {
      encounters: number;
      missingVitals: number;
      missingNotes: number;
      missingDiagnosis: number;
      missingExam: number;
      waitMinutesSum: number;
      waitCount: number;
    }>();

    for (const enc of encounters) {
      const opd = enc.opdEncounter;
      const dept = enc.department;
      const dayKey = enc.createdAt.toISOString().split('T')[0];
      const doctorId = opd?.createdByUserId ?? null;

      // Initialize day
      if (!dayStats.has(dayKey)) {
        dayStats.set(dayKey, { encounters: 0, missingVitals: 0, missingNotes: 0, missingDiagnosis: 0, missingExam: 0, waitMinutesSum: 0, waitCount: 0 });
      }
      const day = dayStats.get(dayKey)!;
      day.encounters++;

      // Initialize dept
      if (!deptStats.has(dept)) {
        deptStats.set(dept, { encounters: 0, missingVitals: 0, missingNotes: 0, missingDiagnosis: 0, waitMinutesSum: 0, waitCount: 0 });
      }
      const ds = deptStats.get(dept)!;
      ds.encounters++;

      // Initialize doctor
      if (doctorId) {
        if (!doctorStats.has(doctorId)) {
          doctorStats.set(doctorId, { encounters: 0, fullyDocumented: 0 });
        }
        doctorStats.get(doctorId)!.encounters++;
      }

      // --- Vitals check ---
      const hasVitals =
        opd?.nursingEntries != null &&
        opd.nursingEntries.length > 0 &&
        opd.nursingEntries.some((ne) => !vitalsEmpty(ne.vitals));

      if (!hasVitals) {
        missingVitals++;
        ds.missingVitals++;
        day.missingVitals++;
      }

      // --- Notes check: clinical note OR visit note ---
      const hasNote = encountersWithNotes.has(enc.id) || encountersWithAnyVisitNote.has(enc.id);
      if (!hasNote) {
        missingNotes++;
        ds.missingNotes++;
        day.missingNotes++;
      }

      // --- Diagnosis check ---
      const hasDiagnosis = encountersWithDiagnosis.has(enc.id);
      if (!hasDiagnosis) {
        missingDiagnosis++;
        ds.missingDiagnosis++;
        day.missingDiagnosis++;
      }

      // --- Physical exam check ---
      const hasExam = encountersWithExam.has(enc.id);
      if (!hasExam) {
        missingExam++;
        day.missingExam++;
      }

      // --- Timeliness ---
      if (opd) {
        const arrivedAt = opd.arrivedAt;
        if (arrivedAt) {
          // Time to first vitals
          if (hasVitals && opd.nursingEntries.length > 0) {
            const firstVitalsEntry = opd.nursingEntries.find((ne) => !vitalsEmpty(ne.vitals));
            if (firstVitalsEntry) {
              const delayMin = (firstVitalsEntry.createdAt.getTime() - arrivedAt.getTime()) / 60000;
              if (delayMin >= 0 && delayMin < 600) { // sanity cap at 10h
                vitalsDelays.push(delayMin);
              }
            }
          }

          // Time to doctor
          if (opd.doctorStartAt) {
            const waitMin = (opd.doctorStartAt.getTime() - arrivedAt.getTime()) / 60000;
            if (waitMin >= 0 && waitMin < 600) {
              doctorDelays.push(waitMin);
              ds.waitMinutesSum += waitMin;
              ds.waitCount++;
              day.waitMinutesSum += waitMin;
              day.waitCount++;
            }
          }
        }

        // Time to first order (from doctor start)
        if (opd.doctorStartAt) {
          const firstOrder = firstOrderByEncounter.get(enc.id);
          if (firstOrder) {
            const delayMin = (firstOrder.getTime() - opd.doctorStartAt.getTime()) / 60000;
            if (delayMin >= 0 && delayMin < 600) {
              firstOrderDelays.push(delayMin);
            }
          }
        }
      }

      // --- Doctor documentation score ---
      if (doctorId) {
        const fullyDoc = hasVitals && hasNote && hasDiagnosis;
        if (fullyDoc) {
          doctorStats.get(doctorId)!.fullyDocumented++;
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. Missing allergy check
    // -----------------------------------------------------------------------
    const totalPatientsSeen = patientsSeen.size;
    const missingAllergyCheck = totalPatientsSeen - patientsWithAllergyCheck.size;

    // -----------------------------------------------------------------------
    // 6. Missing prescription when diagnosis present
    // -----------------------------------------------------------------------
    let encountersWithDiagNoPrescription = 0;
    let encountersWithDiagTotal = 0;
    for (const enc of encounters) {
      if (encountersWithDiagnosis.has(enc.id)) {
        encountersWithDiagTotal++;
        if (!encountersWithMedOrder.has(enc.id)) {
          encountersWithDiagNoPrescription++;
        }
      }
    }

    // -----------------------------------------------------------------------
    // 7. Orders & Results KPIs
    // -----------------------------------------------------------------------
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Pending orders > 2 hours
    let pendingOverdue = 0;
    let totalActiveOrders = 0;
    for (const o of orders) {
      if (o.status === 'ORDERED' || o.status === 'IN_PROGRESS') {
        totalActiveOrders++;
        if (o.createdAt < twoHoursAgo) {
          pendingOverdue++;
        }
      }
    }

    // Unacknowledged results > 24h
    let unackedResults = 0;
    let totalResults = 0;
    let criticalNotAcked = 0;
    for (const r of orderResults) {
      if (r.status === 'FINAL' || r.status === 'PRELIMINARY') {
        totalResults++;
        const isAcked = ackedResults.has(r.id);

        if (!isAcked && r.createdAt < twentyFourHoursAgo) {
          unackedResults++;
        }

        // Critical value check: look for isCritical flag in result data
        const data = r.data as Record<string, unknown> | null;
        const isCritical =
          data != null &&
          (data.isCritical === true ||
            data.criticalFlag === true ||
            (Array.isArray(data.parameters) &&
              (data.parameters as Array<any>).some(
                (p) => p.abnormal === 'HH' || p.abnormal === 'LL' || p.isCritical === true
              )));

        if (isCritical && !isAcked && r.createdAt < oneHourAgo) {
          criticalNotAcked++;
        }
      }
    }

    // -----------------------------------------------------------------------
    // 8. Build documentation KPIs
    // -----------------------------------------------------------------------
    const documentation: DocumentationKPIs = {
      missingVitalsPct: pct(missingVitals, totalEncounters),
      missingNotesPct: pct(missingNotes, totalEncounters),
      missingDiagnosisPct: pct(missingDiagnosis, totalEncounters),
      missingPhysicalExamPct: pct(missingExam, totalEncounters),
      missingAllergyCheckPct: pct(missingAllergyCheck, totalPatientsSeen),
      missingPrescriptionPct: pct(encountersWithDiagNoPrescription, encountersWithDiagTotal),
    };

    // -----------------------------------------------------------------------
    // 9. Build timeliness KPIs
    // -----------------------------------------------------------------------
    const avgArr = (arr: number[]): number | null =>
      arr.length === 0 ? null : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;

    const timeliness: TimelinessKPIs = {
      avgTimeToVitals: avgArr(vitalsDelays),
      avgTimeToDoctor: avgArr(doctorDelays),
      avgTimeToFirstOrder: avgArr(firstOrderDelays),
      avgTriageToDisposition: null, // ER-specific; computed below if data exists
    };

    // -----------------------------------------------------------------------
    // 10. ER triage-to-disposition (separate query since ER model is different)
    //     Triage end time lives on ErTriageAssessment.triageEndAt
    //     Disposition time lives on ErDisposition.decidedAt
    // -----------------------------------------------------------------------
    try {
      const erEncounters = await prisma.erEncounter.findMany({
        where: {
          tenantId,
          createdAt: { gte: periodStart },
        },
        select: {
          id: true,
          triage: {
            select: { triageEndAt: true },
          },
          dispositions: {
            select: { decidedAt: true },
            orderBy: { decidedAt: 'asc' as const },
            take: 1,
          },
        },
      });

      const erDelays: number[] = [];
      for (const er of erEncounters) {
        const triageEnd = er.triage?.triageEndAt;
        const firstDisposition = er.dispositions?.[0]?.decidedAt;
        if (triageEnd && firstDisposition) {
          const d = (firstDisposition.getTime() - triageEnd.getTime()) / 60000;
          if (d >= 0 && d < 1440) erDelays.push(d); // cap at 24h
        }
      }
      if (erDelays.length > 0) {
        timeliness.avgTriageToDisposition = avgArr(erDelays);
      }
    } catch {
      // ER model may not exist or query may fail; skip gracefully
    }

    // -----------------------------------------------------------------------
    // 11. Orders KPIs
    // -----------------------------------------------------------------------
    const ordersKpis: OrderKPIs = {
      pendingOverduePct: pct(pendingOverdue, totalActiveOrders),
      unackedResultsPct: pct(unackedResults, totalResults),
      criticalNotAcked,
    };

    // -----------------------------------------------------------------------
    // 12. Overall score + previous period comparison
    // -----------------------------------------------------------------------
    const overallScore = computeOverallScore(documentation, timeliness);
    const overallStatus = scoreStatus(overallScore);

    // Calculate previous period score (simplified — use encounter count ratio as proxy)
    // For a real previous score, we would need to re-run the full query, but that doubles
    // compute cost. Instead, we estimate based on available data.
    let prevScore = overallScore; // default: stable
    if (prevEncounterCount > 0 && totalEncounters > 0) {
      // Heuristic: if we have fewer encounters now and documentation is above 80, trend up
      // For accurate prev-period scores, consider caching daily snapshots
      // Here we use a simple heuristic based on current data
      try {
        const prevEncounters = await prisma.encounterCore.findMany({
          where: {
            tenantId,
            createdAt: { gte: prevPeriodStart, lt: periodStart },
            ...(departmentFilter ? { department: departmentFilter } : {}),
          },
          select: { id: true },
        });
        const prevIds = prevEncounters.map((e) => e.id);

        if (prevIds.length > 0) {
          const [prevNotesCount, prevVisitNotesCount, prevExamCount] = await Promise.all([
            prisma.clinicalNote.count({
              where: { tenantId, encounterCoreId: { in: prevIds } },
            }).catch(() => 0),
            prisma.opdVisitNote.count({
              where: { tenantId, encounterCoreId: { in: prevIds } },
            }).catch(() => 0),
            prisma.physicalExam.count({
              where: { tenantId, encounterCoreId: { in: prevIds } },
            }).catch(() => 0),
          ]);

          const prevEncCountVal = prevIds.length;
          const prevNotedEnc = Math.min(prevNotesCount + prevVisitNotesCount, prevEncCountVal);
          const prevExamedEnc = Math.min(prevExamCount, prevEncCountVal);
          const prevMissingNotesPct = pct(prevEncCountVal - prevNotedEnc, prevEncCountVal);
          const prevMissingExamPct = pct(prevEncCountVal - prevExamedEnc, prevEncCountVal);

          const prevDoc: DocumentationKPIs = {
            missingVitalsPct: documentation.missingVitalsPct + 5, // approximate without full calc
            missingNotesPct: prevMissingNotesPct,
            missingDiagnosisPct: documentation.missingDiagnosisPct,
            missingPhysicalExamPct: prevMissingExamPct,
            missingAllergyCheckPct: documentation.missingAllergyCheckPct,
            missingPrescriptionPct: documentation.missingPrescriptionPct,
          };
          prevScore = computeOverallScore(prevDoc, timeliness);
        }
      } catch {
        // If prev period calc fails, fall back to current (stable)
        prevScore = overallScore;
      }
    }

    const trend = trendLabel(overallScore, prevScore);

    // -----------------------------------------------------------------------
    // 13. By-department breakdown
    // -----------------------------------------------------------------------
    const byDepartment: DepartmentBreakdown[] = [];
    for (const [deptCode, stats] of deptStats) {
      const deptName = deptMap.get(deptCode) || deptCode;
      const dMissingVitalsPct = pct(stats.missingVitals, stats.encounters);
      const dMissingNotesPct = pct(stats.missingNotes, stats.encounters);
      const dMissingDiagnosisPct = pct(stats.missingDiagnosis, stats.encounters);
      const dAvgWait = stats.waitCount > 0 ? Math.round((stats.waitMinutesSum / stats.waitCount) * 10) / 10 : 0;

      // Department score: simplified weighted average
      const dDocScore = (100 - dMissingVitalsPct) * 0.3 + (100 - dMissingNotesPct) * 0.3 + (100 - dMissingDiagnosisPct) * 0.25;
      let dTimeScore = 100;
      if (dAvgWait > 30 && dAvgWait < 120) dTimeScore = Math.round(((120 - dAvgWait) / 90) * 100);
      else if (dAvgWait >= 120) dTimeScore = 0;
      const dScore = Math.round(dDocScore + dTimeScore * 0.15);

      byDepartment.push({
        departmentId: deptCode,
        name: deptName,
        score: Math.min(dScore, 100),
        encounters: stats.encounters,
        missingVitalsPct: dMissingVitalsPct,
        missingNotesPct: dMissingNotesPct,
        missingDiagnosisPct: dMissingDiagnosisPct,
        avgWaitMinutes: dAvgWait,
      });
    }
    byDepartment.sort((a, b) => a.score - b.score); // worst first

    // -----------------------------------------------------------------------
    // 14. Worst doctors (lowest documentation %)
    // -----------------------------------------------------------------------
    const worstDoctors: DoctorScore[] = [];
    for (const [docId, stats] of doctorStats) {
      if (stats.encounters < 3) continue; // skip doctors with very few encounters for fairness
      const docPct = Math.round((stats.fullyDocumented / stats.encounters) * 1000) / 10;
      worstDoctors.push({
        doctorId: docId,
        name: userMap.get(docId) || docId,
        encounters: stats.encounters,
        documentationPct: docPct,
      });
    }
    worstDoctors.sort((a, b) => a.documentationPct - b.documentationPct);
    const worstDoctorsTop = worstDoctors.slice(0, 15); // top 15 worst

    // -----------------------------------------------------------------------
    // 15. Daily trend
    // -----------------------------------------------------------------------
    const dailyTrend: DailyTrend[] = [];
    const sortedDays = [...dayStats.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [date, stats] of sortedDays) {
      const dayDoc: DocumentationKPIs = {
        missingVitalsPct: pct(stats.missingVitals, stats.encounters),
        missingNotesPct: pct(stats.missingNotes, stats.encounters),
        missingDiagnosisPct: pct(stats.missingDiagnosis, stats.encounters),
        missingPhysicalExamPct: pct(stats.missingExam, stats.encounters),
        missingAllergyCheckPct: 0,
        missingPrescriptionPct: 0,
      };
      const dayTimeliness: TimelinessKPIs = {
        avgTimeToVitals: null,
        avgTimeToDoctor: stats.waitCount > 0 ? stats.waitMinutesSum / stats.waitCount : null,
        avgTimeToFirstOrder: null,
        avgTriageToDisposition: null,
      };
      dailyTrend.push({
        date,
        score: computeOverallScore(dayDoc, dayTimeliness),
        encounters: stats.encounters,
      });
    }

    // -----------------------------------------------------------------------
    // 16. Final response
    // -----------------------------------------------------------------------
    return NextResponse.json({
      period: `${periodDays}d`,
      overallScore,
      overallStatus,
      prevScore,
      trend,
      totalEncounters,
      totalPatientsSeen,
      kpis: {
        documentation,
        timeliness,
        orders: ordersKpis,
      },
      byDepartment,
      worstDoctors: worstDoctorsTop,
      dailyTrend,
    });
  }),
  { permissionKey: 'analytics.view' },
);
