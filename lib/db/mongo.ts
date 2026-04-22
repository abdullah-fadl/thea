/**
 * MongoDB Connection Layer — DEPRECATED
 *
 * This module previously provided MongoDB connections. All database operations
 * now go through Prisma (PostgreSQL). These exports exist solely for backward
 * compatibility with code that imports from './mongo'.
 *
 * All functions return Prisma-backed objects or no-ops.
 */

import { cvisionDb, type PrismaDb } from '@/lib/cvision/prisma-db';

/**
 * @deprecated Use prisma directly. Returns Prisma-backed shim.
 */
export async function getPlatformClient(): Promise<{ client: any; db: PrismaDb }> {
  return { client: null, db: cvisionDb };
}

/**
 * @deprecated Use prisma directly. Returns Prisma-backed shim.
 */
export async function getHospitalOpsClient(): Promise<{ client: any; db: PrismaDb }> {
  return { client: null, db: cvisionDb };
}

/**
 * @deprecated Use prisma directly. Returns Prisma-backed shim.
 */
export async function getTenantClient(
  _tenantKey: string,
  _dbName: string
): Promise<{ client: any; db: PrismaDb }> {
  return { client: null, db: cvisionDb };
}

/**
 * No-op — Prisma manages its own connection pool.
 */
export function resetAllConnectionCaches(): void {
  // No-op
}
