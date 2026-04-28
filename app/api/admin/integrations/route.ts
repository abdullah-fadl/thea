import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import { validateBody } from '@/lib/validation/helpers';
import { updateIntegrationsSchema } from '@/lib/validation/admin.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/integrations
 * Get integration settings for current tenant (admin only)
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    if (process.env.DEBUG_AUTH === '1') {
      logger.debug('GET request received', { category: 'api', route: 'GET /api/admin/integrations' });
    }
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      if (process.env.DEBUG_AUTH === '1') {
        logger.error('Auth failed', { category: 'auth', route: 'GET /api/admin/integrations', status: authResult.status });
      }
      return authResult;
    }

    // Authorization - admin or thea-owner (owner can access when working within tenant context)
    const { userRole } = authResult;
    if (!['admin', 'thea-owner'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin or Thea Owner access required' },
        { status: 403 }
      );
    }

    // Get activeTenantId from session (SINGLE SOURCE OF TRUTH)
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      return NextResponse.json(
        {
          error: 'Tenant not selected',
          message: userRole === 'thea-owner'
            ? 'Please select a tenant from the Owner Console to view integration settings.'
            : 'Please select a tenant first.'
        },
        { status: 400 }
      );
    }

    // Get tenant from PostgreSQL via Prisma
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(activeTenantId) });

    if (!tenant) {
      if (process.env.DEBUG_AUTH === '1') {
        logger.error('Tenant not found', { category: 'api', route: 'GET /api/admin/integrations', tenantId: activeTenantId });
      }
      return NextResponse.json(
        {
          error: 'Tenant not found',
          message: `Tenant "${activeTenantId}" does not exist in the database.`
        },
        { status: 404 }
      );
    }

    // Return integration settings with defaults
    const defaultIntegrations = {
      samHealth: {
        enabled: true,
        autoTriggerEnabled: true,
        severityThreshold: 'low' as const,
        engineTimeoutMs: 8000,
      },
    };

    return NextResponse.json({
      tenantId: activeTenantId,
      integrations: (tenant.integrations as Record<string, unknown>) || defaultIntegrations,
    });
});

/**
 * PATCH /api/admin/integrations
 * Update integration settings for current tenant (admin only)
 *
 * Body: { samHealth?: { enabled, autoTriggerEnabled, severityThreshold, engineTimeoutMs } }
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Authorization - admin or thea-owner (owner can access when working within tenant context)
    const { userRole, userId } = authResult;
    if (!['admin', 'thea-owner'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin or Thea Owner access required' },
        { status: 403 }
      );
    }

    // Get activeTenantId from session (SINGLE SOURCE OF TRUTH)
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      return NextResponse.json(
        {
          error: 'Tenant not selected',
          message: userRole === 'thea-owner'
            ? 'Please select a tenant from the Owner Console to update integration settings.'
            : 'Please select a tenant first.'
        },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const v = validateBody(body, updateIntegrationsSchema);
    if ('error' in v) return v.error;

    const { samHealth } = v.data;

    // Get current tenant from PostgreSQL via Prisma
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(activeTenantId) });

    if (!tenant) {
      if (process.env.DEBUG_AUTH === '1') {
        logger.error('Tenant not found', { category: 'api', route: 'PATCH /api/admin/integrations', tenantId: activeTenantId });
      }
      return NextResponse.json(
        {
          error: 'Tenant not found',
          message: `Tenant "${activeTenantId}" does not exist in the database.`
        },
        { status: 404 }
      );
    }

    // Update integrations
    const currentIntegrations = (tenant.integrations as Record<string, unknown>) || {};
    const updatedIntegrations = {
      ...currentIntegrations,
      ...(samHealth ? { samHealth } : {}),
    };

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        integrations: updatedIntegrations as Prisma.InputJsonValue,
        updatedBy: userId,
      },
    });

    await createAuditLog(
      'tenant_integrations',
      tenant.id,
      'INTEGRATIONS_UPDATED',
      userId || 'system',
      undefined,
      { samHealth },
      activeTenantId
    );

    return NextResponse.json({
      success: true,
      tenantId: updated.tenantId,
      integrations: (updated.integrations as Record<string, unknown>) || updatedIntegrations,
    });
});
