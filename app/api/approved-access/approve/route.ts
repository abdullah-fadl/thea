/**
 * POST /api/approved-access/approve
 * Tenant admin approves an access request
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { approveAccessRequest } from '@/lib/core/owner/approvedAccess';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { approvedAccessApproveSchema } from '@/lib/validation/platform.schema';
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
        { error: 'Forbidden', message: 'Only tenant admins can approve access requests' },
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
    const v = validateBody(body, approvedAccessApproveSchema);
    if ('error' in v) return v.error;
    const { requestId, notes, expiresAt } = v.data;

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
        { error: 'Forbidden', message: 'You can only approve requests for your own tenant' },
        { status: 403 }
      );
    }

    const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;
    const approved = await approveAccessRequest(
      requestId,
      authResult.user.id,
      authResult.user.email,
      notes,
      expiresAtDate
    );

    if (!approved) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Request is not pending or already processed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      accessToken: approved.accessToken,
      expiresAt: approved.expiresAt,
      message: 'Access request approved',
    });
});
