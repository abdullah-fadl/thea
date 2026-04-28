/**
 * CVision SaaS — Data Isolation
 *
 * Ensures every MongoDB query is tenant-scoped.
 * Provides audit and backfill utilities for migration.
 */

import { Filter } from '@/lib/cvision/infra/mongo-compat';
import { getTenantDbByKey } from '@/lib/cvision/infra';
import { CVISION_COLLECTIONS } from '@/lib/cvision/constants';

// ═══════════════════════════════════════════════════════════════════════════
// Query wrapper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enforce tenant isolation on any filter.
 * Always use this (or `createTenantFilter` from db.ts) when building queries.
 */
export function withTenantFilter<T = any>(
  tenantId: string,
  filter: Filter<T> = {} as Filter<T>,
): Filter<T> {
  if (!tenantId) throw new Error('tenantId is required for data isolation');
  return { tenantId, ...filter } as Filter<T>;
}

/**
 * Strict version — also excludes soft-deleted records.
 */
export function withTenantFilterActive<T = any>(
  tenantId: string,
  filter: Filter<T> = {} as Filter<T>,
): Filter<T> {
  if (!tenantId) throw new Error('tenantId is required for data isolation');
  return {
    tenantId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    ...filter,
  } as Filter<T>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Audit — find documents without tenantId
// ═══════════════════════════════════════════════════════════════════════════

export interface AuditResult {
  collections: string[];
  orphanedDocuments: { collection: string; count: number }[];
  isSecure: boolean;
  scannedAt: Date;
}

/**
 * Scan all CVision collections for documents missing a tenantId field.
 * Returns a report with orphaned document counts per collection.
 */
export async function auditDataIsolation(tenantId: string): Promise<AuditResult> {
  const db = await getTenantDbByKey(tenantId);

  const collectionNames = Object.values(CVISION_COLLECTIONS);
  const orphanedDocuments: { collection: string; count: number }[] = [];

  for (const colName of collectionNames) {
    try {
      const count = await db.collection(colName).countDocuments({
        $or: [
          { tenantId: { $exists: false } },
          { tenantId: null },
          { tenantId: '' },
        ],
      });
      if (count > 0) {
        orphanedDocuments.push({ collection: colName, count });
      }
    } catch {
      // Collection may not exist yet — skip
    }
  }

  return {
    collections: collectionNames,
    orphanedDocuments,
    isSecure: orphanedDocuments.length === 0,
    scannedAt: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Backfill — stamp tenantId on orphaned documents
// ═══════════════════════════════════════════════════════════════════════════

export interface BackfillResult {
  collections: string[];
  updatedDocuments: number;
  details: { collection: string; updated: number }[];
}

/**
 * Backfill tenantId on all documents in CVision collections that are missing it.
 * Safe to run multiple times — only touches documents without a tenantId.
 */
export async function backfillTenantId(tenantId: string): Promise<BackfillResult> {
  const db = await getTenantDbByKey(tenantId);

  const collectionNames = Object.values(CVISION_COLLECTIONS);
  const details: { collection: string; updated: number }[] = [];
  let totalUpdated = 0;

  for (const colName of collectionNames) {
    try {
      const result = await db.collection(colName).updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        { $set: { tenantId } },
      );
      if (result.modifiedCount > 0) {
        details.push({ collection: colName, updated: result.modifiedCount });
        totalUpdated += result.modifiedCount;
      }
    } catch {
      // Collection may not exist — skip
    }
  }

  return {
    collections: collectionNames,
    updatedDocuments: totalUpdated,
    details,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Ensure tenantId index on ALL collections
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a tenantId index on every CVision collection for query performance.
 * Safe to run repeatedly — MongoDB skips existing indexes.
 */
export async function ensureTenantIdIndexes(tenantId: string): Promise<string[]> {
  const db = await getTenantDbByKey(tenantId);
  const collectionNames = Object.values(CVISION_COLLECTIONS);
  const indexed: string[] = [];

  for (const colName of collectionNames) {
    try {
      await db.collection(colName).createIndex({ tenantId: 1 });
      indexed.push(colName);
    } catch {
      // Skip if collection doesn't exist
    }
  }

  // Also index the SaaS-specific collections
  const saasCollections = ['cvision_tenants', 'cvision_tenant_users', 'cvision_api_keys'];
  for (const colName of saasCollections) {
    try {
      await db.collection(colName).createIndex({ tenantId: 1 });
      indexed.push(colName);
    } catch {
      // Skip
    }
  }

  return indexed;
}
