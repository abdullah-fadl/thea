import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type JourneyItem = {
  id: string;
  type: 'registration' | 'er' | 'opd' | 'ipd' | 'order' | 'result' | 'note' | 'discharge' | 'death' | 'billing';
  ts: Date;
  status: string;
  label: string;
  encounterCoreId?: string | null;
  episodeId?: string | null;
  deepLink?: string | null;
  source?: string | null;
  linkedNoteId?: string | null;
  noteId?: string | null;
  orderId?: string | null;
  resultId?: string | null;
};

function toDate(value: unknown, fallback?: Date): Date {
  const d = value ? new Date(value as any) : null;
  if (d && Number.isFinite(d.getTime())) return d;
  return fallback || new Date(0);
}

function uniqueItems(items: JourneyItem[]): JourneyItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [
      item.type,
      item.encounterCoreId || '',
      item.episodeId || '',
      item.ts ? item.ts.toISOString() : '',
      item.status || '',
      item.label || '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const GET = withAuthTenant(async (req: NextRequest, { tenantId }, params: any) => {
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
  const encounterById = encounters.reduce<Record<string, any>>((acc, enc) => {
    acc[String(enc.id || '')] = enc;
    return acc;
  }, {});

  const opdEncounters = encounterIds.length
    ? await prisma.opdEncounter.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const opdByEncounter = opdEncounters.reduce<Record<string, any>>((acc, opd) => {
    acc[String(opd.encounterCoreId || '')] = opd;
    return acc;
  }, {});

  const ipdEpisodes = encounterIds.length
    ? await prisma.ipdEpisode.findMany({
        where: { tenantId, encounterId: { in: encounterIds } },
      })
    : [];
  const ipdByEncounter = ipdEpisodes.reduce<Record<string, any>>((acc, episode) => {
    acc[String(episode.encounterId || '')] = episode;
    return acc;
  }, {});

  const orders = encounterIds.length
    ? await prisma.ordersHub.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];

  const orderIds = orders.map((o) => o.id).filter(Boolean);
  const orderResults = orderIds.length
    ? await prisma.orderResult.findMany({
        where: { tenantId, orderId: { in: orderIds } },
      })
    : [];

  const orderLinks = encounterIds.length
    ? await prisma.orderContextLink.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const linkByOrderId = orderLinks.reduce<Record<string, any>>((acc, link) => {
    acc[String(link.orderId || '')] = link;
    return acc;
  }, {});

  const clinicalNotes = await prisma.clinicalNote.findMany({
    where: { tenantId, patientMasterId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const discharges = encounterIds.length
    ? await prisma.dischargeSummary.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const dischargeByEncounter = discharges.reduce<Record<string, any>>((acc, item) => {
    const key = String(item.encounterCoreId || '');
    if (!acc[key] || new Date(acc[key].createdAt).getTime() < new Date(item.createdAt).getTime()) {
      acc[key] = item;
    }
    return acc;
  }, {});

  const deathDeclarations = encounterIds.length
    ? await prisma.deathDeclaration.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const deathByEncounter = deathDeclarations.reduce<Record<string, any>>((acc, item) => {
    acc[String(item.encounterCoreId || '')] = item;
    return acc;
  }, {});

  const mortuaryCases = encounterIds.length
    ? await prisma.mortuaryCase.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const mortuaryByEncounter = mortuaryCases.reduce<Record<string, any>>((acc, item) => {
    acc[String(item.encounterCoreId || '')] = item;
    return acc;
  }, {});

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
  const payments = encounterIds.length
    ? await prisma.billingPayment.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const lockByEncounter = locks.reduce<Record<string, any>>((acc, item) => {
    acc[String(item.encounterCoreId || '')] = item;
    return acc;
  }, {});
  const postingByEncounter = postings.reduce<Record<string, any>>((acc, item) => {
    acc[String(item.encounterCoreId || '')] = item;
    return acc;
  }, {});
  const paymentsByEncounter = payments.reduce<Record<string, typeof payments>>((acc, item) => {
    const key = String(item.encounterCoreId || '');
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // ER patient records via Prisma (replaces getErCollections)
  const erPatientRecords = await prisma.erPatient.findMany({
    where: { tenantId, patientMasterId },
    take: 100,
  });
  const erPatientIds = erPatientRecords.map((p) => String(p.id || '')).filter(Boolean);
  const erEncounterRecords = erPatientIds.length
    ? await prisma.erEncounter.findMany({
        where: { tenantId, patientId: { in: erPatientIds } },
        orderBy: { startedAt: 'asc' },
      })
    : [];

  const identityAudits = await prisma.auditLog.findMany({
    where: {
      tenantId,
      resourceType: 'patient_master',
      resourceId: patientMasterId,
      action: 'GOV_IDENTITY_APPLIED',
    },
    select: { id: true, timestamp: true, metadata: true },
    orderBy: { timestamp: 'asc' },
    take: 100,
  });

  const timeline: JourneyItem[] = [];

  const registrationTs = toDate(patient.createdAt, new Date());
  timeline.push({
    id: `registration-${patientMasterId}`,
    type: 'registration',
    ts: registrationTs,
    status: (patient as Record<string, unknown>).status as string || 'KNOWN',
    label: 'Registration',
    encounterCoreId: null,
    episodeId: null,
    deepLink: `/registration?patientMasterId=${encodeURIComponent(patientMasterId)}`,
    source: 'patient_master',
  });

  identityAudits.forEach((entry) => {
    if (!entry?.timestamp) return;
    const matchLevel = (entry?.metadata as Record<string, unknown>)?.matchLevel || 'UNKNOWN';
    timeline.push({
      id: `identity-${entry.id || entry.timestamp}`,
      type: 'registration',
      ts: toDate(entry.timestamp, new Date()),
      status: String(matchLevel),
      label: `Government identity applied (${matchLevel})`,
      encounterCoreId: null,
      episodeId: null,
      deepLink: `/patient/${encodeURIComponent(patientMasterId)}`,
      source: 'audit_logs',
    });
  });

  encounters.forEach((encounter) => {
    const encounterId = String(encounter.id || '');
    const encounterType = String(encounter.encounterType || 'UNKNOWN').toUpperCase();
    const openedAt = encounter.openedAt || encounter.createdAt;
    timeline.push({
      id: `encounter-${encounterId}`,
      type: encounterType === 'ER' ? 'er' : encounterType === 'OPD' ? 'opd' : encounterType === 'IPD' ? 'ipd' : 'opd',
      ts: toDate(openedAt, new Date()),
      status: encounter.status || 'ACTIVE',
      label: `${encounterType} encounter opened`,
      encounterCoreId: encounterId,
      deepLink:
        encounterType === 'ER'
          ? `/er/encounter/${encounterId}`
          : encounterType === 'OPD'
          ? `/opd/visit/${encounterId}`
          : encounterType === 'IPD'
          ? `/ipd/episode/${ipdByEncounter[encounterId]?.id || ''}`
          : null,
      source: 'encounter_core',
    });

    if (encounter.closedAt) {
      timeline.push({
        id: `encounter-close-${encounterId}`,
        type: encounterType === 'ER' ? 'er' : encounterType === 'OPD' ? 'opd' : encounterType === 'IPD' ? 'ipd' : 'opd',
        ts: toDate(encounter.closedAt, new Date()),
        status: 'CLOSED',
        label: `${encounterType} encounter closed`,
        encounterCoreId: encounterId,
        deepLink:
          encounterType === 'ER'
            ? `/er/encounter/${encounterId}`
            : encounterType === 'OPD'
            ? `/opd/visit/${encounterId}`
            : encounterType === 'IPD'
            ? `/ipd/episode/${ipdByEncounter[encounterId]?.id || ''}`
            : null,
        source: 'encounter_core',
      });
    }

    const opd = opdByEncounter[encounterId];
    if (opd) {
      timeline.push({
        id: `opd-${encounterId}`,
        type: 'opd',
        ts: toDate(opd.createdAt, toDate(openedAt)),
        status: opd.status || 'OPEN',
        label: `OPD visit ${opd.status || ''}`.trim(),
        encounterCoreId: encounterId,
        deepLink: `/opd/visit/${encounterId}`,
        source: 'opd_encounters',
      });
    }

    const ipd = ipdByEncounter[encounterId];
    if (ipd) {
      timeline.push({
        id: `ipd-${ipd.id}`,
        type: 'ipd',
        ts: toDate(ipd.admittedAt || ipd.createdAt, toDate(openedAt)),
        status: ipd.status || 'ADMITTED',
        label: `IPD episode ${ipd.status || ''}`.trim(),
        encounterCoreId: encounterId,
        episodeId: String(ipd.id || ''),
        deepLink: `/ipd/episode/${ipd.id}`,
        source: 'ipd_episodes',
      });
    }

    const discharge = dischargeByEncounter[encounterId];
    if (discharge) {
      timeline.push({
        id: `discharge-${encounterId}`,
        type: 'discharge',
        ts: toDate(discharge.createdAt, new Date()),
        status: discharge.disposition || 'DISCHARGED',
        label: `Discharge finalized (${discharge.disposition || 'DISCHARGED'})`,
        encounterCoreId: encounterId,
        deepLink:
          encounterType === 'ER'
            ? `/er/encounter/${encounterId}`
            : encounterType === 'OPD'
            ? `/opd/visit/${encounterId}`
            : encounterType === 'IPD'
            ? `/ipd/episode/${ipdByEncounter[encounterId]?.id || ''}`
            : null,
        source: 'discharge_summary',
      });
    }

    const death = deathByEncounter[encounterId];
    if (death) {
      timeline.push({
        id: `death-${encounterId}`,
        type: 'death',
        ts: toDate(death.declaredAt || death.createdAt, new Date()),
        status: death.finalizedAt ? 'FINALIZED' : 'DECLARED',
        label: `Death ${death.finalizedAt ? 'finalized' : 'declared'}`,
        encounterCoreId: encounterId,
        deepLink:
          mortuaryByEncounter[encounterId]?.id
            ? `/mortuary/${mortuaryByEncounter[encounterId].id}`
            : encounterType === 'ER'
            ? `/er/encounter/${encounterId}`
            : encounterType === 'OPD'
            ? `/opd/visit/${encounterId}`
            : encounterType === 'IPD'
            ? `/ipd/episode/${ipdByEncounter[encounterId]?.id || ''}`
            : null,
        source: 'death_declarations',
      });
    }

    const lock = lockByEncounter[encounterId];
    if (lock?.isLocked) {
      timeline.push({
        id: `billing-lock-${encounterId}`,
        type: 'billing',
        ts: toDate(lock.lockedAt, new Date()),
        status: 'LOCKED',
        label: 'Billing locked',
        encounterCoreId: encounterId,
        deepLink: `/billing/statement?encounterCoreId=${encodeURIComponent(encounterId)}`,
        source: 'billing_lock',
      });
    }

    const posting = postingByEncounter[encounterId];
    if (posting?.status === 'POSTED') {
      timeline.push({
        id: `billing-post-${encounterId}`,
        type: 'billing',
        ts: toDate(posting.postedAt, new Date()),
        status: 'POSTED',
        label: 'Billing posted',
        encounterCoreId: encounterId,
        deepLink: `/billing/statement?encounterCoreId=${encodeURIComponent(encounterId)}`,
        source: 'billing_posting',
      });
    }

    const paymentEvents = paymentsByEncounter[encounterId] || [];
    if (paymentEvents.length) {
      const paidTotal = paymentEvents
        .filter((p) => String(p.status || '').toUpperCase() === 'RECORDED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      timeline.push({
        id: `billing-payment-${encounterId}`,
        type: 'billing',
        ts: toDate(paymentEvents[0]?.createdAt, new Date()),
        status: paidTotal > 0 ? 'PAYMENT_RECORDED' : 'PAYMENT',
        label: paidTotal > 0 ? `Payment recorded (${paidTotal})` : 'Payment',
        encounterCoreId: encounterId,
        deepLink: `/billing/payments?encounterCoreId=${encodeURIComponent(encounterId)}`,
        source: 'billing_payments',
      });
    }
  });

  orders.forEach((order) => {
    const encounterCoreId = String(order.encounterCoreId || '');
    const link = linkByOrderId[String(order.id || '')] || null;
    timeline.push({
      id: `order-${order.id || ''}`,
      type: 'order',
      ts: toDate(order.createdAt || (order as any).requestedAt, new Date()),
      status: order.status || 'PLACED',
      label: `${order.kind || 'Order'}: ${order.orderName || order.orderCode || 'Unnamed'}`,
      encounterCoreId,
      deepLink: `/opd/visit/${encodeURIComponent(encounterCoreId)}`,
      source: 'orders_hub',
      linkedNoteId: link?.noteId || null,
      orderId: order.id || null,
    });
  });

  orderResults.forEach((result) => {
    const encounterCoreId = String((result as any).encounterCoreId || '');
    const encounterType = String(encounterById[encounterCoreId]?.encounterType || '').toUpperCase();
    const deepLink =
      encounterType === 'ER'
        ? `/er/encounter/${encodeURIComponent(encounterCoreId)}`
        : encounterType === 'OPD'
        ? `/opd/visit/${encodeURIComponent(encounterCoreId)}`
        : encounterType === 'IPD'
        ? `/ipd/episode/${ipdByEncounter[encounterCoreId]?.id || ''}`
        : encounterCoreId
        ? `/opd/visit/${encodeURIComponent(encounterCoreId)}`
        : null;
    timeline.push({
      id: `result-${result.id || ''}`,
      type: 'result',
      ts: toDate(result.createdAt, new Date()),
      status: result.status || 'RESULT_READY',
      label: `Result: ${result.summary || result.resultType || 'Result'}`,
      encounterCoreId,
      deepLink,
      source: 'order_results',
      orderId: result.orderId || null,
      resultId: result.id || null,
    });
  });

  clinicalNotes.forEach((note) => {
    const encounterCoreId = String(note.encounterCoreId || '');
    const area = String(note.area || note.noteType || 'NOTE').toUpperCase();
    const encounterType = String(encounterById[encounterCoreId]?.encounterType || '').toUpperCase();
    const deepLink =
      encounterType === 'ER'
        ? `/er/encounter/${encodeURIComponent(encounterCoreId)}`
        : encounterType === 'OPD'
        ? `/opd/visit/${encodeURIComponent(encounterCoreId)}`
        : encounterType === 'IPD'
        ? `/ipd/episode/${ipdByEncounter[encounterCoreId]?.id || ''}`
        : encounterCoreId
        ? `/opd/visit/${encodeURIComponent(encounterCoreId)}`
        : null;
    timeline.push({
      id: `note-${note.id || ''}`,
      type: 'note',
      ts: toDate(note.createdAt, new Date()),
      status: note.noteType || area,
      label: note.title ? `Note: ${note.title}` : `Note: ${note.noteType || area}`,
      encounterCoreId,
      deepLink,
      source: 'clinical_notes',
      noteId: note.id || null,
    });
  });

  erEncounterRecords.forEach((encounter) => {
    timeline.push({
      id: `er-status-${encounter.id || ''}`,
      type: 'er',
      ts: toDate(encounter.startedAt || encounter.updatedAt, new Date()),
      status: encounter.status || 'UNKNOWN',
      label: `ER status: ${encounter.status || 'UNKNOWN'}`,
      encounterCoreId: null,
      deepLink: encounter?.id ? `/er/encounter/${encounter.id}` : null,
      source: 'er_encounters',
    });
  });

  const uniqueTimeline = uniqueItems(timeline).sort((a, b) => {
    const diff = new Date(a.ts).getTime() - new Date(b.ts).getTime();
    if (diff !== 0) return diff;
    return String(a.label || '').localeCompare(String(b.label || ''));
  });

  const deathFinalized = deathDeclarations.some((item) => Boolean(item.finalisedAt));

  const latestEncounter = encounters.length ? encounters[encounters.length - 1] : null;
  const lastEncounterId = String(latestEncounter?.id || '');
  const lastEncounterType = String(latestEncounter?.encounterType || '').toUpperCase();
  const lastEncounterStatus = String(latestEncounter?.status || '');
  const lastOpd = lastEncounterId ? opdByEncounter[lastEncounterId] : null;
  const lastIpd = lastEncounterId ? ipdByEncounter[lastEncounterId] : null;
  const lastEr = erEncounterRecords.length ? erEncounterRecords[erEncounterRecords.length - 1] : null;

  const currentStatus = deathFinalized
    ? 'DECEASED'
    : lastEncounterStatus === 'ACTIVE' && lastEncounterType === 'ER'
    ? 'IN_ER'
    : lastEncounterStatus === 'ACTIVE' && lastEncounterType === 'OPD'
    ? 'ACTIVE_OPD'
    : lastEncounterStatus === 'ACTIVE' && lastEncounterType === 'IPD'
    ? 'ADMITTED_IPD'
    : lastEncounterStatus === 'CLOSED'
    ? 'DISCHARGED'
    : lastEncounterStatus || 'UNKNOWN';

  const lastLocation = lastEncounterType || 'UNKNOWN';
  const lastDepartment =
    lastEncounterType === 'ER'
      ? 'ER'
      : lastEncounterType === 'OPD'
      ? 'OPD'
      : lastEncounterType === 'IPD'
      ? 'IPD'
      : 'UNKNOWN';
  const lastDoctor =
    lastEncounterType === 'OPD'
      ? String(lastOpd?.primaryDoctorUserId || '')
      : lastEncounterType === 'IPD'
      ? String(lastIpd?.ownership?.attendingPhysicianUserId || '')
      : lastEncounterType === 'ER'
      ? String((lastEr as Record<string, unknown>)?.createdByUserId || '')
      : '';

  const lock = lastEncounterId ? lockByEncounter[lastEncounterId] : null;
  const posting = lastEncounterId ? postingByEncounter[lastEncounterId] : null;
  const paymentEvents = lastEncounterId ? paymentsByEncounter[lastEncounterId] || [] : [];
  const paidTotal = paymentEvents
    .filter((p) => String(p.status || '').toUpperCase() === 'RECORDED')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const billingState = posting?.status === 'POSTED'
    ? paidTotal > 0
      ? 'POSTED_PAID'
      : 'POSTED'
    : lock?.isLocked
    ? 'LOCKED'
    : 'READY_OR_DRAFT';

  return NextResponse.json({
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dob: patient.dob,
      gender: patient.gender,
    },
    timeline: uniqueTimeline,
    summary: {
      currentStatus,
      lastLocation,
      lastDepartment,
      lastDoctor: lastDoctor || null,
      billingState,
      deathFinalized,
      identityVerification: (patient as Record<string, unknown>).identityVerification || null,
    },
  });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.master.view' });
