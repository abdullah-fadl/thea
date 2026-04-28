/**
 * OPD Intelligence API — Main endpoint
 *
 * GET /api/opd/dashboard/intelligence?section=recommendations|forecasts|anomalies|accuracy|all
 *
 * Returns intelligence data based on section parameter.
 * Persists new recommendations to opd_recommendations table.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { generateRecommendations } from '@/lib/opd/intelligence/recommendations';
import { generateForecasts } from '@/lib/opd/intelligence/forecasting';
import { detectAnomalies } from '@/lib/opd/intelligence/anomalies';
import { getAccuracySummary, validateRecommendations } from '@/lib/opd/intelligence/accuracyTracker';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const section = req.nextUrl.searchParams.get('section') || 'all';

  const result: any = {};

  try {
    // ── Recommendations ──
    if (section === 'recommendations' || section === 'all') {
      const recommendations = await generateRecommendations(null, tenantId);

      // Persist new recommendations using Prisma (upsert by type + departmentId/doctorId)
      for (const rec of recommendations) {
        const now = new Date();
        const where: any = {
          tenantId,
          type: rec.type,
          dismissed: false,
          expiresAt: { gt: now },
        };
        if (rec.departmentId) where.departmentId = rec.departmentId;
        if (rec.doctorId) where.doctorId = rec.doctorId;

        const existing = await prisma.opdRecommendation.findFirst({ where });
        if (!existing) {
          await prisma.opdRecommendation.create({
            data: {
              tenantId,
              type: rec.type,
              severity: rec.severity,
              titleAr: rec.titleAr,
              titleEn: rec.titleEn,
              descriptionAr: rec.descriptionAr,
              descriptionEn: rec.descriptionEn,
              actionAr: rec.actionAr,
              actionEn: rec.actionEn,
              departmentId: rec.departmentId || null,
              departmentName: rec.departmentName || null,
              doctorId: rec.doctorId || null,
              doctorName: rec.doctorName || null,
              metric: rec.metric || null,
              metricValue: rec.metricValue || null,
              threshold: rec.threshold || null,
              confidence: rec.confidence || null,
              expiresAt: rec.expiresAt ? new Date(rec.expiresAt) : null,
              persistedAt: now,
            },
          });
        }
      }

      // Return active (non-dismissed, non-expired) recommendations
      const activeRecs = await prisma.opdRecommendation.findMany({
        where: {
          tenantId,
          dismissed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 50,
      });

      result.recommendations = activeRecs.map((r) => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        titleAr: r.titleAr,
        titleEn: r.titleEn,
        descriptionAr: r.descriptionAr,
        descriptionEn: r.descriptionEn,
        actionAr: r.actionAr,
        actionEn: r.actionEn,
        departmentId: r.departmentId,
        departmentName: r.departmentName,
        doctorId: r.doctorId,
        doctorName: r.doctorName,
        metric: r.metric,
        metricValue: r.metricValue,
        threshold: r.threshold,
        confidence: r.confidence,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        acknowledged: r.acknowledged || false,
        acknowledgedAt: r.acknowledgedAt,
      }));
    }

    // ── Forecasts ──
    if (section === 'forecasts' || section === 'all') {
      const forecasts = await generateForecasts(null, tenantId, 2);
      result.forecasts = forecasts;
    }

    // ── Anomalies ──
    if (section === 'anomalies' || section === 'all') {
      const anomalies = await detectAnomalies(null, tenantId);
      result.anomalies = anomalies;
    }

    // ── Accuracy ──
    if (section === 'accuracy' || section === 'all') {
      try {
        await validateRecommendations(null, tenantId);
      } catch {
        // Non-critical
      }
      const accuracy = await getAccuracySummary(null, tenantId, 3);
      result.accuracy = accuracy;
    }

    return NextResponse.json(result);
  } catch (err) {
    logger.error('Intelligence API error', { category: 'opd', error: err });
    return NextResponse.json(
      { error: 'Failed to generate intelligence data' },
      { status: 500 },
    );
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.dashboard.strategic' }
);
