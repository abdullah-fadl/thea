import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { createOtp, normalizeMobile, sendOtpSms } from '@/lib/portal/auth';
import { normalizeIdNumber, normalizeIdType } from '@/lib/portal/identity';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const portalRegisterBodySchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  fullName: z.string().min(1, 'fullName is required').max(200),
  idType: z.string().min(1, 'idType is required'),
  idNumber: z.string().min(1, 'idNumber is required'),
  mobile: z.string().min(1, 'mobile is required'),
}).passthrough();

function sanitizeText(text: string): string {
  return String(text || '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 10;

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

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, portalRegisterBodySchema);
  if ('error' in v) return v.error;

  const tenantId = String(body.tenantId || '').trim();
  const fullName = sanitizeText(body.fullName);
  const idType = normalizeIdType(body.idType);
  const idNumberNormalized = normalizeIdNumber(body.idNumber);
  const mobile = normalizeMobile(String(body.mobile || '').trim());

  if (!tenantId || !fullName || !idType || !idNumberNormalized || !mobile) {
    return NextResponse.json(
      { error: 'tenantId, fullName, idType, idNumber, and mobile are required' },
      { status: 400 }
    );
  }

  // --- Validate tenant exists and is active ---
  const tenantExists = await prisma.tenant.findFirst({ where: { id: tenantId, status: 'ACTIVE' } });
  if (!tenantExists) {
    return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 });
  }

  // --- Rate limiting by IP ---
  const ip = getClientIp(request);
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const ipCount = await prisma.patientPortalRateLimit.count({
    where: {
      tenantId,
      type: 'register_ip',
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
      type: 'register_ip',
      key: ip,
    },
  });

  // --- Rate limiting by idNumber ---
  const idRateCount = await prisma.patientPortalRateLimit.count({
    where: {
      tenantId,
      type: 'register_id',
      key: idNumberNormalized,
      createdAt: { gte: windowStart },
    },
  });
  if (idRateCount >= 3) {
    return NextResponse.json(
      { error: 'Too many requests for this identifier. Please try again later.' },
      { status: 429 }
    );
  }
  await prisma.patientPortalRateLimit.create({
    data: {
      tenantId,
      type: 'register_id',
      key: idNumberNormalized,
    },
  });

  // --- Validate ID number format ---
  if (idType === 'NATIONAL_ID' || idType === 'IQAMA') {
    if (!/^[12]\d{9}$/.test(idNumberNormalized)) {
      return NextResponse.json({ error: 'Invalid ID number format' }, { status: 400 });
    }
  } else if (idType === 'PASSPORT') {
    if (idNumberNormalized.length < 5 || idNumberNormalized.length > 20) {
      return NextResponse.json({ error: 'Invalid ID number format' }, { status: 400 });
    }
  }

  // --- Validate patient identity ---
  const idFilter: any = { tenantId };
  if (idType === 'NATIONAL_ID') idFilter.nationalId = idNumberNormalized;
  else if (idType === 'IQAMA') idFilter.iqama = idNumberNormalized;
  else if (idType === 'PASSPORT') idFilter.passport = idNumberNormalized;

  const patient = await prisma.patientMaster.findFirst({ where: idFilter });

  if (patient) {
    if (String(patient.status || '') === 'MERGED') {
      return NextResponse.json({ error: 'Unable to complete registration. Please contact the hospital or try logging in.' }, { status: 409 });
    }
    const existingMobile = normalizeMobile(String((patient as any).mobileNormalized || patient.mobile || '').trim());
    if (existingMobile && existingMobile !== mobile) {
      return NextResponse.json({ error: 'Unable to complete registration. Please contact the hospital or try logging in.' }, { status: 409 });
    }
  }

  // --- Check portal user conflicts ---
  if (patient) {
    const existingPortalUser = await prisma.patientPortalUser.findFirst({
      where: { tenantId, patientMasterId: patient.id },
    });
    if (existingPortalUser) {
      return NextResponse.json({ error: 'Unable to complete registration. Please contact the hospital or try logging in.' }, { status: 409 });
    }
  }

  // --- Save pending registration ---
  const pending = await prisma.patientPortalPendingRegistration.create({
    data: {
      tenantId,
      fullName,
      idType,
      idNumber: idNumberNormalized,
      mobile,
      patientMasterId: patient?.id || null,
      status: 'PENDING_OTP',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  // Cleanup expired pending registrations (fire and forget)
  prisma.patientPortalPendingRegistration.deleteMany({
    where: {
      tenantId,
      status: 'PENDING_OTP',
      expiresAt: { lt: new Date() },
    },
  }).catch(() => {});

  // --- Send OTP ---
  try {
    const { otp } = await createOtp(null, mobile);
    await sendOtpSms(mobile, otp);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate OTP';
    const status = message.includes('Too many OTP requests') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({
    success: true,
    pendingId: pending.id,
    requiresOtp: true,
  });
});
