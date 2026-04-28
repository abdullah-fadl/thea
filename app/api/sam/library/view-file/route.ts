import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { theaEngineGetFile } from '@/lib/sam/theaEngineGateway';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/library/view-file?theaEngineId=<id>
 * 
 * Proxy to thea-engine to get file (PDF)
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const theaEngineId = searchParams.get('theaEngineId');

    if (!theaEngineId) {
      return NextResponse.json(
        { error: 'theaEngineId is required' },
        { status: 400 }
      );
    }

    // Forward to thea-engine via gateway
    const response = await theaEngineGetFile(req, tenantId, theaEngineId);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy engine error: ${errorText}` },
        { status: response.status }
      );
    }

    // Stream the file back
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const disposition = response.headers.get('content-disposition');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition || `inline; filename="${theaEngineId}"`,
      },
    });
  } catch (error: any) {
    logger.error('View file error:', { error: error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to view file' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.view-file' });
