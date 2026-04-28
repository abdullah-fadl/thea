import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { buildDedupeKey, summarizeFindings } from '@/lib/sam/integrity';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import type { IntegrityFinding, IntegrityRun } from '@/lib/models/Integrity';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '@/lib/monitoring/logger';

/** Shape of the raw AI issue returned from the Thea engine */
interface RawIssue {
  type?: string;
  severity?: string;
  title?: string;
  summary?: string;
  recommendation?: string;
  evidence?: RawEvidence[];
  locationA?: { pageNumber?: number; snippet?: string };
  locationB?: { pageNumber?: number; snippet?: string };
  policyA?: { policyId?: string; documentId?: string; filename?: string };
  policyB?: { policyId?: string; documentId?: string; filename?: string };
}

interface RawEvidence {
  policyId?: string;
  documentId?: string;
  policy_id?: string;
  filename?: string;
  page?: number | null;
  chunkId?: string;
  chunk_id?: string;
  quote?: string;
}

/** Metadata shape stored in IntegrityFinding.metadata JSON column */
interface IntegrityFindingMetadata {
  recommendation?: string;
  evidence?: IntegrityFinding['evidence'];
  dedupeKey?: string;
  lastSeenAt?: Date;
  runIds?: string[];
}

/** Metadata shape stored in IntegrityRun.result JSON column */
interface IntegrityRunResult {
  runKey?: string;
  engineConfig?: any;
  query?: string;
  collections?: string[];
  orgProfileSnapshot?: any;
  contextRulesSnapshot?: any;
  summary?: any;
  error?: string;
}

/** Metadata shape stored in IntegrityRun.scope JSON column */
interface IntegrityRunScope {
  type?: string;
  mode?: string;
  filters?: Record<string, string | undefined>;
  runKey?: string;
}

/** Metadata shape stored in IntegrityRun.progress JSON column */
interface IntegrityRunProgress {
  percent: number;
  step: string;
}

/** Metadata shape stored in IntegrityActivity.metadata JSON column */
interface IntegrityActivityMeta {
  runId: string;
}

/** Shape of a library list item returned from /api/sam/library/list */
interface LibraryListItem {
  theaEngineId?: string;
}
const integrityRunSchema = z.object({
  type: z.string().optional().default('issues'),
  query: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  topK: z.number().optional(),
  includeEvidence: z.boolean().optional(),
  allowReopenResolved: z.boolean().optional().default(false),
  scope: z.any().optional(),
  collections: z.array(z.string()).optional(),
  mode: z.string().optional(),
  profile: z.string().optional(),
  layers: z.array(z.any()).optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const mapIssuesToFindings = (
  tenantId: string,
  runId: string,
  issues: RawIssue[],
  now: Date
): IntegrityFinding[] =>
  issues.map((issue) => {
    const evidence = (issue.evidence || []).map((entry: RawEvidence) => ({
      documentId: entry.policyId || entry.documentId || entry.policy_id,
      filename: entry.filename,
      page: entry.page ?? null,
      chunkId: entry.chunkId || entry.chunk_id || null,
      quote: entry.quote,
    }));
    const documentIds: string[] = Array.from(
      new Set(
        evidence
          .map((entry) => String(entry.documentId || '').trim())
          .filter(Boolean)
      )
    );
    return {
      id: crypto.randomUUID(),
      tenantId,
      runId,
      status: 'OPEN',
      type: issue.type || 'ISSUE',
      severity: issue.severity || 'LOW',
      title: issue.title || issue.type || 'Integrity finding',
      summary: issue.summary || '',
      recommendation: issue.recommendation || '',
      documentIds,
      evidence,
      dedupeKey: buildDedupeKey({
        type: issue.type || 'ISSUE',
        severity: issue.severity || 'LOW',
        documentIds,
        summary: issue.summary || '',
        evidence,
      }),
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };
  });

const mapConflictsToFindings = (
  tenantId: string,
  runId: string,
  issues: RawIssue[],
  now: Date
): IntegrityFinding[] =>
  issues.map((issue) => {
    const evidence = [
      issue.locationA && {
        documentId: issue.policyA?.policyId || issue.policyA?.documentId,
        filename: issue.policyA?.filename,
        page: issue.locationA?.pageNumber ?? null,
        chunkId: null,
        quote: issue.locationA?.snippet,
      },
      issue.locationB && {
        documentId: issue.policyB?.policyId || issue.policyB?.documentId,
        filename: issue.policyB?.filename,
        page: issue.locationB?.pageNumber ?? null,
        chunkId: null,
        quote: issue.locationB?.snippet,
      },
    ].filter(Boolean) as IntegrityFinding['evidence'];
    const documentIds: string[] = Array.from(
      new Set(
        evidence
          .map((entry) => String(entry.documentId || '').trim())
          .filter(Boolean)
      )
    );
    return {
      id: crypto.randomUUID(),
      tenantId,
      runId,
      status: 'OPEN',
      type: issue.type || 'CONFLICT',
      severity: issue.severity || 'LOW',
      title: issue.summary || issue.type || 'Conflict detected',
      summary: issue.summary || '',
      recommendation: issue.recommendation || '',
      documentIds,
      evidence,
      dedupeKey: buildDedupeKey({
        type: issue.type || 'CONFLICT',
        severity: issue.severity || 'LOW',
        documentIds,
        summary: issue.summary || '',
        evidence,
      }),
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };
  });

const upsertFindings = async (
  tenantId: string,
  runId: string,
  findings: IntegrityFinding[],
  allowReopenResolved: boolean
) => {
  if (findings.length === 0) return [];

  // Gather dedupeKeys from findings metadata
  const dedupeKeys = findings.map((finding) => finding.dedupeKey);

  // Fetch existing non-archived findings with matching dedupeKeys
  // dedupeKey is stored in the metadata JSON, so we fetch all non-archived and filter in JS
  const allExisting = await prisma.integrityFinding.findMany({
    where: { tenantId, archivedAt: null },
    take: 1000,
  });

  const existingByKey = new Map<string, typeof allExisting[number]>();
  allExisting.forEach((entry) => {
    const meta = (entry.metadata ?? {}) as IntegrityFindingMetadata;
    const key = meta.dedupeKey;
    if (key && dedupeKeys.includes(key)) {
      existingByKey.set(key, entry);
    }
  });

  for (const finding of findings) {
    const existingFinding = existingByKey.get(finding.dedupeKey);
    if (existingFinding) {
      const shouldReopen =
        allowReopenResolved && ['RESOLVED', 'IGNORED'].includes(existingFinding.status);

      // Read existing runIds from metadata
      const existingMeta = (existingFinding.metadata ?? {}) as IntegrityFindingMetadata;
      const existingRunIds = Array.isArray(existingMeta.runIds) ? existingMeta.runIds : [];
      const updatedRunIds = Array.from(new Set([...existingRunIds, runId]));

      await prisma.integrityFinding.updateMany({
        where: { id: existingFinding.id, tenantId },
        data: {
          updatedAt: finding.updatedAt,
          runId,
          ...(shouldReopen ? { status: 'OPEN' } : {}),
          metadata: {
            ...existingMeta,
            lastSeenAt: finding.lastSeenAt.toISOString(),
            runIds: updatedRunIds,
            dedupeKey: finding.dedupeKey,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } else {
      // Insert new finding
      await prisma.integrityFinding.create({
        data: {
          id: finding.id,
          tenantId,
          runId,
          status: finding.status,
          type: finding.type,
          severity: finding.severity,
          title: finding.title,
          summary: finding.summary,
          documentIds: finding.documentIds,
          metadata: {
            recommendation: finding.recommendation,
            evidence: finding.evidence,
            dedupeKey: finding.dedupeKey,
            lastSeenAt: finding.lastSeenAt.toISOString(),
            runIds: [runId],
          } as unknown as Prisma.InputJsonValue,
          createdAt: finding.createdAt,
          updatedAt: finding.updatedAt,
        },
      });
    }
  }

  return findings;
};

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    let runId = '';
  try {
    const body = await req.json();
    const v = validateBody(body, integrityRunSchema);
    if ('error' in v) return v.error;
    const {
      type = 'issues',
      query,
      documentIds,
      topK,
      includeEvidence,
      allowReopenResolved = false,
      scope,
      collections,
      mode,
      profile,
      layers,
    } = v.data;

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    const normalizeForKey = (value: unknown) => JSON.stringify(value || {});
    const runKey = crypto
      .createHash('sha256')
      .update(
        `${type}::${normalizeForKey(documentIds)}::${normalizeForKey(scope)}::${normalizeForKey(
          collections
        )}::${String(query || '')}::${String(mode || '')}::${String(profile || '')}::${normalizeForKey(layers)}`
      )
      .digest('hex');

    // Check for recent duplicate run via metadata.runKey
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentRuns = await prisma.integrityRun.findMany({
      where: {
        tenantId,
        status: { in: ['RUNNING', 'QUEUED'] },
        createdAt: { gte: tenMinutesAgo },
      },
      take: 100,
    });
    const recentRun = recentRuns.find((r) => {
      const meta = r.result as IntegrityRunResult | null;
      return meta?.runKey === runKey;
    }) || recentRuns.find((r) => {
      const scopeData = r.scope as IntegrityRunScope | null;
      return scopeData?.runKey === runKey;
    });

    if (recentRun) {
      return NextResponse.json({ runId: recentRun.id, status: recentRun.status, deduped: true });
    }

    const now = new Date();
    runId = crypto.randomUUID();

    await prisma.integrityRun.create({
      data: {
        id: runId,
        tenantId,
        status: 'RUNNING',
        type,
        documentIds: Array.isArray(documentIds) ? documentIds : [],
        scope: {
          ...(scope || {
            type: documentIds?.length ? 'selection' : 'filter',
            mode: documentIds?.length ? 'selection' : 'filters',
            filters: query ? { textQuery: query } : undefined,
          }),
          runKey,
          mode: mode || undefined,
        } as unknown as Prisma.InputJsonValue,
        progress: { percent: 5, step: 'initializing' } as Prisma.InputJsonValue,
        result: {
          runKey,
          engineConfig: {
            analysisTypes: mode === 'quick_review' ? ['issues', 'conflicts'] : undefined,
            compareMode: mode === 'quick_review' ? 'both' : undefined,
            profile: profile || (mode === 'quick_review' ? 'general_ops' : undefined),
            layers: Array.isArray(layers) ? layers : undefined,
            query: query || scope?.filters?.textQuery,
          },
          query,
          collections: Array.isArray(collections) ? collections : undefined,
          orgProfileSnapshot: orgProfile,
          contextRulesSnapshot: contextRules,
        } as unknown as Prisma.InputJsonValue,
        createdBy: userId,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    await prisma.integrityActivity.create({
      data: {
        tenantId,
        type: 'STATUS_CHANGE',
        message: 'Integrity run started',
        userId,
        metadata: { runId } as Prisma.InputJsonValue,
        createdAt: new Date(),
      },
    });

    const resolveDocumentIds = async () => {
      if (Array.isArray(documentIds) && documentIds.length > 0) {
        return documentIds;
      }
      if (scope?.type === 'filter' && scope?.filters) {
        const params = new URLSearchParams();
        Object.entries(scope.filters).forEach(([key, value]) => {
          if (value === undefined || value === null || value === '') return;
          params.set(key, String(value));
        });
        params.set('page', '1');
        params.set('limit', '500');
        const listResponse = await fetch(new URL(`/api/sam/library/list?${params.toString()}`, req.url), {
          headers: { cookie: req.headers.get('cookie') || '' },
        });
        const listData = await listResponse.json();
        if (!listResponse.ok) {
          throw new Error(listData?.error || 'Failed to resolve filtered documents');
        }
        return (listData.items || []).map((item: LibraryListItem) => item.theaEngineId).filter(Boolean);
      }
      return [];
    };

    const resolvedDocumentIds = await resolveDocumentIds();
    await prisma.integrityRun.updateMany({
      where: { id: runId, tenantId },
      data: {
        documentIds: resolvedDocumentIds,
        progress: { percent: 20, step: 'analyzing' } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // If there are no documents, do not generate findings.
    if (!resolvedDocumentIds || resolvedDocumentIds.length === 0) {
      const summary = summarizeFindings([]);
      await prisma.integrityRun.updateMany({
        where: { id: runId, tenantId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: { summary } as Prisma.InputJsonValue,
          progress: { percent: 100, step: 'completed' } as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
      await prisma.integrityActivity.create({
        data: {
          tenantId,
          type: 'STATUS_CHANGE',
          message: 'Integrity run completed (no documents matched)',
          userId,
          metadata: { runId } as Prisma.InputJsonValue,
          createdAt: new Date(),
        },
      });
      return NextResponse.json({ runId, status: 'COMPLETED', summary, empty: true });
    }

    let findings: IntegrityFinding[] = [];
    if (type === 'conflicts') {
      const response = await fetch(new URL('/api/sam/thea-engine/conflicts', req.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
        body: JSON.stringify({
          mode: documentIds?.length ? 'single' : 'global',
          policyIdA: resolvedDocumentIds?.[0],
          policyIdB: resolvedDocumentIds?.[1],
          strictness: 'strict',
          limitPolicies: resolvedDocumentIds?.length ? undefined : 50,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Conflict analysis failed');
      }
      findings = mapConflictsToFindings(tenantId, runId, payload.issues || [], now);
    } else {
      const effectiveQuery = query || scope?.filters?.textQuery || 'Find conflicts, gaps, and risks in these documents';
      const response = await fetch(new URL('/api/sam/thea-engine/issues/ai', req.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
        body: JSON.stringify({
          query: effectiveQuery,
          policyIds: resolvedDocumentIds?.length ? resolvedDocumentIds : null,
          topK: topK || 20,
          includeEvidence: includeEvidence ?? true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Issue analysis failed');
      }
      findings = mapIssuesToFindings(tenantId, runId, payload.issues || [], now);
    }

    await upsertFindings(tenantId, runId, findings, allowReopenResolved);

    const summary = summarizeFindings(findings);
    await prisma.integrityRun.updateMany({
      where: { id: runId, tenantId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: { summary } as Prisma.InputJsonValue,
        progress: { percent: 100, step: 'completed' } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
    await prisma.integrityActivity.create({
      data: {
        tenantId,
        type: 'STATUS_CHANGE',
        message: 'Integrity run completed',
        userId,
        metadata: { runId } as Prisma.InputJsonValue,
        createdAt: new Date(),
      },
    });

    const criticalFindings = findings.filter((finding) =>
      ['CRITICAL', 'HIGH'].includes(String(finding.severity).toUpperCase())
    );
    if (criticalFindings.length > 0) {
      await prisma.integrityActivity.create({
        data: {
          tenantId,
          type: 'ALERT',
          message: `Integrity alert: ${criticalFindings.length} critical findings detected`,
          userId,
          metadata: { runId } as Prisma.InputJsonValue,
          createdAt: new Date(),
        },
      });
    }

    const documentsToUpdate = (resolvedDocumentIds || []).filter(Boolean);
    if (documentsToUpdate.length > 0) {
      await prisma.policyDocument.updateMany({
        where: {
          tenantId,
          OR: [
            { theaEngineId: { in: documentsToUpdate } },
            { policyEngineId: { in: documentsToUpdate } },
            { id: { in: documentsToUpdate } },
          ],
        },
        data: {
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ runId, status: 'COMPLETED', summary });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Integrity run error:', { error });
      try {
        await prisma.integrityRun.updateMany({
          where: { tenantId, id: runId },
          data: {
            status: 'FAILED',
            result: { error: errMsg } as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        });
        await prisma.integrityActivity.create({
          data: {
            tenantId,
            type: 'STATUS_CHANGE',
            message: `Integrity run failed: ${errMsg}`,
            userId,
            metadata: { runId } as Prisma.InputJsonValue,
            createdAt: new Date(),
          },
        });
      } catch (updateError) {
        logger.error('Failed to update run status:', { error: updateError });
      }
      // [SEC-06]
      return NextResponse.json(
        { error: 'Failed to start integrity run' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.run' }
);

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get('limit') || '20');
      const page = parseInt(searchParams.get('page') || '1');

      const where = { tenantId, archivedAt: null } as const;
      // IntegrityRun has no archivedAt in schema, so we filter via result metadata if needed
      // For now, just filter by tenantId
      const whereSimple = { tenantId };

      const [total, runs] = await Promise.all([
        prisma.integrityRun.count({ where: whereSimple }),
        prisma.integrityRun.findMany({
          where: whereSimple,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return NextResponse.json({
        items: runs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: unknown) {
      logger.error('Integrity runs list error:', { error });
      return NextResponse.json(
        { error: 'Failed to list integrity runs' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.read' }
);
