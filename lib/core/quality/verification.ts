/**
 * Quality Gate - Security Verification
 *
 * Verification checks for:
 * - Cross-tenant access attempts
 * - Unauthorized route access
 * - Expired subscription behavior
 * - Session restore behavior
 * - Tenant boundary violations
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { logAuthorizationEvent } from '../guards/index';
import { logger } from '@/lib/monitoring/logger';

export interface VerificationResult {
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Verify tenant isolation - ensure tenantId is never from client
 */
export async function verifyTenantIsolation(
  request: NextRequest
): Promise<VerificationResult> {
  // Check if tenantId is in query params or body
  const searchParams = request.nextUrl.searchParams;
  const hasTenantIdInQuery = searchParams.has('tenantId') || searchParams.has('tenant');

  if (hasTenantIdInQuery) {
    await logAuthorizationEvent({
      type: 'tenant_boundary_violation',
      userId: 'unknown',
      tenantId: 'unknown',
      details: {
        route: request.nextUrl.pathname,
        violation: 'tenantId in query params',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    });

    return {
      passed: false,
      message: 'Tenant boundary violation: tenantId found in query params',
      details: {
        violation: 'tenantId in query params',
      },
    };
  }

  // Check body if it's a POST/PUT/PATCH request
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const body = await request.clone().json().catch(() => ({}));
      if (body.tenantId || body.tenant) {
        await logAuthorizationEvent({
          type: 'tenant_boundary_violation',
          userId: 'unknown',
          tenantId: 'unknown',
          details: {
            route: request.nextUrl.pathname,
            violation: 'tenantId in request body',
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            userAgent: request.headers.get('user-agent'),
          },
        });

        return {
          passed: false,
          message: 'Tenant boundary violation: tenantId found in request body',
          details: {
            violation: 'tenantId in request body',
          },
        };
      }
    } catch (error) {
      // Body parsing failed, continue
    }
  }

  return {
    passed: true,
    message: 'Tenant isolation verified',
  };
}

/**
 * Verify subscription enforcement
 */
export async function verifySubscriptionEnforcement(
  request: NextRequest
): Promise<VerificationResult> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return {
      passed: true, // Not authenticated, will be handled by auth
      message: 'Not authenticated',
    };
  }

  const { tenantId, user } = authResult;

  // Skip for owner roles
  if (user.role === 'thea-owner') {
    return {
      passed: true,
      message: 'Owner - subscription check skipped',
    };
  }

  // Check subscription status
  const { checkSubscription } = await import('../subscription/engine');
  const subscriptionCheck = await checkSubscription(tenantId);

  if (!subscriptionCheck.allowed) {
    return {
      passed: false,
      message: 'Subscription not active',
      details: {
        status: subscriptionCheck.contract?.status,
        reason: subscriptionCheck.reason,
      },
    };
  }

  return {
    passed: true,
    message: 'Subscription verified',
    details: {
      status: subscriptionCheck.contract?.status,
      readOnly: subscriptionCheck.readOnly,
    },
  };
}

/**
 * Verify owner cannot access tenant data
 */
export async function verifyOwnerSeparation(
  request: NextRequest
): Promise<VerificationResult> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return {
      passed: true,
      message: 'Not authenticated',
    };
  }

  const { user, tenantId } = authResult;

  // Only check for owner roles
  if (user.role !== 'thea-owner') {
    return {
      passed: true,
      message: 'Not owner - check skipped',
    };
  }

  // Owner should not access tenant-specific routes (except /owner routes)
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/owner') && !pathname.startsWith('/api/owner')) {
    // Owner trying to access tenant routes
    if (tenantId && tenantId !== 'platform') {
      await logAuthorizationEvent({
        type: 'unauthorized_access',
        userId: user.id,
        tenantId: 'platform',
        details: {
          route: pathname,
          violation: 'Owner accessing tenant route',
          attemptedTenantId: tenantId,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          userAgent: request.headers.get('user-agent'),
        },
      });

      return {
        passed: false,
        message: 'Owner separation violation: Owner accessing tenant route',
        details: {
          route: pathname,
          attemptedTenantId: tenantId,
        },
      };
    }
  }

  return {
    passed: true,
    message: 'Owner separation verified',
  };
}

/**
 * Verify session restore behavior
 */
export async function verifySessionRestore(
  userId: string
): Promise<VerificationResult> {
  const { getLastSessionState } = await import('../auth/sessionRestore');
  const state = await getLastSessionState(userId);

  if (!state) {
    return {
      passed: true,
      message: 'No previous session state (first login)',
    };
  }

  // Verify state structure
  const hasRequiredFields =
    state.userId === userId &&
    typeof state.lastVisitedAt === 'object' &&
    state.lastVisitedAt instanceof Date;

  if (!hasRequiredFields) {
    return {
      passed: false,
      message: 'Invalid session state structure',
      details: {
        state,
      },
    };
  }

  return {
    passed: true,
    message: 'Session restore verified',
    details: {
      hasLastRoute: !!state.lastRoute,
      hasLastPlatform: !!state.lastPlatformKey,
      hasLastTenant: !!state.lastTenantId,
    },
  };
}

/**
 * Run all verification checks including route scanning
 */
export async function runQualityGate(
  request: NextRequest
): Promise<{
  passed: boolean;
  results: VerificationResult[];
  routeScan?: {
    totalRoutes: number;
    routesWithViolations: number;
    criticalViolations: number;
    highViolations: number;
    mediumViolations: number;
    violations: any[];
    summary: string;
  };
  crossTenantTests?: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    results: any[];
  };
}> {
  const results: VerificationResult[] = [];

  // 1. Tenant isolation check
  const tenantIsolation = await verifyTenantIsolation(request);
  results.push(tenantIsolation);

  // 2. Subscription enforcement check
  const subscription = await verifySubscriptionEnforcement(request);
  results.push(subscription);

  // 3. Owner separation check
  const ownerSeparation = await verifyOwnerSeparation(request);
  results.push(ownerSeparation);

  // 4. Session restore check (if authenticated)
  try {
    const authResult = await requireAuth(request);
    if (!(authResult instanceof NextResponse)) {
      const sessionRestore = await verifySessionRestore(authResult.userId);
      results.push(sessionRestore);
    }
  } catch (error) {
    // Not authenticated, skip
  }

  // 5. Route scanning (scan all API routes)
  let routeScan: any = undefined;
  try {
    const { scanAllRoutes, generateScanReport } = await import('./routeScanner');
    const scanResults = scanAllRoutes();
    routeScan = generateScanReport(scanResults);

    // Add route scan violations to results
    if (routeScan.criticalViolations > 0 || routeScan.highViolations > 0) {
      results.push({
        passed: false,
        message: `Route security scan found ${routeScan.criticalViolations} critical and ${routeScan.highViolations} high violations`,
        details: {
          totalRoutes: routeScan.totalRoutes,
          routesWithViolations: routeScan.routesWithViolations,
          violations: routeScan.violations,
        },
      });
    } else {
      results.push({
        passed: true,
        message: `Route security scan passed: ${routeScan.totalRoutes} routes scanned, no violations`,
      });
    }
  } catch (error) {
    logger.error('Route scan failed', { category: 'system', error });
    results.push({
      passed: false,
      message: `Route scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // 6. Cross-tenant access tests
  let crossTenantTests: any = undefined;
  try {
    const { runCrossTenantTests } = await import('./apiTests');
    const testResults = await runCrossTenantTests();
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = testResults.filter(t => !t.passed).length;

    crossTenantTests = {
      totalTests: testResults.length,
      passedTests,
      failedTests,
      results: testResults,
    };

    if (failedTests > 0) {
      results.push({
        passed: false,
        message: `Cross-tenant access tests failed: ${failedTests} out of ${testResults.length} tests failed`,
        details: {
          failedTests: testResults.filter(t => !t.passed),
        },
      });
    } else {
      results.push({
        passed: true,
        message: `Cross-tenant access tests passed: ${passedTests} out of ${testResults.length} tests passed`,
      });
    }
  } catch (error) {
    logger.error('Cross-tenant tests failed', { category: 'system', error });
    results.push({
      passed: false,
      message: `Cross-tenant tests failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  const passed = results.every(r => r.passed);

  return {
    passed,
    results,
    routeScan,
    crossTenantTests,
  };
}
