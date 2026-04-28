import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { normalizeIdentifier, normalizeName } from '@/lib/hospital/patientMaster';
import { rateLimitSearch, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageFromDob(dob: unknown): number | null {
  const date = safeDate(dob);
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function nameScore(queryNormalized: string, targetNormalized: string) {
  if (!queryNormalized || !targetNormalized) return 0;
  if (queryNormalized === targetNormalized) return 3;
  if (targetNormalized.includes(queryNormalized)) return 2;
  const queryTokens = new Set(queryNormalized.split(' ').filter(Boolean));
  const targetTokens = new Set(targetNormalized.split(' ').filter(Boolean));
  let overlap = 0;
  queryTokens.forEach((token) => {
    if (targetTokens.has(token)) overlap += 1;
  });
  return overlap ? 1 : 0;
}

function buildEncounterLink(encounterType: string, encounterId: string, episodeId?: string | null) {
  if (!encounterId) return null;
  const type = String(encounterType || '').toUpperCase();
  if (type === 'ER') return `/er/encounter/${encounterId}`;
  if (type === 'OPD') return `/opd/visit/${encounterId}`;
  if (type === 'IPD') return `/ipd/episode/${episodeId || encounterId}`;
  return null;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const rl = await rateLimitSearch({ ip: getRequestIp(req), userId });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const q = String(req.nextUrl.searchParams.get('q') || '').trim();
  const includeMerged = String(req.nextUrl.searchParams.get('includeMerged') || '').toLowerCase() === 'true';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 20), 50);

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const normalizedName = normalizeName(q);
  const identifier = normalizeIdentifier(q);

  // Build Prisma OR conditions for patient search
  const orConditions: Record<string, unknown>[] = [];
  if (UUID_RE.test(q)) {
    orConditions.push({ id: q });
  }
  if (identifier) {
    orConditions.push({ nationalId: identifier });
    orConditions.push({ iqama: identifier });
    orConditions.push({ passport: identifier });
    orConditions.push({ mrn: identifier });
  }
  if (normalizedName) {
    orConditions.push({ nameNormalized: { contains: normalizedName, mode: 'insensitive' as const } });
  }
  if (orConditions.length === 0) {
    orConditions.push({ fullName: { contains: q, mode: 'insensitive' as const } });
    orConditions.push({ mrn: { contains: q, mode: 'insensitive' as const } });
  }

  const patientFilter: Record<string, unknown> = {
    tenantId,
    OR: orConditions,
  };
  if (!includeMerged) {
    patientFilter.status = { not: 'MERGED' };
  }

  const patientMatches = await prisma.patientMaster.findMany({
    where: patientFilter,
    take: 60,
  });

  const patientIds = patientMatches.map((p: Record<string, unknown>) => String(p.id || '')).filter(Boolean);

  const encounters = patientIds.length
    ? await prisma.encounterCore.findMany({
        where: { tenantId, patientId: { in: patientIds } },
        orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
      })
    : [];

  const encounterIds = encounters.map((e: Record<string, unknown>) => String(e.id || '')).filter(Boolean);

  const ipdEpisodes = encounterIds.length
    ? await prisma.ipdEpisode.findMany({
        where: { tenantId, encounterId: { in: encounterIds } },
      })
    : [];
  const ipdByEncounter = ipdEpisodes.reduce<any>((acc, episode) => {
    acc[String((episode as Record<string, unknown>).encounterId || '')] = episode;
    return acc;
  }, {});

  const deathDeclarations = encounterIds.length
    ? await prisma.deathDeclaration.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const deathEncounterIds = new Set(
    deathDeclarations.filter((d: Record<string, unknown>) => Boolean(d.finalizedAt)).map((d: Record<string, unknown>) => String(d.encounterCoreId || ''))
  );

  const activeEncounterByPatient = encounters.reduce<Record<string, Record<string, unknown>>>((acc, encounter: Record<string, unknown>) => {
    if (encounter.status !== 'ACTIVE') return acc;
    const key = String(encounter.patientId || '');
    const current = acc[key];
    const currentTime = safeDate(current?.openedAt || current?.createdAt)?.getTime() || 0;
    const nextTime = safeDate(encounter.openedAt || encounter.createdAt)?.getTime() || 0;
    if (!current || nextTime >= currentTime) acc[key] = encounter;
    return acc;
  }, {});

  const lastSeenByPatient = encounters.reduce<Record<string, number>>((acc, encounter: Record<string, unknown>) => {
    const key = String(encounter.patientId || '');
    const candidates = [encounter.updatedAt, encounter.closedAt, encounter.openedAt, encounter.createdAt]
      .map((d) => safeDate(d)?.getTime() || 0);
    const lastSeen = Math.max(...candidates);
    acc[key] = Math.max(acc[key] || 0, lastSeen);
    return acc;
  }, {});

  // ER encounter search: find active ER encounters for patients not already in main results
  const erEncounterMatches = patientIds.length
    ? await prisma.erEncounter.findMany({
        where: { tenantId, patientId: { in: patientIds } },
        orderBy: { startedAt: 'desc' },
      })
    : [];
  const erEncounterByPatient = erEncounterMatches.reduce<Record<string, Record<string, unknown>>>((acc, enc: Record<string, unknown>) => {
    const key = String(enc.patientId || '');
    if (!acc[key]) acc[key] = enc;
    return acc;
  }, {});

  const items: Array<Record<string, unknown> & { _rank: { exact: number; active: number; lastSeen: number; nameScore: number } }> = [];
  patientMatches.forEach((patient: Record<string, unknown>) => {
    const patientId = String(patient.id || '');
    const activeEncounter = activeEncounterByPatient[patientId] || null;
    const activeEncounterType = activeEncounter?.encounterType || null;
    const ipdEpisode = activeEncounter ? ipdByEncounter[String(activeEncounter.id || '')] : null;
    const lastSeenAtMs = lastSeenByPatient[patientId] || 0;
    const isDeceased = encounters.some((e: Record<string, unknown>) => deathEncounterIds.has(String(e.id || '')) && String(e.patientId || '') === patientId);

    const identifiers = (patient.identifiers || {}) as Record<string, unknown>;
    const links = Array.isArray(patient.links) ? patient.links : [];

    const identifierMatch =
      (identifier && [
        identifiers?.nationalId || patient.nationalId,
        identifiers?.iqama || patient.iqama,
        identifiers?.passport || patient.passport,
      ].some((id: unknown) => normalizeIdentifier(id as string) === identifier)) ||
      (identifier && links.some((link: Record<string, unknown>) => normalizeIdentifier(link?.mrn as string) === identifier)) ||
      (identifier && links.some((link: Record<string, unknown>) => normalizeIdentifier(link?.tempMrn as string) === identifier)) ||
      String(patient.id || '') === q;

    const score = nameScore(normalizedName, String(patient.nameNormalized || ''));
    const matchReason = identifierMatch
      ? 'EXACT_ID'
      : score >= 2
      ? 'PARTIAL_NAME'
      : score === 1
      ? 'FUZZY'
      : 'PARTIAL_NAME';

    const mrn =
      links.find((link: Record<string, unknown>) => link?.mrn)?.mrn ||
      links.find((link: Record<string, unknown>) => link?.tempMrn)?.tempMrn ||
      patient.mrn ||
      null;

    // Check if this patient has an active ER encounter
    const erEnc = erEncounterByPatient[patientId] || null;
    const hasActiveEr = erEnc && String(erEnc.status || '') !== 'DISCHARGED' && String(erEnc.status || '') !== 'CLOSED';

    items.push({
      patientMasterId: patientId,
      fullName: patient.fullName || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unknown',
      dob: patient.dob || null,
      identifiers: {
        mrn,
        tempMrn: links.find((link: Record<string, unknown>) => link?.tempMrn)?.tempMrn || null,
        nationalId: identifiers?.nationalId || patient.nationalId || null,
        iqama: identifiers?.iqama || patient.iqama || null,
        passport: identifiers?.passport || patient.passport || null,
      },
      age: ageFromDob(patient.dob),
      gender: patient.gender || null,
      statusBadges: [
        isDeceased ? 'DECEASED' : null,
        patient.status === 'MERGED' ? 'MERGED' : null,
        activeEncounter ? 'ACTIVE_ENCOUNTER' : null,
        activeEncounterType ? String(activeEncounterType).toUpperCase() : null,
        hasActiveEr ? 'ER' : null,
      ].filter(Boolean),
      activeEncounter: activeEncounter
        ? {
            encounterType: String(activeEncounter.encounterType || ''),
            encounterId: String(activeEncounter.id || ''),
            lastSeenAt: lastSeenAtMs ? new Date(lastSeenAtMs).toISOString() : null,
            link: buildEncounterLink(String(activeEncounter.encounterType || ''), String(activeEncounter.id || ''), (ipdEpisode?.id as string) || null),
          }
        : null,
      matchReason,
      lastSeenAt: lastSeenAtMs ? new Date(lastSeenAtMs).toISOString() : null,
      _rank: {
        exact: identifierMatch ? 1 : 0,
        active: activeEncounter ? 1 : 0,
        lastSeen: lastSeenAtMs || 0,
        nameScore: score,
      },
    } as any);
  });

  items.sort((a, b) => {
    if (a._rank.exact !== b._rank.exact) return b._rank.exact - a._rank.exact;
    if (a._rank.active !== b._rank.active) return b._rank.active - a._rank.active;
    if (a._rank.lastSeen !== b._rank.lastSeen) return b._rank.lastSeen - a._rank.lastSeen;
    if (a._rank.nameScore !== b._rank.nameScore) return b._rank.nameScore - a._rank.nameScore;
    return String(a.patientMasterId || a.fullName || '').localeCompare(String(b.patientMasterId || b.fullName || ''));
  });

  const trimmed = items.slice(0, limit).map((item) => {
    const { _rank, ...rest } = item;
    return rest;
  });

  return NextResponse.json({ items: trimmed });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.search.view' }
);
