import { logger } from '@/lib/monitoring/logger';
/**
 * CVision (HR OS) - Audit Logging
 * 
 * Centralized audit logging for all CVision operations.
 * All mutations are logged with actor, timestamp, and change details.
 */

import { v4 as uuidv4 } from 'uuid';
import { CVISION_COLLECTIONS } from './constants';
import type {
  CVisionAuditLog,
  CVisionAuditAction,
  CVisionResourceType,
} from './types';
import { getTenantDbByKey } from '@/lib/cvision/infra/db';

export interface CVisionAuditContext {
  tenantId: string;
  actorUserId: string;
  actorRole: string;
  actorEmail?: string;
  ip?: string;
  userAgent?: string;
}

export interface CVisionAuditOptions {
  resourceId: string;
  success?: boolean;
  errorMessage?: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

/**
 * Log a CVision audit event
 * 
 * @param context - Actor and tenant context
 * @param action - The action being performed
 * @param resourceType - The type of resource being acted upon
 * @param options - Additional audit options
 */
export async function logCVisionAudit(
  context: CVisionAuditContext,
  action: CVisionAuditAction,
  resourceType: CVisionResourceType,
  options: CVisionAuditOptions
): Promise<void> {
  try {
    // Skip audit if tenantId is empty (owner without selected tenant)
    if (!context.tenantId) {
      logger.info('[CVision Audit] Skipping audit log: no tenantId (owner mode)');
      return;
    }

    const db = await getTenantDbByKey(context.tenantId);
    const collection = db.collection(CVISION_COLLECTIONS.auditLogs);

    // Build audit log object — only include fields that exist in the
    // CvisionAuditLog Prisma schema (no updatedAt, createdBy, updatedBy).
    const auditLog: Record<string, any> = {
      id: uuidv4(),
      tenantId: context.tenantId,
      action,
      resourceType,
      resourceId: options.resourceId,
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      actorEmail: context.actorEmail,
      success: options.success !== false,
      errorMessage: options.errorMessage,
      changes: options.changes,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: options.metadata,
      createdAt: new Date(),
    };

    await collection.insertOne(auditLog);
  } catch (error) {
    // Audit logging should never break the application
    logger.error('[CVision Audit] Failed to write audit log:', error);
    if (process.env.NODE_ENV === 'development') {
      logger.error('[CVision Audit] Data:', { context, action, resourceType, options });
    }
  }
}

/**
 * Create audit context from request and auth
 */
export function createCVisionAuditContext(
  auth: {
    userId: string;
    role: string;
    tenantId: string;
    user?: { email?: string };
  },
  request?: {
    headers?: {
      get: (name: string) => string | null;
    };
  }
): CVisionAuditContext {
  return {
    tenantId: auth.tenantId,
    actorUserId: auth.userId,
    actorRole: auth.role,
    actorEmail: auth.user?.email,
    ip: request?.headers?.get('x-forwarded-for') || request?.headers?.get('x-real-ip') || undefined,
    userAgent: request?.headers?.get('user-agent') || undefined,
  };
}

/**
 * Compute changes between two objects
 * Returns only the fields that changed
 */
export function computeChanges(
  before: Record<string, any> | null | undefined,
  after: Record<string, any>
): { before?: Record<string, any>; after?: Record<string, any> } {
  if (!before) {
    return { after };
  }

  const changedBefore: Record<string, any> = {};
  const changedAfter: Record<string, any> = {};

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    // Skip internal fields
    if (key === '_id' || key === 'createdAt' || key === 'updatedAt') {
      continue;
    }

    const beforeValue = before[key];
    const afterValue = after[key];

    // Compare values (simple comparison, handles primitives and dates)
    const beforeStr = JSON.stringify(beforeValue);
    const afterStr = JSON.stringify(afterValue);

    if (beforeStr !== afterStr) {
      changedBefore[key] = beforeValue;
      changedAfter[key] = afterValue;
    }
  }

  if (Object.keys(changedBefore).length === 0) {
    return {};
  }

  return { before: changedBefore, after: changedAfter };
}

/**
 * Ensure CVision audit log indexes
 */
export async function ensureCVisionAuditIndexes(tenantId: string): Promise<void> {
  try {
    const db = await getTenantDbByKey(tenantId);
    const collection = db.collection(CVISION_COLLECTIONS.auditLogs);

    // Index on createdAt for time-based queries
    await collection.createIndex({ createdAt: -1 });

    // Index on actorUserId for user activity queries
    await collection.createIndex({ actorUserId: 1, createdAt: -1 });

    // Index on resourceType and resourceId
    await collection.createIndex({ resourceType: 1, resourceId: 1, createdAt: -1 });

    // Index on action type
    await collection.createIndex({ action: 1, createdAt: -1 });

    // Compound index for common queries
    await collection.createIndex({ tenantId: 1, resourceType: 1, createdAt: -1 });

    logger.info('[CVision Audit] Indexes created for tenant:', tenantId);
  } catch (error) {
    logger.error('[CVision Audit] Failed to create indexes:', error);
  }
}
