/**
 * CVision SaaS — API Key Management
 *
 * Generate, validate, revoke, and rate-limit API keys for external integrations.
 * Keys use the format: cvk_live_xxxx / cvk_test_xxxx
 * Only the SHA-256 hash is stored — the plain key is returned once on creation.
 */

import { Collection, Db, ObjectId } from '@/lib/cvision/infra/mongo-compat';
import { createHash, randomBytes } from 'crypto';
import { getPlatformClient } from '@/lib/db/mongo';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface APIKey {
  _id?: ObjectId;
  tenantId: string;
  keyId: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  type: 'LIVE' | 'TEST';
  permissions: string[];
  rateLimit: number;
  lastUsed?: Date;
  usageCount: number;
  ipWhitelist?: string[];
  expiresAt?: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
}

export interface APIKeyValidation {
  valid: boolean;
  tenantId?: string;
  keyId?: string;
  permissions?: string[];
  rateLimit?: number;
  type?: 'LIVE' | 'TEST';
  error?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// Permissions catalog
// ═══════════════════════════════════════════════════════════════════════════

export const API_PERMISSIONS: Record<string, string> = {
  'read:employees': 'Read employee data',
  'write:employees': 'Create/update employees',
  'delete:employees': 'Delete employees',
  'read:attendance': 'Read attendance records',
  'write:attendance': 'Log attendance',
  'read:payroll': 'Read payroll data',
  'write:payroll': 'Process payroll',
  'read:leaves': 'Read leave requests',
  'write:leaves': 'Create/approve leaves',
  'read:performance': 'Read performance reviews',
  'write:performance': 'Submit reviews',
  'read:reports': 'Generate reports',
  'read:recruitment': 'Read job openings',
  'write:recruitment': 'Manage recruitment',
  'manage:webhooks': 'Manage webhook subscriptions',
  'read:tenant': 'Read tenant info',
};

// ═══════════════════════════════════════════════════════════════════════════
// Internal
// ═══════════════════════════════════════════════════════════════════════════

const KEYS_COLLECTION = 'cvision_api_keys';
const RATE_LIMIT_COLLECTION = 'cvision_api_rate_limits';
const USAGE_COLLECTION = 'cvision_api_usage';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateKeyString(type: 'LIVE' | 'TEST'): string {
  const prefix = type === 'LIVE' ? 'cvk_live_' : 'cvk_test_';
  const random = randomBytes(24).toString('base64url').slice(0, 32);
  return `${prefix}${random}`;
}

function generateKeyId(): string {
  return `key_${randomBytes(12).toString('hex')}`;
}

async function getPlatformDb(): Promise<Db> {
  const { db } = await getPlatformClient();
  return db;
}

async function getSystemKeysCollection(): Promise<Collection<APIKey>> {
  const db = await getPlatformDb();
  return db.collection<APIKey>(KEYS_COLLECTION);
}

// ═══════════════════════════════════════════════════════════════════════════
// Generate
// ═══════════════════════════════════════════════════════════════════════════

export async function generateAPIKey(
  tenantId: string,
  params: {
    name: string;
    type: 'LIVE' | 'TEST';
    permissions: string[];
    rateLimit?: number;
    ipWhitelist?: string[];
    expiresAt?: Date;
    createdBy: string;
  },
): Promise<{ key: string; keyId: string }> {
  const col = await getSystemKeysCollection();

  const plainKey = generateKeyString(params.type);
  const keyId = generateKeyId();
  const keyHash = hashKey(plainKey);
  const keyPrefix = plainKey.slice(0, 12) + '...';

  const apiKey: APIKey = {
    tenantId,
    keyId,
    keyHash,
    keyPrefix,
    name: params.name,
    type: params.type,
    permissions: params.permissions,
    rateLimit: params.rateLimit || 60,
    usageCount: 0,
    ipWhitelist: params.ipWhitelist,
    expiresAt: params.expiresAt,
    isActive: true,
    createdBy: params.createdBy,
    createdAt: new Date(),
  };

  await col.insertOne(apiKey as any);

  return { key: plainKey, keyId };
}

// ═══════════════════════════════════════════════════════════════════════════
// Validate
// ═══════════════════════════════════════════════════════════════════════════

export async function validateAPIKey(
  keyString: string,
  clientIp?: string,
): Promise<APIKeyValidation> {
  if (!keyString || !keyString.startsWith('cvk_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const keyHash = hashKey(keyString);
  const col = await getSystemKeysCollection();

  const apiKey = await col.findOne({ keyHash });
  if (!apiKey) {
    return { valid: false, error: 'API key not found' };
  }

  if (!apiKey.isActive) {
    return { valid: false, error: 'API key has been revoked' };
  }

  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  if (apiKey.ipWhitelist?.length && clientIp) {
    if (!apiKey.ipWhitelist.includes(clientIp)) {
      return { valid: false, error: 'IP address not whitelisted' };
    }
  }

  // Update lastUsed
  col.updateOne(
    { keyHash },
    { $set: { lastUsed: new Date() }, $inc: { usageCount: 1 } },
  ).catch(() => {});

  return {
    valid: true,
    tenantId: apiKey.tenantId,
    keyId: apiKey.keyId,
    permissions: apiKey.permissions,
    rateLimit: apiKey.rateLimit,
    type: apiKey.type,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// List / Revoke
// ═══════════════════════════════════════════════════════════════════════════

export async function listAPIKeys(tenantId: string): Promise<APIKey[]> {
  const col = await getSystemKeysCollection();
  return col.find(
    { tenantId, revokedAt: { $exists: false } },
    { projection: { keyHash: 0 } },
  ).sort({ createdAt: -1 }).toArray();
}

export async function revokeAPIKey(
  tenantId: string,
  keyId: string,
  revokedBy: string,
): Promise<void> {
  const col = await getSystemKeysCollection();
  await col.updateOne(
    { tenantId, keyId },
    { $set: { isActive: false, revokedAt: new Date(), revokedBy } },
  );
}

export async function getAPIKey(tenantId: string, keyId: string): Promise<APIKey | null> {
  const col = await getSystemKeysCollection();
  return col.findOne(
    { tenantId, keyId },
    { projection: { keyHash: 0 } },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiting (sliding window per minute)
// ═══════════════════════════════════════════════════════════════════════════

export async function checkRateLimit(
  keyId: string,
  limit: number,
): Promise<RateLimitResult> {
  const db = await getPlatformDb();
  const col = db.collection(RATE_LIMIT_COLLECTION);

  const now = new Date();
  const windowStart = new Date(now.getTime() - 60_000);
  const resetAt = new Date(now.getTime() + 60_000);

  // Count requests in the current window
  const count = await col.countDocuments({
    keyId,
    timestamp: { $gte: windowStart },
  });

  if (count >= limit) {
    return { allowed: false, remaining: 0, limit, resetAt };
  }

  // Record this request
  await col.insertOne({ keyId, timestamp: now });

  // Cleanup old entries (fire-and-forget)
  col.deleteMany({
    keyId,
    timestamp: { $lt: new Date(now.getTime() - 120_000) },
  }).catch(() => {});

  return {
    allowed: true,
    remaining: limit - count - 1,
    limit,
    resetAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Usage tracking
// ═══════════════════════════════════════════════════════════════════════════

export async function trackAPIUsage(
  keyId: string,
  tenantId: string,
  endpoint: string,
  method: string,
  statusCode: number,
): Promise<void> {
  try {
    const db = await getPlatformDb();
    const col = db.collection(USAGE_COLLECTION);
    await col.insertOne({
      keyId,
      tenantId,
      endpoint,
      method,
      statusCode,
      timestamp: new Date(),
    });
  } catch {
    // Non-critical — don't block the response
  }
}

export async function getAPIUsageStats(
  tenantId: string,
  keyId?: string,
  days = 30,
): Promise<{
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  topEndpoints: { endpoint: string; count: number }[];
}> {
  const db = await getPlatformDb();
  const col = db.collection(USAGE_COLLECTION);

  const since = new Date(Date.now() - days * 86400000);
  const filter: Record<string, any> = { tenantId, timestamp: { $gte: since } };
  if (keyId) filter.keyId = keyId;

  const [total, successes, topEndpoints] = await Promise.all([
    col.countDocuments(filter),
    col.countDocuments({ ...filter, statusCode: { $gte: 200, $lt: 300 } }),
    col.aggregate([
      { $match: filter },
      { $group: { _id: '$endpoint', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray(),
  ]);

  return {
    totalRequests: total,
    successRequests: successes,
    errorRequests: total - successes,
    topEndpoints: topEndpoints.map((e: any) => ({ endpoint: e._id, count: e.count })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Permission checking
// ═══════════════════════════════════════════════════════════════════════════

export function hasAPIPermission(
  grantedPermissions: string[],
  requiredPermission: string,
): boolean {
  if (grantedPermissions.includes('*')) return true;
  if (grantedPermissions.includes(requiredPermission)) return true;

  // 'read:employees' is covered by 'read:*' or '*:employees'
  const [action, resource] = requiredPermission.split(':');
  if (grantedPermissions.includes(`${action}:*`)) return true;
  if (grantedPermissions.includes(`*:${resource}`)) return true;

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Indexes
// ═══════════════════════════════════════════════════════════════════════════

export async function ensureAPIKeyIndexes(): Promise<void> {
  const col = await getSystemKeysCollection();
  await col.createIndex({ keyHash: 1 }, { unique: true });
  await col.createIndex({ tenantId: 1, keyId: 1 }, { unique: true });
  await col.createIndex({ tenantId: 1, isActive: 1 });

  const db = await getPlatformDb();
  const rateLimitCol = db.collection(RATE_LIMIT_COLLECTION);
  await rateLimitCol.createIndex({ keyId: 1, timestamp: 1 });
  await rateLimitCol.createIndex({ timestamp: 1 }, { expireAfterSeconds: 120 });

  const usageCol = db.collection(USAGE_COLLECTION);
  await usageCol.createIndex({ tenantId: 1, timestamp: -1 });
  await usageCol.createIndex({ keyId: 1, timestamp: -1 });
  await usageCol.createIndex({ timestamp: 1 }, { expireAfterSeconds: 90 * 86400 });
}
