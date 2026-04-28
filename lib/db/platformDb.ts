/**
 * Platform Database Access — Prisma-backed
 *
 * Platform DB operations now use Prisma model calls via the CVision
 * prisma-db layer (same MongoDB-compat API backed by Prisma delegates).
 */

import { cvisionDb, type PrismaDb } from '@/lib/cvision/prisma-db';

/**
 * Get Platform Database
 */
export async function getPlatformDb(): Promise<PrismaDb> {
  return cvisionDb;
}

/**
 * Get a collection from Platform DB
 */
export async function getPlatformCollection(name: string) {
  return cvisionDb.collection(name);
}

/**
 * Reset platform DB connection cache — no-op (Prisma manages its own pool)
 */
export function resetPlatformConnectionCache(): void {
  // No-op: Prisma manages connection pooling internally
}
