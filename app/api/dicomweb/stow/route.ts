import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getSource, getDefaultSource } from '@/lib/dicomweb/sources';
import { storeInstances } from '@/lib/dicomweb/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * STOW-RS proxy: Upload DICOM instances to the configured PACS.
 *
 * POST /api/dicomweb/stow?sourceId=...
 * Body: multipart/related DICOM data (as sent by client-side uploader)
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sourceId = req.nextUrl.searchParams.get('sourceId');
    const source = sourceId
      ? await getSource(tenantId, sourceId)
      : await getDefaultSource(tenantId);

    if (!source) {
      return NextResponse.json({ error: 'No DICOM source configured' }, { status: 404 });
    }

    const contentType = req.headers.get('Content-Type');
    if (!contentType) {
      return NextResponse.json({ error: 'Content-Type header is required' }, { status: 400 });
    }

    const bodyBuffer = Buffer.from(await req.arrayBuffer());
    const result = await storeInstances(source, bodyBuffer, contentType);

    return NextResponse.json(
      { success: result.status >= 200 && result.status < 300, response: result.body },
      { status: result.status },
    );
  }),
  { tenantScoped: true, permissionKey: 'radiology.orders.create' },
);
