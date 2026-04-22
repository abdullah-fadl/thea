import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { getPACSClient, isPACSConfigured } from '@/lib/integrations/pacs/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/radiology/pacs/query
 *
 * Query PACS for studies via DICOMweb QIDO-RS.
 * Proxies the request through the server-side PACS client
 * so the browser never talks to PACS directly.
 *
 * Query params:
 *   - patientId       Patient ID in PACS
 *   - studyDate       Study date (YYYYMMDD or YYYY-MM-DD)
 *   - modality        Modality (e.g. CT, MRI, XR)
 *   - accessionNumber Accession number
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    if (!isPACSConfigured()) {
      return NextResponse.json(
        {
          error: 'PACS_NOT_CONFIGURED',
          message: 'PACS integration is not configured / تكامل PACS غير مُعَد',
        },
        { status: 503 }
      );
    }

    const client = getPACSClient();
    if (!client) {
      return NextResponse.json(
        {
          error: 'PACS_CLIENT_ERROR',
          message: 'Failed to initialize PACS client / فشل في تهيئة عميل PACS',
        },
        { status: 500 }
      );
    }

    const params = req.nextUrl.searchParams;
    const patientId = params.get('patientId') || undefined;
    const studyDate = params.get('studyDate') || undefined;
    const modality = params.get('modality') || undefined;
    const accessionNumber = params.get('accessionNumber') || undefined;

    try {
      const studies = await client.searchStudies({
        patientId,
        studyDate,
        modality,
        accessionNumber,
      });

      logger.info('PACS study query completed', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/radiology/pacs/query',
        resultCount: studies.length,
        filters: { patientId, studyDate, modality, accessionNumber },
      });

      return NextResponse.json({
        studies,
        total: studies.length,
        source: 'pacs',
      });
    } catch (err) {
      logger.error('PACS query failed', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/radiology/pacs/query',
        error: err instanceof Error ? err : undefined,
      });

      return NextResponse.json(
        {
          error: 'PACS_QUERY_FAILED',
          message: err instanceof Error
            ? `PACS query failed: ${err.message} / فشل استعلام PACS`
            : 'PACS query failed / فشل استعلام PACS',
        },
        { status: 502 }
      );
    }
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);
