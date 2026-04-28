import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  const role = String(user?.role || '');
  const dev = false;
  const roleLower = role.toLowerCase();
  const isDoctor = roleLower.includes('doctor') || roleLower.includes('physician');
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });

  if (!dev && !isDoctor && !charge) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const wardFilter = url.searchParams.get('ward') || '';
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

  // Apply ward filter in-memory (location is JSON)
  const wardFiltered = wardFilter
    ? episodes.filter((ep) => {
        const loc = ep.location as Record<string, unknown> | null;
        return loc && (loc.ward === wardFilter || loc.unit === wardFilter);
      })
    : episodes;

  const today = todayString();

  // Enrich each episode with vitals, assessments, progress notes, pending orders/results
  const enriched = await Promise.all(
    wardFiltered.map(async (ep) => {
      const encounterCoreId = String(ep.encounterId || '').trim();
      const patientMasterId = String((ep.patient as Record<string, unknown> | null)?.id || '').trim();

      const [
        latestVitalsArr,
        latestAssessmentArr,
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
        // Latest nursing assessment (MEWS)
        prisma.ipdNursingAssessment.findMany({
          where: { tenantId, episodeId: ep.id },
          orderBy: { createdAt: 'desc' },
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
        // Pending results — count order results without corresponding acks
        encounterCoreId
          ? prisma.orderResult.count({
              where: { tenantId, order: { encounterCoreId } },
            })
          : Promise.resolve(0),
        // Allergies from patient
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

      const admittedAt = ep.createdAt ? new Date(ep.createdAt) : null;
      const losMs = admittedAt ? Date.now() - admittedAt.getTime() : 0;
      const losDays = Math.max(1, Math.ceil(losMs / (24 * 60 * 60 * 1000)));

      return {
        id: ep.id,
        status: ep.status,
        patientName: (ep.patient as Record<string, unknown> | null)?.fullName as string || 'Unknown',
        patientId: patientMasterId,
        encounterCoreId,
        location: (ep.location as Record<string, unknown>) || {},
        ownership: (ep.ownership as Record<string, unknown>) || {},
        reasonForAdmission: ep.reasonForAdmission || '',
        riskFlags: (ep.riskFlags as Record<string, unknown>) || {},
        admittedAt: ep.createdAt,
        losDays,
        serviceUnit: ep.serviceUnit || '',
        latestVitals: latestVitalsArr[0]?.vitals || null,
        latestAssessment: latestAssessmentArr[0]
          ? {
              mewsScore: latestAssessmentArr[0].mewsScore,
              mewsLevel: latestAssessmentArr[0].mewsLevel,
              bradenScore: latestAssessmentArr[0].bradenScore,
              bradenRisk: latestAssessmentArr[0].bradenRisk,
              fallRiskScore: latestAssessmentArr[0].fallRiskScore,
              fallRiskLevel: latestAssessmentArr[0].fallRiskLevel,
            }
          : null,
        hasProgressToday: todayProgressArr.length > 0,
        lastProgressDate: todayProgressArr.length > 0
          ? today
          : null,
        pendingOrdersCount,
        pendingResultsCount,
        allergiesCount: allergiesArr.length,
        allergies: allergiesArr.map((a) => ({
          name: a.allergen || '',
          severity: a.severity || '',
          type: a.type || '',
        })),
        activeProblems: activeProblemsArr.map((p) => ({
          name: p.problemName || p.description || '',
          icd10: p.icdCode || '',
        })),
      };
    }),
  );

  // Compute KPIs
  const myPatients = enriched.length;
  const needRounding = enriched.filter((e) => !e.hasProgressToday).length;
  const pendingResults = enriched.reduce((sum, e) => sum + e.pendingResultsCount, 0);
  const dischargeReady = enriched.filter((e) => e.status === 'DISCHARGE_READY').length;

  // Get unique wards for filter options
  const wards = [...new Set(
    enriched
      .map((e) => e.location?.ward || e.location?.unit || '')
      .filter(Boolean),
  )].sort();

  return NextResponse.json({
    items: enriched,
    kpis: { myPatients, needRounding, pendingResults, dischargeReady },
    wards,
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
