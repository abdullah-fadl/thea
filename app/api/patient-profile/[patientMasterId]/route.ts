import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildEncounterLink(encounter: Record<string, unknown>, ipdEpisode?: Record<string, unknown>) {
  const type = String(encounter?.encounterType || '').toUpperCase();
  const source = encounter?.source as Record<string, unknown> | undefined;
  if (type === 'OPD') return `/opd/visit/${encounter.id}`;
  if (type === 'ER') return `/er/encounter/${source?.sourceId || encounter.id}`;
  if (type === 'IPD') return `/ipd/episode/${source?.sourceId || ipdEpisode?.id || encounter.id}`;
  return `/encounters/${encounter.id}`;
}

export const GET = withAuthTenant(withAccessAudit(async (req: NextRequest, { tenantId }, params: any) => {
  const resolvedParams = await params;
  const patientMasterId = String(resolvedParams?.patientMasterId || '').trim();
  if (!patientMasterId) {
    return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
  }

  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientMasterId },
  });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const encounters = await prisma.encounterCore.findMany({
    where: { tenantId, patientId: patientMasterId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  const encounterIds = encounters.map((enc) => String(enc.id || '')).filter(Boolean);

  const opdEncounters = encounterIds.length
    ? await prisma.opdEncounter.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const opdByEncounter = opdEncounters.reduce<Record<string, unknown>>((acc, opd) => {
    acc[String(opd.encounterCoreId || '')] = opd;
    return acc;
  }, {});

  const ipdEpisodes = encounterIds.length
    ? await prisma.ipdEpisode.findMany({
        where: { tenantId, encounterId: { in: encounterIds } },
      })
    : [];
  const ipdByEncounter = ipdEpisodes.reduce<Record<string, unknown>>((acc, episode) => {
    acc[String(episode.encounterId || '')] = episode;
    return acc;
  }, {});

  const dischargeSummaries = encounterIds.length
    ? await prisma.dischargeSummary.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const dischargeByEncounter = dischargeSummaries.reduce<Record<string, unknown>>((acc, summary) => {
    acc[String(summary.encounterCoreId || '')] = summary;
    return acc;
  }, {});

  const deathDeclarations = encounterIds.length
    ? await prisma.deathDeclaration.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const deathByEncounter = deathDeclarations.reduce<Record<string, unknown>>((acc, item) => {
    acc[String(item.encounterCoreId || '')] = item;
    return acc;
  }, {});
  const deathFinalized = deathDeclarations.some((item) => Boolean(item.finalisedAt));

  const orders = encounterIds.length
    ? await prisma.ordersHub.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const ordersByEncounter = orders.reduce<Record<string, typeof orders>>((acc, order) => {
    const key = String(order.encounterCoreId || '');
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});
  const orderById = orders.reduce<Record<string, (typeof orders)[number]>>((acc, order) => {
    acc[String(order.id || '')] = order;
    return acc;
  }, {});

  const orderIds = orders.map((o) => String(o.id || '')).filter(Boolean);
  const orderResults = orderIds.length
    ? await prisma.orderResult.findMany({
        where: { tenantId, orderId: { in: orderIds } },
      })
    : [];
  const resultAcks = orderResults.length
    ? await prisma.resultAck.findMany({
        where: { tenantId, orderResultId: { in: orderResults.map((r) => String(r.id || '')).filter(Boolean) } },
      })
    : [];
  const ackByResult = resultAcks.reduce<Record<string, typeof resultAcks>>((acc, ack) => {
    const key = String(ack.orderResultId || '');
    if (!acc[key]) acc[key] = [];
    acc[key].push(ack);
    return acc;
  }, {});

  const notes = await prisma.clinicalNote.findMany({
    where: { tenantId, patientMasterId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const identityAudits = await prisma.auditLog.findMany({
    where: { tenantId, resourceType: 'patient_master', resourceId: patientMasterId, action: 'GOV_IDENTITY_APPLIED' },
    orderBy: { timestamp: 'asc' },
    take: 100,
  });

  const tasks = encounterIds.length
    ? await prisma.clinicalTask.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds }, status: 'DONE' },
      })
    : [];

  const locks = encounterIds.length
    ? await prisma.billingLock.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const postings = encounterIds.length
    ? await prisma.billingPosting.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const lockByEncounter = locks.reduce<Record<string, (typeof locks)[number]>>((acc, lock) => {
    acc[String(lock.encounterCoreId || '')] = lock;
    return acc;
  }, {});
  const postingByEncounter = postings.reduce<Record<string, (typeof postings)[number]>>((acc, posting) => {
    acc[String(posting.encounterCoreId || '')] = posting;
    return acc;
  }, {});

  const activeEncounterCore = encounters
    .filter((enc) => enc.status === 'ACTIVE')
    .sort((a, b) => {
      const at = toDate(a.openedAt || a.createdAt)?.getTime() || 0;
      const bt = toDate(b.openedAt || b.createdAt)?.getTime() || 0;
      return bt - at;
    })[0] || null;
  const latestEncounterCore = encounters
    .slice()
    .sort((a, b) => {
      const at = toDate(a.openedAt || a.createdAt)?.getTime() || 0;
      const bt = toDate(b.openedAt || b.createdAt)?.getTime() || 0;
      return bt - at;
    })[0] || null;
  const focusEncounter = activeEncounterCore || latestEncounterCore || null;
  const focusEpisode = focusEncounter ? ipdByEncounter[String(focusEncounter.id || '')] : null;

  const encounterSummaries = encounters.map((encounter) => {
    const key = String(encounter.id || '');
    const discharge = dischargeByEncounter[key] as Record<string, unknown> | undefined;
    const death = deathByEncounter[key] as Record<string, unknown> | undefined;
    const outcome = discharge?.disposition || (death?.finalizedAt ? 'DECEASED' : null);
    return {
      encounterCoreId: encounter.id,
      encounterType: encounter.encounterType,
      status: encounter.status,
      openedAt: encounter.openedAt || encounter.createdAt,
      closedAt: encounter.closedAt || null,
      location: encounter.department || null,
      outcome,
      isActive: encounter.status === 'ACTIVE',
      deepLink: buildEncounterLink(encounter as Record<string, unknown>, ipdByEncounter[key] as Record<string, unknown> | undefined),
    };
  });

  const timeline: Array<{ id: string; ts: string; label: string; type: string; deepLink?: string }> = [];
  encounterSummaries.forEach((summary) => {
    if (summary.openedAt) {
      timeline.push({
        id: `enc-open-${summary.encounterCoreId}`,
        ts: new Date(summary.openedAt).toISOString(),
        label: `${summary.encounterType} encounter opened`,
        type: 'ENCOUNTER_OPENED',
        deepLink: summary.deepLink,
      });
    }
    if (summary.closedAt) {
      timeline.push({
        id: `enc-close-${summary.encounterCoreId}`,
        ts: new Date(summary.closedAt).toISOString(),
        label: `${summary.encounterType} encounter closed`,
        type: 'ENCOUNTER_CLOSED',
        deepLink: summary.deepLink,
      });
    }
  });

  notes.forEach((note) => {
    if (!note?.createdAt) return;
    const encounter = note.encounterCoreId
      ? encounters.find((e) => String(e.id || '') === String(note.encounterCoreId || ''))
      : null;
    timeline.push({
      id: `note-${note.id}`,
      ts: new Date(note.createdAt).toISOString(),
      label: `Clinical note: ${note.noteType || 'NOTE'}`,
      type: 'CLINICAL_NOTE',
      deepLink: encounter
        ? buildEncounterLink(encounter as Record<string, unknown>, ipdByEncounter[String(encounter.id || '')] as Record<string, unknown> | undefined)
        : `/patient/${patientMasterId}/journey#note-${note.id}`,
    });
  });

  orders.forEach((order) => {
    if (!order?.createdAt) return;
    const encounter = encounters.find((e) => String(e.id || '') === String(order.encounterCoreId || ''));
    timeline.push({
      id: `order-${order.id}`,
      ts: new Date(order.createdAt).toISOString(),
      label: `Order placed: ${order.orderName || order.orderCode || order.kind || 'ORDER'}`,
      type: 'ORDER_PLACED',
      deepLink: encounter ? buildEncounterLink(encounter as Record<string, unknown>, ipdByEncounter[String(encounter.id || '')] as Record<string, unknown> | undefined) : undefined,
    });
  });

  orderResults.forEach((result) => {
    if (!result?.createdAt) return;
    const order = orderById[String(result.orderId || '')];
    const encounter = order ? encounters.find((e) => String(e.id || '') === String(order.encounterCoreId || '')) : null;
    timeline.push({
      id: `result-${result.id}`,
      ts: new Date(result.createdAt).toISOString(),
      label: `Result ready: ${order?.orderName || order?.orderCode || 'ORDER'}`,
      type: 'RESULT_READY',
      deepLink: encounter ? buildEncounterLink(encounter as Record<string, unknown>, ipdByEncounter[String(encounter.id || '')] as Record<string, unknown> | undefined) : undefined,
    });
  });

  resultAcks.forEach((ack) => {
    if (!ack?.ackAt) return;
    const result = orderResults.find((r) => String(r.id || '') === String(ack.orderResultId || ''));
    const order = result ? orderById[String(result.orderId || '')] : null;
    const encounter = order ? encounters.find((e) => String(e.id || '') === String(order.encounterCoreId || '')) : null;
    timeline.push({
      id: `ack-${ack.id || ack.orderResultId}-${ack.userId || ''}`,
      ts: new Date(ack.ackAt).toISOString(),
      label: `Result acknowledged: ${order?.orderName || order?.orderCode || 'ORDER'}`,
      type: 'RESULT_ACK',
      deepLink: encounter ? buildEncounterLink(encounter as Record<string, unknown>, ipdByEncounter[String(encounter.id || '')] as Record<string, unknown> | undefined) : undefined,
    });
  });

  tasks.forEach((task) => {
    if (!task?.completedAt) return;
    const encounter = encounters.find((e) => String(e.id || '') === String(task.encounterCoreId || ''));
    timeline.push({
      id: `task-${task.id}`,
      ts: new Date(task.completedAt).toISOString(),
      label: `Task completed: ${task.title || task.taskType || 'TASK'}`,
      type: 'TASK_COMPLETED',
      deepLink: encounter ? buildEncounterLink(encounter as Record<string, unknown>, ipdByEncounter[String(encounter.id || '')] as Record<string, unknown> | undefined) : undefined,
    });
  });

  dischargeSummaries.forEach((summary) => {
    if (!summary?.createdAt) return;
    const encounter = encounters.find((e) => String(e.id || '') === String(summary.encounterCoreId || ''));
    timeline.push({
      id: `discharge-${summary.id || summary.encounterCoreId}`,
      ts: new Date(summary.createdAt).toISOString(),
      label: `Discharge finalized: ${summary.disposition || 'DISCHARGED'}`,
      type: 'DISCHARGE_FINALIZED',
      deepLink: encounter ? buildEncounterLink(encounter as Record<string, unknown>, ipdByEncounter[String(encounter.id || '')] as Record<string, unknown> | undefined) : undefined,
    });
  });

  deathDeclarations.forEach((death) => {
    if (!death?.createdAt) return;
    const encounter = encounters.find((e) => String(e.id || '') === String(death.encounterCoreId || ''));
    timeline.push({
      id: `death-${death.id || death.encounterCoreId}`,
      ts: new Date(death.createdAt).toISOString(),
      label: `Death declared`,
      type: 'DEATH_DECLARED',
      deepLink: encounter ? buildEncounterLink(encounter as Record<string, unknown>, ipdByEncounter[String(encounter.id || '')] as Record<string, unknown> | undefined) : undefined,
    });
    if (death.finalisedAt) {
      timeline.push({
        id: `death-final-${death.id || death.encounterCoreId}`,
        ts: new Date(death.finalisedAt).toISOString(),
        label: `Death finalized`,
        type: 'DEATH_FINALIZED',
        deepLink: encounter ? buildEncounterLink(encounter as Record<string, unknown>, ipdByEncounter[String(encounter.id || '')] as Record<string, unknown> | undefined) : undefined,
      });
    }
  });

  identityAudits.forEach((entry) => {
    if (!entry?.timestamp) return;
    const matchLevel = (entry?.metadata as Record<string, unknown>)?.matchLevel || 'UNKNOWN';
    timeline.push({
      id: `identity-${entry.id || entry.timestamp}`,
      ts: new Date(entry.timestamp).toISOString(),
      label: `Government identity applied (${matchLevel})`,
      type: 'IDENTITY_LOOKUP',
    });
  });

  timeline.sort((a, b) => {
    const at = new Date(a.ts).getTime();
    const bt = new Date(b.ts).getTime();
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  const focusEncounterId = focusEncounter ? String(focusEncounter.id || '') : '';
  const focusOrders = focusEncounterId ? ordersByEncounter[focusEncounterId] || [] : [];
  const focusOrderIds = focusOrders.map((o) => String(o.id || '')).filter(Boolean);
  const focusResults = orderResults.filter((r) => focusOrderIds.includes(String(r.orderId || '')));
  const pendingResultCount = focusResults.filter((r) => !(ackByResult[String(r.id || '')] || []).length).length;
  const activeOrdersCount = focusOrders.filter((o) => !['CANCELLED', 'COMPLETED'].includes(String(o.status || '').toUpperCase())).length;

  const latestNoteWithDx = [...notes]
    .reverse()
    .find((note) => {
      const meta = note?.metadata as Record<string, unknown> | null;
      return Array.isArray(meta?.diagnoses) && (meta.diagnoses as unknown[]).length;
    });

  const latestVitals = focusEpisode
    ? await prisma.ipdVitals.findMany({
        where: { tenantId, episodeId: String((focusEpisode as any).id || '') },
        orderBy: { recordedAt: 'desc' },
        take: 1,
      })
    : [];

  const clinicalSnapshot = {
    latestVitals: (latestVitals[0] as Record<string, unknown> | undefined)?.vitals || null,
    activeDiagnoses: ((latestNoteWithDx?.metadata as Record<string, unknown> | null)?.diagnoses) || [],
    activeOrdersCount,
    pendingResultsCount: pendingResultCount,
  };

  const billingEncounterId = focusEncounterId || (encounterIds[0] || '');
  let billingSnapshot = null;
  if (billingEncounterId) {
    const charges = await prisma.billingChargeEvent.findMany({
      where: { tenantId, encounterCoreId: billingEncounterId },
      take: 200,
    });
    const payments = await prisma.billingPayment.findMany({
      where: { tenantId, encounterCoreId: billingEncounterId },
      take: 200,
    });
    const totalCharges = charges
      .filter((c) => c.status === 'ACTIVE')
      .reduce((sum: number, c) => sum + Number(c.totalPrice || 0), 0);
    const totalPayments = payments
      .filter((p) => p.status === 'RECORDED')
      .reduce((sum: number, p) => sum + Number(p.amount || 0), 0);
    const lock = lockByEncounter[billingEncounterId] || null;
    const posting = postingByEncounter[billingEncounterId] || null;
    billingSnapshot = {
      encounterCoreId: billingEncounterId,
      totalCharges,
      totalPayments,
      balance: totalCharges - totalPayments,
      lockStatus: lock?.isLocked ? 'LOCKED' : 'UNLOCKED',
      postingStatus: posting?.status || 'DRAFT',
      statementLink: `/billing/statement?encounterCoreId=${encodeURIComponent(billingEncounterId)}`,
    };
  }

  const patientLinks = (patient as Record<string, unknown>)?.links as Array<Record<string, unknown>> | undefined;
  const mrn =
    patientLinks?.find((link) => link?.mrn)?.mrn ||
    patientLinks?.find((link) => link?.tempMrn)?.tempMrn ||
    null;

  const activeEncounter = activeEncounterCore
    ? {
        encounterCoreId: activeEncounterCore.id,
        encounterType: activeEncounterCore.encounterType,
        status: activeEncounterCore.status,
        openedAt: activeEncounterCore.openedAt || activeEncounterCore.createdAt,
        location: activeEncounterCore.department || null,
        deepLink: buildEncounterLink(activeEncounterCore as Record<string, unknown>, ipdByEncounter[String(activeEncounterCore.id || '')] as Record<string, unknown> | undefined),
      }
    : null;

  return NextResponse.json({
    patient,
    mrn,
    activeEncounter,
    encounters: encounterSummaries,
    timeline,
    clinicalSnapshot,
    billingSnapshot,
    deathFinalized,
  });
}, { resourceType: 'patient', extractPatientId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('patient-profile'); return idx >= 0 ? parts[idx + 1] || null : null; } }), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.master.view' });
