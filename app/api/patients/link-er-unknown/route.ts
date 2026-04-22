import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import {
  buildPatientMasterRecord,
  hasOfficialIdentifier,
  sanitizeIdentifiers,
} from '@/lib/hospital/patientMaster';
import { validateBody } from '@/lib/validation/helpers';
import { linkErUnknownSchema } from '@/lib/validation/patient.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINAL_ER_STATUSES = new Set(['ADMITTED', 'TRANSFERRED', 'DISCHARGED', 'CANCELLED']);

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, linkErUnknownSchema);
  if ('error' in v) return v.error;

  const erEncounterId = String(body.erEncounterId || '').trim();
  const tempMrn = String(body.tempMrn || '').trim();
  const reason = String(body.reason || '').trim();
  const identifiers = sanitizeIdentifiers(body.identifiers || {});
  const genderRaw = String(body.gender || 'UNKNOWN').trim().toUpperCase();
  const gender = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(genderRaw) ? genderRaw : 'UNKNOWN';
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const dob = parseDate(body.dob);

  if (!erEncounterId && !tempMrn) {
    return NextResponse.json({ error: 'erEncounterId or tempMrn is required' }, { status: 400 });
  }
  if (!hasOfficialIdentifier(identifiers)) {
    return NextResponse.json({ error: 'At least one identifier is required' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  let encounter: Record<string, unknown> | null = null;
  let erPatient: Record<string, unknown> | null = null;
  let sourceEncounterId = erEncounterId || '';

  if (erEncounterId) {
    encounter = await prisma.erEncounter.findFirst({
      where: { tenantId, id: erEncounterId },
    });
    if (!encounter) {
      return NextResponse.json({ error: 'ER encounter not found' }, { status: 404 });
    }
  } else {
    erPatient = await prisma.erPatient.findFirst({
      where: { tenantId, tempMrn },
    });
    if (!erPatient) {
      return NextResponse.json({ error: 'ER patient not found for tempMrn' }, { status: 404 });
    }
    encounter = await prisma.erEncounter.findFirst({
      where: { tenantId, patientId: erPatient.id },
      orderBy: { startedAt: 'desc' },
    });
    if (!encounter) {
      return NextResponse.json({ error: 'ER encounter not found for tempMrn' }, { status: 404 });
    }
    sourceEncounterId = String(encounter.id || '');
  }

  const identifierMatches: Record<string, unknown>[] = [];
  if (identifiers.nationalId) identifierMatches.push({ identifiers: { path: ['nationalId'], equals: identifiers.nationalId } });
  if (identifiers.iqama) identifierMatches.push({ identifiers: { path: ['iqama'], equals: identifiers.iqama } });
  if (identifiers.passport) identifierMatches.push({ identifiers: { path: ['passport'], equals: identifiers.passport } });

  let patientMaster: Record<string, unknown> | null = identifierMatches.length
    ? await prisma.patientMaster.findFirst({
        where: { tenantId, OR: identifierMatches },
      })
    : null;

  if (patientMaster && String(patientMaster.status || '') === 'MERGED') {
    return NextResponse.json({ error: 'Patient master record is merged' }, { status: 409 });
  }
  if (!patientMaster) {
    const record = buildPatientMasterRecord(tenantId, userId, {
      firstName: firstName || 'Unknown',
      lastName,
      dob,
      gender: gender as any,
      identifiers,
      status: 'KNOWN',
    });
    patientMaster = await prisma.patientMaster.create({ data: record as any });
    await createAuditLog(
      'patient_master',
      patientMaster.id as string,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: patientMaster },
      tenantId
    );
  }

  const now = new Date();
  const encounterCoreId = String(sourceEncounterId || '');
  let encounterCore: Record<string, unknown> | null = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    const coreStatus = FINAL_ER_STATUSES.has(String(encounter?.status || '')) ? 'CLOSED' : 'ACTIVE';
    const core = {
      id: encounterCoreId,
      tenantId,
      patientId: patientMaster.id as string,
      encounterType: 'ER',
      status: coreStatus,
      department: 'ER',
      openedAt: encounter?.startedAt ? new Date(encounter.startedAt as string) : now,
      closedAt: encounter?.closedAt ? new Date(encounter.closedAt as string) : null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: userId,
      source: { system: 'ER', sourceId: encounterCoreId },
    };
    try {
      encounterCore = await prisma.encounterCore.create({ data: core as any });
      await createAuditLog(
        'encounter_core',
        core.id,
        'CREATE',
        userId || 'system',
        user?.email,
        { after: core, source: 'ER' },
        tenantId
      );
    } catch (err: unknown) {
      // Unique constraint violation - fetch existing
      encounterCore = await prisma.encounterCore.findFirst({
        where: { tenantId, id: encounterCoreId },
      });
    }
  } else if (encounterCore?.patientId !== patientMaster.id) {
    await prisma.encounterCore.updateMany({
      where: { tenantId, id: encounterCoreId },
      data: { patientId: patientMaster.id, updatedAt: now },
    });
  }

  // Check for existing link (idempotency)
  const existingLink = await prisma.patientIdentityLink.findFirst({
    where: sourceEncounterId
      ? { tenantId, system: 'ER', sourcePatientId: sourceEncounterId }
      : { tenantId, system: 'ER', tempMrn: tempMrn },
  });

  let wasInserted = false;
  if (!existingLink) {
    await prisma.patientIdentityLink.create({
      data: {
        tenantId,
        system: 'ER',
        sourcePatientId: sourceEncounterId || tempMrn || '',
        tempMrn: tempMrn || null,
        patientId: patientMaster.id as string,
        createdAt: now,
      },
    });
    wasInserted = true;

    await createAuditLog(
      'patient_identity_link',
      sourceEncounterId || tempMrn,
      'LINK_ER_UNKNOWN',
      userId || 'system',
      user?.email,
      {
        sourceEncounterId: sourceEncounterId || null,
        sourceTempMrn: tempMrn || null,
        patientMasterId: patientMaster.id,
        reason,
      },
      tenantId
    );
  }

  return NextResponse.json({
    success: true,
    noOp: !wasInserted,
    patientMasterId: patientMaster.id,
    encounterCoreId: encounterCore ? encounterCore.id : null,
    erEncounterId: sourceEncounterId || null,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'registration.view' }
);
