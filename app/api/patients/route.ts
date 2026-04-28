import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma, type PatientMasterStatus } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';
import {
  buildPatientMasterRecord,
  detectDuplicateCandidates,
  hasOfficialIdentifier,
  sanitizeIdentifiers,
  type PatientMasterInput,
} from '@/lib/hospital/patientMaster';
import { allocateShortCode } from '@/lib/clinicalInfra/publicIds';
import { encryptDocument, decryptDocument, hashForSearch, isEncryptionEnabled } from '@/lib/security/fieldEncryption';
import { validateBody } from '@/lib/validation/helpers';
import { createPatientSchema } from '@/lib/validation/patient.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createPatientSchema);
  if ('error' in v) return v.error;
  const { firstName, lastName, dob, knownAllergies, nationality, city, mobile, email, bloodType, emergencyContact } = v.data;

  const identifiers = sanitizeIdentifiers(body.identifiers || body);
  // Server-authoritative: status is computed only from official identifiers.
  // Ignore any incoming `status` from the client.
  const status = hasOfficialIdentifier(identifiers) ? 'KNOWN' : 'UNKNOWN';
  const gender = String(body.gender || 'UNKNOWN').trim().toUpperCase();
  const normalizedGender = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(gender) ? gender : 'UNKNOWN';
  const input: PatientMasterInput = {
    firstName: body.firstName,
    lastName: body.lastName,
    dob: parseDate(body.dob),
    gender: normalizedGender as any,
    identifiers,
    status: status as PatientMasterStatus,
    mobile: body.mobile || null,
    email: body.email || null,
    bloodType: body.bloodType || null,
    knownAllergies: Array.isArray(body.knownAllergies) ? body.knownAllergies : (body.knownAllergies ? [body.knownAllergies] : null),
    nationality: body.nationality || null,
    city: body.city || null,
    emergencyContact: body.emergencyContact || null,
  };

  // Duplicate check: use hash fields when encryption is enabled, plain otherwise
  const identifierMatches: any[] = isEncryptionEnabled()
    ? [
        identifiers.nationalId ? { nationalId_hash: hashForSearch(identifiers.nationalId) } : null,
        identifiers.iqama ? { iqama_hash: hashForSearch(identifiers.iqama) } : null,
        identifiers.passport ? { passport_hash: hashForSearch(identifiers.passport) } : null,
      ].filter(Boolean)
    : [
        identifiers.nationalId ? { nationalId: identifiers.nationalId } : null,
        identifiers.iqama ? { iqama: identifiers.iqama } : null,
        identifiers.passport ? { passport: identifiers.passport } : null,
      ].filter(Boolean);

  if (identifierMatches.length) {
    const existing = await prisma.patientMaster.findFirst({
      where: { tenantId, OR: identifierMatches },
    });
    if (existing) {
      const decryptedExisting = decryptDocument('patient_master', existing);
      if (String(decryptedExisting.status || '') === 'MERGED') {
        return NextResponse.json(
          { error: 'Identifier belongs to a merged patient', patientId: decryptedExisting.id },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, patient: decryptedExisting, noOp: true });
    }
  }

  const potentialCandidates: any[] = [];
  if (input.dob) {
    const start = new Date(input.dob);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const candidates = await prisma.patientMaster.findMany({
      where: { tenantId, dob: { gte: start, lt: end }, status: { not: 'MERGED' } },
      take: 25,
    });
    potentialCandidates.push(...candidates);
  }

  const duplicateCandidates = detectDuplicateCandidates(input, potentialCandidates);

  // Wrap MRN allocation + patient creation in a transaction to prevent race conditions (RACE-01).
  // allocateShortCode uses INSERT ... ON CONFLICT DO UPDATE which is atomic at the SQL level,
  // but we need the full sequence (MRN alloc + duplicate re-check + create) to be atomic.
  let patient: any;
  try {
    patient = await prisma.$transaction(async (tx) => {
      // Re-check for duplicates inside transaction to prevent TOCTOU race
      if (identifierMatches.length) {
        const existingInTx = await tx.patientMaster.findFirst({
          where: { tenantId, OR: identifierMatches },
        });
        if (existingInTx) {
          throw Object.assign(new Error('DUPLICATE'), { existing: existingInTx });
        }
      }

      const mrn = await allocateShortCode({
        db: tx,
        tenantId,
        entityType: 'patient_master',
        prefix: 'MRN',
        pad: 6,
      });

      const rec = buildPatientMasterRecord(tenantId, userId, { ...input, mrn });
      const encryptedPatient = encryptDocument('patient_master', rec as any);
      await tx.patientMaster.create({ data: encryptedPatient as unknown as Prisma.PatientMasterCreateInput });
      return rec;
    }, { isolationLevel: 'Serializable' });
  } catch (err: any) {
    // Handle duplicate detected inside transaction
    if (err?.message === 'DUPLICATE' && err?.existing) {
      const decrypted = decryptDocument('patient_master', err.existing);
      return NextResponse.json({ success: true, patient: decrypted, noOp: true });
    }
    throw err;
  }

  await createAuditLog(
    'patient_master',
    patient.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: patient }, // audit log keeps plain text for authorized auditors
    tenantId
  );

  return NextResponse.json({
    success: true,
    patient, // return plain text to caller
    duplicateCandidates,
  });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.master.create' }
);
