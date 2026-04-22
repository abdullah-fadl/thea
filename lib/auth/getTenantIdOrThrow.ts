/**
 * Get Tenant ID or Throw
 * 
 * Standardized helper to extract activeTenantId from session (SINGLE SOURCE OF TRUTH).
 * Throws error if activeTenantId is missing (should never happen after proper auth).
 * 
 * Usage:
 *   const tenantId = await getTenantIdOrThrow(request);
 */

import { NextRequest } from 'next/server';
import { getActiveTenantId } from './sessionHelpers';

/**
 * Get activeTenantId from session or throw error
 * SINGLE SOURCE OF TRUTH: Always reads from session.activeTenantId
 * 
 * @param request - NextRequest object
 * @returns activeTenantId string
 * @throws Error if activeTenantId is missing
 */
export async function getTenantIdOrThrow(request: NextRequest): Promise<string> {
  const activeTenantId = await getActiveTenantId(request);
  
  if (!activeTenantId) {
    throw new Error('Tenant not selected. Please log in again.');
  }

  return activeTenantId;
}

/**
 * Get activeTenantId and user context from session
 * SINGLE SOURCE OF TRUTH: Always reads from session.activeTenantId
 * 
 * @param request - NextRequest object
 * @returns Object with tenantId (activeTenantId), userId, userRole, userEmail
 * @throws Error if activeTenantId is missing
 */
export async function getTenantContextOrThrow(request: NextRequest): Promise<{
  tenantId: string;
  userId: string;
  userRole: string;
  userEmail: string;
}> {
  const { requireAuth } = await import('./requireAuth');
  const authResult = await requireAuth(request);
  
  if (authResult instanceof Response) {
    throw new Error('Unauthorized: Authentication required');
  }

  if (!authResult.tenantId) {
    throw new Error('Tenant not selected. Please log in again.');
  }

  return {
    tenantId: authResult.tenantId, // This is activeTenantId from requireAuth
    userId: authResult.userId,
    userRole: authResult.userRole,
    userEmail: authResult.userEmail,
  };
}

