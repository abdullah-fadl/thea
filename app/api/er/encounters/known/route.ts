import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ER_ARRIVAL_METHODS, ER_PAYMENT_STATUSES } from '@/lib/er/constants';
import { writeErAuditLog } from '@/lib/er/audit';
import { normalizeIdentifier } from '@/lib/hospital/patientMaster';
import { allocateErVisitNumber, isPrismaDuplicateKeyError } from '@/lib/er/identifiers';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  patientMasterId: z.string().optional(),
  patientId: z.string().optional(),
  mrn: z.string().optional(),
  arrivalMethod: z.string().optional(),
  paymentStatus: z.string().optional(),
  identifiers: z.object({
    nationalId: z.string().optional(),
    iqama: z.string().optional(),
    passport: z.string().optional(),
  }).optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
  const body = await req.json();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  if (!body.patientMasterId && !body.patientId && !body.mrn) {
    return NextResponse.json({ error: 'Missing identifier', missing: ['patientMasterId|patientId|mrn'] }, { status: 400 });
  }

  const arrivalMethod = ER_ARRIVAL_METHODS.includes(body.arrivalMethod) ? body.arrivalMethod : 'WALKIN';
  const paymentStatus = ER_PAYMENT_STATUSES.includes(body.paymentStatus) ? body.paymentStatus : 'PENDING';

  const identifiersInput = {
    nationalId: normalizeIdentifier(body.identifiers?.nationalId || ''),
    iqama: normalizeIdentifier(body.identifiers?.iqama || ''),
    passport: normalizeIdentifier(body.identifiers?.passport || ''),
  };

  const findPatientMasterByIdentifiers = async (identifiers: typeof identifiersInput) => {
    const orConditions: Array<any> = [];
    if (identifiers.nationalId) orConditions.push({ identifiers: { path: ['nationalId'], equals: identifiers.nationalId } });
    if (identifiers.iqama) orConditions.push({ identifiers: { path: ['iqama'], equals: identifiers.iqama } });
    if (identifiers.passport) orConditions.push({ identifiers: { path: ['passport'], equals: identifiers.passport } });
    if (!orConditions.length) return { patientMaster: null, candidates: [] as string[] };

    const matches = await prisma.patientMaster.findMany({
      where: { tenantId, OR: orConditions },
      take: 100,
    });
    if (!matches.length) return { patientMaster: null, candidates: [] };

    const active = matches.filter((item) => String(item.status || '') !== 'MERGED');
    if (active.length === 1) return { patientMaster: active[0], candidates: [] };
    if (active.length > 1) {
      return { patientMaster: null, candidates: active.map((item) => item.id) };
    }
    return { patientMaster: null, candidates: matches.map((item) => item.id) };
  };

  let patientMasterId = body.patientMasterId ? String(body.patientMasterId || '').trim() : null;
  let patient: any | null = null;
  let patientMaster: any | null = null;

  if (patientMasterId) {
    patientMaster = await prisma.patientMaster.findFirst({
      where: { tenantId, id: patientMasterId },
    });
    if (!patientMaster) {
      return NextResponse.json({ error: 'Patient master record not found' }, { status: 404 });
    }
    if (String(patientMaster.status || '') === 'MERGED') {
      return NextResponse.json({ error: 'Patient master record is merged' }, { status: 409 });
    }
    // Look for existing ER patient linked to this patient master
    patient = await prisma.erPatient.findFirst({ where: { tenantId, patientMasterId } });
    if (!patient) {
      const pmIdentifiers = patientMaster.identifiers as Record<string, unknown> | null;
      patient = {
        id: uuidv4(),
        tenantId,
        patientMasterId,
        mrn: null,
        tempMrn: null,
        isUnknown: false,
        fullName: patientMaster.fullName || 'Unknown',
        gender: patientMaster.gender || 'UNKNOWN',
        dob: patientMaster.dob || null,
        approxAge: null,
        nationalId: (pmIdentifiers?.nationalId as string) || null,
        createdAt: new Date(),
      };
      // If erPatient model doesn't exist, this is a no-op patient stub
      try {
        await prisma.erPatient.create({ data: patient as Prisma.ErPatientUncheckedCreateInput });
      } catch {
        // ER patient model may not exist yet; patient is kept in-memory
      }
    }
  } else {
    // Find patient by patientId or mrn
    const whereClause: any = { tenantId };
    if (body.patientId) whereClause.id = body.patientId;
    if (body.mrn) whereClause.mrn = body.mrn;
    patient = await prisma.patientMaster.findFirst({ where: whereClause });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }
    patientMasterId = patient.id ? String(patient.id || '') : null;
    if (!patientMasterId) {
      const fallbackIdentifiers = {
        nationalId: normalizeIdentifier(String(patient?.nationalId || '') || identifiersInput.nationalId || ''),
        iqama: normalizeIdentifier(String(patient?.iqama || '') || identifiersInput.iqama || ''),
        passport: normalizeIdentifier(String(patient?.passport || '') || identifiersInput.passport || ''),
      };
      const { patientMaster: resolved, candidates } = await findPatientMasterByIdentifiers(fallbackIdentifiers);
      if (candidates.length) {
        return NextResponse.json(
          { error: 'Multiple patient master matches', candidates },
          { status: 409 }
        );
      }
      if (resolved) {
        patientMasterId = String(resolved.id || '');
        patientMaster = resolved;
      }
    }
  }

  if (patientMasterId) {
    const existingEncounter = await prisma.erEncounter.findFirst({
      where: {
        tenantId,
        patientId: patientMasterId,
        status: 'REGISTERED',
        closedAt: null,
      },
    });
    if (existingEncounter) {
      return NextResponse.json({ success: true, patient, encounter: existingEncounter, noOp: true });
    }
  }

  const encounterId = uuidv4();
  const now = new Date();
  let encounterCoreId: string | null = null;
  if (patientMasterId) {
    const existingCore = await prisma.encounterCore.findFirst({
      where: { tenantId, patientId: patientMasterId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (existingCore) {
      encounterCoreId = String(existingCore.id || '');
    } else {
      const core = {
        id: uuidv4(),
        tenantId,
        patientId: patientMasterId,
        encounterType: 'ER',
        status: 'ACTIVE',
        department: 'ER',
        openedAt: now,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: userId,
      };
      try {
        await prisma.encounterCore.create({ data: core as Prisma.EncounterCoreUncheckedCreateInput });
        encounterCoreId = core.id;
      } catch (err: unknown) {
        if (isPrismaDuplicateKeyError(err)) {
          const existingBySource = await prisma.encounterCore.findFirst({
            where: { tenantId, patientId: patientMasterId, status: 'ACTIVE' },
          });
          encounterCoreId = existingBySource ? String(existingBySource.id || '') : null;
        } else {
          throw err;
        }
      }
    }
  }

  let encounter: any | null = null;
  const maxAttemptsForVisit = 3;
  for (let attempt = 1; attempt <= maxAttemptsForVisit; attempt++) {
    const visitNumber = await allocateErVisitNumber(null, tenantId);
    encounter = {
      id: encounterId,
      tenantId,
      patientId: patientMasterId || patient.id,
      encounterCoreId,
      status: 'REGISTERED',
      arrivalMethod,
      paymentStatus,
      triageLevel: null,
      chiefComplaint: null,
      startedAt: now,
      closedAt: null,
      createdByUserId: userId,
      updatedAt: now,
    };
    try {
      await prisma.erEncounter.create({ data: encounter as Prisma.ErEncounterUncheckedCreateInput });
      encounter.visitNumber = visitNumber;
      break;
    } catch (err: unknown) {
      if (isPrismaDuplicateKeyError(err) && attempt < maxAttemptsForVisit) {
        continue;
      }
      throw err;
    }
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'encounter',
    entityId: encounterId,
    action: 'CREATE',
    after: encounter,
    ip,
  });
  if (patientMasterId || encounterCoreId) {
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'encounter',
      entityId: encounterId,
      action: 'LINK_PATIENT_MASTER',
      before: null,
      after: {
        patientMasterId,
        encounterCoreId,
      },
      ip,
    });
  }

  return NextResponse.json({ success: true, patient, encounter });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.register.create' }
);
