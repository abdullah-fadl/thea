/**
 * Centralized API Route Wrapper
 *
 * Provides secure, tenant-isolated API route handlers with:
 * - Authentication (required by default)
 * - Tenant filtering (enforced on DB queries)
 * - Platform access checks (for platform-specific routes)
 * - Permission checks (optional)
 *
 * Usage:
 * ```ts
 * export const GET = withAuthTenant(async (req, { user, tenantId }) => {
 *   // user and tenantId are guaranteed to be available
 *   // All DB queries are automatically tenant-filtered
 *   return NextResponse.json({ data: ... });
 * }, { platformKey: 'sam', permissionKey: 'policies.read' });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedUser } from '@/lib/auth/requireAuth';
import { requireOwner } from '@/lib/core/owner/separation';
import { isPlatformEnabled } from '../subscription/engine';
import { type PlatformKey } from '@/lib/db/platformKey';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { requireAreaAccess, type AreaKey } from '@/lib/access/tenantUser';
import { getDefaultPermissionsForRole, expandGroupedPermissions } from '@/lib/permissions';
import { checkRateLimitRedis, getRequestIp } from '@/lib/security/rateLimit';
import { RATE_LIMIT_CONFIG } from '@/lib/security/config';
import { requireCSRF } from '@/lib/security/csrf';
import { sanitizeRequestBody } from '@/lib/security/sanitize';

// Re-export PlatformKey for backward compatibility
export type { PlatformKey } from '@/lib/db/platformKey';

export interface WithAuthTenantOptions {
  /** Platform key (e.g., 'sam', 'thea-health') - enforces platform access */
  platformKey?: PlatformKey;
  /** Permission key (e.g., 'policies.read') - enforces permission */
  permissionKey?: string;
  /** Alternative: array of permission keys — user needs ANY of these (overrides permissionKey if both set) */
  permissionKeys?: string[];
  /** If true, ensures all DB queries are tenant-scoped (default: true) */
  tenantScoped?: boolean;
  /** If true, route is owner-scoped (for /owner/** routes) */
  ownerScoped?: boolean;
  /** If true, route is public (no auth required) */
  publicRoute?: boolean;
  /** When auth fails, return this response instead of 401 (avoids 401 noise for polling endpoints) */
  softFailResponse?: NextResponse | (() => NextResponse);
  /** Custom rate limit override. Set to false to skip. Default: API general (120/min per user). */
  rateLimit?: { max: number; windowMs: number } | false;
  /** Enable CSRF validation for state-changing methods (POST/PUT/PATCH/DELETE). Default: true.
   *  Set to false to opt out (e.g., for machine-to-machine / webhook endpoints). */
  csrf?: boolean;
  /** Enable XSS input sanitization on request bodies for POST/PUT/PATCH. Default: true.
   *  Set to false to opt out (e.g., for routes that need raw HTML input). */
  sanitize?: boolean;
}

function resolveAreaFromPath(pathname: string): AreaKey | null {
  if (pathname.startsWith('/api/registration') || pathname.startsWith('/api/patients') || pathname.startsWith('/api/encounters') || pathname.startsWith('/api/search')) {
    return 'REGISTRATION';
  }
  if (pathname.startsWith('/api/er')) return 'ER';
  if (pathname.startsWith('/api/opd')) return 'OPD';
  if (pathname.startsWith('/api/ipd')) return 'IPD';
  if (pathname.startsWith('/api/orders') || pathname.startsWith('/api/order-sets') || pathname.startsWith('/api/attachments')) {
    return 'ORDERS';
  }
  if (pathname.startsWith('/api/results')) return 'RESULTS';
  if (pathname.startsWith('/api/tasks')) return 'TASKS';
  if (pathname.startsWith('/api/handover')) return 'HANDOVER';
  if (pathname.startsWith('/api/notifications')) return 'NOTIFICATIONS';
  if (pathname.startsWith('/api/billing')) return 'BILLING';
  if (pathname.startsWith('/api/mortuary')) return 'MORTUARY';
  return null;
}

export type AuthTenantHandler = (
  request: NextRequest,
  context: {
    user: AuthenticatedUser['user'];
    tenantId: string;
    userId: string;
    permissions: string[];
    role: string;
  },
  params?: { [key: string]: string | string[] } | Promise<{ [key: string]: string | string[] }>
) => Promise<NextResponse>;

const TAK_THEA_CACHE_MAX = 500;
const takTheaCache = new Map<string, boolean>();

function normalizeTenantKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

async function isTakTheaTenant(tenantId: string): Promise<boolean> {
  if (!tenantId) return false;
  const cached = takTheaCache.get(tenantId);
  if (cached !== undefined) return cached;
  // Evict oldest entries when cache grows too large
  if (takTheaCache.size >= TAK_THEA_CACHE_MAX) {
    const firstKey = takTheaCache.keys().next().value;
    if (firstKey !== undefined) takTheaCache.delete(firstKey);
  }

  // Fast path: tenantId itself contains TAK_Thea-like token
  const tid = normalizeTenantKey(tenantId);
  if (tid.includes('TAKTHEA') || tid.includes('HMGTAK')) {
    takTheaCache.set(tenantId, true);
    return true;
  }

  try {
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantId),
      select: { name: true, tenantId: true },
    });
    const nameKey = normalizeTenantKey(tenant?.name);
    const tenantIdKey = normalizeTenantKey(tenant?.tenantId);
    const isTak = [nameKey, tenantIdKey].some((k) => k.includes('TAKTHEA') || k.includes('HMGTAK'));
    takTheaCache.set(tenantId, isTak);
    return isTak;
  } catch {
    takTheaCache.set(tenantId, false);
    return false;
  }
}

/**
 * Wrapper for API route handlers with authentication and tenant isolation
 * Supports both regular routes and dynamic routes with params
 */
export function withAuthTenant(
  handler: AuthTenantHandler,
  options: WithAuthTenantOptions = {}
): ((request: NextRequest) => Promise<NextResponse>) &
   ((request: NextRequest, context: { params: { [key: string]: string | string[] } | Promise<{ [key: string]: string | string[] }> }) => Promise<NextResponse>) {
  const {
    platformKey,
    permissionKey,
    permissionKeys,
    tenantScoped = true,
    ownerScoped = false,
    publicRoute = false,
    softFailResponse,
    rateLimit: rateLimitOpt,
    csrf: csrfOpt = true,
    sanitize: sanitizeOpt = true,
  } = options;

  const wrappedHandler = async (
    request: NextRequest,
    context?: { params?: { [key: string]: string | string[] } | Promise<{ [key: string]: string | string[] }> }
  ) => {
    // Resolve params if provided (for dynamic routes)
    const params = context?.params instanceof Promise ? await context.params : context?.params;

    // Public routes skip auth
    if (publicRoute) {
      return handler(request, {
        user: {} as unknown as AuthenticatedUser['user'],
        tenantId: '',
        userId: '',
        permissions: [],
        role: 'public',
      }, params);
    }

    // Owner-scoped routes require owner role
    if (ownerScoped) {
      const ownerResult = await requireOwner(request);
      if (ownerResult instanceof NextResponse) {
        return ownerResult;
      }

      return handler(request, {
        user: ownerResult.user,
        tenantId: ownerResult.tenantId || '',
        userId: ownerResult.user.id,
        permissions: ownerResult.user?.permissions || [],
        role: ownerResult.user.role,
      }, params);
    }

    // Regular routes require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      if (softFailResponse) return typeof softFailResponse === 'function' ? softFailResponse() : softFailResponse;
      return authResult;
    }

    const { user, tenantId } = authResult;

    // ─── UUID guard: empty/invalid tenantId should not reach Prisma ──────────
    // Owner users without a selected tenant have tenantId = ''. Passing this to
    // Prisma crashes with "invalid input syntax for type uuid". For tenant-scoped
    // routes, return a safe empty response instead of letting the query fail.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // LIB-05 fix: Missing/invalid tenantId always returns 403, never masked by
    // softFailResponse (which is only meant for auth failures on polling endpoints).
    if (tenantScoped && (!tenantId || !UUID_RE.test(tenantId))) {
      return NextResponse.json(
        { error: 'No tenant selected', message: 'No tenant selected' },
        { status: 403 }
      );
    }

    // [SEC] Default rate limiting — protects all authenticated routes (120/min per user)
    if (rateLimitOpt !== false) {
      const rlMax = rateLimitOpt?.max ?? RATE_LIMIT_CONFIG.API.MAX_REQUESTS;
      const rlWindow = rateLimitOpt?.windowMs ?? RATE_LIMIT_CONFIG.API.WINDOW_MS;
      const rlKey = `api:${user.id}`;
      const rl = await checkRateLimitRedis(rlKey, rlMax, rlWindow);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' },
          {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
          }
        );
      }
    }

    // [SEC] CSRF protection for state-changing methods (POST/PUT/PATCH/DELETE)
    // Skipped for GET/HEAD, auth endpoints, API-key requests, and routes that explicitly opt out.
    if (csrfOpt !== false) {
      const hasApiKey = !!request.headers.get('x-api-key');
      if (!hasApiKey) {
        const csrfResult = await requireCSRF(request);
        if (csrfResult) {
          return csrfResult;
        }
      }
    }

    // Block portal (patient) sessions from accessing staff API routes
    const sessionType = (authResult as unknown as Record<string, unknown>).sessionType || (user as unknown as Record<string, unknown>).sessionType;
    if (sessionType === 'portal' || String(user.role || '').toLowerCase() === 'patient') {
      const pathname = request.nextUrl.pathname || '';
      if (!pathname.startsWith('/api/portal')) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Portal sessions cannot access staff API routes' },
          { status: 403 }
        );
      }
    }

    const rawPermissions = (authResult as unknown as Record<string, string[]>).permissions ?? user?.permissions ?? [];
    const permissions = rawPermissions.length > 0
      ? expandGroupedPermissions(rawPermissions)
      : getDefaultPermissionsForRole(String(user?.role || ''));
    const isTakThea = tenantId ? await isTakTheaTenant(tenantId) : false;

    const roleLower = String(user.role || '').toLowerCase();
    const isOwnerRole = roleLower === 'thea-owner';
    const isAdminRole = roleLower === 'admin' || roleLower === 'tenant-admin';

    // Owner and admin bypass platform check (subscription may be missing in dev)
    if (platformKey && !isOwnerRole && !isAdminRole) {
      if (isTakThea) {
        // Skip platform gating for TAK_Thea
      } else if (process.env.NODE_ENV === 'development') {
        // In development, allow access when subscription/contract may be missing
        const subscriptionCheck = await import('../subscription/engine').then((m) => m.checkSubscription(tenantId));
        if (!subscriptionCheck.allowed && !subscriptionCheck.contract) {
          // No contract at all — typical dev setup; allow
        } else if (!subscriptionCheck.allowed) {
          return NextResponse.json(
            {
              error: 'Forbidden',
              message: subscriptionCheck.reason || `You do not have access to ${platformKey} platform`,
            },
            { status: 403 }
          );
        } else {
          const platformMap: Record<PlatformKey, 'sam' | 'theaHealth' | 'cvision' | 'edrac' | 'imdad'> = {
            sam: 'sam',
            thea_health: 'theaHealth',
            cvision: 'cvision',
            edrac: 'edrac',
            imdad: 'imdad',
          };
          const subscriptionKey = platformMap[platformKey];
          const enabled = (subscriptionCheck.contract?.enabledPlatforms as Record<string, boolean> | undefined)?.[subscriptionKey];
          if (!enabled) {
            return NextResponse.json(
              {
                error: 'Forbidden',
                message: `You do not have access to ${platformKey} platform`,
              },
              { status: 403 }
            );
          }
        }
      } else {
        const platformMap: Record<PlatformKey, string> = {
          'sam': 'sam',
          'thea_health': 'theaHealth',
          'cvision': 'cvision',
          'edrac': 'edrac',
          'imdad': 'imdad',
        };

        const subscriptionKey = platformMap[platformKey];
        const enabled = await isPlatformEnabled(tenantId, subscriptionKey as any);
        if (!enabled) {
          return NextResponse.json(
            {
              error: 'Forbidden',
              message: `You do not have access to ${platformKey} platform`,
            },
            { status: 403 }
          );
        }
      }
    }

    // Permission check (owner bypasses)
    const keysToCheck = permissionKeys?.length ? permissionKeys : (permissionKey ? [permissionKey] : []);
    if (keysToCheck.length > 0 && !isOwnerRole) {
      const pathname = request.nextUrl.pathname || '';
      const effectiveKeys = keysToCheck.map((pk) => {
        if (platformKey === 'thea_health' && pk.startsWith('er.')) {
          if (pathname.startsWith('/api/ipd')) return 'ipd.live-beds.view';
          if (pathname.startsWith('/api/opd')) return 'opd.dashboard.view';
          if (pathname.startsWith('/api/billing')) return 'dashboard.view';
        }
        return pk;
      });

      const hasPermission =
        effectiveKeys.some((k) => permissions.includes(k)) ||
        roleLower === 'admin' ||
        roleLower === 'tenant-admin' ||
        roleLower === 'thea-owner';

      if (!hasPermission && !isTakThea) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: `Permission required: ${effectiveKeys.join(' or ')}`,
          },
          { status: 403 }
        );
      }
    }

    // Area-based access (Thea Health only) — owner bypasses
    if (platformKey === 'thea_health' && !isOwnerRole) {
      const pathname = request.nextUrl.pathname || '';
      if (!pathname.startsWith('/api/admin')) {
        const area = resolveAreaFromPath(pathname);
        if (area) {
          // Catalog/medication search: doctors need these for orders & prescriptions
          const isCatalogSearch = pathname === '/api/billing/catalog/search';
          const isMedicationCatalog = pathname === '/api/billing/medication-catalog';
          const allowRoles =
            area === 'ORDERS' || area === 'TASKS' || area === 'NOTIFICATIONS' || area === 'RESULTS' || area === 'REGISTRATION'
              ? ['charge', 'admin', 'dev', 'doctor', 'consultant', 'physician']
              : isCatalogSearch || isMedicationCatalog
              ? ['doctor', 'consultant', 'physician', 'charge', 'admin', 'dev', 'finance', 'reception', 'front_desk']
              : [];
          const requireRoles =
            area === 'BILLING' && !isCatalogSearch && !isMedicationCatalog
              ? ['finance', 'admin', 'charge', 'dev', 'reception', 'receptionist', 'front_desk', 'staff']
              : area === 'BILLING' && (isCatalogSearch || isMedicationCatalog)
              ? [] // No strict role requirement; allowRoles handles it
              : area === 'MORTUARY'
              ? ['charge', 'admin', 'dev']
              : [];
          const access = await requireAreaAccess({
            tenantId,
            userId: user.id,
            user,
            area,
            allowRoles,
            requireRoles,
          });
          if (access instanceof NextResponse) {
            return access;
          }
        }
      }
    }

    // [SEC] XSS input sanitization for state-changing methods
    let sanitizedRequest = request;
    if (sanitizeOpt !== false) {
      const method = request.method.toUpperCase();
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          const contentType = request.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const clonedRequest = request.clone();
            const body = await clonedRequest.json();
            const sanitizedBody = sanitizeRequestBody(body);
            sanitizedRequest = new NextRequest(request.url, {
              method: request.method,
              headers: request.headers,
              body: JSON.stringify(sanitizedBody),
            });
          }
        } catch {
          // If body parsing fails, pass the original request through
        }
      }
    }

    // Execute handler with authenticated context
    return handler(sanitizedRequest, {
      user,
      tenantId,
      userId: user.id,
      permissions: permissions || [],
      role: user.role,
    }, params);
  };

  return wrappedHandler as ((request: NextRequest) => Promise<NextResponse>) &
    ((request: NextRequest, context: { params: { [key: string]: string | string[] } | Promise<{ [key: string]: string | string[] }> }) => Promise<NextResponse>);
}

/**
 * Helper to create tenant-filtered query
 * Use this in route handlers to ensure tenant isolation
 */
export function createTenantQuery<T>(
  baseQuery: Record<string, any>,
  tenantId: string
): T {
  return {
    ...baseQuery,
    tenantId,
  } as T;
}
