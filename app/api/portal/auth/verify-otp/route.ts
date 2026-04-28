import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import {
  createPortalSession,
  generatePortalToken,
  normalizeMobile,
  setPortalCookie,
  verifyOtp,
} from '@/lib/portal/auth';
import { normalizeIdNumber, normalizeIdType } from '@/lib/portal/identity';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const portalVerifyOtpBodySchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  otp: z.string().min(1, 'otp is required'),
  mobile: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, portalVerifyOtpBodySchema);
  if ('error' in v) return v.error;

  const tenantId = String(body.tenantId || '').trim();
  const otp = String(body.otp || '').trim();
  const idType = normalizeIdType(body.idType);
  const idNumberNormalized = normalizeIdNumber(body.idNumber);
  let mobile = normalizeMobile(String(body.mobile || '').trim());
  let patientMasterId: string | null = null;
  if (!tenantId || !otp) {
    return NextResponse.json({ error: 'tenantId and otp are required' }, { status: 400 });
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
    patientMasterId = String(patient.id || '').trim() || null;
  }

  if (!mobile) {
    return NextResponse.json({ error: 'mobile or idType/idNumber is required' }, { status: 400 });
  }
  const now = new Date();
  const windowStart = new Date(now.getTime() - ATTEMPT_WINDOW_MS);
  const lockCount = await prisma.patientPortalRateLimit.count({
    where: {
      tenantId,
      type: 'otp_lock',
      key: mobile,
      createdAt: { gte: windowStart },
    },
  });
  if (lockCount > 0) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const isValid = await verifyOtp(null, mobile, otp);

  if (!isValid) {
    const attempts = await prisma.patientPortalRateLimit.count({
      where: {
        tenantId,
        type: 'otp_attempt',
        key: mobile,
        createdAt: { gte: windowStart },
      },
    });
    await prisma.patientPortalRateLimit.create({
      data: { tenantId, type: 'otp_attempt', key: mobile },
    });
    if (attempts + 1 >= MAX_ATTEMPTS) {
      await prisma.patientPortalRateLimit.create({
        data: { tenantId, type: 'otp_lock', key: mobile },
      });
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 });
  }

  let portalUser: any =
    (patientMasterId
      ? await prisma.patientPortalUser.findFirst({ where: { tenantId, patientMasterId } })
      : null) ||
    (await prisma.patientPortalUser.findFirst({ where: { tenantId, mobile } }));

  if (portalUser && patientMasterId && portalUser.patientMasterId && portalUser.patientMasterId !== patientMasterId) {
    return NextResponse.json({ error: 'Mobile linked to another patient' }, { status: 409 });
  }

  if (!portalUser) {
    portalUser = await prisma.patientPortalUser.create({
      data: {
        tenantId,
        mobile,
        patientMasterId: patientMasterId || null,
      },
    });
  } else {
    const patch: any = {};
    if (patientMasterId && !portalUser.patientMasterId) {
      patch.patientMasterId = patientMasterId;
    }
    if (mobile && portalUser.mobile !== mobile) {
      patch.mobile = mobile;
    }
    if (Object.keys(patch).length > 0) {
      await prisma.patientPortalUser.updateMany({
        where: { tenantId, id: portalUser.id },
        data: patch,
      });
      portalUser = { ...portalUser, ...patch };
    }
  }

  const sessionId = await createPortalSession(tenantId, portalUser.id, portalUser.patientMasterId || null);
  const token = generatePortalToken({
    portalUserId: portalUser.id,
    tenantId,
    mobile,
    sessionId,
    patientMasterId: portalUser.patientMasterId || null,
  });

  const response = NextResponse.json({
    success: true,
    portalUser: { id: portalUser.id, mobile: portalUser.mobile, patientMasterId: portalUser.patientMasterId || null },
    patientMasterId: portalUser.patientMasterId || null,
  });
  setPortalCookie(response, token, request);
  return response;
});
