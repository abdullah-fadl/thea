import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getSource, getDefaultSource } from '@/lib/dicomweb/sources';
import { searchStudies } from '@/lib/dicomweb/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * QIDO-RS proxy: Search studies
 * GET /api/dicomweb/studies?sourceId=...&PatientName=...&StudyDate=...
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const params = req.nextUrl.searchParams;
    const sourceId = params.get('sourceId');

    const source = sourceId
      ? await getSource(tenantId, sourceId)
      : await getDefaultSource(tenantId);

    if (!source) {
      return NextResponse.json(
        { error: 'No DICOM source configured. Add one in Admin > DICOM Sources.' },
        { status: 404 },
      );
    }

    // Forward QIDO query params (strip sourceId)
    const qidoParams: Record<string, string> = {};
    params.forEach((value, key) => {
      if (key !== 'sourceId') qidoParams[key] = value;
    });

    const studies = await searchStudies(source, qidoParams);
    return NextResponse.json({ studies, sourceId: source.id, sourceName: source.name });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' },
);
