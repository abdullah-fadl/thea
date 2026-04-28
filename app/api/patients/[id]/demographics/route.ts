import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { buildFullName, hasOfficialIdentifier, normalizeIdentifier, normalizeName } from '@/lib/hospital/patientMaster';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { fullDemographicsSchema } from '@/lib/validation/patient.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const patientId = String((params as Record<string, string>)?.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'Patient id is required' }, { status: 400 });
  }

  const role = String(user?.role || '').toLowerCase();
  const allowed =
    role.includes('admin') ||
    role.includes('dev') ||
    role.includes('front') ||
    role.includes('charge') ||
    role === 'registration' ||
    role === 'registration_supervisor';
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, fullDemographicsSchema);
  if ('error' in v) return v.error;

  const firstName = String(body.firstName || '').trim();
  const middleName = String(body.middleName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const dob = parseDate(body.dob);
  const nationalId = normalizeIdentifier(body.nationalId || null);
  const reason = String(body.reason || '').trim();

  const patient = await prisma.patientMaster.findFirst({ where: { tenantId, id: patientId } });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  if (String(patient.status || '') === 'MERGED') {
    return NextResponse.json({ error: 'Patient is merged' }, { status: 409 });
  }

  const encounterIds = (await prisma.encounterCore.findMany({
    where: { tenantId, patientId },
    select: { id: true },
  })).map((r) => r.id).filter(Boolean);

  const deathFinalized = encounterIds.length
    ? (await prisma.deathDeclaration.count({
        where: { tenantId, encounterCoreId: { in: encounterIds }, finalisedAt: { not: null } },
      })) > 0
    : false;

  const canCorrectIdentifiers = role.includes('admin') || role === 'registration_supervisor';
  const existingNationalId = normalizeIdentifier((patient.identifiers as Record<string, string>)?.nationalId || null);
  if (existingNationalId && !nationalId) {
    return NextResponse.json({ error: 'Identifier deletion not allowed' }, { status: 400 });
  }
  if (existingNationalId && nationalId && existingNationalId !== nationalId && !canCorrectIdentifiers) {
    return NextResponse.json({ error: 'Identifier correction not allowed' }, { status: 403 });
  }

  const nameEmpty = !firstName && !middleName && !lastName;
  if (nameEmpty) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
  }

  const requiresReason =
    deathFinalized ||
    (existingNationalId && nationalId && existingNationalId !== nationalId);
  if (requiresReason && !reason) {
    return NextResponse.json({ error: 'Reason required', code: 'REASON_REQUIRED' }, { status: 400 });
  }

  const fullName = buildFullName(firstName, middleName, lastName);
  const nameNormalized = normalizeName(fullName);
  const identifiers = {
    ...(patient.identifiers as Record<string, string>),
    nationalId: nationalId || (patient.identifiers as Record<string, string>)?.nationalId || null,
  };
  const status = hasOfficialIdentifier(identifiers) ? 'KNOWN' : 'UNKNOWN';
  const now = new Date();
  const genderRaw = String(body.gender || '').toUpperCase();
  const gender = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(genderRaw) ? genderRaw : null;

  const update: Record<string, unknown> = {
    firstName: firstName || 'Unknown',
    middleName: middleName || null,
    lastName: lastName || '',
    fullName,
    nameNormalized,
    dob: dob ?? null,
    identifiers,
    status,
    updatedAt: now,
    updatedByUserId: userId || null,
  };
  if (gender) update.gender = gender;

  await prisma.patientMaster.update({
    where: { id: patientId },
    data: update,
  });

  await createAuditLog(
    'patient_master',
    patientId,
    'PATIENT_DEMOGRAPHICS_UPDATED',
    userId || 'system',
    user?.email,
    { before: patient, after: { ...patient, ...update }, reason: reason || null },
    tenantId
  );

  return NextResponse.json({ success: true, patient: { ...patient, ...update } });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'registration.view' }
);
