import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import type { Prisma } from '@prisma/client';
import {
  buildPatientMasterRecord,
  mapPatientInputFromEr,
  normalizeIdentifier,
  type PatientMasterInput,
} from '@/lib/hospital/patientMaster';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CLOSED_ER_STATUSES = ['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'CANCELLED'];

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const tokens = String(fullName || '').trim().split(' ').filter(Boolean);
  const firstName = tokens.shift() || 'Unknown';
  return { firstName, lastName: tokens.join(' ') };
}

async function ensurePatientFromEr(args: {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  erPatient: any;
}) {
  const identifiers = {
    nationalId: normalizeIdentifier(args.erPatient?.nationalId),
    iqama: normalizeIdentifier(args.erPatient?.iqama),
    passport: normalizeIdentifier(args.erPatient?.passport),
  };

  const orConditions: Prisma.PatientMasterWhereInput[] = [
    { links: { path: '$', array_contains: [{ system: 'ER', patientId: String(args.erPatient?.id || '') }] } as any },
  ];
  if (identifiers.nationalId) orConditions.push({ identifiers: { path: ['nationalId'], equals: identifiers.nationalId } });
  if (identifiers.iqama) orConditions.push({ identifiers: { path: ['iqama'], equals: identifiers.iqama } });
  if (identifiers.passport) orConditions.push({ identifiers: { path: ['passport'], equals: identifiers.passport } });

  // Try simple identifier match first
  const simpleOrConditions: Prisma.PatientMasterWhereInput[] = [];
  if (identifiers.nationalId) simpleOrConditions.push({ identifiers: { path: ['nationalId'], equals: identifiers.nationalId } });
  if (identifiers.iqama) simpleOrConditions.push({ identifiers: { path: ['iqama'], equals: identifiers.iqama } });
  if (identifiers.passport) simpleOrConditions.push({ identifiers: { path: ['passport'], equals: identifiers.passport } });

  const existing = simpleOrConditions.length
    ? await prisma.patientMaster.findFirst({
        where: { tenantId: args.tenantId, OR: simpleOrConditions },
      })
    : null;
  if (existing) return existing;

  const input = mapPatientInputFromEr(args.erPatient);
  const record = buildPatientMasterRecord(args.tenantId, args.userId, input);
  const created = await prisma.patientMaster.create({ data: record as unknown as Prisma.PatientMasterUncheckedCreateInput });
  await createAuditLog(
    'patient_master',
    created.id,
    'CREATE',
    args.userId || 'system',
    args.userEmail,
    { after: created, source: 'ER' },
    args.tenantId
  );
  return created;
}

async function ensurePatientFromIpd(args: {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  ipdEpisode: any;
}) {
  const episodePatient = (args.ipdEpisode?.patient as Record<string, unknown>) || {};
  const identifiers = {
    nationalId: normalizeIdentifier(episodePatient?.nationalId as string),
    iqama: normalizeIdentifier(episodePatient?.iqama as string),
    passport: normalizeIdentifier(episodePatient?.passport as string),
  };

  const linkId = String(episodePatient?.id || args.ipdEpisode?.id || '');
  const simpleOrConditions: Prisma.PatientMasterWhereInput[] = [];
  if (identifiers.nationalId) simpleOrConditions.push({ identifiers: { path: ['nationalId'], equals: identifiers.nationalId } });
  if (identifiers.iqama) simpleOrConditions.push({ identifiers: { path: ['iqama'], equals: identifiers.iqama } });
  if (identifiers.passport) simpleOrConditions.push({ identifiers: { path: ['passport'], equals: identifiers.passport } });

  const existing = simpleOrConditions.length
    ? await prisma.patientMaster.findFirst({
        where: { tenantId: args.tenantId, OR: simpleOrConditions },
      })
    : null;
  if (existing) return existing;

  const namePayload = episodePatient?.fullName
    ? splitFullName(episodePatient.fullName as string)
    : {
        firstName: String(episodePatient?.firstName || 'Unknown'),
        lastName: String(episodePatient?.lastName || ''),
      };

  const input: PatientMasterInput = {
    firstName: namePayload.firstName,
    lastName: namePayload.lastName,
    dob: episodePatient?.dob ? new Date(episodePatient.dob as string) : null,
    gender: (episodePatient?.gender || 'UNKNOWN') as any,
    identifiers,
    status: identifiers.nationalId || identifiers.iqama || identifiers.passport ? 'KNOWN' : 'UNKNOWN',
    links: linkId
      ? [
          {
            system: 'IPD',
            patientId: linkId,
            mrn: (episodePatient?.mrn as string) ?? null,
            tempMrn: (episodePatient?.tempMrn as string) ?? null,
          },
        ]
      : undefined,
  };

  const record = buildPatientMasterRecord(args.tenantId, args.userId, input);
  const created = await prisma.patientMaster.create({ data: record as unknown as Prisma.PatientMasterUncheckedCreateInput });
  await createAuditLog(
    'patient_master',
    created.id,
    'CREATE',
    args.userId || 'system',
    args.userEmail,
    { after: created, source: 'IPD' },
    args.tenantId
  );
  return created;
}

async function upsertEncounterCore(args: {
  tenantId: string;
  sourceSystem: 'ER' | 'IPD';
  sourceId: string;
  encounterId: string;
  patientId: string;
  encounterType: string;
  status: string;
  department: string;
  openedAt: Date | null;
  closedAt: Date | null;
  userId?: string;
  userEmail?: string;
}) {
  const now = new Date();

  // Check if encounter already exists by source
  const existing = await prisma.encounterCore.findFirst({
    where: { tenantId: args.tenantId, id: args.encounterId },
  });
  if (existing) return existing;

  const encounter = {
    id: args.encounterId,
    tenantId: args.tenantId,
    patientId: args.patientId,
    encounterType: args.encounterType,
    status: args.status,
    department: args.department,
    openedAt: args.openedAt,
    closedAt: args.closedAt,
    createdAt: now,
    updatedAt: now,
    createdByUserId: args.userId,
    sourceSystem: args.sourceSystem,
    sourceId: args.sourceId,
  };

  try {
    const created = await prisma.encounterCore.create({ data: encounter as Prisma.EncounterCoreUncheckedCreateInput });
    await createAuditLog(
      'encounter_core',
      encounter.id,
      'CREATE',
      args.userId || 'system',
      args.userEmail,
      { after: encounter, source: args.sourceSystem },
      args.tenantId
    );
    return created;
  } catch {
    // Unique constraint - already exists
    return await prisma.encounterCore.findFirst({
      where: { tenantId: args.tenantId, id: args.encounterId },
    });
  }
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const resolvedParams = (params && typeof (params as any).then === 'function') ? await params : params;
  const encounterId = String((resolvedParams as any)?.id || '').trim();
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter id is required' }, { status: 400 });
  }

  const existing = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterId },
  });
  if (existing) {
    const patient = await prisma.patientMaster.findFirst({
      where: { tenantId, id: existing.patientId },
    });
    return NextResponse.json({ encounter: existing, patient: patient || null });
  }

  // Check ER encounters
  const erEncounter = await prisma.erEncounter.findFirst({
    where: { tenantId, id: encounterId },
  });
  if (erEncounter) {
    const erPatient = await prisma.erPatient.findFirst({
      where: { tenantId, id: erEncounter.patientId },
    });
    const patientRecord = erPatient
      ? await ensurePatientFromEr({ tenantId, userId, userEmail: user?.email, erPatient: erPatient as Record<string, unknown> })
      : null;

    const status = CLOSED_ER_STATUSES.includes(String(erEncounter.status || ''))
      ? 'CLOSED'
      : 'ACTIVE';

    const encounter = await upsertEncounterCore({
      tenantId,
      sourceSystem: 'ER',
      sourceId: encounterId,
      encounterId,
      patientId: patientRecord?.id || String(erEncounter.patientId || ''),
      encounterType: 'ER',
      status,
      department: 'ER',
      openedAt: erEncounter.startedAt ? new Date(erEncounter.startedAt) : null,
      closedAt: erEncounter.closedAt ? new Date(erEncounter.closedAt) : null,
      userId,
      userEmail: user?.email,
    });

    const patient = encounter
      ? await prisma.patientMaster.findFirst({
          where: { tenantId, id: encounter.patientId },
        })
      : null;
    return NextResponse.json({ encounter, patient: patient || null });
  }

  // Check IPD episodes
  const ipdEpisode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, encounterId },
  });
  if (ipdEpisode) {
    const patientRecord = await ensurePatientFromIpd({
      tenantId,
      userId,
      userEmail: user?.email,
      ipdEpisode: ipdEpisode as unknown as Record<string, unknown>,
    });

    const episodeStatus = String((ipdEpisode as unknown as Record<string, unknown>).status || '').toUpperCase();
    const status = episodeStatus === 'ACTIVE' ? 'ACTIVE' : 'CLOSED';

    const encounter = await upsertEncounterCore({
      tenantId,
      sourceSystem: 'IPD',
      sourceId: String(ipdEpisode.id || ''),
      encounterId,
      patientId: patientRecord.id,
      encounterType: 'IPD',
      status,
      department: 'IPD',
      openedAt: ipdEpisode.createdAt ? new Date(ipdEpisode.createdAt as unknown as string) : null,
      closedAt: (ipdEpisode as unknown as Record<string, unknown>).closedAt ? new Date((ipdEpisode as unknown as Record<string, unknown>).closedAt as string) : null,
      userId,
      userEmail: user?.email,
    });

    const patient = encounter
      ? await prisma.patientMaster.findFirst({
          where: { tenantId, id: encounter.patientId },
        })
      : null;
    return NextResponse.json({ encounter, patient: patient || null });
  }

  return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'encounters.core.view' }
);
