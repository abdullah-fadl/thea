import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/integration/middleware-config
 *
 * Returns the current middleware (Mirth Connect) configuration.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    const config = await prisma.integrationConfig.findFirst({
      where: { tenantId, key: 'middleware' },
    });

    const defaults = {
      key: 'middleware',
      engineType: 'mirth_connect',
      mirthUrl: process.env.MIRTH_URL || 'https://localhost:8443',
      mirthApiPort: 8443,
      hl7ListenerPort: 6661,
      httpListenerPort: 8080,
      theaCallbackUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/integration/hl7/receive`
        : 'http://app:3000/api/integration/hl7/receive',
      autoRouteResults: true,
      retryEnabled: true,
      maxRetries: 3,
      channels: [],
    };

    return NextResponse.json({ config: config || defaults });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);

/**
 * POST /api/integration/middleware-config
 *
 * Update middleware configuration.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json().catch(() => ({}));

    // Extract only allowed fields from body to prevent unsafe spread
    const configData: Record<string, any> = {};
    if (body.engineType !== undefined) configData.engineType = String(body.engineType);
    if (body.mirthUrl !== undefined) configData.mirthUrl = String(body.mirthUrl);
    if (body.mirthApiPort !== undefined) configData.mirthApiPort = Number(body.mirthApiPort) || null;
    if (body.hl7ListenerPort !== undefined) configData.hl7ListenerPort = Number(body.hl7ListenerPort) || null;
    if (body.httpListenerPort !== undefined) configData.httpListenerPort = Number(body.httpListenerPort) || null;
    if (body.theaCallbackUrl !== undefined) configData.theaCallbackUrl = String(body.theaCallbackUrl);
    if (body.autoRouteResults !== undefined) configData.autoRouteResults = Boolean(body.autoRouteResults);
    if (body.retryEnabled !== undefined) configData.retryEnabled = Boolean(body.retryEnabled);
    if (body.maxRetries !== undefined) configData.maxRetries = Number(body.maxRetries) || 3;
    if (body.channels !== undefined) configData.channels = body.channels;

    await prisma.integrationConfig.upsert({
      where: {
        tenantId_key: { tenantId, key: 'middleware' },
      },
      update: configData,
      create: {
        tenantId,
        key: 'middleware',
        ...configData,
      },
    });

    return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);
