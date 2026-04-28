import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { replaceOperationLinks } from '@/lib/sam/operationLinks';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const normalizeToken = (value: string) => value.trim().toLowerCase();

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
  try {
    const operations = await prisma.taxonomyOperation.findMany({
      where: { tenantId, isActive: true },
      take: 500,
    });
    const normalizeOperationRecord = (op: any) => {
      if (!op) return null;
      return op;
    };
    const normalizedOperations = operations.map(normalizeOperationRecord).filter(Boolean);
    const operationsById = new Map<string, any>();
    const operationsByNormalizedName = new Map<string, any>();
    const operationsByCode = new Map<string, any>();
    const operationsByName = new Map<string, any>();
    normalizedOperations.forEach((op: any) => {
      operationsById.set(op.id, op);
      if (op.normalizedName) operationsByNormalizedName.set(op.normalizedName, op);
      if (op.code) operationsByCode.set(op.code, op);
      if (op.name) operationsByName.set(op.name.toLowerCase(), op);
    });

    // Fetch all active, non-deleted policies that have operationIds or classification.operations
    const allDocs = await prisma.policyDocument.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        theaEngineId: true,
        classification: true,
        entityType: true,
        departmentIds: true,
        operationIds: true,
      },
      take: 500,
    });

    // Filter in JS: only docs that have operationIds or classification.operations
    const docs = allDocs.filter((doc: any) => {
      const hasOperationIds = Array.isArray(doc.operationIds) && doc.operationIds.length > 0;
      const classOps = (doc.classification as any)?.operations;
      const hasClassOps = Array.isArray(classOps) && classOps.length > 0;
      return hasOperationIds || hasClassOps;
    });

    let updated = 0;
    let needsReview = 0;
    let linksUpserted = 0;

    for (const doc of docs) {
      const rawOps = Array.isArray(doc.operationIds) && doc.operationIds.length > 0
        ? doc.operationIds
        : Array.isArray((doc.classification as any)?.operations)
        ? (doc.classification as any).operations
        : [];

      const resolvedIds: string[] = [];
      let unresolvedCount = 0;

      rawOps.forEach((op: any) => {
        if (typeof op === 'string') {
          const token = op;
          if (operationsById.has(token)) {
            resolvedIds.push(token);
            return;
          }
          const normalized = normalizeToken(token);
          if (operationsByNormalizedName.has(normalized)) {
            resolvedIds.push(operationsByNormalizedName.get(normalized).id);
            return;
          }
          if (operationsByCode.has(token)) {
            resolvedIds.push(operationsByCode.get(token).id);
            return;
          }
          if (operationsByName.has(normalized)) {
            resolvedIds.push(operationsByName.get(normalized).id);
            return;
          }
          unresolvedCount += 1;
          return;
        }

        if (op && typeof op === 'object') {
          if (op.id && operationsById.has(op.id)) {
            resolvedIds.push(op.id);
            return;
          }
          const name = op.name || op.label;
          if (name && typeof name === 'string') {
            const normalized = normalizeToken(name);
            if (operationsByNormalizedName.has(normalized)) {
              resolvedIds.push(operationsByNormalizedName.get(normalized).id);
              return;
            }
            if (operationsByName.has(normalized)) {
              resolvedIds.push(operationsByName.get(normalized).id);
              return;
            }
          }
          unresolvedCount += 1;
        }
      });

      const uniqueIds = Array.from(new Set(resolvedIds));
      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: userId,
      };

      if (uniqueIds.length > 0) {
        updateData.operationIds = uniqueIds;
      }

      if (unresolvedCount > 0 || uniqueIds.length === 0) {
        updateData.operationalMappingNeedsReview = true;
        needsReview += 1;
      } else {
        updateData.operationalMappingNeedsReview = false;
      }

      const result = await prisma.policyDocument.updateMany({
        where: {
          tenantId,
          OR: [
            { theaEngineId: doc.theaEngineId || undefined },
            { policyEngineId: doc.theaEngineId || (doc as any).policyEngineId || undefined },
            { id: doc.id },
          ],
        },
        data: updateData as any,
      });

      if (result.count > 0) updated += 1;

      const documentId = doc.theaEngineId || doc.id;
      if (documentId) {
        const departmentId = Array.isArray(doc.departmentIds) ? doc.departmentIds[0] : undefined;
        const linkResult = await replaceOperationLinks(
          req,
          tenantId,
          documentId,
          uniqueIds,
          doc.entityType,
          departmentId
        );
        if (!(linkResult instanceof NextResponse)) {
          linksUpserted += linkResult.upserted || 0;
        }
      }
    }

    return NextResponse.json({
      success: true,
      scanned: docs.length,
      updated,
      needsReview,
      linksUpserted,
    });
  } catch (error: any) {
    logger.error('Backfill operationIds error:', { error: error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to backfill operationIds' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.metadata.write' });
