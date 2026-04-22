import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { logger } from '@/lib/monitoring/logger';

// TODO: Add Prisma model for operation_documents when SAM module is migrated
// For now, stubbed to remove MongoDB dependency

export async function replaceOperationLinks(
  req: NextRequest,
  tenantId: string,
  documentId: string,
  operationIds: string[],
  entityType?: string,
  departmentId?: string
) {
  try {
    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantId),
      select: { id: true },
    });
    if (!tenant) return { deleted: false, upserted: 0 };

    // Delete existing links
    await prisma.$executeRawUnsafe(
      `DELETE FROM operation_documents WHERE "tenantId" = $1 AND "documentId" = $2`,
      tenant.id, documentId
    );

    if (!operationIds || operationIds.length === 0) {
      return { deleted: true, upserted: 0 };
    }

    let upserted = 0;
    const now = new Date();
    for (const operationId of operationIds) {
      if (!operationId) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO operation_documents ("id", "tenantId", "operationId", "documentId", "entityType", "departmentId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT ("tenantId", "operationId", "documentId") DO UPDATE SET "updatedAt" = $6, "entityType" = $4, "departmentId" = $5`,
        tenant.id, operationId, documentId, entityType || null, departmentId || null, now
      );
      upserted += 1;
    }
    return { deleted: true, upserted };
  } catch (error) {
    logger.error('operationLinks error', { category: 'general', error });
    return { deleted: false, upserted: 0 };
  }
}

export async function getOperationLinks(
  req: NextRequest,
  tenantId: string,
  operationId: string
) {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantId),
      select: { id: true },
    });
    if (!tenant) return [];

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM operation_documents WHERE "tenantId" = $1 AND "operationId" = $2`,
      tenant.id, operationId
    );
    return rows as Record<string, unknown>[];
  } catch (error) {
    logger.error('operationLinks error', { category: 'general', error });
    return [];
  }
}

export async function getLinksByDocumentIds(
  req: NextRequest,
  tenantId: string,
  documentIds: string[]
) {
  if (!documentIds || documentIds.length === 0) return [];
  try {
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantId),
      select: { id: true },
    });
    if (!tenant) return [];

    const placeholders = documentIds.map((_, i) => `$${i + 2}`).join(', ');
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM operation_documents WHERE "tenantId" = $1 AND "documentId" IN (${placeholders})`,
      tenant.id, ...documentIds
    );
    return rows as Record<string, unknown>[];
  } catch (error) {
    logger.error('operationLinks error', { category: 'general', error });
    return [];
  }
}
