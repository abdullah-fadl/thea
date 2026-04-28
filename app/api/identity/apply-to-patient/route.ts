import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { normalizeName } from '@/lib/hospital/patientMaster';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function splitName(fullName: string) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'Unknown', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    lookupId: z.string().min(1),
    patientMasterId: z.string().min(1),
    clientRequestId: z.string().optional(),
    override: z.boolean().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const lookupId = String(body.lookupId || '').trim();
  const patientMasterId = String(body.patientMasterId || '').trim();
  const requestId = String(body.clientRequestId || '').trim() || null;
  const override = Boolean(body.override);

  if (!lookupId || !patientMasterId) {
    return NextResponse.json({ error: 'lookupId and patientMasterId are required' }, { status: 400 });
  }

  const role = String(user?.role || '').toLowerCase();
  const canOverride = role.includes('admin') || role.includes('dev');
  if (override && !canOverride) {
    return NextResponse.json({ error: 'Override not allowed' }, { status: 403 });
  }

  if (requestId) {
    const existing = await prisma.identityApplyIdempotency.findFirst({
      where: { tenantId, userId: userId || 'system', requestId },
    });
    if (existing?.response) {
      const res = NextResponse.json(existing.response);
      res.headers.set('x-idempotent-replay', '1');
      return res;
    }
  }

  const lookup = await prisma.identityLookup.findFirst({
    where: { tenantId, id: lookupId },
  });
  if (!lookup) {
    return NextResponse.json({ error: 'Lookup not found' }, { status: 404 });
  }
  if (lookup.matchLevel !== 'VERIFIED') {
    return NextResponse.json({ error: 'Lookup not verified', code: 'LOOKUP_NOT_VERIFIED' }, { status: 400 });
  }
  if (!lookup.identityType || !lookup.identityLast4 || !lookup.identityValueHash) {
    return NextResponse.json({ error: 'Lookup missing identity fields', code: 'LOOKUP_NOT_VERIFIED' }, { status: 400 });
  }
  const requireDob = String(process.env.IDENTITY_REQUIRE_DOB_FOR_LOOKUP || '1') === '1';
  if (requireDob && !lookup.dob) {
    return NextResponse.json({ error: 'Lookup missing DOB', code: 'LOOKUP_NOT_VERIFIED' }, { status: 400 });
  }

  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientMasterId },
  });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  if (String(patient.status || '') === 'MERGED') {
    return NextResponse.json({ error: 'Patient is merged' }, { status: 409 });
  }

  const payload = (lookup.payload as Record<string, unknown>) || {};
  const nameFromPayload = payload.fullNameEn || payload.fullNameAr || '';
  const nameParts = splitName(nameFromPayload as string);

  const updates: Record<string, unknown> = {};
  const now = new Date();

  const nextFirstName = (!patient.firstName || override) ? nameParts.firstName : patient.firstName;
  const nextLastName = (!patient.lastName || override) ? nameParts.lastName : patient.lastName;
  if ((!patient.firstName || override) && nextFirstName) updates.firstName = nextFirstName;
  if ((!patient.lastName || override) && nextLastName) updates.lastName = nextLastName;
  if ((!patient.fullName || override) || updates.firstName || updates.lastName) {
    const fullName = `${nextFirstName || ''} ${nextLastName || ''}`.replace(/\s+/g, ' ').trim() || 'Unknown';
    updates.fullName = fullName;
    updates.nameNormalized = normalizeName(fullName);
  }

  if (!patient.gender || patient.gender === 'UNKNOWN' || override) {
    if (payload.gender) updates.gender = payload.gender;
  }

  if (!patient.dob || override) {
    if (payload.dob) updates.dob = new Date(payload.dob as string);
  }

  updates.identityVerification = {
    source: 'GOV_LOOKUP',
    matchLevel: lookup.matchLevel,
    dobProvided: Boolean(lookup.dob),
    verifiedAt: lookup.matchLevel === 'VERIFIED' ? now : null,
    lastLookupAt: now,
    identityType: lookup.identityType,
    identityLast4: lookup.identityLast4,
    identityValueHash: lookup.identityValueHash,
    provider: lookup.provider,
    providerTraceId: lookup.providerTraceId || null,
    lookupId: lookup.id,
  };
  updates.updatedAt = now;
  updates.updatedByUserId = userId || null;

  await prisma.patientMaster.updateMany({
    where: { tenantId, id: patientMasterId },
    data: updates,
  });

  if (!lookup.patientMasterId) {
    await prisma.identityLookup.updateMany({
      where: { tenantId, id: lookupId },
      data: { patientMasterId },
    });
  }

  await createAuditLog(
    'patient_master',
    patientMasterId,
    'GOV_IDENTITY_APPLIED',
    userId || 'system',
    user?.email,
    {
      lookupId,
      matchLevel: lookup.matchLevel,
      identityType: lookup.identityType,
      identityLast4: lookup.identityLast4,
      identityValueHash: lookup.identityValueHash,
      provider: lookup.provider,
      providerTraceId: lookup.providerTraceId || null,
    },
    tenantId
  );

  const updated = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientMasterId },
  });
  const response = { success: true, patient: updated };

  if (requestId) {
    await prisma.identityApplyIdempotency.upsert({
      where: {
        tenantId_userId_requestId: {
          tenantId,
          userId: userId || 'system',
          requestId,
        },
      },
      create: { tenantId, userId: userId || 'system', requestId, response, createdAt: now },
      update: {}, // No-op if already exists
    });
  }

  return NextResponse.json(response);
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.master.edit' });

