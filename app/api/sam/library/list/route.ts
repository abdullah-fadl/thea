import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { evaluateLifecycle } from '@/lib/sam/lifecycle';
import { theaEngineListPolicies, theaEngineSearch } from '@/lib/sam/theaEngineGateway';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const getTheaEngineId = (policy: Record<string, unknown>) => policy.policyId || policy.id;
const getTheaEngineFilename = (policy: Record<string, unknown>) =>
  policy?.filename || policy?.fileName || policy?.originalFileName || 'Unknown';

async function upsertTheaEnginePolicies(
  tenantId: string,
  theaEnginePolicies: Record<string, unknown>[]
) {
  const theaEngineIds = theaEnginePolicies
    .map((policy) => getTheaEngineId(policy))
    .filter(Boolean);
  if (theaEngineIds.length === 0) return;

  // Fetch existing documents matching any of the theaEngineIds
  const theaEngineIdsStr = theaEngineIds as string[];
  const existingDocs = await prisma.policyDocument.findMany({
    where: {
      tenantId,
      OR: [
        { theaEngineId: { in: theaEngineIdsStr } },
        { policyEngineId: { in: theaEngineIdsStr } },
        { id: { in: theaEngineIdsStr } },
      ],
    },
  });
  const existingById = new Map<string, any>();
  existingDocs.forEach((doc: any) => {
    const key = doc.theaEngineId || doc.policyEngineId || doc.id;
    if (key) {
      existingById.set(key as string, doc);
    }
  });

  const now = new Date();
  for (const policy of theaEnginePolicies) {
    const theaEngineId = getTheaEngineId(policy);
    if (!theaEngineId) continue;

    const existing = existingById.get(theaEngineId as string);
    const setData: Record<string, any> = {
      tenantId,
      theaEngineId,
      originalFileName: getTheaEngineFilename(policy),
      filename: getTheaEngineFilename(policy),
      indexedAt: (policy.indexedAt || policy.indexed_at) as string | undefined,
      updatedAt: now,
    };
    if (!existing?.status && policy.status) {
      setData.status = policy.status;
    }
    if (!existing?.progress && policy.progress) {
      setData.progress = policy.progress;
    }

    if (existing) {
      // Update existing
      await prisma.policyDocument.updateMany({
        where: {
          tenantId,
          OR: [
            { theaEngineId },
            { policyEngineId: theaEngineId },
            { id: theaEngineId },
          ],
        },
        data: setData as Prisma.PolicyDocumentUncheckedUpdateManyInput,
      });
    } else {
      // Insert new
      try {
        await prisma.policyDocument.create({
          data: {
            ...setData,
            id: theaEngineId,
            title: getTheaEngineFilename(policy),
            createdAt: now,
            isActive: true,
            tagsStatus: 'auto-approved',
            scope: 'enterprise',
          } as Prisma.PolicyDocumentUncheckedCreateInput,
        });
      } catch (insertError: unknown) {
        // Ignore duplicate key errors
        if (!(insertError as any)?.message?.includes('Unique constraint')) {
          logger.warn('Failed to upsert policy document:', { error: insertError });
        }
      }
    }
  }
}

/**
 * Build task counts per documentId using JS aggregation (replaces MongoDB aggregate)
 */
async function buildTaskCounts(tenantId: string, documentIds: string[]): Promise<Map<string, number>> {
  const taskCountsMap = new Map<string, number>();
  if (documentIds.length === 0) return taskCountsMap;

  const tasks = await prisma.documentTask.findMany({
    where: { tenantId, documentId: { in: documentIds } },
    select: { documentId: true },
  });
  tasks.forEach((task: any) => {
    const docId = task.documentId as string;
    taskCountsMap.set(docId, (taskCountsMap.get(docId) || 0) + 1);
  });
  return taskCountsMap;
}

/**
 * Build finding counts per documentId using JS aggregation (replaces MongoDB $unwind + $group)
 */
async function buildFindingCounts(tenantId: string, documentIds: string[]): Promise<Map<string, number>> {
  const findingCountsMap = new Map<string, number>();
  if (documentIds.length === 0) return findingCountsMap;

  const findings = await prisma.integrityFinding.findMany({
    where: {
      tenantId,
      status: { in: ['OPEN', 'IN_REVIEW'] },
    },
    select: { documentIds: true },
    take: 1000,
  });

  // documentIds is a String[] array field on each finding. Count how many findings reference each docId.
  const docIdSet = new Set(documentIds);
  findings.forEach((finding: Record<string, unknown>) => {
    const fDocIds = Array.isArray(finding.documentIds) ? finding.documentIds : [];
    fDocIds.forEach((docId: string) => {
      if (docIdSet.has(docId)) {
        findingCountsMap.set(docId, (findingCountsMap.get(docId) || 0) + 1);
      }
    });
  });
  return findingCountsMap;
}

/**
 * Build active run status per documentId
 */
async function buildRunStatusMap(tenantId: string, documentIds: string[]): Promise<Map<string, { runId: string; status: string }>> {
  const runStatusMap = new Map<string, { runId: string; status: string }>();
  if (documentIds.length === 0) return runStatusMap;

  const activeRuns = await prisma.integrityRun.findMany({
    where: {
      tenantId,
      status: { in: ['RUNNING', 'QUEUED'] },
    },
    select: { id: true, status: true, documentIds: true },
    take: 100,
  });

  const docIdSet = new Set(documentIds);
  activeRuns.forEach((run: any) => {
    const runDocIds = (Array.isArray(run.documentIds) ? run.documentIds : []) as string[];
    runDocIds.forEach((docId: string) => {
      if (docIdSet.has(docId) && !runStatusMap.has(docId)) {
        runStatusMap.set(docId, { runId: run.id as string, status: run.status as string });
      }
    });
  });
  return runStatusMap;
}

function buildItem(mongoDoc: Record<string, unknown>, pePolicy: Record<string, unknown> | undefined, taskCountsMap: Map<string, number>, findingCountsMap: Map<string, number>, runStatusMap: Map<string, { runId: string; status: string }>) {
  const theaEngineId = String(mongoDoc.theaEngineId || mongoDoc.policyEngineId || mongoDoc.id || '');
  const lifecycleStatus = computeLifecycleStatus(mongoDoc);
  const operationalMapping = (mongoDoc.classification as Record<string, unknown>) || {};
  const normalizeIds = (items: unknown) =>
    (Array.isArray(items) ? items : [])
      .map((item: unknown) => (typeof item === 'string' ? item : (item as Record<string, unknown>)?.id))
      .filter(Boolean);

  return {
    theaEngineId,
    filename: getTheaEngineFilename(pePolicy) || mongoDoc.originalFileName || 'Unknown',
    status: pePolicy?.status || 'UNKNOWN',
    indexedAt: pePolicy?.indexedAt || pePolicy?.indexed_at,
    progress: pePolicy?.progress || {},
    taskCount: taskCountsMap.get(theaEngineId) || 0,
    metadata: {
      title: mongoDoc.title || mongoDoc.originalFileName || '',
      departmentIds: mongoDoc.departmentIds || [],
      scope: mongoDoc.scope || 'enterprise',
      tagsStatus: mongoDoc.tagsStatus || 'auto-approved',
      effectiveDate: mongoDoc.effectiveDate,
      expiryDate: mongoDoc.expiryDate,
      version: mongoDoc.version,
      owners: mongoDoc.owners || [],
      lifecycleStatus,
      integrityOpenCount: findingCountsMap.get(theaEngineId) || 0,
      integrityLastRunAt: (mongoDoc as Record<string, unknown>).integrityLastRunAt || null,
      integrityRunStatus: runStatusMap.get(theaEngineId)?.status || null,
      integrityRunId: runStatusMap.get(theaEngineId)?.runId || null,
      entityType: mongoDoc.entityType,
      category: mongoDoc.category,
      source: mongoDoc.source,
      operationIds: mongoDoc.operationIds || [],
      archivedAt: mongoDoc.archivedAt || null,
      status: mongoDoc.status,
      statusUpdatedAt: mongoDoc.statusUpdatedAt,
      reviewCycleMonths: mongoDoc.reviewCycleMonths,
      nextReviewDate: mongoDoc.nextReviewDate,
      operationalMapping: {
        operations: normalizeIds(operationalMapping.operations),
        function: operationalMapping.function,
        riskDomains: normalizeIds(operationalMapping.riskDomains),
        mappingConfidence: operationalMapping.mappingConfidence,
        needsReview: mongoDoc.operationalMappingNeedsReview || operationalMapping.needsReview || false,
      },
    },
  };
}

export const GET = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);

    // Filters
    const departmentIdsParam = searchParams.get('departmentIds');
    const departmentIds = departmentIdsParam ? departmentIdsParam.split(',').filter(Boolean) : [];
    const scope = searchParams.get('scope');
    const entityType = searchParams.get('entityType');
    const tagsStatus = searchParams.get('tagsStatus');
    const expiryStatus = searchParams.get('expiryStatus');
    const lifecycleStatus = searchParams.get('lifecycleStatus');
    const searchQuery = searchParams.get('search') || '';
    const includeArchived = searchParams.get('includeArchived') === '1';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // If search query provided, use thea-engine search
    if (searchQuery.trim()) {
      try {
        const searchData = await theaEngineSearch(req, tenantId, {
          query: searchQuery,
          topK: limit * 2,
        });
        const searchPolicyIds = new Set(
          (searchData.results || []).map((r: Record<string, unknown>) => r.policyId || r.policy_id)
        );

        if (searchPolicyIds.size === 0) {
          return NextResponse.json({
            items: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          });
        }

        const policiesData = await theaEngineListPolicies(req, tenantId);
        const theaEnginePolicies = (policiesData.policies || []).filter((p: Record<string, unknown>) =>
          searchPolicyIds.has(getTheaEngineId(p))
        );

        await upsertTheaEnginePolicies(tenantId, theaEnginePolicies);

        // Build Prisma where clause
        const searchIdArray = Array.from(searchPolicyIds);
        const prismaWhereAnd: any[] = [
            {
              OR: [
                { theaEngineId: { in: searchIdArray } },
                { policyEngineId: { in: searchIdArray } },
                { id: { in: searchIdArray } },
              ],
            },
        ];
        const prismaWhere: Record<string, unknown> = {
          tenantId: tenantId,
          isActive: true,
          deletedAt: null,
          AND: prismaWhereAnd,
        };
        if (!includeArchived) {
          prismaWhere.archivedAt = null;
        }
        if (departmentIds.length > 0) {
          prismaWhereAnd.push({
            departmentIds: { hasSome: departmentIds },
          });
        }
        if (scope) {
          prismaWhereAnd.push({ scope });
        }
        if (entityType) {
          prismaWhereAnd.push({ entityType });
        }
        if (tagsStatus) {
          prismaWhereAnd.push({ tagsStatus });
        }

        // If only one condition in AND, simplify
        if (prismaWhereAnd.length === 1) {
          prismaWhere.OR = prismaWhereAnd[0].OR;
          delete prismaWhere.AND;
        }

        const mongoDocs = await prisma.policyDocument.findMany({
          where: prismaWhere,
          take: 500,
        });
        const documentIds = mongoDocs.map((doc: any) => String(doc.theaEngineId || doc.policyEngineId || doc.id || '')).filter(Boolean);

        const [taskCountsMap, findingCountsMap, runStatusMap] = await Promise.all([
          buildTaskCounts(tenantId, documentIds),
          buildFindingCounts(tenantId, documentIds),
          buildRunStatusMap(tenantId, documentIds),
        ]);

        const theaEngineIds = mongoDocs
          .map((d: any) => d.theaEngineId || d.id)
          .filter(Boolean) as string[];

        if (theaEngineIds.length === 0) {
          return NextResponse.json({
            items: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          });
        }

        const pePolicyMap = new Map<string, any>(
          theaEnginePolicies.map((p: Record<string, unknown>) => [getTheaEngineId(p), p] as const)
        );

        const items = mongoDocs.map((mongoDoc: any) => {
          const theaEngineId = String(mongoDoc.theaEngineId || mongoDoc.policyEngineId || mongoDoc.id || '');
          const pePolicy = pePolicyMap.get(theaEngineId) as Record<string, unknown> | undefined;
          return buildItem(mongoDoc as Record<string, unknown>, pePolicy, taskCountsMap, findingCountsMap, runStatusMap);
        });

        // Apply expiry/lifecycle filter
        let filteredItems = items;
        if (expiryStatus) {
          filteredItems = items.filter((item) => {
            if (expiryStatus === 'expired') return item.metadata.lifecycleStatus === 'EXPIRED';
            if (expiryStatus === 'expiringSoon') return item.metadata.lifecycleStatus === 'EXPIRING_SOON';
            if (expiryStatus === 'valid') return ['ACTIVE', 'UNDER_REVIEW'].includes(item.metadata.lifecycleStatus || '');
            return true;
          });
        }
        if (lifecycleStatus) {
          filteredItems = filteredItems.filter(
            (item) => item.metadata.lifecycleStatus === lifecycleStatus
          );
        }

        const total = filteredItems.length;
        const paginatedItems = filteredItems.slice((page - 1) * limit, page * limit);

        return NextResponse.json({
          items: paginatedItems,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (searchError) {
        logger.warn('Policy-engine search failed, falling back to list:', { error: searchError });
      }
    }

    // No search query or search failed - list all policies with metadata
    const policiesData = await theaEngineListPolicies(req, tenantId);
    const theaEnginePolicies = policiesData.policies || [];
    if (theaEnginePolicies.length === 0) {
      return NextResponse.json({
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    await upsertTheaEnginePolicies(tenantId, theaEnginePolicies);

    // Build Prisma query with filters
    const prismaWhere: Record<string, unknown> = {
      tenantId: tenantId,
      isActive: true,
      deletedAt: null,
    };
    if (!includeArchived) {
      prismaWhere.archivedAt = null;
    }
    if (departmentIds.length > 0) {
      prismaWhere.departmentIds = { hasSome: departmentIds };
    }
    if (scope) {
      prismaWhere.scope = scope;
    }
    if (entityType) {
      prismaWhere.entityType = entityType;
    }
    if (tagsStatus) {
      prismaWhere.tagsStatus = tagsStatus;
    }

    const mongoDocs = await prisma.policyDocument.findMany({
      where: prismaWhere,
      take: 500,
    });

    const documentIds = mongoDocs.map((doc: any) => String(doc.theaEngineId || doc.policyEngineId || doc.id || '')).filter(Boolean);

    const [taskCountsMap, findingCountsMap, runStatusMap] = await Promise.all([
      buildTaskCounts(tenantId, documentIds),
      buildFindingCounts(tenantId, documentIds),
      buildRunStatusMap(tenantId, documentIds),
    ]);

    const theaEngineIds = mongoDocs
      .map((d: any) => d.theaEngineId || d.id)
      .filter(Boolean) as string[];

    if (theaEngineIds.length === 0) {
      return NextResponse.json({
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    const pePolicyMap = new Map<string, any>(
      theaEnginePolicies.map((p: Record<string, unknown>) => [getTheaEngineId(p), p] as const)
    );

    let items = mongoDocs.map((mongoDoc: any) => {
      const theaEngineId = String(mongoDoc.theaEngineId || mongoDoc.policyEngineId || mongoDoc.id || '');
      const pePolicy = pePolicyMap.get(theaEngineId) as Record<string, unknown> | undefined;
      return buildItem(mongoDoc as Record<string, unknown>, pePolicy, taskCountsMap, findingCountsMap, runStatusMap);
    });

    // Apply expiry filter if specified
    if (expiryStatus) {
      items = items.filter((item) => {
        if (expiryStatus === 'expired') return item.metadata.lifecycleStatus === 'EXPIRED';
        if (expiryStatus === 'expiringSoon') return item.metadata.lifecycleStatus === 'EXPIRING_SOON';
        if (expiryStatus === 'valid') return ['ACTIVE', 'UNDER_REVIEW'].includes(item.metadata.lifecycleStatus || '');
        return true;
      });
    }
    if (lifecycleStatus) {
      items = items.filter((item) => item.metadata.lifecycleStatus === lifecycleStatus);
    }

    // Paginate
    const total = items.length;
    const paginatedItems = items.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    logger.error('Library list error:', { error: error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to list library items' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.list' });

/**
 * Compute lifecycle status from document
 */
function computeLifecycleStatus(doc: Record<string, unknown>): string {
  if (!doc) return 'ACTIVE';
  const evaluation = evaluateLifecycle(doc);
  return evaluation.status;
}
