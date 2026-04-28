import * as otplib from 'otplib';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '@/lib/env';

const authenticator = (otplib as any)?.authenticator as any;

// Configure TOTP
if (authenticator) {
  authenticator.options = {
    digits: 6,
    step: 30, // 30 seconds
    window: 1, // Allow 1 step before/after for clock drift
  };
}

/**
 * Generate a new 2FA secret for a user
 */
export function generate2FASecret(
  email: string,
  issuer: string = 'Thea Health'
): {
  secret: string;
  otpAuthUrl: string;
} {
  if (!authenticator) {
    throw new Error('Authenticator not available');
  }
  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(email, issuer, secret);

  return { secret, otpAuthUrl };
}

/**
 * Generate QR code as data URL
 */
export async function generateQRCode(otpAuthUrl: string): Promise<string> {
  return await QRCode.toDataURL(otpAuthUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

/**
 * Verify a TOTP token
 */
export function verify2FAToken(token: string, secret: string): boolean {
  try {
    if (!authenticator) return false;
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const randomBytes = crypto.randomBytes(8);
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 8 }, (_, idx) =>
      charset[randomBytes[idx] % 32]
    ).join('');
    codes.push(code);
  }
  return codes;
}

const TEMP_TOKEN_EXPIRES_IN = '10m';

export function generateTempToken(payload: { userId: string; activeTenantId?: string | null }): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TEMP_TOKEN_EXPIRES_IN });
}

export function verifyTempToken(token: string): { userId: string; activeTenantId?: string | null } | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as { userId: string; activeTenantId?: string | null };
  } catch {
    return null;
  }
}
