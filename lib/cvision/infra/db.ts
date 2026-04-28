/**
 * CVision Database Layer
 * Isolation layer for database access — backed by Prisma model calls
 */

import { cvisionDb, type PrismaDb } from '@/lib/cvision/prisma-db';

export async function getTenantDb(_tenantId: string): Promise<PrismaDb> {
  return cvisionDb;
}

export { getTenantDb as getTenantDbByKey };
