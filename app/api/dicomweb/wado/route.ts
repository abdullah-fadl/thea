import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getSource, getDefaultSource } from '@/lib/dicomweb/sources';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * WADO-RS proxy: Retrieve image pixel data
 *
 * This is a pass-through proxy. Cornerstone3D makes requests like:
 *   GET /api/dicomweb/wado/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/frames/{frame}?sourceId=...
 *
 * We forward the path after /wado/ to the configured PACS baseUrl.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sourceId = req.nextUrl.searchParams.get('sourceId');
    const source = sourceId
      ? await getSource(tenantId, sourceId)
      : await getDefaultSource(tenantId);

    if (!source) {
      return NextResponse.json({ error: 'No DICOM source configured' }, { status: 404 });
    }

    // Extract the DICOMWeb path after /wado/
    const pathname = req.nextUrl.pathname;
    const wadoPathMatch = pathname.match(/\/api\/dicomweb\/wado\/(.*)/);
    const wadoPath = wadoPathMatch?.[1];

    if (!wadoPath) {
      return NextResponse.json({ error: 'Invalid WADO-RS path' }, { status: 400 });
    }

    // Build target URL
    const targetUrl = `${source.baseUrl}/${wadoPath}`;

    // Build auth headers
    const headers: Record<string, string> = {
      Accept: req.headers.get('Accept') || 'multipart/related; type="application/octet-stream"',
    };
    switch (source.authType) {
      case 'basic': {
        const { username, password } = source.credentials ?? {};
        if (username && password) {
          headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        }
        break;
      }
      case 'bearer': {
        const { token } = source.credentials ?? {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        break;
      }
      case 'apikey': {
        const { apiKey } = source.credentials ?? {};
        if (apiKey) headers['X-API-Key'] = apiKey;
        break;
      }
    }

    // Proxy the request
    const upstream = await fetch(targetUrl, { headers });

    if (!upstream.ok) {
      return new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
        },
      });
    }

    // Pass through the response body (streaming)
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
        'Transfer-Encoding': upstream.headers.get('Transfer-Encoding') || '',
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' },
);
