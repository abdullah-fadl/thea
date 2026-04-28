import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ICU_UNITS = ['ICU', 'CCU', 'NICU', 'PICU', 'MICU', 'SICU', 'CVICU'];

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIcuUnit(location: any | null): boolean {
  if (!location) return false;
  const unit = String(location.unit || location.ward || '').toUpperCase();
  return ICU_UNITS.some((u) => unit.includes(u));
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  const role = String(user?.role || '');
  const dev = false;
  const roleLower = role.toLowerCase();
  const isDoctor = roleLower.includes('doctor') || roleLower.includes('physician') || roleLower.includes('intensivist');
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });

  if (!dev && !isDoctor && !charge) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const bedFilter = url.searchParams.get('bed') || '';
  const statusFilter = url.searchParams.get('status') || '';
  const showAll = url.searchParams.get('all') === 'true';

  // Fetch active/discharge-ready episodes
  const whereClause: any = {
    tenantId,
    status: { in: ['ACTIVE', 'DISCHARGE_READY'] },
  };

  // Doctor sees only their patients unless showAll or charge/dev
  if (!showAll && !dev && !charge) {
    whereClause.ownership = { path: ['attendingPhysicianUserId'], equals: userId };
  }

  if (statusFilter && ['ACTIVE', 'DISCHARGE_READY'].includes(statusFilter)) {
    whereClause.status = statusFilter;
  }

  const episodes = await prisma.ipdEpisode.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Filter to ICU units only (location is JSON)
  const icuEpisodes = episodes.filter((ep) => isIcuUnit(ep.location as Record<string, unknown> | null));

  // Apply bed filter in-memory
  const filtered = bedFilter
    ? icuEpisodes.filter((ep) => {
        const loc = ep.location as Record<string, unknown> | null;
        return loc && String(loc.bed || '').includes(bedFilter);
      })
    : icuEpisodes;

  const today = todayString();

  // Enrich each episode with ICU-specific data
  const enriched = await Promise.all(
    filtered.map(async (ep) => {
      const patientJson = ep.patient as Record<string, unknown> | null;
      const locationJson = ep.location as Record<string, unknown> | null;
      const ownershipJson = ep.ownership as Record<string, unknown> | null;
      const riskFlagsJson = ep.riskFlags as Record<string, unknown> | null;
      const encounterCoreId = String(ep.encounterId || '').trim();
      const patientMasterId = String(patientJson?.id || '').trim();

      const [
        latestVitalsArr,
        latestAssessmentArr,
        latestSofaArr,
        activeVentArr,
        todayProgressArr,
        pendingOrdersCount,
        pendingResultsCount,
        allergiesArr,
        activeProblemsArr,
      ] = await Promise.all([
        // Latest vitals
        prisma.ipdVitals.findMany({
          where: { tenantId, episodeId: ep.id },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }),
        // Latest nursing assessment (MEWS, GCS, icuMonitoring)
        prisma.ipdNursingAssessment.findMany({
          where: { tenantId, episodeId: ep.id },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }),
        // Latest SOFA score
        prisma.sofaScore.findMany({
          where: { tenantId, episodeId: ep.id },
          orderBy: { scoredAt: 'desc' },
          take: 1,
        }),
        // Active ventilator record (not ended)
        prisma.ventilatorRecord.findMany({
          where: { tenantId, episodeId: ep.id, endedAt: null },
          orderBy: { startedAt: 'desc' },
          take: 1,
        }),
        // Today's progress note
        encounterCoreId
          ? prisma.clinicalNote.findMany({
              where: {
                tenantId,
                encounterCoreId,
                noteType: 'DAILY_PROGRESS',
                metadata: {
                  path: ['episodeId'],
                  equals: ep.id,
                },
                AND: [{ metadata: { path: ['date'], equals: today } }],
              },
              take: 1,
            })
          : Promise.resolve([]),
        // Pending orders count
        prisma.ipdOrder.count({
          where: { tenantId, episodeId: ep.id, status: { in: ['DRAFT', 'ORDERED'] } },
        }),
        // Pending results count
        encounterCoreId
          ? prisma.orderResult.count({
              where: { tenantId, order: { encounterCoreId } },
            })
          : Promise.resolve(0),
        // Allergies
        patientMasterId
          ? prisma.patientAllergy.findMany({
              where: { tenantId, patientId: patientMasterId },
              take: 20,
            })
          : Promise.resolve([]),
        // Active problems
        patientMasterId
          ? prisma.patientProblem.findMany({
              where: { tenantId, patientId: patientMasterId, status: 'active' },
              take: 20,
            })
          : Promise.resolve([]),
      ]);

      // Extract ICU-specific data
      const assessment = latestAssessmentArr[0] || null;
      const assessmentExt = assessment as typeof assessment & any;
      const icuMon = (assessmentExt?.icuMonitoring as Record<string, unknown>) || {};
      const drips = Array.isArray(icuMon.drips) ? (icuMon.drips as Array<any>).filter((d) => !d.stoppedAt) : [];
      const sofa = latestSofaArr[0] || null;
      const vent = activeVentArr[0] || null;

      const admittedAt = ep.createdAt ? new Date(ep.createdAt) : null;
      const losMs = admittedAt ? Date.now() - admittedAt.getTime() : 0;
      const losDays = Math.max(1, Math.ceil(losMs / (24 * 60 * 60 * 1000)));

      return {
        id: ep.id,
        status: ep.status,
        patientName: (patientJson?.fullName as string) || 'Unknown',
        patientId: patientMasterId,
        encounterCoreId,
        location: locationJson || {},
        ownership: ownershipJson || {},
        reasonForAdmission: ep.reasonForAdmission || '',
        riskFlags: riskFlagsJson || {},
        admittedAt: ep.createdAt,
        losDays,
        serviceUnit: ep.serviceUnit || '',
        // Vitals
        latestVitals: latestVitalsArr[0]?.vitals || null,
        // Nursing assessment
        latestAssessment: assessment
          ? {
              mewsScore: assessment.mewsScore,
              mewsLevel: assessment.mewsLevel,
              gcsScore: assessment.gcsScore,
              bradenScore: assessment.bradenScore,
              bradenRisk: assessment.bradenRisk,
              fallRiskScore: assessment.fallRiskScore,
              fallRiskLevel: assessment.fallRiskLevel,
              consciousness: assessment.consciousness,
            }
          : null,
        // SOFA
        sofaScore: sofa
          ? {
              totalScore: sofa.totalScore,
              respiratory: sofa.respiratory,
              coagulation: sofa.coagulation,
              liver: sofa.liver,
              cardiovascular: sofa.cardiovascular,
              cns: sofa.cns,
              renal: sofa.renal,
              scoredAt: sofa.scoredAt,
            }
          : null,
        // Ventilator
        isOnVentilator: vent !== null,
        ventilatorMode: vent ? (vent.mode || '') : null,
        ventilatorFio2: vent ? ((vent.settings as Record<string, unknown>)?.fio2 || null) : null,
        // Vasopressors / drips
        activeDripsCount: drips.length,
        activeDrips: drips.slice(0, 5).map((d) => ({
          drugName: String(d.drugName || ''),
          rate: d.rate || 0,
          dose: String(d.dose || ''),
        })),
        // Progress note
        hasProgressToday: todayProgressArr.length > 0,
        lastProgressDate: todayProgressArr.length > 0 ? today : null,
        // Orders & results
        pendingOrdersCount,
        pendingResultsCount,
        allergiesCount: allergiesArr.length,
        allergies: allergiesArr.map((a) => ({
          name: a.allergen || '',
          severity: a.severity || '',
          type: a.type || '',
        })),
        activeProblems: activeProblemsArr.map((p) => {
          const pExt = p as typeof p & any;
          return {
            name: (pExt.name as string) || (pExt.description as string) || '',
            icd10: (pExt.icd10Code as string) || '',
          };
        }),
      };
    }),
  );

  // Compute ICU-specific KPIs
  const myPatients = enriched.length;
  const onVentilator = enriched.filter((e) => e.isOnVentilator).length;
  const highSofa = enriched.filter((e) => (e.sofaScore?.totalScore || 0) >= 10).length;
  const needRounding = enriched.filter((e) => !e.hasProgressToday).length;

  // Unique bed areas for filter
  const beds = [...new Set(
    enriched
      .map((e) => e.location?.bed || e.location?.room || '')
      .filter(Boolean),
  )].sort();

  return NextResponse.json({
    items: enriched,
    kpis: { myPatients, onVentilator, highSofa, needRounding },
    beds,
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' }
);
