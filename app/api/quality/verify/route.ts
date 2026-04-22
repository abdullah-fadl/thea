/**
 * Quality Gate Verification API
 *
 * Endpoint to run security verification checks
 * Owner-only: exposes security scan results
 */

import { NextRequest, NextResponse } from 'next/server';
import { runQualityGate } from '@/lib/core/quality/verification';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/quality/verify
 * Run quality gate verification checks
 *
 * Returns comprehensive security verification report including:
 * - Route security scan (all /app/api/** routes)
 * - Cross-tenant access tests
 * - Tenant isolation checks
 * - Subscription enforcement
 * - Owner separation
 * - Session restore
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req) => {
    const result = await runQualityGate(req);

    return NextResponse.json({
      passed: result.passed,
      results: result.results,
      routeScan: result.routeScan,
      crossTenantTests: result.crossTenantTests,
      timestamp: new Date().toISOString(),
      summary: result.passed
        ? '✅ All security checks passed - System is production-ready'
        : '❌ Security checks failed - DO NOT DEPLOY',
    });
  }),
  { ownerScoped: true, permissionKey: 'quality.manage' },
);

/**
 * GET /api/quality/verify
 * Quick health check for quality gate
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req) => {
    const result = await runQualityGate(req);

    return NextResponse.json({
      status: result.passed ? 'healthy' : 'unhealthy',
      passed: result.passed,
      criticalIssues: result.routeScan?.criticalViolations || 0,
      highIssues: result.routeScan?.highViolations || 0,
      timestamp: new Date().toISOString(),
    });
  }),
  { ownerScoped: true, permissionKey: 'quality.manage' },
);
