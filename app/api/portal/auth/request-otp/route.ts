import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { createOtp, normalizeMobile, sendOtpSms } from '@/lib/portal/auth';
import { normalizeIdNumber, normalizeIdType } from '@/lib/portal/identity';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { rateLimitOTP, getRequestIp } from '@/lib/security/rateLimit';

const portalRequestOtpBodySchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  mobile: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_MOBILE = 5;
const MAX_PER_IP = 20;

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

  const v = validateBody(body, portalRequestOtpBodySchema);
  if ('error' in v) return v.error;

  const rl = await rateLimitOTP({ ip: getRequestIp(request), phone: body.mobile || body.phone });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const tenantId = String(body.tenantId || '').trim();
  const idType = normalizeIdType(body.idType);
  const idNumberNormalized = normalizeIdNumber(body.idNumber);
  let mobile = normalizeMobile(String(body.mobile || '').trim());
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  // --- Validate tenant exists and is active ---
  const tenantExists = await prisma.tenant.findFirst({ where: { id: tenantId, status: 'ACTIVE' } });
  if (!tenantExists) {
    return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 });
  }

  if (idType && idNumberNormalized) {
    const idFilter: any = { tenantId };
    if (idType === 'NATIONAL_ID') idFilter.nationalId = idNumberNormalized;
    else if (idType === 'IQAMA') idFilter.iqama = idNumberNormalized;
    else if (idType === 'PASSPORT') idFilter.passport = idNumberNormalized;

    const patient = await prisma.patientMaster.findFirst({ where: idFilter });
    if (!patient || String(patient.status || '') === 'MERGED') {
      return NextResponse.json(
        { error: 'Unable to process request. Please verify your information or contact the hospital.' },
        { status: 400 }
      );
    }
    mobile = normalizeMobile(String((patient as any).mobileNormalized || patient.mobile || '').trim());
    if (!mobile) {
      return NextResponse.json(
        { error: 'Unable to process request. Please verify your information or contact the hospital.' },
        { status: 400 }
      );
    }
  }

  if (!mobile) {
    return NextResponse.json({ error: 'mobile or idType/idNumber is required' }, { status: 400 });
  }
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_WINDOW_MS);
  const ip = getClientIp(request);

  const [mobileCount, ipCount] = await Promise.all([
    prisma.patientPortalRateLimit.count({
      where: { tenantId, type: 'mobile', key: mobile, createdAt: { gte: windowStart } },
    }),
    prisma.patientPortalRateLimit.count({
      where: { tenantId, type: 'ip', key: ip, createdAt: { gte: windowStart } },
    }),
  ]);
  if (mobileCount >= MAX_PER_MOBILE || ipCount >= MAX_PER_IP) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  await Promise.all([
    prisma.patientPortalRateLimit.create({
      data: { tenantId, type: 'mobile', key: mobile },
    }),
    prisma.patientPortalRateLimit.create({
      data: { tenantId, type: 'ip', key: ip },
    }),
  ]);

  try {
    const { otp } = await createOtp(null, mobile);
    await sendOtpSms(mobile, otp);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate OTP';
    const status = message.includes('Too many OTP requests') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ success: true });
});
