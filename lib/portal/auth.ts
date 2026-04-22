import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { sendOTP } from '@/lib/notifications/smsService';

const PORTAL_TOKEN_COOKIE = 'portal-token';
const PORTAL_SESSION_DAYS = Number(process.env.PORTAL_SESSION_DAYS || '7');
const PORTAL_IDLE_MINUTES = Number(process.env.PORTAL_IDLE_MINUTES || '30');

// OTP Configuration
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 3;
const OTP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type PortalTokenPayload = {
  portalUserId: string;
  tenantId: string;
  mobile: string;
  sessionId: string;
  patientMasterId?: string | null;
};

export function normalizeMobile(value: string) {
  return String(value || '')
    .trim()
    .replace(/[^0-9+]/g, '')
    .replace(/^00/, '+');
}

export function generatePortalToken(payload: PortalTokenPayload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${PORTAL_SESSION_DAYS}d` });
}

export function verifyPortalToken(token: string): PortalTokenPayload | null {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  try {
    return jwt.verify(token, process.env.JWT_SECRET) as PortalTokenPayload;
  } catch {
    return null;
  }
}

export function setPortalCookie(response: NextResponse, token: string, request: NextRequest) {
  const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
  const isSecure = protocol === 'https';
  response.cookies.set(PORTAL_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure,
    maxAge: PORTAL_SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

export function clearPortalCookie(response: NextResponse) {
  response.cookies.set(PORTAL_TOKEN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    maxAge: 0,
    path: '/',
  });
}

export async function createPortalSession(tenantId: string, portalUserId: string, patientMasterId?: string | null) {
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PORTAL_SESSION_DAYS * 24 * 60 * 60 * 1000);

  // Resolve tenantId key to UUID
  const tenant = await prisma.tenant.findFirst({ where: { tenantId } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  await prisma.patientPortalSession.create({
    data: {
      id: sessionId,
      tenantId: tenant.id,
      portalUserId,
      patientMasterId: patientMasterId || null,
      lastSeenAt: now,
      expiresAt,
    },
  });

  return sessionId;
}

export async function validatePortalSession(tenantId: string, sessionId: string) {
  // Resolve tenantId key to UUID
  const tenant = await prisma.tenant.findFirst({ where: { tenantId } });
  if (!tenant) return { valid: false };

  const session = await prisma.patientPortalSession.findFirst({
    where: { id: sessionId, tenantId: tenant.id },
  });
  if (!session) return { valid: false };

  const lastSeenAt = session.lastSeenAt || session.createdAt;
  if (lastSeenAt && PORTAL_IDLE_MINUTES > 0) {
    const idleMs = PORTAL_IDLE_MINUTES * 60 * 1000;
    if (new Date(lastSeenAt).getTime() + idleMs < Date.now()) {
      await prisma.patientPortalSession.delete({ where: { id: sessionId } });
      return { valid: false, expired: true };
    }
  }

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    await prisma.patientPortalSession.delete({ where: { id: sessionId } });
    return { valid: false, expired: true };
  }

  await prisma.patientPortalSession.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  });

  return { valid: true, session };
}

export function requirePortalAuth(request: NextRequest) {
  const token = request.cookies.get(PORTAL_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = verifyPortalToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  return payload;
}

export async function requirePortalSession(request: NextRequest) {
  const payload = requirePortalAuth(request);
  if (payload instanceof NextResponse) return payload;
  const sessionCheck = await validatePortalSession(payload.tenantId, payload.sessionId);
  if (!sessionCheck.valid) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }
  return payload;
}

// Generate a secure 6-digit OTP
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Store OTP in database (Prisma: OtpToken model)
export async function createOtp(_dbOrTenantId: any, mobile: string): Promise<{ otp: string; expiresAt: Date }> {
  const otp = generateSecureOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  // Check rate limit
  const rateWindow = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS);
  const recentOtps = await prisma.otpToken.count({
    where: {
      mobile,
      createdAt: { gte: rateWindow },
    },
  });

  if (recentOtps >= OTP_MAX_ATTEMPTS) {
    throw new Error('Too many OTP requests. Please try again later.');
  }

  // Store OTP
  await prisma.otpToken.create({
    data: {
      otp,
      mobile,
      expiresAt,
      attempts: 0,
      verified: false,
    },
  });

  return { otp, expiresAt };
}

// Verify OTP
export async function verifyOtp(_dbOrTenantId: any, mobile: string, inputOtp: string): Promise<boolean> {
  const now = new Date();

  const record = await prisma.otpToken.findFirst({
    where: {
      mobile,
      otp: inputOtp,
      expiresAt: { gt: now },
      verified: false,
    },
  });

  if (!record) {
    // Increment attempts on the latest OTP for this mobile
    const latestOtp = await prisma.otpToken.findFirst({
      where: {
        mobile,
        expiresAt: { gt: now },
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (latestOtp) {
      await prisma.otpToken.update({
        where: { id: latestOtp.id },
        data: { attempts: { increment: 1 } },
      });
    }
    return false;
  }

  // Mark as verified
  await prisma.otpToken.update({
    where: { id: record.id },
    data: { verified: true, verifiedAt: new Date() },
  });

  return true;
}

// Placeholder for SMS sending - implement with Twilio/local provider
export async function sendOtpSms(mobile: string, otp: string): Promise<void> {
  const result = await sendOTP(mobile, otp);
  if (!result.success) {
    logger.error('Failed to send OTP', { category: 'auth', mobile, error: result.error || 'Unknown error' });
  }
}
