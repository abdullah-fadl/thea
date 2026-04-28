/**
 * Add Tenant Debug Header Helper
 * 
 * Adds X-Active-Tenant header to response for debugging tenant isolation.
 * This helps verify that requests are filtering correctly.
 */

import { NextResponse } from 'next/server';

/**
 * Add X-Active-Tenant debug header to response
 * 
 * @param response - NextResponse object
 * @param activeTenantId - Active tenant ID from session
 */
export function addTenantDebugHeader(response: NextResponse, activeTenantId: string | null): void {
  if (activeTenantId) {
    response.headers.set('X-Active-Tenant', activeTenantId);
  } else {
    response.headers.set('X-Active-Tenant', 'none');
  }
}

