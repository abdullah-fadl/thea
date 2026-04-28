import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_STATUSES = ['OPEN', 'CLAIMED', 'IN_PROGRESS'];
const AREAS = new Set(['ER', 'OPD', 'IPD']);

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const area = String(params.get('area') || '').trim().toUpperCase();
  const statusParam = String(params.get('status') || '').trim();

  const statuses = statusParam
    ? statusParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_STATUSES;

  const filter: any = { tenantId, status: { in: statuses } };

  if (area && AREAS.has(area)) {
    const encounters = await prisma.encounterCore.findMany({
      where: { tenantId, encounterType: area as any },
      select: { id: true },
    });
    const encounterIds = encounters.map((e: any) => String(e.id || '')).filter(Boolean);
    if (!encounterIds.length) {
      return NextResponse.json({ items: [] });
    }
    filter.encounterCoreId = { in: encounterIds };
  }

  const tasks = await prisma.clinicalTask.findMany({
    where: filter,
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  const encounterIds = Array.from(new Set(tasks.map((t: any) => String(t.encounterCoreId || '')).filter(Boolean)));
  const encounters = encounterIds.length
    ? await prisma.encounterCore.findMany({
        where: { tenantId, id: { in: encounterIds } },
      })
    : [];
  const encounterById = encounters.reduce<Record<string, (typeof encounters)[0]>>((acc, enc) => {
    acc[String(enc.id || '')] = enc;
    return acc;
  }, {});

  const patientIds = Array.from(
    new Set(encounters.map((enc: any) => String(enc.patientId || '')).filter(Boolean))
  );
  const patients = patientIds.length
    ? await prisma.patientMaster.findMany({
        where: { tenantId, id: { in: patientIds } },
      })
    : [];
  const patientById = patients.reduce<Record<string, (typeof patients)[0]>>((acc, patient) => {
    acc[String(patient.id || '')] = patient;
    return acc;
  }, {});

  const ipdEpisodes = encounterIds.length
    ? await prisma.ipdEpisode.findMany({
        where: { tenantId, encounterId: { in: encounterIds } },
      })
    : [];
  const ipdByEncounter = ipdEpisodes.reduce<Record<string, (typeof ipdEpisodes)[0]>>((acc, episode) => {
    acc[String(episode.encounterId || '')] = episode;
    return acc;
  }, {});

  const items = tasks.map((task: any) => {
    const encounter = encounterById[String(task.encounterCoreId || '')];
    const patient = patientById[String(encounter?.patientId || '')];
    const encounterType = String(encounter?.encounterType || '').toUpperCase();
    const deepLink =
      encounterType === 'ER'
        ? `/er/encounter/${encodeURIComponent(encounter?.id || '')}`
        : encounterType === 'OPD'
        ? `/opd/visit/${encodeURIComponent(encounter?.id || '')}`
        : encounterType === 'IPD'
        ? `/ipd/episode/${ipdByEncounter[encounter?.id || '']?.id || ''}`
        : null;
    return {
      task,
      encounterType: encounterType || null,
      patient: patient || null,
      deepLink,
    };
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'tasks.queue.view' }
);
