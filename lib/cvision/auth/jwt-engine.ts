import { logger } from '@/lib/monitoring/logger';
/**
 * CVision API JWT Engine
 *
 * Provides Bearer-token authentication for CVision API/mobile access.
 * This is SEPARATE from the existing cookie-based web session auth.
 *
 * - Access tokens: short-lived (15 min), stateless, for API calls
 * - Refresh tokens: long-lived (7 days), stored hashed in DB, rotated on use
 *
 * Tokens are verified via Authorization: Bearer <token> header,
 * NOT via cookies. The existing cookie-based auth is untouched.
 */

import crypto from 'crypto';
import { getCVisionDb } from '@/lib/cvision/db';

// Per-process random fallback — safe for dev, but tokens won't survive restarts.
// In production, set CVISION_API_SECRET and CVISION_REFRESH_SECRET env vars.
const FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');
const JWT_SECRET = process.env.CVISION_API_SECRET || process.env.JWT_SECRET || (() => {
  logger.warn('[CVision JWT] WARNING: No CVISION_API_SECRET or JWT_SECRET env var set. Using random per-process secret — tokens will not survive restarts.');
  return FALLBACK_SECRET;
})();
const REFRESH_SECRET = process.env.CVISION_REFRESH_SECRET || (() => {
  logger.warn('[CVision JWT] WARNING: No CVISION_REFRESH_SECRET env var set. Using derived secret.');
  return JWT_SECRET + '-refresh-' + crypto.randomBytes(8).toString('hex');
})();

export const ACCESS_TOKEN_EXPIRY = 15 * 60;           // 15 minutes
export const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

export interface ApiTokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  name: string;
  type: 'access' | 'refresh';
  jti?: string;
  iat: number;
  exp: number;
}

// ─── Base64url helpers ───────────────────────────────────────

function b64Encode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

function b64Decode(data: string): string {
  return Buffer.from(data, 'base64url').toString();
}

function hmacSign(header: string, payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
}

// ─── Token Generation ────────────────────────────────────────

export function generateAccessToken(user: {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  name: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64Encode(JSON.stringify({
    userId: user.userId,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    name: user.name,
    type: 'access',
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY,
  }));
  return `${header}.${payload}.${hmacSign(header, payload, JWT_SECRET)}`;
}

export function generateRefreshToken(user: {
  userId: string;
  tenantId: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64Encode(JSON.stringify({
    userId: user.userId,
    tenantId: user.tenantId,
    type: 'refresh',
    jti: crypto.randomBytes(32).toString('hex'),
    iat: now,
    exp: now + REFRESH_TOKEN_EXPIRY,
  }));
  return `${header}.${payload}.${hmacSign(header, payload, REFRESH_SECRET)}`;
}

// ─── Token Verification ──────────────────────────────────────

export function verifyToken(token: string, type: 'access' | 'refresh'): ApiTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const secret = type === 'access' ? JWT_SECRET : REFRESH_SECRET;
    const expectedSig = hmacSign(parts[0], parts[1], secret);

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(parts[2]))) return null;

    const payload: ApiTokenPayload = JSON.parse(b64Decode(parts[1]));

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.type !== type) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Token Hashing (for DB storage) ──────────────────────────

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── Refresh Token DB Operations ─────────────────────────────

export async function storeRefreshToken(
  tenantId: string,
  userId: string,
  refreshToken: string,
  deviceInfo?: string,
  ipAddress?: string,
): Promise<void> {
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_refresh_tokens');

  await col.insertOne({
    tenantId,
    userId,
    tokenHash: hashToken(refreshToken),
    deviceInfo: deviceInfo || null,
    ipAddress: ipAddress || null,
    isRevoked: false,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000),
    lastUsedAt: new Date(),
  });

  // Prune expired tokens
  await col.deleteMany({ expiresAt: { $lt: new Date() } }).catch(() => {});
}

export async function validateRefreshToken(
  tenantId: string,
  refreshToken: string,
): Promise<boolean> {
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_refresh_tokens');
  const record = await col.findOne({
    tokenHash: hashToken(refreshToken),
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });

  if (record) {
    await col.updateOne({ _id: record._id, tenantId }, { $set: { lastUsedAt: new Date() } });
    return true;
  }
  return false;
}

export async function revokeRefreshToken(tenantId: string, refreshToken: string): Promise<void> {
  const db = await getCVisionDb(tenantId);
  await db.collection('cvision_refresh_tokens').updateOne(
    { tokenHash: hashToken(refreshToken) },
    { $set: { isRevoked: true } },
  );
}

export async function revokeAllUserTokens(tenantId: string, userId: string): Promise<number> {
  const db = await getCVisionDb(tenantId);
  const result = await db.collection('cvision_refresh_tokens').updateMany(
    { tenantId, userId, isRevoked: false },
    { $set: { isRevoked: true } },
  );
  return result.modifiedCount;
}

export async function getActiveSessions(tenantId: string, userId: string): Promise<any[]> {
  const db = await getCVisionDb(tenantId);
  return db.collection('cvision_refresh_tokens')
    .find({ tenantId, userId, isRevoked: false, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .project({ tokenHash: 0 })
    .toArray();
}

// ─── Helper: extract Bearer token from request ───────────────

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}
