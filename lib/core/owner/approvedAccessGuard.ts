/**
 * Approved Access Guard
 * 
 * Validates that owner has approved access to tenant data
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { isTheaOwner } from './separation';
import { getApprovedAccessByToken, recordTokenUsage } from './approvedAccess';
import { canAccessPlatform } from '../models/ApprovedAccessToken';

/**
 * Require approved access for owner accessing tenant routes
 * Returns approved access context or 403 response
 */
export async function requireApprovedAccess(
  request: NextRequest,
  requiredPlatform?: 'sam' | 'health' | 'edrac' | 'cvision'
): Promise<{ tenantId: string; allowedPlatforms: any } | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // If not owner, allow normal access
  if (!isTheaOwner(authResult)) {
    return { tenantId: authResult.tenantId, allowedPlatforms: {} };
  }

  // Owner must have approved access token
  const approvedAccessToken = request.cookies.get('approved_access_token')?.value;
  if (!approvedAccessToken) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Thea Owner requires approved access to access tenant data. Please request access from tenant admin.',
      },
      { status: 403 }
    );
  }

  // Verify token
  const approvedAccess = await getApprovedAccessByToken(approvedAccessToken);
  if (!approvedAccess) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Approved access token is invalid or expired. Please request new access.',
      },
      { status: 403 }
    );
  }

  // Verify token belongs to this owner
  if (approvedAccess.ownerId !== authResult.user.id) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'This approved access token does not belong to you.',
      },
      { status: 403 }
    );
  }

  // Check platform access if required
  if (requiredPlatform && !canAccessPlatform(approvedAccess, requiredPlatform)) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: `You do not have approved access to ${requiredPlatform} platform for this tenant.`,
      },
      { status: 403 }
    );
  }

  // Record usage (for audit)
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;
  await recordTokenUsage(approvedAccessToken, ipAddress, userAgent);

  return {
    tenantId: approvedAccess.tenantId,
    allowedPlatforms: approvedAccess.allowedPlatforms,
  };
}
