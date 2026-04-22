/**
 * Database Access Layer — Prisma-backed
 *
 * This module previously provided MongoDB connections (hospital_ops DB).
 * It now uses the Prisma-backed CVision DB for backward compatibility.
 *
 * All callers that use `getCollection()` or `connectDB()` will transparently
 * get PostgreSQL-backed Prisma objects.
 */

import { cvisionDb, type PrismaDb, type PrismaCollection } from './cvision/prisma-db';
import { resetAllConnectionCaches } from './db/mongo';

/**
 * Reset connection cache — no-op (Prisma manages its own pool)
 */
export function resetConnectionCache(): void {
  resetAllConnectionCaches();
}

/**
 * Connect to database and return Db instance.
 * Returns the Prisma-backed DB for backward compatibility.
 */
export async function connectDB(): Promise<PrismaDb> {
  return cvisionDb;
}

/**
 * Get a collection by name.
 * Returns a PrismaCollection that translates MongoDB operations to Prisma calls.
 */
export async function getCollection(name: string): Promise<PrismaCollection> {
  return cvisionDb.collection(name);
}
