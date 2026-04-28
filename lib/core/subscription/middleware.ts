/**
 * Subscription Middleware Helper
 * 
 * Lightweight subscription check for Edge Runtime
 * Uses cached subscription status from JWT or makes API call
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth/edge';

export interface SubscriptionStatus {
  allowed: boolean;
  readOnly: boolean;
  status?: 'active' | 'blocked' | 'expired';
  reason?: string;
}

/**
 * Get subscription status from token payload
 * This is a lightweight check for Edge Runtime
 * Full validation happens in API routes
 */
export async function getSubscriptionStatusFromToken(
  request: NextRequest
): Promise<SubscriptionStatus | null> {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return null;
  }

  // Try to get subscription status from token payload
  // For now, we'll assume active if token is valid
  // Full check happens in /api/auth/me
  const payload = await verifyTokenEdge(token);
  
  if (!payload) {
    return null;
  }

  // For owner roles, always allow (no subscription check)
  if (payload.role === 'thea-owner') {
    return {
      allowed: true,
      readOnly: false,
      status: 'active',
    };
  }

  // For other users, we need to check subscription
  // This is a lightweight check - full validation in API routes
  // For now, assume active if token is valid
  // TODO: Add subscription status to JWT payload at login
  return {
    allowed: true,
    readOnly: false,
    status: 'active',
  };
}

/**
 * Check subscription in middleware
 * Returns subscription status or redirect/error response
 */
export async function checkSubscriptionInMiddleware(
  request: NextRequest
): Promise<SubscriptionStatus | NextResponse | null> {
  // Skip subscription check for public paths
  const { pathname } = request.nextUrl;
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/health'
  ) {
    return null;
  }

  // Get subscription status from token
  const subscriptionStatus = await getSubscriptionStatusFromToken(request);
  
  if (!subscriptionStatus) {
    // No subscription info available - allow (will be checked in API routes)
    return null;
  }

  // If subscription is not allowed, block access
  if (!subscriptionStatus.allowed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Subscription Required',
          message: subscriptionStatus.reason || 'Subscription is not active',
        },
        { status: 403 }
      );
    } else {
      // Redirect to subscription error page
      const errorUrl = new URL('/subscription-error', request.url);
      errorUrl.searchParams.set('reason', subscriptionStatus.reason || 'Subscription is not active');
      return NextResponse.redirect(errorUrl);
    }
  }

  return subscriptionStatus;
}
