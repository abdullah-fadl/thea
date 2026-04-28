import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/db/prisma';
import { getSessionData } from '@/lib/auth/sessionHelpers';
import { withErrorHandler } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

const switchTenantSchema = z.object({
  tenantId: z.string().min(1),
});

/**
 * POST /api/auth/switch-tenant
 * Switch active tenant for owner roles (updates session.activeTenantId)
 *
 * Body: { tenantId: string }
 *
 * Only accessible to owner roles.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only owner roles can switch tenants
    if (authResult.userRole !== 'thea-owner') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only Thea Owner can switch tenants' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = switchTenantSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { tenantId } = validation.data;

    // Validate tenant exists and is active
    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    if (tenant.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Tenant is not active' },
        { status: 403 }
      );
    }

    // Get current session
    const sessionData = await getSessionData(request);
    if (!sessionData || !sessionData.sessionId) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    // Update session.activeTenantId (SINGLE SOURCE OF TRUTH)
    await prisma.session.update({
      where: { sessionId: sessionData.sessionId },
      data: {
        activeTenantId: tenantId,
      },
    });

    await createAuditLog(
      'auth',
      authResult.userId,
      'TENANT_SWITCHED',
      authResult.userId,
      undefined,
      { tenantId, tenantName: tenant.name || tenantId },
      tenantId
    );

    return NextResponse.json({
      success: true,
      tenantId,
      tenantName: tenant.name || tenantId,
      message: `Switched to tenant: ${tenant.name || tenantId}`,
    });
});
