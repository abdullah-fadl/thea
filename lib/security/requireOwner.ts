/**
 * Require Thea Owner Role
 *
 * Ensures the user has the 'thea-owner' role to access owner console routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from './auth';
import { AuthenticatedUser } from './auth';

/**
 * Require thea-owner role
 * Returns authenticated user context or 403 response
 */
export async function requireOwner(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  const auth = await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    return auth; // Already an error response
  }

  if (auth.userRole !== 'thea-owner') {
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: 'Thea Owner access required' 
      },
      { status: 403 }
    );
  }

  return auth;
}

