import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getSource, getDefaultSource } from '@/lib/dicomweb/sources';
import { listInstances } from '@/lib/dicomweb/client';
import { resolveImageIds } from '@/lib/dicomweb/imageIdResolver';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * QIDO-RS proxy: List instances for a series + resolve imageIds
 * GET /api/dicomweb/studies/{studyUID}/series/{seriesUID}/instances?sourceId=...
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, params }: any) => {
    // Extract UIDs from URL path
    const pathname = req.nextUrl.pathname;
    const studyMatch = pathname.match(/\/studies\/([^/]+)/);
    const seriesMatch = pathname.match(/\/series\/([^/]+)/);
    const studyUID = (params as Record<string, string>)?.studyUID || studyMatch?.[1];
    const seriesUID = (params as Record<string, string>)?.seriesUID || seriesMatch?.[1];

    if (!studyUID || !seriesUID) {
      return NextResponse.json({ error: 'studyUID and seriesUID are required' }, { status: 400 });
    }

    const sourceId = req.nextUrl.searchParams.get('sourceId');
    const source = sourceId
      ? await getSource(tenantId, sourceId)
      : await getDefaultSource(tenantId);

    if (!source) {
      return NextResponse.json({ error: 'No DICOM source configured' }, { status: 404 });
    }

    const instances = await listInstances(source, studyUID, seriesUID);

    // Also resolve Cornerstone imageIds via the proxy
    const proxyBaseUrl = '/api/dicomweb/wado';
    const imageIds = resolveImageIds(proxyBaseUrl, studyUID, seriesUID, instances, source.id);

    return NextResponse.json({
      instances,
      imageIds,
      studyUID,
      seriesUID,
      sourceId: source.id,
    });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' },
);
