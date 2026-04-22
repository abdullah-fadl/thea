import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { getPACSClient, isPACSConfigured } from '@/lib/integrations/pacs/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/radiology/pacs/status
 *
 * Check if PACS is configured and connected.
 * Returns: { configured, connected, serverInfo, responseTimeMs }
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const configured = isPACSConfigured();

    if (!configured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        serverInfo: null,
        responseTimeMs: null,
        message: 'PACS integration is not configured / تكامل PACS غير مُعَد',
      });
    }

    const client = getPACSClient();
    if (!client) {
      return NextResponse.json({
        configured: true,
        connected: false,
        serverInfo: null,
        responseTimeMs: null,
        message: 'Failed to initialize PACS client / فشل في تهيئة عميل PACS',
      });
    }

    try {
      const result = await client.testConnection();

      logger.info('PACS connection status checked', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/radiology/pacs/status',
        connected: result.connected,
        responseTimeMs: result.responseTimeMs,
      });

      return NextResponse.json({
        configured: true,
        connected: result.connected,
        serverInfo: result.serverInfo || null,
        responseTimeMs: result.responseTimeMs || null,
      });
    } catch (err) {
      logger.error('PACS status check failed', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/radiology/pacs/status',
        error: err instanceof Error ? err : undefined,
      });

      return NextResponse.json({
        configured: true,
        connected: false,
        serverInfo: err instanceof Error ? err.message : 'Unknown error',
        responseTimeMs: null,
      });
    }
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);
