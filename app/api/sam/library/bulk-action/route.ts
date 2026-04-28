import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { theaEngineDeletePolicy } from '@/lib/sam/theaEngineGateway';
import { validateBody } from '@/lib/validation/helpers';
import { samBulkActionSchema } from '@/lib/validation/sam.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/sam/library/bulk-action
 *
 * Perform bulk actions on library items
 *
 * Body: {
 *   action: 'delete' | 'archive' | 'reassign-departments' | 'mark-global' | 'mark-shared',
 *   theaEngineIds: string[],
 *   metadata?: { departmentIds?, scope?, ... } (for reassign/mark actions)
 * }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, samBulkActionSchema);
    if ('error' in v) return v.error;
    const { action, theaEngineIds, metadata } = v.data;

    const baseWhere = {
      tenantId: tenantId,
      OR: [
        { theaEngineId: { in: theaEngineIds } },
        { policyEngineId: { in: theaEngineIds } }, // backward compat: old field name
        { id: { in: theaEngineIds } }, // Fallback for legacy
      ],
    };

    const activeWhere = {
      ...baseWhere,
      isActive: true,
      deletedAt: null,
    };

    let updateData: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    switch (action) {
      case 'delete': {
        const policies = await prisma.policyDocument.findMany({
          where: baseWhere,
        });
        const policyIds = policies.map((p: any) => p.id || p.documentId || p.theaEngineId).filter(Boolean);
        const documentIds = policies.map((p: any) => p.documentId || p.theaEngineId || p.id).filter(Boolean);

        const deleteResults = await Promise.allSettled(
          theaEngineIds.map((theaEngineId: string) =>
            theaEngineDeletePolicy(req, tenantId, theaEngineId)
          )
        );
        const failedDeletes = deleteResults
          .map((result, index) => ({ result, theaEngineId: theaEngineIds[index] }))
          .filter((entry) => entry.result.status === 'rejected');
        if (failedDeletes.length > 0) {
          return NextResponse.json(
            {
              error: 'Failed to delete one or more documents from the document engine',
              failedTheaEngineIds: failedDeletes.map((entry) => entry.theaEngineId),
            },
            { status: 502 }
          );
        }

        if (policyIds.length > 0 || documentIds.length > 0) {
          const chunkOrConditions: any[] = [];
          if (policyIds.length > 0) chunkOrConditions.push({ documentId: { in: policyIds } });
          if (documentIds.length > 0) chunkOrConditions.push({ documentId: { in: documentIds } });

          await prisma.policyChunk.deleteMany({
            where: {
              tenantId,
              OR: chunkOrConditions,
            },
          });
        }

        const deleteResult = await prisma.policyDocument.deleteMany({
          where: baseWhere,
        });
        return NextResponse.json({
          success: true,
          action,
          deletedCount: deleteResult.count || 0,
          theaEngineIds,
        });
      }

      case 'archive':
        updateData = {
          archivedAt: new Date(),
          archivedBy: userId,
          status: 'ARCHIVED',
          statusUpdatedAt: new Date(),
          updatedAt: new Date(),
        };
        break;

      case 'unarchive':
        updateData = {
          archivedAt: null,
          archivedBy: null,
          status: 'ACTIVE',
          statusUpdatedAt: new Date(),
          updatedAt: new Date(),
        };
        break;

      case 'reassign-departments':
        if (!metadata?.departmentIds || !Array.isArray(metadata.departmentIds)) {
          return NextResponse.json(
            { error: 'metadata.departmentIds array is required for reassign-departments' },
            { status: 400 }
          );
        }
        updateData.departmentIds = metadata.departmentIds;
        break;

      case 'mark-global':
        updateData.scope = 'enterprise';
        if (metadata?.departmentIds) {
          updateData.departmentIds = []; // Clear departments for global
        }
        break;

      case 'mark-shared':
        updateData.scope = 'shared';
        if (metadata?.departmentIds && Array.isArray(metadata.departmentIds)) {
          updateData.departmentIds = metadata.departmentIds;
        }
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const result = await prisma.policyDocument.updateMany({
      where: activeWhere,
      data: updateData as Prisma.InputJsonValue,
    });

    return NextResponse.json({
      success: true,
      action,
      matchedCount: result.count,
      modifiedCount: result.count,
      theaEngineIds,
    });
  } catch (error: any) {
    logger.error('Bulk action error:', { error: error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.bulk-action' });
