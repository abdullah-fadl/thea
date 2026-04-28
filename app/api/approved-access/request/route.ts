/**
 * POST /api/approved-access/request
 * Owner requests access to a tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/core/owner/separation';
import { requestTenantAccess } from '@/lib/core/owner/approvedAccess';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  tenantId: z.string().min(1),
  reason: z.string().optional(),
  durationHours: z.number().min(1).max(168).default(24), // Max 7 days
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    // Require owner role
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { tenantId, reason, durationHours } = requestSchema.parse(body);

    const accessToken = await requestTenantAccess(
      authResult.user.id,
      authResult.user.email,
      tenantId,
      reason,
      durationHours
    );

    return NextResponse.json({
      success: true,
      requestId: accessToken.id,
      message: 'Access request submitted. Waiting for tenant admin approval.',
    });
  } catch (error) {
    logger.error('Request access error', { category: 'api', error });
    
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
