import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getSource, getDefaultSource } from '@/lib/dicomweb/sources';
import { listSeries } from '@/lib/dicomweb/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * QIDO-RS proxy: List series for a study
 * GET /api/dicomweb/studies/{studyUID}/series?sourceId=...
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, params }: any) => {
    const studyUID = (params as Record<string, string>)?.studyUID || req.nextUrl.pathname.split('/studies/')[1]?.split('/series')[0];
    if (!studyUID) {
      return NextResponse.json({ error: 'studyUID is required' }, { status: 400 });
    }

    const sourceId = req.nextUrl.searchParams.get('sourceId');
    const source = sourceId
      ? await getSource(tenantId, sourceId)
      : await getDefaultSource(tenantId);

    if (!source) {
      return NextResponse.json({ error: 'No DICOM source configured' }, { status: 404 });
    }

    const series = await listSeries(source, studyUID);
    return NextResponse.json({ series, studyUID, sourceId: source.id });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' },
);
