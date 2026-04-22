/**
 * CVision Auth Wrapper
 * Isolation layer wrapping withAuthTenant for CVision
 */

import {
  withAuthTenant as sharedWithAuthTenant,
  type WithAuthTenantOptions,
  type AuthTenantHandler
} from '@/lib/core/guards/withAuthTenant';
import { NextRequest, NextResponse } from 'next/server';

// Re-export types for convenience
export type { WithAuthTenantOptions, AuthTenantHandler };

export interface CVisionAuthContext {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  tenantId: string;
  userId: string;
  permissions: string[];
  role: string;
}

export type CVisionHandler = (
  request: NextRequest,
  context: CVisionAuthContext,
  params?: any
) => Promise<NextResponse>;

/**
 * CVision-specific auth wrapper
 * Defaults platformKey to 'cvision' but allows override
 */
export function withCVisionAuth(
  handler: AuthTenantHandler,
  options: WithAuthTenantOptions = {}
) {
  return sharedWithAuthTenant(
    handler,
    {
      platformKey: 'cvision', // Default to cvision
      ...options, // Allow override if needed
    }
  );
}

// Backward compatibility - use the same as shared
export const withAuthTenant = sharedWithAuthTenant;
