import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { hasOfficialIdentifier, normalizeIdentifier, normalizeName, type PatientIdentifiers } from '@/lib/hospital/patientMaster';
import { encryptDocument, decryptDocument } from '@/lib/security/fieldEncryption';
import { validateBody } from '@/lib/validation/helpers';
import { updatePatientSchema } from '@/lib/validation/patient.schema';
import { logPatientAccess } from '@/lib/audit/patientAccessLogger';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildDisplayName(firstName: string, middleName: string, lastName: string) {
  const parts = [firstName, middleName, lastName].map((v) => String(v || '').trim()).filter(Boolean);
  return parts.join(' ').trim() || 'Unknown';
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const routeParams = (params && typeof params === 'object') ? params as Record<string, string | string[]> : {};
  const patientId = String(routeParams.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'Patient id is required' }, { status: 400 });
  }

  const raw = await prisma.patientMaster.findFirst({ where: { tenantId, id: patientId } });
  if (!raw) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // Fire-and-forget: log patient record access
  logPatientAccess({
    tenantId,
    userId: userId || '',
    userRole: user?.role || '',
    patientId,
    accessType: 'view',
    resourceType: 'demographics',
    path: req.nextUrl?.pathname,
  });

  const patient = decryptDocument('patient_master', raw);
  return NextResponse.json({
    patient: {
      id: patient.id,
      fullName: patient.fullName || [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ').trim(),
      firstNameAr: patient.firstName,
      middleNameAr: patient.middleName,
      lastNameAr: patient.lastName,
      firstName: patient.firstName,
      middleName: patient.middleName,
      lastName: patient.lastName,
      dob: patient.dob,
      dateOfBirth: patient.dob,
      gender: patient.gender,
      mrn: patient.mrn || ((patient.identifiers as Record<string, unknown> | null))?.mrn,
      fileNumber: patient.mrn || ((patient.identifiers as Record<string, unknown> | null))?.mrn,
      insuranceCompanyName: patient.insuranceCompanyName,
    },
  });
}), { resourceType: 'patient', extractPatientId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('patients'); return idx >= 0 ? parts[idx + 1] || null : null; } }),
  { tenantScoped: true, permissionKeys: ['clinical.view', 'opd.doctor.encounter.view', 'opd.doctor.visit.view', 'opd.nursing.edit', 'opd.visit.view', 'patients.master.edit'] }
);

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const resolvedParams = (params && typeof params === 'object') ? params as Record<string, string | string[]> : {};
  const patientId = String(resolvedParams.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'Patient id is required' }, { status: 400 });
  }

  const clientRequestId =
    req.headers.get('x-client-request-id') ||
    req.headers.get('x-idempotency-key') ||
    req.headers.get('client-request-id') ||
    null;

  if (clientRequestId) {
    const existingAudit = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        resourceType: 'patient_master',
        resourceId: patientId,
        metadata: { path: ['clientRequestId'], equals: String(clientRequestId) },
      },
    });
    if (existingAudit) {
      const current = await prisma.patientMaster.findFirst({ where: { tenantId, id: patientId } });
      return NextResponse.json({ success: true, noOp: true, patient: current });
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updatePatientSchema);
  if ('error' in v) return v.error;

  const firstName = String(body.firstName || '').trim();
  const middleName = String(body.middleName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const dob = parseDate(body.dob);
  const genderRaw = String(body.gender || '').toUpperCase();
  const gender = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(genderRaw) ? genderRaw : null;
  const reason = String(body.reason || '').trim();

  if (!firstName && !middleName && !lastName) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
  }

  const existingRaw = await prisma.patientMaster.findFirst({ where: { tenantId, id: patientId } });
  if (!existingRaw) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  // Decrypt for comparison and return
  const existing = decryptDocument('patient_master', existingRaw);
  if (String(existing.status || '') === 'MERGED') {
    return NextResponse.json({ error: 'Patient is merged' }, { status: 409 });
  }

  const existingIdentifiers = (existing.identifiers as PatientIdentifiers | null) || {} as PatientIdentifiers;
  const known = hasOfficialIdentifier(existingIdentifiers);
  const role = String(user?.role || '').toLowerCase();
  const canCorrectIdentifiers = role.includes('admin') || role === 'registration_supervisor';

  const bodyIdentifiers = body.identifiers as Record<string, unknown> | undefined;
  const incomingIdentifiers = {
    nationalId: normalizeIdentifier((bodyIdentifiers?.nationalId as string | undefined) || (body.nationalId as string | undefined) || existingIdentifiers.nationalId),
    iqama: normalizeIdentifier((bodyIdentifiers?.iqama as string | undefined) || (body.iqama as string | undefined) || existingIdentifiers.iqama),
    passport: normalizeIdentifier((bodyIdentifiers?.passport as string | undefined) || (body.passport as string | undefined) || existingIdentifiers.passport),
  };

  const identifierChanges: Array<{ key: 'nationalId' | 'iqama' | 'passport'; before: string | null; after: string | null; action: 'ADDED' | 'CORRECTED' }> = [];
  const identifierErrors: string[] = [];
  (['nationalId', 'iqama', 'passport'] as const).forEach((key) => {
    const beforeVal = normalizeIdentifier(existingIdentifiers[key] || null);
    const afterRaw = bodyIdentifiers?.[key] ?? body[key];
    const afterVal = normalizeIdentifier((afterRaw as string | null | undefined) ?? beforeVal);
    if (beforeVal && !afterVal) {
      identifierErrors.push(`${key}: deletion not allowed`);
      return;
    }
    if (!beforeVal && afterVal) {
      identifierChanges.push({ key, before: null, after: afterVal, action: 'ADDED' });
      incomingIdentifiers[key] = afterVal;
      return;
    }
    if (beforeVal && afterVal && beforeVal !== afterVal) {
      identifierChanges.push({ key, before: beforeVal, after: afterVal, action: 'CORRECTED' });
      incomingIdentifiers[key] = afterVal;
      return;
    }
    incomingIdentifiers[key] = beforeVal || null;
  });

  if (identifierErrors.length) {
    return NextResponse.json({ error: 'Identifier change not allowed', details: identifierErrors }, { status: 400 });
  }

  const identifierCorrections = identifierChanges.filter((c) => c.action === 'CORRECTED');
  if (identifierCorrections.length && !canCorrectIdentifiers) {
    return NextResponse.json({ error: 'Identifier correction not allowed', code: 'IDENTIFIER_CORRECTION_FORBIDDEN' }, { status: 403 });
  }

  const dobChanged = (() => {
    const before = existing.dob ? new Date(existing.dob) : null;
    if (!before && !dob) return false;
    if (!before && dob) return true;
    if (before && !dob) return true;
    return before!.toISOString().slice(0, 10) !== dob!.toISOString().slice(0, 10);
  })();

  const nameChanged =
    String(existing.firstName || '') !== (firstName || 'Unknown') ||
    String(existing.middleName || '') !== String(middleName || '') ||
    String(existing.lastName || '') !== (lastName || '');

  const requiresReason = (known && (nameChanged || dobChanged)) || identifierCorrections.length > 0;
  if (requiresReason && !reason) {
    return NextResponse.json(
      { error: 'Reason required for this change', code: 'REASON_REQUIRED' },
      { status: 400 }
    );
  }

  const fullName = buildDisplayName(firstName, middleName, lastName);
  const nameNormalized = normalizeName(fullName);
  const now = new Date();
  const status = hasOfficialIdentifier(incomingIdentifiers) ? 'KNOWN' : 'UNKNOWN';

  const update: Record<string, unknown> = {
    firstName: firstName || 'Unknown',
    middleName: middleName || null,
    lastName: lastName || '',
    fullName,
    nameNormalized,
    dob: dob ?? null,
    identifiers: incomingIdentifiers,
    status,
    updatedAt: now,
    updatedByUserId: userId || null,
  };
  if (gender) update.gender = gender;

  const existingIds = (existing.identifiers as PatientIdentifiers | null) || {};
  const updateDob = update.dob as Date | null;
  const updateIds = update.identifiers as PatientIdentifiers | undefined;
  const noChange =
    String(existing.firstName || '') === update.firstName &&
    String(existing.middleName || '') === String(update.middleName || '') &&
    String(existing.lastName || '') === update.lastName &&
    String(existing.fullName || '') === update.fullName &&
    (existing.dob ? new Date(existing.dob).toISOString().slice(0, 10) : '') === (updateDob ? updateDob.toISOString().slice(0, 10) : '') &&
    String(existingIds.nationalId || '') === String(updateIds?.nationalId || '') &&
    String(existingIds.iqama || '') === String(updateIds?.iqama || '') &&
    String(existingIds.passport || '') === String(updateIds?.passport || '') &&
    String(existing.status || '') === update.status;

  if (!noChange) {
    // Encrypt sensitive fields before persisting
    const encryptedUpdate = encryptDocument('patient_master', update);
    await prisma.patientMaster.update({
      where: { id: patientId },
      data: encryptedUpdate,
    });
  }

  const auditBase = {
    before: existing,
    after: { ...existing, ...update },
    reason: reason || null,
    clientRequestId: clientRequestId ? String(clientRequestId) : null,
  };

  if (nameChanged) {
    await createAuditLog(
      'patient_master',
      patientId,
      'PATIENT_NAME_UPDATED',
      userId || 'system',
      user?.email,
      auditBase,
      tenantId
    );
  }
  if (dobChanged) {
    await createAuditLog(
      'patient_master',
      patientId,
      'PATIENT_DOB_UPDATED',
      userId || 'system',
      user?.email,
      auditBase,
      tenantId
    );
  }
  for (const change of identifierChanges) {
    const action = change.action === 'ADDED' ? 'PATIENT_IDENTIFIER_ADDED' : 'PATIENT_IDENTIFIER_CORRECTED';
    await createAuditLog(
      'patient_master',
      patientId,
      action,
      userId || 'system',
      user?.email,
      { ...auditBase, identifier: change.key, beforeValue: change.before, afterValue: change.after },
      tenantId
    );
  }

  const updatedRaw = await prisma.patientMaster.findFirst({ where: { tenantId, id: patientId } });
  const updated = decryptDocument('patient_master', updatedRaw);
  return NextResponse.json({ success: true, noOp: noChange, patient: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.master.edit' }
);

