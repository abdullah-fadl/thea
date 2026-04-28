import { NextRequest, NextResponse } from 'next/server';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';

/**
 * Require tenant ID from authenticated session
 * 
 * This is the SINGLE SOURCE OF TRUTH for tenant context.
 * Tenant ID is always read from session.activeTenantId (set at login).
 * 
 * @throws Returns NextResponse with 401 if session is missing or tenant not selected
 * @returns tenantId from session
 */
export async function requireTenantId(request: NextRequest): Promise<string | NextResponse> {
  const tenantId = await getActiveTenantId(request);
  
  if (!tenantId) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Tenant not selected. Please log in again.' },
      { status: 401 }
    );
  }
  
  return tenantId;
}

