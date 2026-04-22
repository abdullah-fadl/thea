/**
 * CVision Prisma Database Layer
 *
 * Drop-in replacement for the MongoDB-compatible PrismaShim.
 * Provides the same .collection().find()/.findOne()/.insertOne() API
 * but backed by Prisma model calls instead of raw SQL.
 *
 * This allows all 200+ CVision files to work without changes while
 * eliminating raw SQL generation from the PrismaShim.
 */

import { prisma } from '@/lib/db/prisma';
import {
  COLLECTION_TO_PRISMA,
  mongoFilterToPrisma,
  mongoUpdateToPrisma,
  mongoSortToPrisma,
  mongoProjectToPrisma,
} from './prisma-helpers';
import { logger } from '@/lib/monitoring/logger';

// ─── UUID Validation ──────────────────────────────────────────────────────────
// Prevents empty strings or invalid values from reaching PostgreSQL UUID columns.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Check if a Prisma where clause contains an empty/invalid tenantId (UUID column) */
function hasInvalidUuidTenantId(where: Record<string, any>): boolean {
  if ('tenantId' in where) {
    const tid = where.tenantId;
    if (typeof tid === 'string' && !UUID_RE.test(tid)) return true;
  }
  return false;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PrismaModelDelegate = {
  findMany: (args?: any) => Promise<any[]>;
  findFirst: (args?: any) => Promise<any | null>;
  findUnique: (args?: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  createMany: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  updateMany: (args: any) => Promise<any>;
  upsert: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  deleteMany: (args: any) => Promise<any>;
  count: (args?: any) => Promise<number>;
  aggregate: (args: any) => Promise<any>;
  groupBy: (args: any) => Promise<any[]>;
};

// ─── PrismaCursor ─────────────────────────────────────────────────────────────
// Mimics MongoDB cursor with .sort(), .skip(), .limit(), .project(), .toArray()

class PrismaCursor {
  private _model: PrismaModelDelegate;
  private _where: Record<string, any>;
  private _orderBy: Record<string, string>[] | undefined;
  private _skip: number | undefined;
  private _take: number | undefined;
  private _select: Record<string, boolean> | undefined;
  private _empty: boolean;

  constructor(model: PrismaModelDelegate, where: Record<string, any>, select?: Record<string, boolean>) {
    this._model = model;
    this._where = where;
    this._empty = false;
    if (select) this._select = select;
  }

  /** Create a no-op cursor that always returns empty results */
  static empty(model: PrismaModelDelegate): PrismaCursor {
    const cursor = new PrismaCursor(model, {});
    cursor._empty = true;
    return cursor;
  }

  sort(sortSpec: Record<string, number>): PrismaCursor {
    this._orderBy = mongoSortToPrisma(sortSpec);
    return this;
  }

  skip(n: number): PrismaCursor {
    this._skip = n;
    return this;
  }

  limit(n: number): PrismaCursor {
    this._take = n;
    return this;
  }

  project(projection: Record<string, number>): PrismaCursor {
    this._select = mongoProjectToPrisma(projection);
    return this;
  }

  async toArray(): Promise<any[]> {
    // Guard: return empty if cursor was created with invalid UUID tenantId
    if (this._empty || hasInvalidUuidTenantId(this._where)) return [];
    const args: any = { where: this._where };
    if (this._orderBy?.length) args.orderBy = this._orderBy;
    if (this._skip !== undefined) args.skip = this._skip;
    if (this._take !== undefined) args.take = this._take;
    if (this._select && Object.keys(this._select).length > 0) args.select = this._select;
    return this._model.findMany(args);
  }

  // Allow awaiting cursor directly (same as toArray)
  then(resolve: (value: any[]) => any, reject?: (reason: any) => any): Promise<any[]> {
    return this.toArray().then(resolve, reject);
  }
}

// ─── PrismaCollection ─────────────────────────────────────────────────────────
// Mimics MongoDB collection with find/findOne/insertOne/updateOne/etc.

class PrismaCollection {
  private _model: PrismaModelDelegate;
  private _collectionName: string;

  constructor(model: PrismaModelDelegate, collectionName: string) {
    this._model = model;
    this._collectionName = collectionName;
  }

  find(filter: Record<string, any> = {}, options?: { projection?: Record<string, number> }): PrismaCursor {
    const where = mongoFilterToPrisma(filter);
    // Guard: empty tenantId would crash PostgreSQL UUID column — return empty cursor
    if (hasInvalidUuidTenantId(where)) return PrismaCursor.empty(this._model);
    const select = options?.projection ? mongoProjectToPrisma(options.projection) : undefined;
    return new PrismaCursor(this._model, where, select);
  }

  async findOne(filter: Record<string, any> = {}, options?: { sort?: Record<string, number>; projection?: Record<string, number> }): Promise<any | null> {
    const where = mongoFilterToPrisma(filter);
    // Guard: empty tenantId would crash PostgreSQL UUID column
    if (hasInvalidUuidTenantId(where)) return null;
    const args: any = { where };
    if (options?.sort) {
      args.orderBy = mongoSortToPrisma(options.sort);
    }
    if (options?.projection) {
      args.select = mongoProjectToPrisma(options.projection);
    }
    return this._model.findFirst(args);
  }

  async findOneAndUpdate(
    filter: Record<string, any>,
    update: Record<string, any>,
    options?: { upsert?: boolean; returnDocument?: string; sort?: Record<string, number>; projection?: Record<string, number> }
  ): Promise<any> {
    const where = mongoFilterToPrisma(filter);
    const data = mongoUpdateToPrisma(update);
    const orderBy = options?.sort ? mongoSortToPrisma(options.sort) : undefined;
    const findArgs: any = { where };
    if (orderBy?.length) findArgs.orderBy = orderBy;

    if (options?.upsert) {
      // For upsert, we need a unique identifier. Try 'id' first, then composite.
      try {
        const existing = await this._model.findFirst(findArgs);
        if (existing) {
          const updated = await this._model.update({
            where: { id: existing.id },
            data,
          });
          return { value: updated };
        }
        // Create new record
        const createData = { ...where, ...data };
        // Remove Prisma operators from createData
        const cleanCreateData = cleanDataForCreate(createData);
        const created = await this._model.create({ data: cleanCreateData });
        return { value: created };
      } catch (error) {
        logger.warn('findOneAndUpdate upsert fallback', {
          category: 'db',
          collection: this._collectionName,
          error: error instanceof Error ? error.message : String(error),
        });
        return { value: null };
      }
    }

    try {
      const existing = await this._model.findFirst(findArgs);
      if (!existing) return { value: null };
      const updated = await this._model.update({
        where: { id: existing.id },
        data,
      });
      return { value: updated };
    } catch (error) {
      logger.warn('findOneAndUpdate error', {
        category: 'db',
        collection: this._collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return { value: null };
    }
  }

  async insertOne(doc: Record<string, any>): Promise<{ insertedId: string; acknowledged: boolean }> {
    const cleanDoc = cleanDataForCreate(doc);
    // Guard: reject inserts with invalid tenantId to avoid PostgreSQL UUID errors
    if ('tenantId' in cleanDoc && typeof cleanDoc.tenantId === 'string' && !UUID_RE.test(cleanDoc.tenantId)) {
      logger.warn('insertOne skipped: invalid tenantId', { collection: this._collectionName, tenantId: cleanDoc.tenantId });
      return { insertedId: '', acknowledged: false };
    }
    const result = await this._model.create({ data: cleanDoc });
    return { insertedId: result.id, acknowledged: true };
  }

  async insertMany(docs: Record<string, any>[]): Promise<{ insertedCount: number; acknowledged: boolean }> {
    const cleanDocs = docs.map(cleanDataForCreate);
    const result = await this._model.createMany({ data: cleanDocs, skipDuplicates: true });
    return { insertedCount: result.count, acknowledged: true };
  }

  async updateOne(
    filter: Record<string, any>,
    update: Record<string, any>,
    options?: { upsert?: boolean; arrayFilters?: any[] }
  ): Promise<{ modifiedCount: number; matchedCount: number; upsertedCount: number }> {
    const where = mongoFilterToPrisma(filter);
    const data = mongoUpdateToPrisma(update);

    if (options?.upsert) {
      try {
        const existing = await this._model.findFirst({ where });
        if (existing) {
          await this._model.update({ where: { id: existing.id }, data });
          return { modifiedCount: 1, matchedCount: 1, upsertedCount: 0 };
        }
        const createData = cleanDataForCreate({ ...where, ...data });
        await this._model.create({ data: createData });
        return { modifiedCount: 0, matchedCount: 0, upsertedCount: 1 };
      } catch (error) {
        logger.warn('updateOne upsert error', {
          category: 'db',
          collection: this._collectionName,
          error: error instanceof Error ? error.message : String(error),
        });
        return { modifiedCount: 0, matchedCount: 0, upsertedCount: 0 };
      }
    }

    try {
      const existing = await this._model.findFirst({ where });
      if (!existing) return { modifiedCount: 0, matchedCount: 0, upsertedCount: 0 };
      await this._model.update({ where: { id: existing.id }, data });
      return { modifiedCount: 1, matchedCount: 1, upsertedCount: 0 };
    } catch (error) {
      logger.warn('updateOne error', {
        category: 'db',
        collection: this._collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return { modifiedCount: 0, matchedCount: 0, upsertedCount: 0 };
    }
  }

  async updateMany(
    filter: Record<string, any>,
    update: Record<string, any>
  ): Promise<{ modifiedCount: number; matchedCount: number }> {
    const where = mongoFilterToPrisma(filter);
    const data = mongoUpdateToPrisma(update);

    try {
      const result = await this._model.updateMany({ where, data });
      return { modifiedCount: result.count, matchedCount: result.count };
    } catch (error) {
      logger.warn('updateMany error', {
        category: 'db',
        collection: this._collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return { modifiedCount: 0, matchedCount: 0 };
    }
  }

  async replaceOne(
    filter: Record<string, any>,
    replacement: Record<string, any>,
    options?: { upsert?: boolean }
  ): Promise<{ modifiedCount: number; matchedCount: number; upsertedCount: number }> {
    const where = mongoFilterToPrisma(filter);
    try {
      const existing = await this._model.findFirst({ where });
      if (existing) {
        const cleanData = cleanDataForCreate(replacement);
        await this._model.update({ where: { id: existing.id }, data: cleanData });
        return { modifiedCount: 1, matchedCount: 1, upsertedCount: 0 };
      }
      if (options?.upsert) {
        const cleanData = cleanDataForCreate({ ...where, ...replacement });
        await this._model.create({ data: cleanData });
        return { modifiedCount: 0, matchedCount: 0, upsertedCount: 1 };
      }
      return { modifiedCount: 0, matchedCount: 0, upsertedCount: 0 };
    } catch {
      return { modifiedCount: 0, matchedCount: 0, upsertedCount: 0 };
    }
  }

  async deleteOne(filter: Record<string, any>): Promise<{ deletedCount: number }> {
    const where = mongoFilterToPrisma(filter);
    try {
      const existing = await this._model.findFirst({ where });
      if (!existing) return { deletedCount: 0 };
      await this._model.delete({ where: { id: existing.id } });
      return { deletedCount: 1 };
    } catch (error) {
      logger.warn('deleteOne error', {
        category: 'db',
        collection: this._collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return { deletedCount: 0 };
    }
  }

  async deleteMany(filter: Record<string, any>): Promise<{ deletedCount: number }> {
    const where = mongoFilterToPrisma(filter);
    try {
      const result = await this._model.deleteMany({ where });
      return { deletedCount: result.count };
    } catch (error) {
      logger.warn('deleteMany error', {
        category: 'db',
        collection: this._collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return { deletedCount: 0 };
    }
  }

  async countDocuments(filter: Record<string, any> = {}): Promise<number> {
    const where = mongoFilterToPrisma(filter);
    // Guard: empty tenantId would crash PostgreSQL UUID column
    if (hasInvalidUuidTenantId(where)) return 0;
    return this._model.count({ where });
  }

  async distinct(field: string, filter: Record<string, any> = {}): Promise<any[]> {
    const where = mongoFilterToPrisma(filter);
    if (hasInvalidUuidTenantId(where)) return [];
    try {
      const results = await this._model.findMany({
        where,
        select: { [field]: true },
        distinct: [field],
      });
      return results.map((r: any) => r[field]).filter((v: any) => v != null);
    } catch {
      // Fallback: fetch all and deduplicate
      const results = await this._model.findMany({ where });
      const values = new Set(results.map((r: any) => r[field]).filter((v: any) => v != null));
      return Array.from(values);
    }
  }

  aggregate(pipeline: Record<string, unknown>[]): { toArray: () => Promise<Record<string, unknown>[]> } & Promise<PrismaCursor> {
    // Returns a thenable cursor-like object so both patterns work:
    //   await col.aggregate(p).toArray()   (MongoDB style)
    //   await col.aggregate(p)             (promise style)
    const doAggregate = async (): Promise<PrismaCursor> => this._doAggregate(pipeline);
    const promise = doAggregate();
    const enhanced = Object.assign(promise, {
      toArray: async () => {
        const cursor = await promise;
        return (cursor as any).toArray();
      },
    });
    return enhanced;
  }

  private async _doAggregate(pipeline: Record<string, any>[]): Promise<PrismaCursor> {
    // Basic aggregation support: $match → where, $group → groupBy, $sort → orderBy
    // For complex pipelines, fall back to raw query
    const matchStage = pipeline.find((s) => s.$match);
    const groupStage = pipeline.find((s) => s.$group);
    const sortStage = pipeline.find((s) => s.$sort);

    if (groupStage) {
      const where = matchStage ? mongoFilterToPrisma(matchStage.$match) : {};
      const groupFields = groupStage.$group;
      const _id = groupFields._id;

      // Simple count/sum aggregation
      const aggArgs: any = { where };
      const by: string[] = [];
      if (_id && _id !== null) {
        if (typeof _id === 'string' && _id.startsWith('$')) {
          by.push(_id.slice(1));
        } else if (typeof _id === 'object') {
          for (const val of Object.values(_id)) {
            if (typeof val === 'string' && val.startsWith('$')) by.push(val.slice(1));
          }
        }
      }

      // Build _sum, _count, _avg, _min, _max
      const prismaAgg: any = {};
      for (const [key, rawVal] of Object.entries(groupFields)) {
        if (key === '_id') continue;
        const v = rawVal as Record<string, unknown>;
        if (typeof v === 'object' && v !== null) {
          if (v.$sum !== undefined) {
            if (typeof v.$sum === 'string' && v.$sum.startsWith('$')) {
              if (!prismaAgg._sum) prismaAgg._sum = {};
              prismaAgg._sum[v.$sum.slice(1)] = true;
            } else if (v.$sum === 1) {
              prismaAgg._count = true;
            }
          }
          if (v.$avg && typeof v.$avg === 'string' && v.$avg.startsWith('$')) {
            if (!prismaAgg._avg) prismaAgg._avg = {};
            prismaAgg._avg[v.$avg.slice(1)] = true;
          }
          if (v.$min && typeof v.$min === 'string' && v.$min.startsWith('$')) {
            if (!prismaAgg._min) prismaAgg._min = {};
            prismaAgg._min[v.$min.slice(1)] = true;
          }
          if (v.$max && typeof v.$max === 'string' && v.$max.startsWith('$')) {
            if (!prismaAgg._max) prismaAgg._max = {};
            prismaAgg._max[v.$max.slice(1)] = true;
          }
        }
      }

      try {
        if (by.length > 0) {
          const result = await this._model.groupBy({
            by,
            where,
            ...prismaAgg,
          });
          // Transform to match MongoDB aggregate output format
          const transformed = result.map((row: any) => {
            const out: any = { _id: by.length === 1 ? row[by[0]] : {} };
            if (by.length > 1) {
              for (const b of by) out._id[b] = row[b];
            }
            for (const [key, rawVal] of Object.entries(groupFields)) {
              if (key === '_id') continue;
              const v = rawVal as Record<string, unknown>;
              if (typeof v === 'object' && v !== null) {
                if (v.$sum !== undefined) {
                  if (typeof v.$sum === 'string' && v.$sum.startsWith('$')) {
                    out[key] = row._sum?.[v.$sum.slice(1)] ?? 0;
                  } else if (v.$sum === 1) {
                    out[key] = row._count ?? 0;
                  }
                }
                if (typeof v.$avg === 'string') out[key] = row._avg?.[v.$avg.slice(1)] ?? 0;
                if (typeof v.$min === 'string') out[key] = row._min?.[v.$min.slice(1)] ?? null;
                if (typeof v.$max === 'string') out[key] = row._max?.[v.$max.slice(1)] ?? null;
              }
            }
            return out;
          });
          return new PrismaCursor(
            { findMany: async () => transformed } as unknown as PrismaModelDelegate,
            {}
          );
        }

        // No group by field (_id: null) — aggregate entire collection
        const aggResult = await this._model.aggregate({
          where,
          ...prismaAgg,
        });
        const out: any = { _id: null };
        for (const [key, rawVal] of Object.entries(groupFields)) {
          if (key === '_id') continue;
          const v = rawVal as Record<string, unknown>;
          if (typeof v === 'object' && v !== null) {
            if (v.$sum !== undefined) {
              if (typeof v.$sum === 'string' && v.$sum.startsWith('$')) {
                out[key] = aggResult._sum?.[v.$sum.slice(1)] ?? 0;
              } else if (v.$sum === 1) {
                out[key] = aggResult._count ?? 0;
              }
            }
          }
        }
        return new PrismaCursor(
          { findMany: async () => [out] } as unknown as PrismaModelDelegate,
          {}
        );
      } catch (error) {
        logger.warn('aggregate error', {
          category: 'db',
          collection: this._collectionName,
          error: error instanceof Error ? error.message : String(error),
        });
        return new PrismaCursor(
          { findMany: async () => [] } as unknown as PrismaModelDelegate,
          {}
        );
      }
    }

    // No $group — treat as a filtered find
    const where = matchStage ? mongoFilterToPrisma(matchStage.$match) : {};
    const cursor = new PrismaCursor(this._model, where);
    if (sortStage) cursor.sort(sortStage.$sort);
    return cursor;
  }

  async bulkWrite(
    ops: Array<{
      insertOne?: { document: Record<string, any> };
      updateOne?: { filter: Record<string, any>; update: Record<string, any>; upsert?: boolean };
      updateMany?: { filter: Record<string, any>; update: Record<string, any> };
      deleteOne?: { filter: Record<string, any> };
      deleteMany?: { filter: Record<string, any> };
    }>
  ): Promise<{ ok: number; insertedCount: number; modifiedCount: number; deletedCount: number }> {
    let insertedCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;

    for (const op of ops) {
      if (op.insertOne) {
        await this.insertOne(op.insertOne.document);
        insertedCount++;
      } else if (op.updateOne) {
        const res = await this.updateOne(op.updateOne.filter, op.updateOne.update, { upsert: op.updateOne.upsert });
        modifiedCount += res.modifiedCount;
      } else if (op.updateMany) {
        const res = await this.updateMany(op.updateMany.filter, op.updateMany.update);
        modifiedCount += res.modifiedCount;
      } else if (op.deleteOne) {
        const res = await this.deleteOne(op.deleteOne.filter);
        deletedCount += res.deletedCount;
      } else if (op.deleteMany) {
        const res = await this.deleteMany(op.deleteMany.filter);
        deletedCount += res.deletedCount;
      }
    }

    return { ok: 1, insertedCount, modifiedCount, deletedCount };
  }

  // No-ops for index creation (handled by Prisma schema)
  async createIndex(_keys: any, _options?: any): Promise<string> {
    return 'prisma-managed';
  }

  async createIndexes(_indexes: any[]): Promise<string[]> {
    return _indexes.map(() => 'prisma-managed');
  }
}

// ─── PrismaDb ─────────────────────────────────────────────────────────────────
// Mimics the shimDb.collection() API

class PrismaDb {
  collection<T = any>(collectionName: string): PrismaCollection {
    const modelKey = COLLECTION_TO_PRISMA[collectionName];
    if (!modelKey) {
      logger.warn('Unknown CVision collection, falling back to no-op', {
        category: 'db',
        collection: collectionName,
      });
      // Return a no-op collection for unknown tables
      return new PrismaCollection(createNoOpDelegate(), collectionName);
    }
    const delegate = prisma[modelKey as keyof typeof prisma] as unknown as PrismaModelDelegate | undefined;
    if (!delegate) {
      logger.warn('Prisma delegate not found', {
        category: 'db',
        collection: collectionName,
        model: String(modelKey),
      });
      return new PrismaCollection(createNoOpDelegate(), collectionName);
    }
    return new PrismaCollection(delegate, collectionName);
  }

  /** List known collections (returns Prisma model names mapped to MongoDB-style names) */
  listCollections(): { toArray: () => Promise<{ name: string }[]> } {
    const names = Object.keys(COLLECTION_TO_PRISMA).map(name => ({ name }));
    return { toArray: async () => names };
  }

  /** Run a database command (MongoDB compat). For Prisma, delegates to $queryRaw for ping. */
  async command(cmd: Record<string, any>): Promise<any> {
    if (cmd.ping) {
      // Health check — just verify Prisma connection
      await prisma.$queryRawUnsafe('SELECT 1');
      return { ok: 1 };
    }
    return { ok: 1 };
  }
}

function createNoOpDelegate(): PrismaModelDelegate {
  return {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (args: any) => args.data,
    createMany: async () => ({ count: 0 }),
    update: async (args: any) => args.data,
    updateMany: async () => ({ count: 0 }),
    upsert: async (args: any) => args.create || args.data,
    delete: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
    count: async () => 0,
    aggregate: async () => ({}),
    groupBy: async () => [],
  };
}

// ─── Helper: Clean data for create ────────────────────────────────────────────
// Remove Prisma query operators (OR, AND, in, etc.) and MongoDB operators
// from data intended for a create operation.

function cleanDataForCreate(data: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip Prisma filter operators
    if (key === 'OR' || key === 'AND' || key === 'NOT') continue;
    // Skip MongoDB operators
    if (key.startsWith('$')) continue;
    // Skip _id (Prisma uses 'id')
    if (key === '_id') {
      if (value && typeof value === 'string') clean.id = value;
      continue;
    }
    // Unwrap Prisma operators like { in: [...] } to plain values
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      if ('increment' in value) {
        clean[key] = value.increment; // For $inc in create context
        continue;
      }
      if ('in' in value && Array.isArray(value.in)) {
        clean[key] = value.in[0]; // Take first value for create
        continue;
      }
    }
    clean[key] = value;
  }
  return clean;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const cvisionDb = new PrismaDb();
export type { PrismaCollection, PrismaDb };
