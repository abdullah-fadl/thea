import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { replaceOperationLinks } from '@/lib/sam/operationLinks';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import type { Prisma } from '@prisma/client';

const updateLibraryMetadataSchema = z.object({
  theaEngineId: z.string().min(1, 'theaEngineId is required'),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/library/metadata?theaEngineId=<id>
 *
 * Get metadata for a single library item
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const theaEngineId = searchParams.get('theaEngineId');

    if (!theaEngineId) {
      return NextResponse.json(
        { error: 'theaEngineId is required' },
        { status: 400 }
      );
    }

    const doc = await prisma.policyDocument.findFirst({
      where: {
        tenantId: tenantId,
        OR: [
          { theaEngineId: theaEngineId },
          { policyEngineId: theaEngineId }, // backward compat: old field name
          { id: theaEngineId }, // Fallback for legacy
        ],
        isActive: true,
        deletedAt: null,
      },
    });

    if (!doc) {
      return NextResponse.json(
        { error: 'Metadata not found' },
        { status: 404 }
      );
    }

    // PolicyDocument has extended JSON-stored fields not in the Prisma schema
    const docExt = doc as typeof doc & any;

    const normalizeIds = (items: unknown[]) =>
      (Array.isArray(items) ? items : [])
        .map((item) => (typeof item === 'string' ? item : (item as Record<string, unknown>)?.id))
        .filter(Boolean);

    const classification = (doc.classification as Record<string, unknown>) || {};

    return NextResponse.json({
      theaEngineId: doc.theaEngineId || doc.id,
      metadata: {
        title: doc.title,
        departmentIds: doc.departmentIds || [],
        scope: doc.scope || 'enterprise',
        tagsStatus: doc.tagsStatus || 'auto-approved',
        effectiveDate: doc.effectiveDate,
        expiryDate: doc.expiryDate,
        version: doc.version,
        reviewCycleMonths: doc.reviewCycleMonths,
        nextReviewDate: doc.nextReviewDate,
        status: doc.status,
        statusUpdatedAt: doc.statusUpdatedAt,
        owners: doc.owners || [],
        entityType: doc.entityType,
        category: doc.category,
        source: doc.source,
        setting: docExt.setting,
        policyType: docExt.policyType,
        sector: docExt.sector,
        country: docExt.country,
        reviewCycle: docExt.reviewCycle,
        tags: (docExt.tags as unknown[]) || [],
        section: docExt.section,
        aiTags: docExt.aiTags,
        operationalMapping: {
          operations: normalizeIds(classification.operations as unknown[] || []),
          function: classification.function,
          riskDomains: normalizeIds(classification.riskDomains as unknown[] || []),
          mappingConfidence: classification.mappingConfidence,
          needsReview: doc.operationalMappingNeedsReview || classification.needsReview || false,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Get metadata error:', { error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to get metadata' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.metadata.read' });

/**
 * PUT /api/sam/library/metadata
 *
 * Update metadata for a library item
 */
export const PUT = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, updateLibraryMetadataSchema);
    if ('error' in v) return v.error;
    const { theaEngineId, metadata } = v.data as { theaEngineId: string; metadata: Record<string, unknown> };

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };
    const parseDateValue = (value: unknown): Date | undefined => {
      if (!value) return undefined;
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      return undefined;
    };
    const normalizeRequiredType = (value?: string) => {
      if (!value) return undefined;
      if (value === 'Policy') return 'policy';
      if (value === 'SOP') return 'sop';
      if (value === 'Workflow') return 'workflow';
      return undefined;
    };

    if (metadata.title !== undefined) updateData.title = metadata.title;
    if (metadata.departmentIds !== undefined) updateData.departmentIds = metadata.departmentIds;
    if (metadata.scope !== undefined) updateData.scope = metadata.scope;
    if (metadata.scopeId !== undefined) updateData.scopeId = metadata.scopeId;
    if (metadata.tagsStatus !== undefined) updateData.tagsStatus = metadata.tagsStatus;
    if (metadata.effectiveDate !== undefined) updateData.effectiveDate = parseDateValue(metadata.effectiveDate);
    if (metadata.expiryDate !== undefined) updateData.expiryDate = parseDateValue(metadata.expiryDate);
    if (metadata.version !== undefined) updateData.version = metadata.version;
    if (metadata.reviewCycleMonths !== undefined) updateData.reviewCycleMonths = metadata.reviewCycleMonths;
    if (metadata.nextReviewDate !== undefined) updateData.nextReviewDate = metadata.nextReviewDate;
    if (metadata.status !== undefined) updateData.status = metadata.status;
    if (metadata.statusUpdatedAt !== undefined) updateData.statusUpdatedAt = metadata.statusUpdatedAt;
    if (metadata.owners !== undefined) updateData.owners = metadata.owners;
    if (metadata.entityType !== undefined) updateData.entityType = metadata.entityType;
    if (metadata.entityTypeId !== undefined) updateData.entityTypeId = metadata.entityTypeId;
    if (metadata.category !== undefined) updateData.category = metadata.category;
    if (metadata.source !== undefined) updateData.source = metadata.source;
    if (metadata.setting !== undefined) updateData.setting = metadata.setting;
    if (metadata.policyType !== undefined) updateData.policyType = metadata.policyType;
    if (metadata.sector !== undefined) updateData.sector = metadata.sector;
    if (metadata.sectorId !== undefined) updateData.sectorId = metadata.sectorId;
    if (metadata.country !== undefined) updateData.country = metadata.country;
    if (metadata.reviewCycle !== undefined) updateData.reviewCycle = metadata.reviewCycle;
    if (metadata.tags !== undefined) updateData.tags = metadata.tags;
    if (metadata.section !== undefined) updateData.section = metadata.section;
    if (metadata.aiTags !== undefined) updateData.aiTags = metadata.aiTags;

    const creationContext = metadata.creationContext as Record<string, unknown> | undefined;
    if (creationContext && creationContext.source === 'gap_modal') {
      updateData.creationContext = creationContext;
      const pinnedEntityType = normalizeRequiredType(creationContext.requiredType as string | undefined);
      if (pinnedEntityType) {
        updateData.entityType = pinnedEntityType;
      }
      if (creationContext.departmentId) {
        const existing = Array.isArray(updateData.departmentIds) ? updateData.departmentIds : [];
        updateData.departmentIds = Array.from(new Set([creationContext.departmentId as string, ...existing]));
      }
      if (creationContext.operationId) {
        const existingOps = Array.isArray(updateData.operationIds) ? updateData.operationIds : [];
        const merged = Array.from(new Set([creationContext.operationId as string, ...existingOps]));
        updateData.operationIds = merged;
      }
    }
    const resolveOperationIds = async (tokens?: string[]) => {
      const list = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
      if (list.length === 0) return { resolvedIds: [], unresolvedCount: 0 };
      const operations = await prisma.taxonomyOperation.findMany({
        where: { tenantId, isActive: true },
        take: 500,
      });
      type TaxOp = (typeof operations)[number];
      const operationsById = new Map<string, TaxOp>();
      const operationsByNormalizedName = new Map<string, TaxOp>();
      const operationsByCode = new Map<string, TaxOp>();
      const operationsByName = new Map<string, TaxOp>();
      operations.forEach((op) => {
        if (!op) return;
        const opAny = op as any;
        const opId = op.id;
        if (opId) operationsById.set(opId, op);
        if (opAny.normalizedName) operationsByNormalizedName.set(opAny.normalizedName, op);
        if (op.code) operationsByCode.set(op.code, op);
        if (op.name) operationsByName.set(op.name.toLowerCase(), op);
      });
      const normalizeToken = (value: string) => value.trim().toLowerCase();
      const resolvedIds: string[] = [];
      let unresolvedCount = 0;
      list.forEach((token) => {
        if (operationsById.has(token)) {
          resolvedIds.push(token);
          return;
        }
        const normalized = normalizeToken(token);
        if (operationsByNormalizedName.has(normalized)) {
          resolvedIds.push(operationsByNormalizedName.get(normalized)!.id);
          return;
        }
        if (operationsByCode.has(token)) {
          resolvedIds.push(operationsByCode.get(token)!.id);
          return;
        }
        if (operationsByName.has(normalized)) {
          resolvedIds.push(operationsByName.get(normalized)!.id);
          return;
        }
        unresolvedCount += 1;
      });
      return { resolvedIds: Array.from(new Set(resolvedIds)), unresolvedCount };
    };

    let debugOperations: Record<string, unknown> | null = null;

    // For dot-notation classification updates, we need to read the current classification,
    // merge changes in JS, then write the full classification JSON back.
    let classificationUpdates: Record<string, unknown> = {};

    if (metadata.operationIds !== undefined) {
      const { resolvedIds, unresolvedCount } = await resolveOperationIds(metadata.operationIds as string[]);
      if (resolvedIds.length > 0) {
        updateData.operationIds = resolvedIds;
        classificationUpdates.operations = resolvedIds;
      } else {
        updateData.operationIds = metadata.operationIds;
        classificationUpdates.operations = metadata.operationIds;
      }
      updateData.operationalMappingNeedsReview = unresolvedCount > 0;
      classificationUpdates.needsReview = unresolvedCount > 0;
      debugOperations = {
        source: 'metadata.operationIds',
        input: metadata.operationIds,
        resolvedIds,
        unresolvedCount,
      };
    }
    if (metadata.operationalMapping !== undefined) {
      const mapping = (metadata.operationalMapping || {}) as Record<string, unknown>;
      if (mapping.operations !== undefined) {
        const { resolvedIds, unresolvedCount } = await resolveOperationIds(mapping.operations as string[]);
        const finalOps = resolvedIds.length > 0 ? resolvedIds : mapping.operations as string[];
        classificationUpdates.operations = finalOps;
        updateData.operationIds = finalOps;
        updateData.operationalMappingNeedsReview = unresolvedCount > 0;
        classificationUpdates.needsReview = unresolvedCount > 0;
        debugOperations = {
          source: 'metadata.operationalMapping.operations',
          input: mapping.operations,
          resolvedIds,
          unresolvedCount,
        };
      }
      if (mapping.function !== undefined) {
        classificationUpdates.function = mapping.function;
      }
      if (mapping.riskDomains !== undefined) {
        classificationUpdates.riskDomains = mapping.riskDomains;
      }
      if (mapping.mappingConfidence !== undefined) {
        classificationUpdates.mappingConfidence = mapping.mappingConfidence;
      }
      if (mapping.needsReview !== undefined) {
        updateData.operationalMappingNeedsReview = mapping.needsReview;
        classificationUpdates.needsReview = mapping.needsReview;
      }
    }

    // If classification changes, read current doc, merge, write back full JSON
    if (Object.keys(classificationUpdates).length > 0) {
      const existingDoc = await prisma.policyDocument.findFirst({
        where: {
          tenantId,
          OR: [
            { theaEngineId: theaEngineId },
            { policyEngineId: theaEngineId },
            { id: theaEngineId },
          ],
        },
        select: { classification: true },
      });
      const existingClassification = (existingDoc?.classification as Record<string, unknown>) || {};
      updateData.classification = {
        ...existingClassification,
        ...classificationUpdates,
      };
    }

    const result = await prisma.policyDocument.updateMany({
      where: {
        tenantId: tenantId,
        OR: [
          { theaEngineId: theaEngineId },
          { policyEngineId: theaEngineId }, // backward compat
          { id: theaEngineId }, // Fallback for legacy
        ],
        isActive: true,
        deletedAt: null,
      },
      data: updateData as Prisma.PolicyDocumentUpdateManyMutationInput,
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Metadata not found' },
        { status: 404 }
      );
    }

    const shouldUpdateLinks =
      metadata?.operationIds !== undefined ||
      (metadata?.operationalMapping as Record<string, unknown> | undefined)?.operations !== undefined;

    if (shouldUpdateLinks) {
      const classificationData = updateData.classification as Record<string, unknown> | undefined;
      const finalOperationIds = Array.isArray(updateData.operationIds)
        ? updateData.operationIds
        : Array.isArray(classificationData?.operations)
        ? classificationData.operations as string[]
        : [];
      const doc = await prisma.policyDocument.findFirst({
        where: {
          tenantId: tenantId,
          OR: [
            { theaEngineId: theaEngineId },
            { policyEngineId: theaEngineId },
            { id: theaEngineId },
          ],
        },
        select: { theaEngineId: true, policyEngineId: true, id: true, entityType: true, departmentIds: true },
      });
      const documentId = doc?.theaEngineId || doc?.policyEngineId || doc?.id || theaEngineId;
      const departmentId = Array.isArray(doc?.departmentIds) ? doc?.departmentIds[0] : undefined;
      await replaceOperationLinks(req, tenantId, documentId, finalOperationIds, doc?.entityType, departmentId);
      if (process.env.NODE_ENV !== 'production') {
        logger.info('[metadata] operation link upsert', {
          tenantId,
          documentId,
          entityType: doc?.entityType,
          operations: finalOperationIds,
          debugOperations,
        });
      }
    }

    const shouldTriggerIntegrity = Boolean(
      metadata?.departmentIds !== undefined ||
      metadata?.scope !== undefined ||
      metadata?.entityType !== undefined ||
      metadata?.operationIds !== undefined ||
      metadata?.operationalMapping !== undefined
    );
    if (shouldTriggerIntegrity) {
      try {
        await fetch(new URL('/api/sam/integrity/runs', req.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
          body: JSON.stringify({
            type: 'issues',
            documentIds: [theaEngineId],
            scope: { type: 'selection' },
          }),
        });
      } catch (integrityError) {
        logger.warn('Failed to trigger integrity run on metadata update:', { error: integrityError });
      }
    }

    return NextResponse.json({
      success: true,
      theaEngineId,
    });
  } catch (error: unknown) {
    logger.error('Update metadata error:', { error });
    return NextResponse.json(
      { error: 'Failed to update metadata' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.metadata.write' });
