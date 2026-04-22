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
  const isDoctor = roleLower.includes('doctor') || roleLower.includes('physician') || roleLower.includes('intensivist');
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

  const encounterCoreId = String(episode?.encounterId || '').trim();
  const patientMasterId = String((episode?.patient as Record<string, unknown>)?.id || '').trim();
  const now = new Date();
  const hours48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const days7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Parallel fetch ALL rounding data (IPD + ICU-specific)
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
    // ICU-specific
    sofaHistory,
    ventRecords,
    ventChecks,
    icuCarePlans,
    icuEvents,
  ] = await Promise.all([
    // --- IPD standard data ---
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
      take: 30,
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
    // Doctor progress notes
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
    // Care plans (IPD standard)
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
    // Pending results via order relation
    encounterCoreId
      ? prisma.orderResult.findMany({
          where: { tenantId, order: { encounterCoreId } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : Promise.resolve([]),

    // --- ICU-specific data ---
    // SOFA score history (last 7 days)
    prisma.sofaScore.findMany({
      where: { tenantId, episodeId, scoredAt: { gte: days7ago } },
      orderBy: { scoredAt: 'desc' },
      take: 30,
    }),
    // Ventilator records (sessions)
    prisma.ventilatorRecord.findMany({
      where: { tenantId, episodeId },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    // ICU ventilator checks (hourly, last 48h)
    prisma.icuVentilatorCheck.findMany({
      where: { tenantId, episodeId, checkedAt: { gte: hours48ago } },
      orderBy: { checkedAt: 'desc' },
      take: 100,
    }),
    // ICU care plans (daily bundles)
    prisma.icuCarePlan.findMany({
      where: { tenantId, episodeId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // ICU events (admit/transfer/discharge)
    prisma.ipdIcuEvent.findMany({
      where: { tenantId, episodeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  // --- Map standard IPD data ---

  const vitalsTrend = vitalsArr.map((v: any) => ({
    time: v.createdAt,
    vitals: v.vitals || {},
    painScore: v.painScore,
    critical: v.critical,
  }));

  const medOrders = medOrdersRaw.map((o: any) => {
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
      isVasopressor: Boolean(med.isVasopressor || med.category === 'vasopressor'),
      isSedation: Boolean(med.isSedation || med.category === 'sedation'),
      isAntibiotic: Boolean(med.isAntibiotic || med.category === 'antibiotic'),
      createdAt: o.createdAt,
    };
  });

  const progress = progressNotes.map((n: any) => ({
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

  const plans = carePlans.map((cp: any) => ({
    id: cp.id,
    problem: cp.problem || '',
    goals: cp.goals || '',
    interventions: cp.interventions || '',
    status: cp.status,
    createdAt: cp.createdAt,
  }));

  // Fluid balance summary
  const fluidIntake = fluidBalanceArr
    .filter((f: any) => true)
    .reduce((sum: number, f: any) => sum + (Number(f.totalIntake) || 0), 0);
  const fluidOutput = fluidBalanceArr
    .reduce((sum: number, f: any) => sum + (Number(f.totalOutput) || 0), 0);

  // Latest assessment with ICU monitoring
  const latestAssessment = assessmentsArr[0]
    ? {
        mewsScore: assessmentsArr[0].mewsScore,
        mewsLevel: assessmentsArr[0].mewsLevel,
        gcsScore: assessmentsArr[0].gcsScore,
        bradenScore: assessmentsArr[0].bradenScore,
        bradenRisk: assessmentsArr[0].bradenRisk,
        fallRiskScore: assessmentsArr[0].fallRiskScore,
        fallRiskLevel: assessmentsArr[0].fallRiskLevel,
        consciousness: assessmentsArr[0].consciousness,
        icuMonitoring: (assessmentsArr[0] as Record<string, unknown>).icuMonitoring || null,
        recordedAt: assessmentsArr[0].createdAt,
      }
    : null;

  // Enrich results with order name + ack status
  const resultOrderIds = pendingResults.map((r: any) => r.orderId).filter(Boolean);
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
  const ackedOrderIds = new Set(acks.map((a: any) => a.orderId));

  const results = pendingResults.map((r: any) => {
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

  // --- Map ICU-specific data ---

  const sofaScores = sofaHistory.map((s: any) => ({
    id: s.id,
    totalScore: s.totalScore,
    respiratory: s.respiratory,
    coagulation: s.coagulation,
    liver: s.liver,
    cardiovascular: s.cardiovascular,
    cns: s.cns,
    renal: s.renal,
    notes: s.notes,
    scoredAt: s.scoredAt,
  }));

  const ventilatorRecords = ventRecords.map((v: any) => ({
    id: v.id,
    mode: v.mode || '',
    settings: v.settings || {},
    recordings: v.recordings || [],
    weaningPlan: v.weaningPlan || null,
    startedAt: v.startedAt,
    endedAt: v.endedAt,
    extubationTime: v.extubationTime || null,
    extubationNote: v.extubationNote || null,
    isActive: !v.endedAt,
  }));

  const ventilatorChecks = ventChecks.map((vc: any) => ({
    id: vc.id,
    mode: vc.mode || '',
    fio2: vc.fio2,
    tidalVolume: vc.tidalVolume,
    respiratoryRate: vc.respiratoryRate,
    peep: vc.peep,
    pip: vc.pip,
    pplat: vc.pplat,
    compliance: vc.compliance,
    minuteVolume: vc.minuteVolume,
    spo2: vc.spo2,
    etco2: vc.etco2,
    alarms: vc.alarms || {},
    checkedAt: vc.checkedAt,
  }));

  const icuCarePlansMapped = icuCarePlans.map((cp: any) => ({
    id: cp.id,
    date: cp.date,
    shift: cp.shift,
    dailyGoals: cp.dailyGoals || {},
    careBundle: cp.careBundle || {},
    sedationLevel: cp.sedationLevel || null,
    painScore: cp.painScore ?? null,
    deliriumScreen: cp.deliriumScreen || null,
    mobilityGoal: cp.mobilityGoal || null,
    nutritionStatus: cp.nutritionStatus || null,
    notes: cp.notes || null,
    createdAt: cp.createdAt,
  }));

  const icuEventsMapped = icuEvents.map((ev: any) => ({
    id: ev.id,
    type: ev.type,
    source: ev.source || null,
    destination: ev.destination || null,
    note: ev.note || null,
    createdAt: ev.createdAt,
  }));

  // Extract hemodynamics and drips from latest assessment
  const icuMon = (latestAssessment?.icuMonitoring || {}) as Record<string, any>;
  const hemodynamics = Array.isArray(icuMon.hemodynamics) ? icuMon.hemodynamics : [];
  const drips = Array.isArray(icuMon.drips) ? icuMon.drips : [];
  const latestHemodynamic = hemodynamics[hemodynamics.length - 1] || null;
  const activeDrips = drips.filter((d: any) => !d.stoppedAt);

  return NextResponse.json({
    episode: {
      id: episode.id,
      status: episode.status,
      patientName: (episode.patient as Record<string, unknown>)?.fullName || 'Unknown',
      patientId: patientMasterId,
      encounterCoreId,
      location: episode.location || {},
      ownership: episode.ownership || {},
      reasonForAdmission: episode.reasonForAdmission || '',
      serviceUnit: episode.serviceUnit || '',
      admittedAt: episode.createdAt,
    },
    // Standard IPD
    vitalsTrend,
    latestAssessment,
    medOrders,
    labImagingOrders: labImagingOrders.map((o: any) => ({
      id: o.id,
      kind: o.kind,
      title: o.title,
      status: o.status,
      notes: o.notes,
      createdAt: o.createdAt,
    })),
    progressNotes: progress,
    carePlans: plans,
    fluidBalance: {
      intake: fluidIntake,
      output: fluidOutput,
      net: fluidIntake - fluidOutput,
      entries: fluidBalanceArr.map((f: any) => ({
        id: f.id,
        shift: f.shift,
        shiftDate: f.shiftDate,
        totalIntake: f.totalIntake,
        totalOutput: f.totalOutput,
        netBalance: f.netBalance,
        intakes: f.intakes || [],
        outputs: f.outputs || [],
        createdAt: f.createdAt,
      })),
    },
    allergies: allergiesArr.map((a: any) => ({
      name: a.allergen || a.name || '',
      severity: a.severity || '',
      type: a.type || '',
    })),
    activeProblems: problemsArr.map((p: any) => ({
      name: p.name || p.description || '',
      icd10: p.icd10Code || '',
    })),
    results,
    // ICU-specific
    sofaScores,
    ventilatorRecords,
    ventilatorChecks,
    icuCarePlans: icuCarePlansMapped,
    icuEvents: icuEventsMapped,
    latestHemodynamic,
    activeDrips: activeDrips.map((d: any) => ({
      drugName: d.drugName || '',
      concentration: d.concentration || '',
      rate: d.rate || 0,
      dose: d.dose || '',
      startedAt: d.startedAt || null,
      adjustments: d.adjustments || [],
    })),
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' }
);
