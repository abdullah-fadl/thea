/**
 * Require Auth Context - Single source of truth for tenant context
 * 
 * Returns authenticated user context with tenantId from session ONLY.
 * For platform/owner roles, allows tenantId="platform" for cross-tenant access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedUser } from './requireAuth';

export interface AuthContext {
  userId: string;
  userEmail: string;
  userRole: string;
  tenantId: string; // Always from session, or "platform" for platform roles
}

const PLATFORM_ROLES = ['thea-owner', 'platform', 'owner'];

/**
 * Require authenticated context with tenant isolation
 * 
 * @param request - Next.js request
 * @param allowPlatform - If true, allows platform roles to access with tenantId="platform"
 * @returns AuthContext or NextResponse (401/403)
 */
export async function requireAuthContext(
  request: NextRequest,
  allowPlatform: boolean = false
): Promise<AuthContext | NextResponse> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId, userEmail, userRole, tenantId } = authResult;

  // For platform roles, allow platform context if explicitly allowed
  if (allowPlatform && PLATFORM_ROLES.includes(userRole)) {
    return {
      userId,
      userEmail,
      userRole,
      tenantId: 'platform', // Special marker for platform access
    };
  }

  // For all other users, tenantId is required
  if (!tenantId || tenantId === '') {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Tenant not selected. Please log in again.' },
      { status: 401 }
    );
  }

  return {
    userId,
    userEmail,
    userRole,
    tenantId,
  };
}

