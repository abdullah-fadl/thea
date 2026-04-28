import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  const episodeId = url.searchParams.get('episodeId') || '';
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const encounterCoreId = String((episode as Record<string, unknown>)?.encounterId || '').trim();
  const patientMasterId = String(((episode as Record<string, unknown>)?.patient as Record<string, unknown>)?.id || '').trim();
  const now = new Date();
  const hours48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Parallel fetch all rounding data
  const [
    vitalsArr,
    assessmentsArr,
    medOrdersRaw,
    labImagingOrders,
    progressNotes,
    carePlans,
    fluidBalanceArr,
    allergiesArr,
    problemsArr,
    pendingResults,
  ] = await Promise.all([
    // Vitals trend (last 48h)
    prisma.ipdVitals.findMany({
      where: { tenantId, episodeId, createdAt: { gte: hours48ago } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
    // Nursing assessments (last 48h)
    prisma.ipdNursingAssessment.findMany({
      where: { tenantId, episodeId, createdAt: { gte: hours48ago } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // Active medication orders
    encounterCoreId
      ? prisma.ordersHub.findMany({
          where: { tenantId, encounterCoreId, kind: 'MEDICATION', status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]),
    // Lab/Imaging orders
    prisma.ipdOrder.findMany({
      where: { tenantId, episodeId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    // Doctor progress notes (all)
    encounterCoreId
      ? prisma.clinicalNote.findMany({
          where: {
            tenantId,
            encounterCoreId,
            noteType: 'DAILY_PROGRESS',
            metadata: { path: ['episodeId'], equals: episodeId },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        })
      : Promise.resolve([]),
    // Care plans
    prisma.ipdCarePlan.findMany({
      where: { tenantId, episodeId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // Fluid balance (last 48h)
    prisma.fluidBalanceEntry.findMany({
      where: { tenantId, episodeId, createdAt: { gte: hours48ago } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
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
    // Pending results — via order relation
    encounterCoreId
      ? prisma.orderResult.findMany({
          where: { tenantId, order: { encounterCoreId } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  // Map vitals to trend format
  const vitalsTrend = vitalsArr.map((v) => ({
    time: v.createdAt,
    vitals: v.vitals || {},
    painScore: v.painScore,
    critical: v.critical,
  }));

  // Map med orders
  const medOrders = medOrdersRaw.map((o) => {
    const med = o.meta?.medication || {};
    return {
      id: o.id,
      drugName: med.medicationName || o.orderName || '',
      dose: med.doseValue || '',
      doseUnit: med.doseUnit || '',
      route: med.route || '',
      frequency: med.frequency || '',
      orderType: med.orderType || '',
      status: o.status || 'ORDERED',
      startAt: med.startAt || o.createdAt,
      isNarcotic: Boolean(med.isNarcotic),
      createdAt: o.createdAt,
    };
  });

  // Map progress notes
  const progress = progressNotes.map((n) => ({
    id: n.id,
    date: n.metadata?.date || null,
    assessment: n.content || '',
    progressSummary: n.metadata?.progressSummary || '',
    changesToday: n.metadata?.changesToday || '',
    planNext24h: n.metadata?.planNext24h || '',
    dispositionPlan: n.metadata?.dispositionPlan || '',
    author: n.author || {},
    createdAt: n.createdAt,
  }));

  // Map care plans
  const plans = carePlans.map((cp) => ({
    id: cp.id,
    problem: cp.problem || '',
    goals: cp.goals || '',
    interventions: cp.interventions || '',
    status: cp.status,
    createdAt: cp.createdAt,
  }));

  // Fluid balance summary
  const fluidIntake = fluidBalanceArr
    .filter((f: any) => f.type === 'INTAKE')
    .reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
  const fluidOutput = fluidBalanceArr
    .filter((f: any) => f.type === 'OUTPUT')
    .reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);

  // Latest assessment
  const latestAssessment = assessmentsArr[0]
    ? {
        mewsScore: assessmentsArr[0].mewsScore,
        mewsLevel: assessmentsArr[0].mewsLevel,
        bradenScore: assessmentsArr[0].bradenScore,
        bradenRisk: assessmentsArr[0].bradenRisk,
        fallRiskScore: assessmentsArr[0].fallRiskScore,
        fallRiskLevel: assessmentsArr[0].fallRiskLevel,
        consciousness: assessmentsArr[0].consciousness,
        recordedAt: assessmentsArr[0].createdAt,
      }
    : null;

  // Enrich results with order name via join and ack status via OrderResultAck
  const resultOrderIds = pendingResults.map((r) => r.orderId).filter(Boolean);
  const orderLookup: Record<string, any> = {};
  if (resultOrderIds.length > 0) {
    const orders = await prisma.ordersHub.findMany({
      where: { tenantId, id: { in: resultOrderIds } },
      select: { id: true, orderName: true },
    });
    for (const o of orders) orderLookup[o.id] = o;
  }
  const acks = resultOrderIds.length > 0
    ? await prisma.orderResultAck.findMany({
        where: { tenantId, orderId: { in: resultOrderIds } },
      })
    : [];
  const ackedOrderIds = new Set(acks.map((a) => a.orderId));

  const results = pendingResults.map((r) => {
    const d = r.data || {};
    return {
      id: r.id,
      orderId: r.orderId,
      orderName: orderLookup[r.orderId]?.orderName || '',
      resultType: r.resultType || '',
      status: r.status || '',
      acknowledged: ackedOrderIds.has(r.orderId),
      value: d.value ?? d.result ?? r.summary ?? null,
      unit: d.unit || null,
      abnormal: Boolean(d.abnormal || d.isAbnormal),
      criticalFlag: Boolean(d.critical || d.isCritical),
      createdAt: r.createdAt,
    };
  });

  return NextResponse.json({
    episode: {
      id: episode.id,
      status: episode.status,
      patientName: ((episode as Record<string, unknown>).patient as Record<string, unknown>)?.fullName || 'Unknown',
      patientId: patientMasterId,
      encounterCoreId,
      location: (episode as Record<string, unknown>).location || {},
      ownership: (episode as Record<string, unknown>).ownership || {},
      reasonForAdmission: (episode as Record<string, unknown>).reasonForAdmission || '',
      serviceUnit: (episode as Record<string, unknown>).serviceUnit || '',
      admittedAt: episode.createdAt,
    },
    vitalsTrend,
    latestAssessment,
    medOrders,
    labImagingOrders: labImagingOrders.map((o) => ({
      id: o.id,
      kind: o.kind,
      title: o.title,
      status: o.status,
      notes: o.notes,
      createdAt: o.createdAt,
    })),
    progressNotes: progress,
    carePlans: plans,
    fluidBalance: { intake: fluidIntake, output: fluidOutput, net: fluidIntake - fluidOutput },
    allergies: allergiesArr.map((a) => ({
      name: a.allergen || a.name || '',
      severity: a.severity || '',
      type: a.type || '',
    })),
    activeProblems: problemsArr.map((p) => ({
      name: p.name || p.description || '',
      icd10: p.icd10Code || '',
    })),
    results,
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
