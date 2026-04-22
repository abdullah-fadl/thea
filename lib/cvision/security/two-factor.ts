import crypto from 'crypto';
import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { encrypt, decrypt } from './encryption';

/**
 * Lightweight TOTP implementation.
 * Avoids external dependencies (speakeasy / otplib) by using native crypto.
 *
 * TOTP = HOTP(secret, floor(time / period))
 * HOTP = Truncate(HMAC-SHA1(secret, counter))
 */

const PERIOD = 30; // seconds
const DIGITS = 6;
const WINDOW = 1;  // ±1 step tolerance

/* ── Brute-force Protection ─────────────────────────────────────────── */

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;  // run cleanup every 5 minutes

interface AttemptRecord {
  count: number;
  lockedUntil: number | null; // epoch ms, or null if not locked
  lastAttemptAt: number;      // epoch ms
}

// userId → AttemptRecord
const otpAttempts = new Map<string, AttemptRecord>();

// Periodic cleanup: remove entries that have naturally expired so the Map
// does not grow unboundedly in long-running server processes.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [userId, record] of otpAttempts) {
    const expired =
      record.lockedUntil !== null
        ? now > record.lockedUntil          // lockout has lifted
        : now - record.lastAttemptAt > LOCKOUT_DURATION_MS; // stale non-locked entry
    if (expired) otpAttempts.delete(userId);
  }
}, CLEANUP_INTERVAL_MS);

// Do not keep the Node.js event loop alive solely for cleanup.
if (cleanupTimer.unref) cleanupTimer.unref();

/**
 * Check whether a user is currently locked out.
 * Returns `{ locked: true, retryAfterMs }` when locked, or `{ locked: false }`.
 */
function checkLockout(userId: string): { locked: false } | { locked: true; retryAfterMs: number } {
  const record = otpAttempts.get(userId);
  if (!record || record.lockedUntil === null) return { locked: false };

  const now = Date.now();
  if (now < record.lockedUntil) {
    return { locked: true, retryAfterMs: record.lockedUntil - now };
  }

  // Lockout has expired — reset the record.
  otpAttempts.delete(userId);
  return { locked: false };
}

/** Record a failed OTP attempt. Locks the user after MAX_ATTEMPTS failures. */
function recordFailedAttempt(userId: string): void {
  const now = Date.now();
  const record = otpAttempts.get(userId) ?? { count: 0, lockedUntil: null, lastAttemptAt: now };

  record.count += 1;
  record.lastAttemptAt = now;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  otpAttempts.set(userId, record);
}

/** Clear the attempt counter on a successful verification. */
function clearAttempts(userId: string): void {
  otpAttempts.delete(userId);
}

/* ── TOTP Core ─────────────────────────────────────────────────────── */

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const stripped = encoded.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const c of stripped) {
    const val = alphabet.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }
  return Buffer.from(bytes);
}

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, '0');
    result += alphabet[parseInt(chunk, 2)];
  }
  return result;
}

function generateHOTP(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);
  const hmac = crypto.createHmac('sha1', secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % (10 ** DIGITS);
  return code.toString().padStart(DIGITS, '0');
}

function generateTOTP(secret: Buffer, time?: number): string {
  const counter = BigInt(Math.floor((time ?? Date.now() / 1000) / PERIOD));
  return generateHOTP(secret, counter);
}

function verifyTOTP(secret: Buffer, token: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  for (let i = -WINDOW; i <= WINDOW; i++) {
    if (generateTOTP(secret, now + i * PERIOD) === token) return true;
  }
  return false;
}

/* ── Public API ────────────────────────────────────────────────────── */

export async function setup2FA(db: Db, userId: string, userEmail: string) {
  const secretBytes = crypto.randomBytes(20);
  const secretBase32 = base32Encode(secretBytes);

  const issuer = 'CVision';
  const label = `${issuer}:${userEmail}`;
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&digits=${DIGITS}&period=${PERIOD}`;

  await db.collection('cvision_users').updateOne(
    { _id: userId },
    { $set: { twoFactorSecret: encrypt(secretBase32), twoFactorEnabled: false, twoFactorSetupAt: new Date() } },
  );

  return { secret: secretBase32, otpauthUrl };
}

export async function confirm2FA(db: Db, userId: string, token: string): Promise<boolean> {
  const user = await db.collection('cvision_users').findOne({ _id: userId });
  if (!user?.twoFactorSecret) return false;

  const secretBase32 = decrypt(user.twoFactorSecret);
  const secretBuf = base32Decode(secretBase32);

  if (!verifyTOTP(secretBuf, token)) return false;

  // Generate backup codes
  const backupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase(),
  );

  await db.collection('cvision_users').updateOne(
    { _id: userId },
    { $set: { twoFactorEnabled: true, backupCodes: backupCodes.map(c => encrypt(c)) } },
  );

  return true;
}

export async function verify2FAToken(
  db: Db,
  userId: string,
  token: string,
): Promise<{ success: boolean; error?: 'locked' | 'invalid'; retryAfterMs?: number }> {
  // 1. Enforce lockout before touching the DB or doing any crypto work.
  const lockout = checkLockout(userId);
  if (lockout.locked) {
    return { success: false, error: 'locked', retryAfterMs: lockout.retryAfterMs };
  }

  const user = await db.collection('cvision_users').findOne({ _id: userId });
  if (!user?.twoFactorSecret || !user.twoFactorEnabled) {
    // Not configured — do not count as a failed attempt.
    return { success: false, error: 'invalid' };
  }

  const secretBase32 = decrypt(user.twoFactorSecret);
  const secretBuf = base32Decode(secretBase32);

  if (verifyTOTP(secretBuf, token)) {
    clearAttempts(userId);
    return { success: true };
  }

  // Check backup codes
  if (user.backupCodes?.length) {
    for (let i = 0; i < user.backupCodes.length; i++) {
      try {
        const code = decrypt(user.backupCodes[i]);
        if (code === token.toUpperCase()) {
          // Remove used backup code
          const updated = [...user.backupCodes];
          updated.splice(i, 1);
          await db.collection('cvision_users').updateOne(
            { _id: userId },
            { $set: { backupCodes: updated } },
          );
          clearAttempts(userId);
          return { success: true };
        }
      } catch { /* skip invalid codes */ }
    }
  }

  // Token did not match — record the failure.
  recordFailedAttempt(userId);

  // Re-check: if this failure pushed the user over the limit, surface the
  // lockout information immediately so the caller can give a useful message.
  const newLockout = checkLockout(userId);
  if (newLockout.locked) {
    return { success: false, error: 'locked', retryAfterMs: newLockout.retryAfterMs };
  }

  return { success: false, error: 'invalid' };
}

export async function disable2FA(db: Db, userId: string) {
  await db.collection('cvision_users').updateOne(
    { _id: userId },
    { $set: { twoFactorEnabled: false }, $unset: { twoFactorSecret: '', backupCodes: '' } },
  );
}

export async function get2FAStatus(db: Db, userId: string) {
  const user = await db.collection('cvision_users').findOne(
    { _id: userId },
    { projection: { twoFactorEnabled: 1, twoFactorSetupAt: 1 } },
  );
  return { enabled: !!user?.twoFactorEnabled, setupAt: user?.twoFactorSetupAt || null };
}
