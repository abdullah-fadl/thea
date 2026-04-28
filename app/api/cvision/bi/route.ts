import { logger } from '@/lib/monitoring/logger';
/**
 * Advanced BI Analytics API
 *
 * GET actions:
 *   absence-patterns       — Absence pattern analysis with day-of-week, monthly, department, employee breakdowns
 *   resignation-seasonality — Resignation trend analysis with predictions and cost impact
 *   trends                 — Workforce time-series data for charting (uses warehouse snapshots)
 *   executive-summary      — High-level summary with KPIs, scorecard, concerns, recommendations
 *   kpis                   — Current-period KPI cards with previous-period comparison
 *   department-scorecard   — Per-department composite performance scorecard
 *
 * POST actions:
 *   generate-report        — Comprehensive BI report combining all analyses
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  analyzeAbsencePatterns,
  analyzeResignationSeasonality,
  getWorkforceTrends,
  getCurrentKPIs,
  getDepartmentScorecard,
  generateExecutiveSummary,
} from '@/lib/cvision/analytics/bi-engine';

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'kpis';

      switch (action) {
        case 'absence-patterns': {
          const startDate = url.searchParams.get('startDate') || undefined;
          const endDate = url.searchParams.get('endDate') || undefined;
          const department = url.searchParams.get('department') || undefined;

          const patterns = await analyzeAbsencePatterns(tenantId, { startDate, endDate, department });
          return NextResponse.json({ patterns });
        }

        case 'resignation-seasonality': {
          const seasonality = await analyzeResignationSeasonality(tenantId);
          return NextResponse.json({ seasonality });
        }

        case 'trends': {
          const metricsParam = url.searchParams.get('metrics') || 'headcount';
          const metrics = metricsParam.split(',').map(m => m.trim());
          const periods = parseInt(url.searchParams.get('periods') || '12', 10);

          const trends = await getWorkforceTrends(tenantId, metrics, periods);
          return NextResponse.json({ trends });
        }

        case 'executive-summary': {
          const summary = await generateExecutiveSummary(tenantId);
          return NextResponse.json({ summary });
        }

        case 'kpis': {
          const kpis = await getCurrentKPIs(tenantId);
          return NextResponse.json({ kpis });
        }

        case 'department-scorecard': {
          const department = url.searchParams.get('department') || undefined;
          const scorecard = await getDepartmentScorecard(tenantId, department);
          return NextResponse.json({ scorecard });
        }

        default:
          return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
          );
      }
    } catch (err: any) {
      logger.error('[bi GET]', err);
      return NextResponse.json(
        { error: 'Internal server error', ...(process.env.NODE_ENV === 'development' ? { details: err.message } : {}) },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.read' }
);

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (
    request: NextRequest,
    { tenantId }: { tenantId: string }
  ) => {
    try {
      const body = await request.json();
      const action = body.action;

      switch (action) {
        case 'generate-report': {
          // Load sequentially to avoid overwhelming the server (heavy DB queries)
          const summary = await generateExecutiveSummary(tenantId);
          const absencePatterns = await analyzeAbsencePatterns(tenantId);
          const resignationData = await analyzeResignationSeasonality(tenantId);

          return NextResponse.json({
            success: true,
            report: {
              generatedAt: new Date().toISOString(),
              period: summary.period,
              executiveSummary: summary,
              absencePatterns,
              resignationSeasonality: resignationData,
            },
          });
        }

        default:
          return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
          );
      }
    } catch (err: any) {
      logger.error('[bi POST]', err);
      return NextResponse.json(
        { error: 'Internal server error', ...(process.env.NODE_ENV === 'development' ? { details: err.message } : {}) },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.read' }
);
