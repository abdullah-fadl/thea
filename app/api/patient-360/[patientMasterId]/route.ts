import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logPatientAccess } from '@/lib/audit/patientAccessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildEncounterLink(encounter: any, ipdEpisode?: any) {
  const type = String(encounter?.encounterType || '').toUpperCase();
  if (type === 'OPD') return `/opd/visit/${encodeURIComponent(encounter.id || '')}`;
  if (type === 'ER') return `/er/encounter/${encodeURIComponent(encounter?.source?.sourceId || encounter.id)}`;
  if (type === 'IPD') return `/ipd/episode/${encodeURIComponent(ipdEpisode?.id || encounter?.source?.sourceId || encounter.id)}`;
  return `/encounters/${encodeURIComponent(encounter.id || '')}`;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const resolved = params instanceof Promise ? await params : params;
  const patientMasterId = String((resolved as Record<string, string>)?.patientMasterId || '').trim();
  if (!patientMasterId) {
    return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
  }

  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientMasterId },
  });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  const patientRecord = patient as typeof patient & any;

  const encounters = await prisma.encounterCore.findMany({
    where: { tenantId, patientId: patientMasterId },
    orderBy: { createdAt: 'asc' },
  });
  const encounterIds = encounters.map((enc: any) => String(enc.id || '')).filter(Boolean);

  const ipdEpisodes = encounterIds.length
    ? await prisma.ipdEpisode.findMany({
        where: { tenantId, encounterId: { in: encounterIds } },
      })
    : [];
  const ipdByEncounter = ipdEpisodes.reduce<Record<string, any>>((acc, episode) => {
    acc[String(episode.encounterId || '')] = episode;
    return acc;
  }, {});

  const activeEncounter = encounters
    .filter((enc: any) => enc.status === 'ACTIVE')
    .sort((a: any, b: any) => {
      const at = toDate(a.openedAt || a.createdAt)?.getTime() || 0;
      const bt = toDate(b.openedAt || b.createdAt)?.getTime() || 0;
      return bt - at;
    })[0] || null;
  const activeEpisode = activeEncounter ? ipdByEncounter[String(activeEncounter.id || '')] : null;

  const mrn =
    (patientRecord.links as Array<any> | undefined)?.find((link) => link?.mrn)?.mrn ||
    (patientRecord.links as Array<any> | undefined)?.find((link) => link?.tempMrn)?.tempMrn ||
    null;

  const activeLocation = activeEpisode?.location || null;

  let isolationFlag = false;
  if (activeEncounter && String(activeEncounter.encounterType || '').toUpperCase() === 'ER') {
    const screening = await prisma.respiratoryScreening.findFirst({
      where: { tenantId, encounterId: activeEncounter.id },
      orderBy: { screenedAt: 'desc' },
    });
    isolationFlag = String((screening as Record<string, unknown> | null)?.result || '') === 'positive';
  }

  const deathDeclarations = encounterIds.length
    ? await prisma.deathDeclaration.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const deceased = deathDeclarations.some((item: any) => Boolean(item.finalizedAt));

  const openTasks = activeEncounter
    ? await prisma.clinicalTask.findMany({
        where: {
          tenantId,
          encounterCoreId: activeEncounter.id,
          status: { in: ['OPEN', 'CLAIMED', 'IN_PROGRESS'] },
        },
      })
    : [];

  let unackResultsCount = 0;
  if (activeEncounter) {
    const orders = await prisma.ordersHub.findMany({
      where: { tenantId, encounterCoreId: activeEncounter.id },
      select: { id: true },
    });
    const orderIds = orders.map((o: any) => String(o.id || '')).filter(Boolean);
    if (orderIds.length) {
      const results = await prisma.orderResult.findMany({
        where: { tenantId, orderId: { in: orderIds } },
        select: { id: true },
      });
      const resultIds = results.map((r: any) => String(r.id || '')).filter(Boolean);
      if (resultIds.length) {
        const acks = await prisma.resultAck.findMany({
          where: { tenantId, orderResultId: { in: resultIds } },
          select: { orderResultId: true },
        });
        const acked = new Set(acks.map((a: any) => String(a.orderResultId || '')).filter(Boolean));
        unackResultsCount = resultIds.filter((id) => !acked.has(id)).length;
      }
    }
  }

  const lastVitals = activeEpisode
    ? await prisma.ipdVitals.findFirst({
        where: { tenantId, episodeId: activeEpisode.id },
        orderBy: { recordedAt: 'desc' },
        select: { recordedAt: true },
      })
    : null;

  const timeline: any[] = [];
  encounters.forEach((enc: any) => {
    const openedAt = enc.openedAt || enc.createdAt;
    timeline.push({
      id: `encounter-open:${enc.id}`,
      label: `${enc.encounterType || 'Encounter'} opened`,
      createdAt: openedAt,
      type: 'ENCOUNTER_OPENED',
      deepLink: buildEncounterLink(enc, ipdByEncounter[String(enc.id || '')]),
    });
    if (enc.closedAt) {
      timeline.push({
        id: `encounter-close:${enc.id}`,
        label: `${enc.encounterType || 'Encounter'} closed`,
        createdAt: enc.closedAt,
        type: 'ENCOUNTER_CLOSED',
        deepLink: buildEncounterLink(enc, ipdByEncounter[String(enc.id || '')]),
      });
    }
  });
  ipdEpisodes.forEach((episode: any) => {
    timeline.push({
      id: `ipd-admit:${episode.id}`,
      label: 'IPD admission',
      createdAt: episode.createdAt,
      type: 'ADMISSION',
      deepLink: `/ipd/episode/${encodeURIComponent(episode.id || '')}`,
    });
  });

  const dischargeSummaries = encounterIds.length
    ? await prisma.dischargeSummary.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  dischargeSummaries.forEach((summary: any) => {
    timeline.push({
      id: `discharge:${summary.id}`,
      label: `Discharge finalized (${summary.disposition || '—'})`,
      createdAt: summary.createdAt,
      type: 'DISCHARGE',
    });
  });

  deathDeclarations.forEach((decl: any) => {
    if (decl.declaredAt) {
      timeline.push({
        id: `death-declared:${decl.id || decl.encounterCoreId}`,
        label: 'Death declared',
        createdAt: decl.declaredAt,
        type: 'DEATH',
      });
    }
    if (decl.finalizedAt) {
      timeline.push({
        id: `death-finalized:${decl.id || decl.encounterCoreId}`,
        label: 'Death finalized',
        createdAt: decl.finalizedAt,
        type: 'DEATH',
      });
    }
  });

  const notes = await prisma.clinicalNote.findMany({
    where: { tenantId, patientMasterId },
    orderBy: { createdAt: 'asc' },
  });
  notes.forEach((note: any) => {
    timeline.push({
      id: `note:${note.id}`,
      label: `Note: ${note.title || note.noteType || 'Clinical Note'}`,
      createdAt: note.createdAt,
      type: 'NOTE',
    });
  });

  const orders = encounterIds.length
    ? await prisma.ordersHub.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  orders.forEach((order: any) => {
    timeline.push({
      id: `order:${order.id}`,
      label: `Order: ${order.orderName || order.orderCode || order.kind || 'Order'}`,
      createdAt: order.createdAt,
      type: 'ORDER',
    });
  });

  const orderIds = orders.map((o: any) => String(o.id || '')).filter(Boolean);
  const results = orderIds.length
    ? await prisma.orderResult.findMany({
        where: { tenantId, orderId: { in: orderIds } },
      })
    : [];
  results.forEach((result: any) => {
    timeline.push({
      id: `result:${result.id}`,
      label: `Result: ${result.summary || result.resultType || 'Result'}`,
      createdAt: result.createdAt,
      type: 'RESULT',
      linkedOrderId: result.orderId,
    });
  });

  timeline.sort((a, b) => {
    const at = toDate(a.createdAt)?.getTime() || 0;
    const bt = toDate(b.createdAt)?.getTime() || 0;
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  // Fire-and-forget: log patient record access for HIPAA compliance
  logPatientAccess({
    tenantId,
    userId: userId || '',
    userRole: ((user as unknown as Record<string, unknown> | undefined)?.role as string) || '',
    patientId: patientMasterId,
    accessType: 'view',
    resourceType: 'patient_360',
    path: req.nextUrl?.pathname,
  });

  return NextResponse.json({
    banner: {
      name: [patient.firstName, patientRecord.middleName as string | undefined, patient.lastName].filter(Boolean).join(' ') || patient.fullName || 'Unknown',
      mrn,
      age: patient?.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : null,
      gender: patient.gender || '—',
      activeEncounterType: activeEncounter?.encounterType || null,
      location: activeLocation,
      flags: {
        isolation: isolationFlag,
        allergies: Array.isArray(activeEpisode?.allergies) ? activeEpisode?.allergies : [],
        deceased,
      },
    },
    snapshot: {
      currentEpisodeType: activeEncounter?.encounterType || null,
      currentBed: activeLocation?.bed || null,
      attendingDoctor: activeEpisode?.ownership?.attendingPhysicianUserId || activeEpisode?.admittingDoctorUserId || null,
      openTasksCount: openTasks.length,
      unackResultsCount,
      lastVitalsAt: lastVitals?.recordedAt || null,
    },
    timeline,
    links: {
      activeEncounter: activeEncounter ? buildEncounterLink(activeEncounter, activeEpisode) : null,
      ipdEpisode: activeEpisode ? `/ipd/episode/${encodeURIComponent(activeEpisode.id || '')}` : null,
      journey: `/patient/${encodeURIComponent(patientMasterId)}/journey`,
    },
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.master.view' });
