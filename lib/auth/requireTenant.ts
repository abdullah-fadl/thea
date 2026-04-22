/**
 * Require Tenant Helper
 * 
 * Ensures tenantId is always extracted from session (never from query/body).
 * This is the golden rule for tenant isolation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from './requireAuth';

/**
 * Require tenant from session
 * Returns tenantId from session or 401 response
 * 
 * Golden Rule: tenantId must ALWAYS come from session.tenantId, never from query/body.
 * 
 * @param request - NextRequest object
 * @returns tenantId string or NextResponse (401)
 */
export async function requireTenant(
  request: NextRequest
): Promise<string | NextResponse> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // tenantId is already extracted from session in requireAuth
  // This is the ONLY source of truth for tenantId
  return authResult.tenantId;
}

/**
 * Require tenant and return full auth context
 * Useful when you need both tenantId and user info
 */
export async function requireTenantAuth(
  request: NextRequest
): Promise<{ tenantId: string; userId: string; userRole: string } | NextResponse> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return {
    tenantId: authResult.tenantId,
    userId: authResult.userId,
    userRole: authResult.userRole,
  };
}

