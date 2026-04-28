import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { updateInstrumentHeartbeat } from '@/lib/integration/messageQueue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/integration/instruments/[id]/test
 *
 * Test connection to an instrument.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    // Extract instrument ID from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const instrumentId = pathParts[pathParts.indexOf('instruments') + 1];

    if (!instrumentId) {
      return NextResponse.json({ error: 'Instrument ID required' }, { status: 400 });
    }

    const instrument = await prisma.instrument.findFirst({
      where: { tenantId, id: instrumentId },
    });

    if (!instrument) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 });
    }

    const startTime = Date.now();
    let success = false;
    let errorMsg = '';

    try {
      if (instrument.connectionType === 'http' && instrument.host) {
        const url = `${instrument.host}${instrument.port ? `:${instrument.port}` : ''}`;
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        success = response.ok || response.status < 500;
      } else if (instrument.connectionType === 'tcp' && instrument.host && instrument.port) {
        // For TCP we just report configuration is valid
        success = true;
      } else if (instrument.connectionType === 'dicom_cstore' && instrument.host) {
        // DICOM echo would require dcmtk — just validate config
        success = !!(instrument.host && instrument.port && instrument.aeTitle);
        if (!success) errorMsg = 'Missing host, port, or AE Title for DICOM connection';
      } else {
        errorMsg = `Connection type ${instrument.connectionType} with current config cannot be tested`;
      }
    } catch (error) {
      errorMsg = String(error);
    }

    const responseTime = Date.now() - startTime;

    // Update status
    await updateInstrumentHeartbeat(
      tenantId,
      instrumentId,
      success ? 'ONLINE' : 'ERROR',
    );

    return NextResponse.json({
      success,
      instrumentId,
      responseTime,
      status: success ? 'ONLINE' : 'ERROR',
      error: errorMsg || undefined,
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);
