/**
 * CVision SaaS — Tenant Middleware
 *
 * Drop-in middleware for API routes. Validates session, tenant status,
 * subscription, feature access, and employee limits in one call.
 */

import { NextRequest } from 'next/server';
import { requireSession, CVisionSessionContext } from '@/lib/cvision/middleware';
import {
  getTenant,
  validateTenantAccess,
  isFeatureEnabled,
  checkEmployeeLimit,
  Tenant,
} from './tenant-manager';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TenantContext {
  tenantId: string;
  tenant: Tenant;
  user: {
    userId: string;
    role: string;
    email?: string;
    name?: string;
    departmentId?: string;
    employeeId?: string;
  };
  session: CVisionSessionContext;
  isAllowed: boolean;
  error?: string;
  status?: number;
}

export interface WithTenantOptions {
  requiredFeature?: string;
  checkEmployeeLimit?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Feature → Endpoint mapping
// ═══════════════════════════════════════════════════════════════════════════

const ENDPOINT_FEATURE_MAP: Record<string, string> = {
  '/api/cvision/retention': 'retention_ai',
  '/api/cvision/whatif': 'what_if',
  '/api/cvision/analytics/what-if': 'what_if',
  '/api/cvision/ai/': 'ai',
  '/api/cvision/muqeem': 'muqeem',
  '/api/cvision/performance': 'performance',
  '/api/cvision/disciplinary': 'disciplinary',
  '/api/cvision/recruitment': 'recruitment',
  '/api/cvision/reports': 'government_reports',
  '/api/cvision/integrations': 'integrations',
};

function detectRequiredFeature(url: string): string | null {
  for (const [prefix, feature] of Object.entries(ENDPOINT_FEATURE_MAP)) {
    if (url.includes(prefix)) return feature;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main middleware
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified SaaS middleware. Call at the start of every API route.
 *
 * 1. Validates session (JWT + cookie)
 * 2. Resolves tenant record from session
 * 3. Checks tenant is active / subscription valid
 * 4. Checks feature access for the endpoint
 * 5. Optionally checks employee limit
 */
export async function withTenant(
  request: NextRequest,
  options: WithTenantOptions = {},
): Promise<TenantContext> {
  // 1. Session
  const sessionResult = await requireSession(request);
  if (!sessionResult.success || !sessionResult.data) {
    return {
      tenantId: '',
      tenant: null as any,
      user: { userId: '', role: '' },
      session: null as any,
      isAllowed: false,
      error: sessionResult.error || 'Authentication required',
      status: sessionResult.status || 401,
    };
  }

  const session = sessionResult.data;
  const { tenantId } = session;

  // 2. Resolve tenant record
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return {
      tenantId,
      tenant: null as any,
      user: { userId: session.userId, role: session.role },
      session,
      isAllowed: false,
      error: 'Tenant not found',
      status: 404,
    };
  }

  // 3. Validate tenant status & subscription
  const access = await validateTenantAccess(tenantId);
  if (!access.valid) {
    return {
      tenantId,
      tenant,
      user: { userId: session.userId, role: session.role },
      session,
      isAllowed: false,
      error: access.reason,
      status: access.status || 403,
    };
  }

  // 4. Feature check (explicit option or auto-detect from URL)
  const feature = options.requiredFeature || detectRequiredFeature(request.url);
  if (feature && !isFeatureEnabled(tenant, feature)) {
    const planName = tenant.subscription.plan;
    return {
      tenantId,
      tenant,
      user: { userId: session.userId, role: session.role },
      session,
      isAllowed: false,
      error: `Upgrade your plan to access this feature. Current plan: ${planName}`,
      status: 403,
    };
  }

  // 5. Employee limit (for creation endpoints)
  if (options.checkEmployeeLimit) {
    const limit = await checkEmployeeLimit(tenantId);
    if (!limit.allowed) {
      return {
        tenantId,
        tenant,
        user: { userId: session.userId, role: session.role },
        session,
        isAllowed: false,
        error: `Employee limit reached (${limit.current}/${limit.max}). Upgrade your plan.`,
        status: 403,
      };
    }
  }

  // All checks passed
  return {
    tenantId,
    tenant,
    user: {
      userId: session.userId,
      role: session.role,
      email: session.user?.email,
      name: session.user?.name,
      departmentId: session.departmentId,
      employeeId: session.employeeId,
    },
    session,
    isAllowed: true,
  };
}
