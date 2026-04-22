/**
 * CVision (HR OS) - Database Helpers
 *
 * Collection access and query helpers for CVision.
 * All queries are tenant-scoped.
 *
 * Now backed by Prisma model calls via cvisionDb (lib/cvision/prisma-db.ts),
 * replacing the raw-SQL PrismaShim layer.
 */

import { cvisionDb, type PrismaCollection, type PrismaDb } from '@/lib/cvision/prisma-db';
import { CVISION_COLLECTIONS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants';
import type { CVisionBaseRecord, CVisionListParams, CVisionListResponse } from './types';

// ─── Collection Types (re-exported for backward compatibility) ────────────────
type Db = PrismaDb;
type Collection<T = any> = PrismaCollection;
type Filter<T = any> = Record<string, any>;
type Sort = Record<string, number>;

/**
 * Get a CVision collection for a tenant
 */
export async function getCVisionCollection<T = any>(
  tenantId: string,
  collectionName: keyof typeof CVISION_COLLECTIONS
): Promise<Collection<T>> {
  return cvisionDb.collection<T>(CVISION_COLLECTIONS[collectionName]);
}

/**
 * Get the tenant database
 */
export async function getCVisionDb(_tenantId: string): Promise<Db> {
  return cvisionDb;
}

/**
 * Create a tenant-scoped query filter
 */
export function createTenantFilter<T>(
  tenantId: string,
  additionalFilter?: Filter<T>,
  _includeDeleted = false
): Filter<T> {
  const baseFilter: Record<string, any> = { tenantId };
  if (!additionalFilter) return baseFilter as Filter<T>;
  return { ...baseFilter, ...additionalFilter } as Filter<T>;
}

/**
 * Paginated list query
 */
export async function paginatedList<T = any>(
  collection: Collection<T>,
  tenantId: string,
  params: CVisionListParams = {},
  additionalFilter?: Filter<T>
): Promise<CVisionListResponse<T>> {
  const {
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    includeDeleted = false,
  } = params;

  const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * safeLimit;

  let filter = createTenantFilter<T>(tenantId, additionalFilter, includeDeleted);

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchFilter = {
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { code: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
      ],
    };
    filter = { $and: [filter, searchFilter] } as Filter<T>;
  }

  const sort: Sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    collection.find(filter).sort(sort).skip(skip).limit(safeLimit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    data: data as T[],
    total,
    page: safePage,
    limit: safeLimit,
    hasMore: skip + data.length < total,
  };
}

/**
 * Find one by ID with tenant scope
 */
export async function findById<T = any>(
  collection: Collection<T>,
  tenantId: string,
  id: string,
  _includeDeleted = false
): Promise<T | null> {
  const filter = createTenantFilter(tenantId, { id } as Filter<T>);
  return collection.findOne(filter) as Promise<T | null>;
}

/**
 * Soft delete a record
 */
export async function softDelete<T = any>(
  collection: Collection<T>,
  tenantId: string,
  id: string,
  userId: string,
  deleteReason?: string
): Promise<boolean> {
  const filter = createTenantFilter<T>(tenantId, { id } as Filter<T>);
  const result = await collection.updateOne(filter, {
    $set: {
      deletedAt: new Date(),
      deletedBy: userId,
      deleteReason: deleteReason || null,
      updatedAt: new Date(),
      updatedBy: userId,
    },
  });
  return result.modifiedCount > 0;
}

/**
 * Restore a soft-deleted record
 */
export async function restoreDeleted<T = any>(
  collection: Collection<T>,
  tenantId: string,
  id: string,
  userId: string
): Promise<boolean> {
  const filter: Filter<T> = { tenantId, id } as Filter<T>;
  const result = await collection.updateOne(filter, {
    $set: {
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: new Date(),
      updatedBy: userId,
    },
  });
  return result.modifiedCount > 0;
}

/**
 * Check if a code is unique within tenant
 */
export async function isCodeUnique<T = any>(
  collection: Collection<T>,
  tenantId: string,
  code: string,
  excludeId?: string
): Promise<boolean> {
  const filter: Filter<T> = {
    tenantId,
    code,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  } as Filter<T>;

  if (excludeId) {
    filter.id = { $ne: excludeId };
  }

  const existing = await collection.findOne(filter);
  return !existing;
}

/**
 * Generate a sequential number for a given prefix
 * Uses Prisma directly for atomic sequence generation
 */
export async function generateSequenceNumber(
  tenantId: string,
  prefix: string,
  padLength = 6
): Promise<string> {
  const { prisma } = await import('@/lib/db/prisma');
  try {
    const existing = await prisma.cvisionSequence.findFirst({
      where: { tenantId, entityType: prefix },
    });

    if (existing) {
      const updated = await prisma.cvisionSequence.update({
        where: { id: existing.id },
        data: { currentValue: { increment: 1 }, updatedAt: new Date() },
      });
      return `${prefix}-${String(updated.currentValue).padStart(padLength, '0')}`;
    }

    const created = await prisma.cvisionSequence.create({
      data: { tenantId, entityType: prefix, prefix, currentValue: 1 },
    });
    return `${prefix}-${String(created.currentValue).padStart(padLength, '0')}`;
  } catch {
    // Race condition fallback
    const seq = await prisma.cvisionSequence.findFirst({
      where: { tenantId, entityType: prefix },
    });
    if (seq) {
      const updated = await prisma.cvisionSequence.update({
        where: { id: seq.id },
        data: { currentValue: { increment: 1 }, updatedAt: new Date() },
      });
      return `${prefix}-${String(updated.currentValue).padStart(padLength, '0')}`;
    }
    return `${prefix}-${String(1).padStart(padLength, '0')}`;
  }
}

/**
 * Ensure collection indexes — no-op (handled by Prisma schema @@index directives)
 */
export async function ensureCVisionIndexes(_tenantId: string): Promise<void> {
  // Indexes are defined in the Prisma schema via @@index directives.
}
