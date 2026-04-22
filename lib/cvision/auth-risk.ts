import { logger } from '@/lib/monitoring/logger';
/**
 * CVision (HR OS) - Auth Risk Scoring
 * 
 * MVP implementation for suspicious login detection.
 * Logs login attempts with IP, userAgent, country, timestamp.
 * Flags suspicious if: too many failed attempts or new IP for user within short window.
 * 
 * Does NOT block logins - only scores and audits.
 */

import { Db, Collection } from '@/lib/cvision/infra/mongo-compat';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Types
// =============================================================================

export interface CvisionAuthEvent {
  id: string;
  tenantId: string;
  userId?: string;
  email?: string;
  ip: string;
  userAgent: string;
  country?: string;
  success: boolean;
  riskScore: number;
  riskFactors: RiskFactor[];
  eventType: AuthEventType;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type AuthEventType = 
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_change'
  | 'password_reset_request'
  | 'session_expired'
  | 'token_refresh';

export interface RiskFactor {
  type: RiskFactorType;
  weight: number;
  description: string;
}

export type RiskFactorType =
  | 'new_ip'
  | 'new_device'
  | 'failed_attempts'
  | 'rapid_attempts'
  | 'unusual_time'
  | 'unusual_country'
  | 'concurrent_sessions'
  | 'impossible_travel';

// =============================================================================
// Configuration
// =============================================================================

export const AUTH_RISK_CONFIG = {
  /** Time window for failed attempt checks (in milliseconds) */
  FAILED_ATTEMPT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes

  /** Max failed attempts before flagging */
  MAX_FAILED_ATTEMPTS: 5,

  /** Time window for new IP checks (in milliseconds) */
  NEW_IP_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours

  /** Time window for rapid attempt detection (in milliseconds) */
  RAPID_ATTEMPT_WINDOW_MS: 60 * 1000, // 1 minute

  /** Max attempts in rapid window before flagging */
  RAPID_ATTEMPT_THRESHOLD: 3,

  /** Risk score thresholds */
  RISK_THRESHOLDS: {
    LOW: 20,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 90,
  },

  /** Weight for each risk factor */
  RISK_WEIGHTS: {
    new_ip: 25,
    new_device: 20,
    failed_attempts: 30,
    rapid_attempts: 35,
    unusual_time: 15,
    unusual_country: 40,
    concurrent_sessions: 10,
    impossible_travel: 50,
  },
} as const;

// =============================================================================
// Collection Helper
// =============================================================================

const COLLECTION_NAME = 'cvision_auth_events';

export function getAuthEventsCollection(db: Db): Collection<CvisionAuthEvent> {
  return db.collection<CvisionAuthEvent>(COLLECTION_NAME);
}

// =============================================================================
// Auth Event Logging
// =============================================================================

export interface LogAuthEventParams {
  db: Db;
  tenantId: string;
  userId?: string;
  email?: string;
  ip: string;
  userAgent: string;
  country?: string;
  success: boolean;
  eventType: AuthEventType;
  metadata?: Record<string, unknown>;
}

/**
 * Log an authentication event and calculate risk score
 * Returns the created event with risk score
 */
export async function logAuthEvent(params: LogAuthEventParams): Promise<CvisionAuthEvent> {
  const { db, tenantId, userId, email, ip, userAgent, country, success, eventType, metadata } = params;

  // Calculate risk score
  const { riskScore, riskFactors } = await calculateRiskScore({
    db,
    tenantId,
    userId,
    email,
    ip,
    userAgent,
    country,
    success,
  });

  const event: CvisionAuthEvent = {
    id: uuidv4(),
    tenantId,
    userId,
    email,
    ip,
    userAgent,
    country,
    success,
    riskScore,
    riskFactors,
    eventType,
    metadata,
    createdAt: new Date(),
  };

  try {
    const collection = getAuthEventsCollection(db);
    await collection.insertOne(event);
  } catch (error) {
    // Don't throw - audit failures should not break auth flow
    logger.error('[CVision AuthRisk] Failed to log auth event:', error);
  }

  return event;
}

// =============================================================================
// Risk Scoring
// =============================================================================

export interface CalculateRiskParams {
  db: Db;
  tenantId: string;
  userId?: string;
  email?: string;
  ip: string;
  userAgent: string;
  country?: string;
  success: boolean;
}

export interface RiskScoreResult {
  riskScore: number;
  riskFactors: RiskFactor[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Calculate risk score based on multiple factors
 */
export async function calculateRiskScore(params: CalculateRiskParams): Promise<RiskScoreResult> {
  const { db, tenantId, userId, email, ip, userAgent, success } = params;
  const riskFactors: RiskFactor[] = [];
  const collection = getAuthEventsCollection(db);

  // Only check historical factors if we have a user identifier
  const userIdentifier = userId || email;
  
  if (userIdentifier) {
    // Check 1: Failed attempts in time window
    const failedAttemptsFactor = await checkFailedAttempts(collection, tenantId, userIdentifier);
    if (failedAttemptsFactor) {
      riskFactors.push(failedAttemptsFactor);
    }

    // Check 2: New IP for this user
    const newIpFactor = await checkNewIp(collection, tenantId, userIdentifier, ip);
    if (newIpFactor) {
      riskFactors.push(newIpFactor);
    }

    // Check 3: Rapid login attempts
    const rapidAttemptsFactor = await checkRapidAttempts(collection, tenantId, userIdentifier);
    if (rapidAttemptsFactor) {
      riskFactors.push(rapidAttemptsFactor);
    }

    // Check 4: New device (userAgent)
    const newDeviceFactor = await checkNewDevice(collection, tenantId, userIdentifier, userAgent);
    if (newDeviceFactor) {
      riskFactors.push(newDeviceFactor);
    }
  }

  // Check 5: Unusual time (outside business hours)
  const unusualTimeFactor = checkUnusualTime();
  if (unusualTimeFactor) {
    riskFactors.push(unusualTimeFactor);
  }

  // Calculate total risk score (capped at 100)
  let riskScore = riskFactors.reduce((sum, factor) => sum + factor.weight, 0);
  riskScore = Math.min(riskScore, 100);

  // If login failed, add base risk
  if (!success) {
    riskScore = Math.min(riskScore + 10, 100);
  }

  // Determine risk level
  const riskLevel = getRiskLevel(riskScore);

  return { riskScore, riskFactors, riskLevel };
}

/**
 * Get risk level from score
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  const { RISK_THRESHOLDS } = AUTH_RISK_CONFIG;
  if (score >= RISK_THRESHOLDS.CRITICAL) return 'critical';
  if (score >= RISK_THRESHOLDS.HIGH) return 'high';
  if (score >= RISK_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

// =============================================================================
// Risk Factor Checks
// =============================================================================

/**
 * Check for too many failed attempts
 */
async function checkFailedAttempts(
  collection: Collection<CvisionAuthEvent>,
  tenantId: string,
  userIdentifier: string
): Promise<RiskFactor | null> {
  const windowStart = new Date(Date.now() - AUTH_RISK_CONFIG.FAILED_ATTEMPT_WINDOW_MS);
  
  const failedCount = await collection.countDocuments({
    tenantId,
    $or: [{ userId: userIdentifier }, { email: userIdentifier }],
    success: false,
    createdAt: { $gte: windowStart },
  });

  if (failedCount >= AUTH_RISK_CONFIG.MAX_FAILED_ATTEMPTS) {
    return {
      type: 'failed_attempts',
      weight: AUTH_RISK_CONFIG.RISK_WEIGHTS.failed_attempts,
      description: `${failedCount} failed login attempts in the last 15 minutes`,
    };
  }

  return null;
}

/**
 * Check if IP is new for this user
 */
async function checkNewIp(
  collection: Collection<CvisionAuthEvent>,
  tenantId: string,
  userIdentifier: string,
  currentIp: string
): Promise<RiskFactor | null> {
  const windowStart = new Date(Date.now() - AUTH_RISK_CONFIG.NEW_IP_WINDOW_MS);
  
  // Find any successful login from this IP in the window
  const existingIp = await collection.findOne({
    tenantId,
    $or: [{ userId: userIdentifier }, { email: userIdentifier }],
    ip: currentIp,
    success: true,
    createdAt: { $gte: windowStart },
  });

  if (!existingIp) {
    // Check if user has any previous successful logins
    const hasHistory = await collection.findOne({
      tenantId,
      $or: [{ userId: userIdentifier }, { email: userIdentifier }],
      success: true,
    });

    // Only flag if user has login history but not from this IP
    if (hasHistory) {
      return {
        type: 'new_ip',
        weight: AUTH_RISK_CONFIG.RISK_WEIGHTS.new_ip,
        description: `Login from new IP address: ${currentIp}`,
      };
    }
  }

  return null;
}

/**
 * Check for rapid login attempts (possible brute force)
 */
async function checkRapidAttempts(
  collection: Collection<CvisionAuthEvent>,
  tenantId: string,
  userIdentifier: string
): Promise<RiskFactor | null> {
  const windowStart = new Date(Date.now() - AUTH_RISK_CONFIG.RAPID_ATTEMPT_WINDOW_MS);
  
  const attemptCount = await collection.countDocuments({
    tenantId,
    $or: [{ userId: userIdentifier }, { email: userIdentifier }],
    createdAt: { $gte: windowStart },
  });

  if (attemptCount >= AUTH_RISK_CONFIG.RAPID_ATTEMPT_THRESHOLD) {
    return {
      type: 'rapid_attempts',
      weight: AUTH_RISK_CONFIG.RISK_WEIGHTS.rapid_attempts,
      description: `${attemptCount} login attempts in the last minute`,
    };
  }

  return null;
}

/**
 * Check if device (userAgent) is new for this user
 */
async function checkNewDevice(
  collection: Collection<CvisionAuthEvent>,
  tenantId: string,
  userIdentifier: string,
  currentUserAgent: string
): Promise<RiskFactor | null> {
  // Normalize userAgent for comparison (extract browser/OS)
  const normalizedUA = normalizeUserAgent(currentUserAgent);
  
  // Check for previous successful logins from similar device
  const recentLogins = await collection.find({
    tenantId,
    $or: [{ userId: userIdentifier }, { email: userIdentifier }],
    success: true,
  }).sort({ createdAt: -1 }).limit(10).toArray();

  // If user has history but no matching device, flag it
  if (recentLogins.length > 0) {
    const hasMatchingDevice = recentLogins.some(
      login => normalizeUserAgent(login.userAgent) === normalizedUA
    );

    if (!hasMatchingDevice) {
      return {
        type: 'new_device',
        weight: AUTH_RISK_CONFIG.RISK_WEIGHTS.new_device,
        description: 'Login from new device/browser',
      };
    }
  }

  return null;
}

/**
 * Check if login is at unusual time (outside business hours)
 */
function checkUnusualTime(): RiskFactor | null {
  const now = new Date();
  const hour = now.getHours();
  
  // Flag logins outside 6 AM - 10 PM
  if (hour < 6 || hour >= 22) {
    return {
      type: 'unusual_time',
      weight: AUTH_RISK_CONFIG.RISK_WEIGHTS.unusual_time,
      description: `Login attempt at unusual hour: ${hour}:00`,
    };
  }

  return null;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Normalize userAgent string for comparison
 * Extracts browser and OS for fingerprinting
 */
function normalizeUserAgent(ua: string): string {
  if (!ua) return 'unknown';
  
  // Simple normalization - extract key parts
  const parts: string[] = [];
  
  // Check for common browsers
  if (ua.includes('Chrome')) parts.push('Chrome');
  else if (ua.includes('Firefox')) parts.push('Firefox');
  else if (ua.includes('Safari')) parts.push('Safari');
  else if (ua.includes('Edge')) parts.push('Edge');
  
  // Check for OS
  if (ua.includes('Windows')) parts.push('Windows');
  else if (ua.includes('Mac')) parts.push('Mac');
  else if (ua.includes('Linux')) parts.push('Linux');
  else if (ua.includes('Android')) parts.push('Android');
  else if (ua.includes('iOS') || ua.includes('iPhone')) parts.push('iOS');
  
  return parts.length > 0 ? parts.join('-') : 'unknown';
}

/**
 * Check if risk score is suspicious (above medium threshold)
 */
export function isSuspiciousLogin(riskScore: number): boolean {
  return riskScore >= AUTH_RISK_CONFIG.RISK_THRESHOLDS.MEDIUM;
}

// =============================================================================
// Query Helpers
// =============================================================================

export interface GetAuthEventsParams {
  db: Db;
  tenantId: string;
  userId?: string;
  email?: string;
  ip?: string;
  eventType?: AuthEventType;
  success?: boolean;
  minRiskScore?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Get auth events with filters
 */
export async function getAuthEvents(params: GetAuthEventsParams): Promise<{
  events: CvisionAuthEvent[];
  total: number;
}> {
  const {
    db,
    tenantId,
    userId,
    email,
    ip,
    eventType,
    success,
    minRiskScore,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = params;

  const collection = getAuthEventsCollection(db);
  
  const filter: Record<string, unknown> = { tenantId };

  if (userId) filter.userId = userId;
  if (email) filter.email = email;
  if (ip) filter.ip = ip;
  if (eventType) filter.eventType = eventType;
  if (success !== undefined) filter.success = success;
  if (minRiskScore !== undefined) filter.riskScore = { $gte: minRiskScore };

  if (startDate || endDate) {
    (filter as any).createdAt = {};
    if (startDate) (filter as any).createdAt.$gte = startDate;
    if (endDate) (filter as any).createdAt.$lte = endDate;
  }

  const [events, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return { events, total };
}

/**
 * Get suspicious login attempts (risk score above threshold)
 */
export async function getSuspiciousLogins(
  db: Db,
  tenantId: string,
  options: { limit?: number; startDate?: Date } = {}
): Promise<CvisionAuthEvent[]> {
  const collection = getAuthEventsCollection(db);
  
  const filter: Record<string, unknown> = {
    tenantId,
    riskScore: { $gte: AUTH_RISK_CONFIG.RISK_THRESHOLDS.MEDIUM },
  };

  if (options.startDate) {
    filter.createdAt = { $gte: options.startDate };
  }

  return collection
    .find(filter)
    .sort({ riskScore: -1, createdAt: -1 })
    .limit(options.limit || 100)
    .toArray();
}

/**
 * Get login statistics for a user
 */
export async function getUserLoginStats(
  db: Db,
  tenantId: string,
  userId: string
): Promise<{
  totalLogins: number;
  failedLogins: number;
  successfulLogins: number;
  uniqueIps: number;
  lastLogin?: Date;
  averageRiskScore: number;
}> {
  const collection = getAuthEventsCollection(db);
  
  const filter = { tenantId, userId };
  
  const [events, uniqueIps] = await Promise.all([
    collection.find(filter).toArray(),
    collection.distinct('ip', filter),
  ]);

  const successfulLogins = events.filter(e => e.success).length;
  const failedLogins = events.filter(e => !e.success).length;
  const totalRiskScore = events.reduce((sum, e) => sum + e.riskScore, 0);
  const lastLogin = events
    .filter(e => e.success)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt;

  return {
    totalLogins: events.length,
    failedLogins,
    successfulLogins,
    uniqueIps: uniqueIps.length,
    lastLogin,
    averageRiskScore: events.length > 0 ? Math.round(totalRiskScore / events.length) : 0,
  };
}

// =============================================================================
// Index Creation
// =============================================================================

/**
 * Create indexes for auth events collection
 * Should be called during app initialization
 */
export async function createAuthEventIndexes(db: Db): Promise<void> {
  const collection = getAuthEventsCollection(db);
  
  await collection.createIndexes([
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { tenantId: 1, userId: 1 }, name: 'tenant_user_idx' },
    { key: { tenantId: 1, email: 1 }, name: 'tenant_email_idx' },
    { key: { tenantId: 1, ip: 1 }, name: 'tenant_ip_idx' },
    { key: { tenantId: 1, riskScore: -1 }, name: 'tenant_risk_idx' },
    { key: { createdAt: -1 }, name: 'created_idx' },
    { key: { tenantId: 1, createdAt: -1 }, name: 'tenant_created_idx' },
    // TTL index - keep events for 90 days
    { key: { createdAt: 1 }, name: 'ttl_idx', expireAfterSeconds: 90 * 24 * 60 * 60 },
  ]);
}
