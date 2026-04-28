/**
 * POST /api/approved-access/reject
 * Tenant admin rejects an access request
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { rejectAccessRequest } from '@/lib/core/owner/approvedAccess';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { approvedAccessRejectSchema } from '@/lib/validation/platform.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: NextRequest) => {
    // Require authentication (tenant admin)
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Must be tenant admin (not owner)
    if (authResult.user.role === 'thea-owner') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only tenant admins can reject access requests' },
        { status: 403 }
      );
    }

    // Must have admin role
    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin role required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const v = validateBody(body, approvedAccessRejectSchema);
    if ('error' in v) return v.error;
    const { requestId, reason } = v.data;

    // Get request to verify tenant
    const accessRequest = await prisma.approvedAccessToken.findFirst({
      where: { id: requestId },
    });

    if (!accessRequest) {
      return NextResponse.json(
        { error: 'Not found', message: 'Access request not found' },
        { status: 404 }
      );
    }

    // Verify tenant admin belongs to the same tenant
    if ((accessRequest as Record<string, unknown>).tenantId !== authResult.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You can only reject requests for your own tenant' },
        { status: 403 }
      );
    }

    const rejected = await rejectAccessRequest(
      requestId,
      authResult.user.id,
      authResult.user.email,
      reason
    );

    if (!rejected) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Request is not pending or already processed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Access request rejected',
    });
});
