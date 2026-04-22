import { logger } from '@/lib/monitoring/logger';
/**
 * Data Warehouse, ETL Pipeline & Archiving API
 *
 * GET actions:
 *   snapshots       — List all snapshots (filters: startPeriod, endPeriod, type)
 *   snapshot-detail — Full snapshot (param: id = snapshotId or period)
 *   compare         — Compare two periods (params: period1, period2)
 *   trends          — Time-series for a metric (params: metric, periods)
 *   archive         — List archived records (filters: collection, reason)
 *   storage         — Storage statistics
 *   etl-status      — ETL pipeline status list
 *
 * POST actions:
 *   generate-snapshot — Create snapshot for current or specified period
 *   archive-data      — Archive terminated employees / closed requisitions
 *   restore           — Restore a single archived record
 *   backfill          — Generate missing snapshots
 *   run-etl           — Manually trigger an ETL pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  generateMonthlySnapshot,
  getSnapshots,
  getSnapshotDetail,
  comparePeriods,
  getTrends,
  archiveTerminatedEmployees,
  archiveClosedRequisitions,
  archiveOldPerformanceReviews,
  searchArchive,
  restoreFromArchive,
  getStorageStats,
  getETLPipelines,
  runETLPipeline,
  backfillSnapshots,
} from '@/lib/cvision/warehouse/warehouse-engine';

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'snapshots';

      switch (action) {
        // ── Snapshots list ──
        case 'snapshots': {
          const startPeriod = url.searchParams.get('startPeriod') || undefined;
          const endPeriod = url.searchParams.get('endPeriod') || undefined;
          const type = url.searchParams.get('type') || undefined;

          let snapshots = await getSnapshots(tenantId, { startPeriod, endPeriod, type });

          // Auto-generate if empty (first visit UX)
          if (snapshots.length === 0) {
            await generateMonthlySnapshot(tenantId);
            snapshots = await getSnapshots(tenantId);
          }

          return NextResponse.json({ snapshots, total: snapshots.length });
        }

        // ── Single snapshot ──
        case 'snapshot-detail': {
          const id = url.searchParams.get('id');
          if (!id) {
            return NextResponse.json(
              { error: 'id parameter required (snapshotId or period YYYY-MM)' },
              { status: 400 }
            );
          }

          const snapshot = await getSnapshotDetail(tenantId, id);
          if (!snapshot) {
            return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
          }

          return NextResponse.json({ snapshot });
        }

        // ── Period comparison ──
        case 'compare': {
          const period1 = url.searchParams.get('period1');
          const period2 = url.searchParams.get('period2');
          if (!period1 || !period2) {
            return NextResponse.json(
              { error: 'period1 and period2 parameters required (YYYY-MM)' },
              { status: 400 }
            );
          }

          const comparison = await comparePeriods(tenantId, period1, period2);
          return NextResponse.json({ comparison });
        }

        // ── Trends (time-series) ──
        case 'trends': {
          const metric = url.searchParams.get('metric') || 'headcount';
          const periods = parseInt(url.searchParams.get('periods') || '6', 10);
          const data = await getTrends(tenantId, metric, periods);
          return NextResponse.json({ metric, data });
        }

        // ── Archive search ──
        case 'archive': {
          const collection = url.searchParams.get('collection') || undefined;
          const reason = url.searchParams.get('reason') || undefined;
          const records = await searchArchive(tenantId, { collection, reason });
          return NextResponse.json({ records, total: records.length });
        }

        // ── Storage stats ──
        case 'storage': {
          const stats = await getStorageStats(tenantId);
          return NextResponse.json({ stats });
        }

        // ── ETL pipeline status ──
        case 'etl-status': {
          const pipelines = await getETLPipelines(tenantId);
          return NextResponse.json({ pipelines });
        }

        default:
          return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
          );
      }
    } catch (err: any) {
      logger.error('[warehouse GET]', err);
      return NextResponse.json(
        { error: err.message || 'Internal server error' },
        { status: 500 }
      );
    }
  }
);

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (
    request: NextRequest,
    { tenantId, userId }: { tenantId: string; userId: string }
  ) => {
    try {
      const body = await request.json();
      const action = body.action;

      switch (action) {
        // ── Generate snapshot ──
        case 'generate-snapshot': {
          const period = body.period || undefined;
          const type = body.type || 'ON_DEMAND';
          const snapshot = await generateMonthlySnapshot(tenantId, period, type);
          return NextResponse.json({
            success: true,
            snapshot,
            message: `Snapshot ${snapshot.snapshotId} generated successfully.`,
          });
        }

        // ── Archive old data ──
        case 'archive-data': {
          const target = body.target || 'all'; // 'employees' | 'requisitions' | 'reviews' | 'all'
          const olderThanMonths = body.olderThanMonths || 12;
          const results: Record<string, number> = {};

          if (target === 'employees' || target === 'all') {
            const r = await archiveTerminatedEmployees(tenantId, olderThanMonths, userId);
            results.employees = r.archived;
          }
          if (target === 'requisitions' || target === 'all') {
            const r = await archiveClosedRequisitions(tenantId, olderThanMonths, userId);
            results.requisitions = r.archived;
          }
          if (target === 'reviews' || target === 'all') {
            const reviewMonths = body.reviewOlderThanMonths || 24;
            const r = await archiveOldPerformanceReviews(tenantId, reviewMonths, userId);
            results.reviews = r.archived;
          }

          const total = Object.values(results).reduce((s, v) => s + v, 0);
          return NextResponse.json({
            success: true,
            results,
            totalArchived: total,
            message: total > 0
              ? `${total} documents archived successfully.`
              : 'No documents met the archiving criteria.',
          });
        }

        // ── Restore from archive ──
        case 'restore': {
          const archiveId = body.archiveId;
          if (!archiveId) {
            return NextResponse.json(
              { error: 'archiveId is required' },
              { status: 400 }
            );
          }

          const result = await restoreFromArchive(tenantId, archiveId);
          if (!result.restored) {
            return NextResponse.json(
              { error: 'Archive record not found' },
              { status: 404 }
            );
          }

          return NextResponse.json({
            success: true,
            collection: result.collection,
            documentId: result.documentId,
            message: `Document restored to ${result.collection}.`,
          });
        }

        // ── Backfill snapshots ──
        case 'backfill': {
          const result = await backfillSnapshots(tenantId);
          return NextResponse.json({
            success: true,
            generated: result.generated,
            periods: result.periods,
            message: result.generated > 0
              ? `${result.generated} snapshot(s) generated.`
              : 'Snapshots already exist — nothing to backfill.',
          });
        }

        // ── Run ETL pipeline ──
        case 'run-etl': {
          const pipelineId = body.pipelineId;
          if (!pipelineId) {
            return NextResponse.json(
              { error: 'pipelineId is required' },
              { status: 400 }
            );
          }

          const result = await runETLPipeline(tenantId, pipelineId, userId);
          return NextResponse.json({
            success: result.success,
            documentsProcessed: result.documentsProcessed,
            message: result.message,
          });
        }

        default:
          return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
          );
      }
    } catch (err: any) {
      logger.error('[warehouse POST]', err);
      return NextResponse.json(
        { error: err.message || 'Internal server error' },
        { status: 500 }
      );
    }
  }
);
