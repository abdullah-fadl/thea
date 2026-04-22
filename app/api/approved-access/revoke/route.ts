/**
 * POST /api/approved-access/revoke
 * Revoke an approved access (owner or tenant admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { revokeAccess } from '@/lib/core/owner/approvedAccess';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const revokeSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { requestId, reason } = revokeSchema.parse(body);

    // Get request to verify ownership/tenant
    const accessRequest = await prisma.approvedAccessToken.findFirst({
      where: { id: requestId },
    });

    if (!accessRequest) {
      return NextResponse.json(
        { error: 'Not found', message: 'Access request not found' },
        { status: 404 }
      );
    }

    // Owner can revoke their own requests
    // Tenant admin can revoke requests for their tenant
    const isOwner = authResult.user.role === 'thea-owner' && (accessRequest as Record<string, unknown>).ownerId === authResult.user.id;
    const isTenantAdmin = authResult.user.role === 'admin' &&
                          authResult.tenantId === (accessRequest as Record<string, unknown>).tenantId;

    if (!isOwner && !isTenantAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You can only revoke your own requests or requests for your tenant' },
        { status: 403 }
      );
    }

    const revoked = await revokeAccess(requestId, authResult.user.id, reason);

    if (!revoked) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Request cannot be revoked' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Access revoked',
    });
  } catch (error) {
    logger.error('Revoke access error', { category: 'api', error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        // [SEC-10]
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    throw error;
  }
});
