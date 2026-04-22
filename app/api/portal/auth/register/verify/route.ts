import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import {
  buildPatientMasterRecord,
  hasOfficialIdentifier,
  type PatientMasterInput,
} from '@/lib/hospital/patientMaster';
import {
  createPortalSession,
  generatePortalToken,
  normalizeMobile,
  setPortalCookie,
  verifyOtp,
} from '@/lib/portal/auth';
import { buildIdentifiers, normalizeIdNumber, normalizeIdType } from '@/lib/portal/identity';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const portalRegisterVerifyBodySchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  pendingId: z.string().min(1, 'pendingId is required'),
  otp: z.string().min(1, 'otp is required'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 20;
const MAX_VERIFY_ATTEMPTS = 5;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.ip ||
    'unknown'
  );
}

function splitFullName(value: string) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return { firstName: '', lastName: '' };
  const parts = normalized.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, portalRegisterVerifyBodySchema);
  if ('error' in v) return v.error;

  const tenantId = String(body.tenantId || '').trim();
  const pendingId = String(body.pendingId || '').trim();
  const otp = String(body.otp || '').trim();

  if (!tenantId || !pendingId || !otp) {
    return NextResponse.json({ error: 'tenantId, pendingId, and otp are required' }, { status: 400 });
  }

  // --- Rate limiting by IP ---
  const ip = getClientIp(request);
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const ipCount = await prisma.patientPortalRateLimit.count({
    where: {
      tenantId,
      type: 'register_verify_ip',
      key: ip,
      createdAt: { gte: windowStart },
    },
  });
  if (ipCount >= MAX_PER_IP) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }
  await prisma.patientPortalRateLimit.create({
    data: {
      tenantId,
      type: 'register_verify_ip',
      key: ip,
      createdAt: new Date(),
    },
  });

  // --- Find pending registration ---
  const pending = await prisma.patientPortalPendingRegistration.findFirst({
    where: { id: pendingId, tenantId, status: 'PENDING_OTP' },
  });

  if (!pending) {
    return NextResponse.json({ error: 'Registration request not found or already completed' }, { status: 404 });
  }

  if (new Date(pending.expiresAt) < new Date()) {
    await prisma.patientPortalPendingRegistration.updateMany({
      where: { id: pendingId, tenantId },
      data: { status: 'EXPIRED' },
    });
    return NextResponse.json({ error: 'Registration request has expired. Please register again.' }, { status: 410 });
  }

  // --- Check brute force attempts ---
  if ((pending.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    await prisma.patientPortalPendingRegistration.updateMany({
      where: { id: pendingId, tenantId },
      data: { status: 'LOCKED' },
    });
    return NextResponse.json({ error: 'Too many failed attempts. Please register again.' }, { status: 429 });
  }

  // --- Verify OTP ---
  const isValid = await verifyOtp(null, pending.mobile, otp);
  if (!isValid) {
    // Increment attempts — read current value and set incremented
    const currentAttempts = pending.attempts || 0;
    await prisma.patientPortalPendingRegistration.updateMany({
      where: { id: pendingId, tenantId },
      data: { attempts: currentAttempts + 1 },
    });
    return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 });
  }

  // --- Complete registration: create/find patient_master ---
  const idType = normalizeIdType(pending.idType);
  const idNumberNormalized = normalizeIdNumber(pending.idNumber);
  const mobile = normalizeMobile(pending.mobile);

  // Build identifier-based filter for Prisma
  const identifierFilter: any = { tenantId };
  if (idType === 'NATIONAL_ID') {
    identifierFilter.nationalId = idNumberNormalized;
  } else if (idType === 'IQAMA') {
    identifierFilter.iqama = idNumberNormalized;
  } else if (idType === 'PASSPORT') {
    identifierFilter.passport = idNumberNormalized;
  } else {
    identifierFilter.nationalId = idNumberNormalized;
  }

  let patient = await prisma.patientMaster.findFirst({
    where: identifierFilter as Parameters<typeof prisma.patientMaster.findFirst>[0]['where'],
  });

  if (patient) {
    // Update mobile if missing
    const existingMobile = normalizeMobile(String((patient as any).mobileNormalized || patient.mobile || '').trim());
    if (!existingMobile) {
      await prisma.patientMaster.updateMany({
        where: { tenantId, id: patient.id },
        data: { mobile, updatedAt: new Date() } as any,
      });
      patient = { ...patient, mobile } as typeof patient;
    }
  } else {
    const { firstName, lastName } = splitFullName(pending.fullName);
    const identifiers = buildIdentifiers(idType, idNumberNormalized);
    const input: PatientMasterInput = {
      firstName: firstName || 'Unknown',
      lastName: lastName || '',
      identifiers,
      gender: 'UNKNOWN' as PatientMasterInput['gender'],
      status: hasOfficialIdentifier(identifiers) ? ('KNOWN' as PatientMasterInput['status']) : ('UNKNOWN' as PatientMasterInput['status']),
    };
    const record = buildPatientMasterRecord(tenantId, undefined, input);
    const insertRecord = {
      ...record,
      mobile,
      mobileNormalized: mobile,
    };
    await prisma.patientMaster.create({ data: insertRecord as any });
    patient = insertRecord as any;
  }

  // --- Create/find portal_user ---
  let portalUser =
    (await prisma.patientPortalUser.findFirst({ where: { tenantId, patientMasterId: patient.id } })) ||
    (await prisma.patientPortalUser.findFirst({ where: { tenantId, mobile } }));

  if (portalUser && portalUser.patientMasterId && portalUser.patientMasterId !== patient.id) {
    return NextResponse.json({ error: 'Mobile linked to another patient' }, { status: 409 });
  }

  const now = new Date();
  if (!portalUser) {
    portalUser = await prisma.patientPortalUser.create({
      data: {
        tenantId,
        mobile,
        patientMasterId: patient.id,
        createdAt: now,
        updatedAt: now,
      },
    });
  } else {
    const patch: any = { updatedAt: now };
    if (!portalUser.patientMasterId) patch.patientMasterId = patient.id;
    if (portalUser.mobile !== mobile) patch.mobile = mobile;
    if (Object.keys(patch).length > 1) {
      await prisma.patientPortalUser.updateMany({
        where: { tenantId, id: portalUser.id },
        data: patch,
      });
      portalUser = { ...portalUser, ...patch };
    }
  }

  // --- Create session ---
  const sessionId = await createPortalSession(tenantId, portalUser.id, portalUser.patientMasterId || null);
  const token = generatePortalToken({
    portalUserId: portalUser.id,
    tenantId,
    mobile,
    sessionId,
    patientMasterId: portalUser.patientMasterId || null,
  });

  // --- Mark pending registration as completed ---
  await prisma.patientPortalPendingRegistration.updateMany({
    where: { id: pendingId, tenantId },
    data: { status: 'COMPLETED', completedAt: now },
  });

  const response = NextResponse.json({
    success: true,
    patientMasterId: portalUser.patientMasterId || null,
    portalUser: { id: portalUser.id, mobile: portalUser.mobile, patientMasterId: portalUser.patientMasterId || null },
  });
  setPortalCookie(response, token, request);
  return response;
});
