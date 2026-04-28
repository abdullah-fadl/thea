import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import {
  buildPatientMasterRecord,
  mapErPatientLink,
  mapPatientInputFromEr,
  normalizeIdentifier,
} from '@/lib/hospital/patientMaster';
import type { PatientMasterRecord } from '@/lib/hospital/patientMaster';
import type { EncounterType, EncounterCoreStatus, EncounterSourceSystem, PatientMaster, ErEncounter, EncounterCore } from '@prisma/client';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  serviceUnit: z.string().min(1, 'serviceUnit is required'),
  admittingDoctorUserId: z.string().min(1, 'admittingDoctorUserId is required'),
  bedClass: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

/** JSON link entry from PatientMaster.links */
interface PatientLink {
  system?: string;
  patientId?: string;
  tempMrn?: string;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(v.data.encounterCoreId).trim();
  const serviceUnit = String(v.data.serviceUnit).trim();
  const admittingDoctorUserId = String(v.data.admittingDoctorUserId).trim();
  const bedClass = String(v.data.bedClass || '').trim() || null;
  const notes = String(v.data.notes || '').trim() || null;

  let resolvedEncounterCoreId = encounterCoreId;
  let encounter: EncounterCore | null = await prisma.encounterCore.findFirst({
    where: { tenantId, id: resolvedEncounterCoreId },
  });
  let sourceEncounter: ErEncounter | null = null;
  if (!encounter) {
    const bySource = await prisma.encounterCore.findFirst({
      where: {
        tenantId,
        sourceId: encounterCoreId,
      },
    });
    if (bySource) {
      encounter = bySource;
      resolvedEncounterCoreId = String(bySource.id || encounterCoreId).trim();
    }
  }
  if (!encounter) {
    const erEncounter = await prisma.erEncounter.findFirst({
      where: { tenantId, id: encounterCoreId },
    });
    sourceEncounter = erEncounter;
    if (erEncounter) {
      const existingCoreId = String(erEncounter.encounterCoreId || '').trim();
      if (existingCoreId) {
        resolvedEncounterCoreId = existingCoreId;
        encounter = await prisma.encounterCore.findFirst({
          where: { tenantId, id: resolvedEncounterCoreId },
        });
      }
      if (!encounter) {
        const patientMasterId = String(erEncounter.patientId || '').trim();
        const now = new Date();
        const coreType = String((erEncounter as Record<string, unknown>).type || 'ER').toUpperCase();
        try {
          const core = await prisma.encounterCore.create({
            data: {
              tenantId,
              patientId: patientMasterId || '',
              encounterType: coreType as EncounterType,
              status: 'ACTIVE' as EncounterCoreStatus,
              department: coreType,
              openedAt: erEncounter.startedAt || now,
              closedAt: null,
              createdAt: now,
              createdByUserId: userId || null,
              sourceSystem: coreType as EncounterSourceSystem,
              sourceId: erEncounter.id,
            },
          });
          resolvedEncounterCoreId = core.id;
          encounter = core;
        } catch (err: unknown) {
          const prismaErr = err as { code?: string };
          if (prismaErr?.code === 'P2002') {
            const existingBySource = await prisma.encounterCore.findFirst({
              where: {
                tenantId,
                sourceSystem: String((erEncounter as Record<string, unknown>).type || 'ER').toUpperCase() as EncounterSourceSystem,
                sourceId: erEncounter.id,
              },
            });
            if (existingBySource) {
              encounter = existingBySource;
              resolvedEncounterCoreId = String(existingBySource.id || resolvedEncounterCoreId).trim();
            }
          } else {
            throw err;
          }
        }
        if (resolvedEncounterCoreId) {
          const enc = await prisma.erEncounter.findFirst({
            where: { tenantId, id: erEncounter.id },
          });
          if (enc && (!(enc.encounterCoreId) || enc.encounterCoreId === '')) {
            await prisma.erEncounter.update({
              where: { id: enc.id },
              data: { encounterCoreId: resolvedEncounterCoreId },
            });
          }
        }
      }
    }
  }
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const encounterType = String(encounter.encounterType || '').toUpperCase();
  if (encounterType !== 'ER' && encounterType !== 'OPD') {
    return NextResponse.json({ error: 'Only ER/OPD encounters can create IPD episodes' }, { status: 409 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  const now = new Date();
  let patientMasterId = String(encounter.patientId || '').trim();
  let patientMaster: PatientMaster | PatientMasterRecord | null = patientMasterId
    ? await prisma.patientMaster.findFirst({ where: { tenantId, id: patientMasterId } })
    : null;
  if (!patientMaster) {
    patientMasterId = '';
  }

  if (!patientMasterId) {
    const ensurePatientMasterFromEr = async (erPatient: { nationalId?: string | null; iqama?: string | null; passport?: string | null; tempMrn?: string | null; [key: string]: unknown }) => {
      if (!erPatient) return { patientMasterId: '', patientMaster: null as PatientMaster | PatientMasterRecord | null };
      const identifiers = {
        nationalId: normalizeIdentifier(erPatient?.nationalId),
        iqama: normalizeIdentifier(erPatient?.iqama),
        passport: normalizeIdentifier(erPatient?.passport),
      };
      const orConditions: any[] = [
        { links: { path: ['$[*].system'], equals: 'ER' } },
      ];
      if (erPatient?.tempMrn) {
        orConditions.push({ links: { path: ['$[*].tempMrn'], equals: String(erPatient.tempMrn || '') } });
      }
      if (identifiers.nationalId) {
        orConditions.push({ identifiers: { path: ['nationalId'], equals: identifiers.nationalId } });
      }
      if (identifiers.iqama) {
        orConditions.push({ identifiers: { path: ['iqama'], equals: identifiers.iqama } });
      }
      if (identifiers.passport) {
        orConditions.push({ identifiers: { path: ['passport'], equals: identifiers.passport } });
      }
      const existingMaster = await prisma.patientMaster.findFirst({
        where: {
          tenantId,
          OR: orConditions,
        },
      });
      if (existingMaster) {
        const link = mapErPatientLink(erPatient);
        if (link?.patientId) {
          const currentLinks = Array.isArray(existingMaster.links) ? existingMaster.links as PatientLink[] : [];
          const hasLink = currentLinks.some((l) => l.system === 'ER' && l.patientId === link.patientId);
          if (!hasLink) {
            await prisma.patientMaster.update({
              where: { id: existingMaster.id },
              data: {
                links: [...currentLinks, link] as any,
                updatedAt: now,
                updatedByUserId: userId || null,
              },
            });
          }
        }
        return { patientMasterId: String(existingMaster.id || '').trim(), patientMaster: existingMaster };
      }
      const input = mapPatientInputFromEr(erPatient);
      const record = buildPatientMasterRecord(tenantId, userId, {
        ...input,
        links: [mapErPatientLink(erPatient)],
      });
      await prisma.patientMaster.create({ data: record as any });
      await createAuditLog(
        'patient_master',
        record.id,
        'CREATE',
        userId || 'system',
        user?.email,
        { after: record, source: 'ER' },
        tenantId
      );
      return { patientMasterId: record.id, patientMaster: record as PatientMasterRecord };
    };

    const erPatientFromCore = encounter?.patientId
      ? await prisma.erPatient.findFirst({
          where: { tenantId, id: String(encounter.patientId || '').trim() },
        })
      : null;
    if (erPatientFromCore) {
      const resolved = await ensurePatientMasterFromEr(erPatientFromCore);
      patientMasterId = resolved.patientMasterId;
      patientMaster = resolved.patientMaster;
    }

    if (!sourceEncounter && String(encounter.sourceSystem || '') === 'ER') {
      sourceEncounter = await prisma.erEncounter.findFirst({
        where: { tenantId, id: String(encounter.sourceId || '').trim() },
      });
    }
    if (!sourceEncounter) {
      sourceEncounter = await prisma.erEncounter.findFirst({
        where: { tenantId, encounterCoreId: resolvedEncounterCoreId },
      });
    }
    if (!sourceEncounter) {
      sourceEncounter = await prisma.erEncounter.findFirst({
        where: { tenantId, id: encounterCoreId },
      });
    }
    if (!patientMasterId && sourceEncounter?.patientId) {
      const erPatient = await prisma.erPatient.findFirst({
        where: { tenantId, id: String(sourceEncounter.patientId || '').trim() },
      });
      if (erPatient) {
        const resolved = await ensurePatientMasterFromEr(erPatient);
        patientMasterId = resolved.patientMasterId;
        patientMaster = resolved.patientMaster;
      }
    }
    if (!patientMasterId) {
      return NextResponse.json(
        { error: 'Encounter core missing and cannot be created without patient master' },
        { status: 409 }
      );
    }
    await prisma.encounterCore.update({
      where: { id: resolvedEncounterCoreId },
      data: { patientId: patientMasterId },
    });
    if (sourceEncounter?.id) {
      const srcEnc = await prisma.erEncounter.findFirst({
        where: { tenantId, id: sourceEncounter.id },
      });
      if (srcEnc && (!srcEnc.encounterCoreId || srcEnc.encounterCoreId === '')) {
        // ErEncounter doesn't have patientMasterId; skip this update
      }
    }
  }

  const existing = await prisma.ipdEpisode.findFirst({
    where: {
      tenantId,
      source: {
        path: ['encounterId'],
        equals: resolvedEncounterCoreId,
      },
    },
  });
  if (existing?.id) {
    return NextResponse.json({ success: true, noOp: true, episodeId: existing.id, episode: existing });
  }

  const patient =
    patientMaster ||
    (patientMasterId
      ? await prisma.patientMaster.findFirst({ where: { tenantId, id: patientMasterId } })
      : null);

  const ipdEncounterCore = await prisma.encounterCore.create({
    data: {
      tenantId,
      patientId: patientMasterId || '',
      encounterType: 'IPD' as EncounterType,
      status: 'ACTIVE' as EncounterCoreStatus,
      department: 'IPD',
      openedAt: now,
      closedAt: null,
      createdAt: now,
      createdByUserId: userId || null,
      sourceSystem: 'IPD' as EncounterSourceSystem,
      sourceId: '',
    },
  });

  const episode = await prisma.ipdEpisode.create({
    data: {
      tenantId,
      encounterId: ipdEncounterCore.id,
      encounterType: 'IPD',
      patient: patient
        ? { id: patient.id, fullName: patient.fullName || 'Unknown' }
        : { id: patientMasterId || null, fullName: 'Unknown' },
      serviceUnit,
      admittingDoctorUserId,
      bedClass,
      admissionNotes: notes,
      status: 'ACTIVE',
      source: { type: encounterType, encounterId: resolvedEncounterCoreId },
      createdAt: now,
      createdByUserId: userId || null,
      updatedAt: now,
      updatedByUserId: userId || null,
    },
  });

  // Update the encounter core source with the episode id
  await prisma.encounterCore.update({
    where: { id: ipdEncounterCore.id },
    data: { sourceId: episode.id },
  });

  const intake = await prisma.ipdAdmissionIntake.create({
    data: {
      tenantId,
      handoffId: resolvedEncounterCoreId, // Use source encounter as handoff reference
      episodeId: episode.id,
      encounterId: ipdEncounterCore.id,
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  await createAuditLog(
    'ipd_episode',
    episode.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: episode },
    tenantId
  );
  await createAuditLog(
    'ipd_admission_intake',
    intake.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: intake },
    tenantId
  );
  await createAuditLog(
    'encounter_core',
    ipdEncounterCore.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: ipdEncounterCore },
    tenantId
  );

  return NextResponse.json({ success: true, episodeId: episode.id, episode });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
