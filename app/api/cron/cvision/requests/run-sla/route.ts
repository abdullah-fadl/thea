import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Request SLA Cron Endpoint
 * GET /api/cron/cvision/requests/run-sla
 * 
 * Cron endpoint for automatic SLA escalation of CVision requests
 * 
 * Security: Protected by CRON_SECRET (header or query param)
 * 
 * Usage:
 * - Vercel Cron: Configured in vercel.json to call this endpoint
 * - External Cron: Call with x-cron-secret header or ?secret=... query param
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlatformClient } from '@/lib/db/mongo';
import { runRequestSlaForTenant } from '@/lib/cvision/runRequestSla';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Get CRON_SECRET from environment
    if (!env.CRON_SECRET) {
      logger.error('[CVision Request SLA Cron] CRON_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    // Check for secret in header or query param
    const headerSecret = request.headers.get('x-cron-secret');
    const querySecret = request.nextUrl.searchParams.get('secret');
    const providedSecret = headerSecret || querySecret;

    if (!providedSecret || providedSecret !== env.CRON_SECRET) {
      logger.warn('[CVision Request SLA Cron] Unauthorized cron request - invalid secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all active tenants
    const { db: platformDb } = await getPlatformClient();
    const tenantsCollection = platformDb.collection('tenants');
    const activeTenants = await tenantsCollection
      .find({ status: 'active' })
      .toArray();

    const results: Record<string, any> = {};
    let totalScanned = 0;
    let totalEscalated = 0;
    let totalSkipped = 0;

    // Run SLA check for each tenant
    for (const tenant of activeTenants) {
      const tenantId = tenant.tenantId;
      if (!tenantId) continue;

      try {
        const result = await runRequestSlaForTenant(tenantId);
        results[tenantId] = result;
        totalScanned += result.scanned;
        totalEscalated += result.escalated;
        totalSkipped += result.skipped;
      } catch (error: any) {
        logger.error(`[CVision Request SLA Cron] Error for tenant ${tenantId}:`, error);
        results[tenantId] = {
          error: error.message || String(error),
        };
      }
    }

    logger.info(
      `[CVision Request SLA Cron] Completed - Scanned: ${totalScanned}, Escalated: ${totalEscalated}, Skipped: ${totalSkipped}`
    );

    return NextResponse.json({
      ok: true,
      tenants: Object.keys(results).length,
      scanned: totalScanned,
      escalated: totalEscalated,
      skipped: totalSkipped,
      results,
    });
  } catch (error: any) {
    logger.error('[CVision Request SLA Cron] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to run SLA check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
