import crypto from 'crypto';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

const SESSIONS = 'cvision_sessions';
const LOGIN_HISTORY = 'cvision_login_history';

const SESSION_TTL_HOURS = 24;

/* ── Types ─────────────────────────────────────────────────────────── */

export interface UserSession {
  _id?: any;
  tenantId: string;
  userId: string;
  token: string;
  device: string;
  ipAddress: string;
  location?: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  active: boolean;
}

export interface LoginHistoryEntry {
  _id?: any;
  tenantId: string;
  userId: string;
  device: string;
  ipAddress: string;
  location?: string;
  success: boolean;
  failureReason?: string;
  twoFactorUsed: boolean;
  suspicious: boolean;
  reportedAt?: Date;
  createdAt: Date;
}

/* ── Session CRUD ──────────────────────────────────────────────────── */

export async function createSession(
  db: Db, tenantId: string, userId: string,
  meta: { device: string; ipAddress: string; location?: string },
): Promise<UserSession> {
  const now = new Date();
  const session: UserSession = {
    tenantId,
    userId,
    token: crypto.randomBytes(48).toString('hex'),
    device: meta.device,
    ipAddress: meta.ipAddress,
    location: meta.location,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000),
    active: true,
  };

  await db.collection(SESSIONS).insertOne(session);

  await db.collection(LOGIN_HISTORY).insertOne({
    tenantId, userId,
    device: meta.device, ipAddress: meta.ipAddress, location: meta.location,
    success: true, twoFactorUsed: false, suspicious: false,
    createdAt: now,
  });

  return session;
}

export async function validateSession(db: Db, token: string): Promise<UserSession | null> {
  const session = await db.collection(SESSIONS).findOne({ token, active: true }) as UserSession | null;
  if (!session) return null;
  if (new Date() > new Date(session.expiresAt)) {
    await db.collection(SESSIONS).updateOne({ _id: session._id, tenantId: session.tenantId }, { $set: { active: false } });
    return null;
  }
  // Sliding expiry: extend TTL from the current time on every valid activity,
  // so that active users are never logged out while they are using the system.
  const now = new Date();
  const newExpiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await db.collection(SESSIONS).updateOne(
    { _id: session._id, tenantId: session.tenantId },
    { $set: { lastActivityAt: now, expiresAt: newExpiresAt } },
  );
  return { ...session, lastActivityAt: now, expiresAt: newExpiresAt };
}

export async function getActiveSessions(db: Db, tenantId: string, userId: string): Promise<UserSession[]> {
  return db.collection(SESSIONS).find({
    tenantId, userId, active: true,
    expiresAt: { $gt: new Date() },
  }).sort({ lastActivityAt: -1 }).toArray() as any;
}

export async function revokeSession(db: Db, tenantId: string, userId: string, sessionId: string) {
  return db.collection(SESSIONS).updateOne(
    { _id: sessionId as unknown, tenantId, userId },
    { $set: { active: false } },
  );
}

export async function revokeAllSessions(db: Db, tenantId: string, userId: string, exceptToken?: string) {
  const query: any = { tenantId, userId, active: true };
  if (exceptToken) query.token = { $ne: exceptToken };
  return db.collection(SESSIONS).updateMany(query, { $set: { active: false } });
}

/* ── Login History ─────────────────────────────────────────────────── */

export async function recordLoginAttempt(
  db: Db, tenantId: string, userId: string,
  meta: { device: string; ipAddress: string; location?: string; success: boolean; failureReason?: string; twoFactorUsed?: boolean },
) {
  await db.collection(LOGIN_HISTORY).insertOne({
    tenantId, userId,
    device: meta.device,
    ipAddress: meta.ipAddress,
    location: meta.location,
    success: meta.success,
    failureReason: meta.failureReason,
    twoFactorUsed: meta.twoFactorUsed || false,
    suspicious: false,
    createdAt: new Date(),
  });
}

export async function getLoginHistory(db: Db, tenantId: string, userId: string, limit = 20) {
  return db.collection(LOGIN_HISTORY).find({ tenantId, userId })
    .sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function reportSuspiciousLogin(db: Db, tenantId: string, userId: string, loginId: string) {
  await db.collection(LOGIN_HISTORY).updateOne(
    { _id: loginId as unknown, tenantId, userId },
    { $set: { suspicious: true, reportedAt: new Date() } },
  );
  // Revoke all sessions for safety
  await revokeAllSessions(db, tenantId, userId);
  return { revoked: true };
}

/* ── Cleanup ───────────────────────────────────────────────────────── */

export async function cleanupExpiredSessions(db: Db) {
  return db.collection(SESSIONS).deleteMany({ expiresAt: { $lt: new Date() } });
}
