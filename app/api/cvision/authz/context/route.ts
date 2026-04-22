import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Authorization Context API
 * GET /api/cvision/authz/context - Get current user's authz context for client-side use
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getAuthzContext } from '@/lib/cvision/authz/context';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get authz context for current user
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      // Build authz context with proper AuthenticatedUser structure
      const ctx = await getAuthzContext(request, {
        user,
        tenantId,
        userId,
        userRole: role as any,
        sessionId: '',
      });

      return NextResponse.json({
        success: true,
        context: ctx,
      });
    } catch (error: any) {
      logger.error('[CVision Authz Context GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: undefined } // No permission required - just need auth
);
