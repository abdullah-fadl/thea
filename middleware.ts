import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { getUiAccessRequirement, getTestModeEffective } from '@/lib/access/uiRouteAccess';
import { logger } from '@/lib/utils/logger';
import { ACTIVE_PLATFORM_COOKIE, parseActivePlatform } from '@/lib/shell/platform';

const CSRF_COOKIE = 'csrf-token';

/**
 * Apply standard security headers to a response.
 */
function applySecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // TODO: Replace 'unsafe-inline' with nonce-based CSP for scripts and styles
  const isDev = process.env.NODE_ENV !== 'production';
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ') + ';'
  );
  if (process.env.NODE_ENV === 'production' && process.env.SECURITY_HSTS !== '0') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

const welcomePath = '/welcome';
const apiPrefix = '/api';

// Platform route definitions
const SAM_ROUTES = [
  '/library',
  '/integrity',
  '/builder',
  '/assistant',
  '/creator',
  '/alignment',
  '/risk-detector',
  '/policies', // Legacy routes (redirected)
  '/demo-limit',
  '/ai', // Legacy routes (redirected)
  '/sam', // SAM-specific routes
  '/welcome', // Welcome page (accessible to all platforms)
];

// Common routes (accessible to both platforms)
const COMMON_ROUTES = [
  '/account',
  '/notifications',
  '/platforms',
  '/welcome', // Welcome page (accessible to all platforms)
];

const HEALTH_ROUTES = [
  '/dashboard', // Main dashboard for Thea Health
  '/registration',
  '/search',
  '/patient',
  '/patient/journey',
  '/orders',
  '/orders/sets',
  '/handover',
  '/tasks',
  '/results',
  '/billing',
  '/mortuary',
  '/departments',
  '/nursing',
  '/opd',
  '/er',
  '/ipd',
  '/patient-experience',
  '/equipment',
  '/scheduling',
  '/welcome', // Welcome page (accessible to all platforms)
  // Clinical Services
  '/physiotherapy',
  '/consults',
  '/wound-care',
  '/nutrition',
  '/social-work',
  '/patient-education',
  // Lab & Diagnostics
  '/blood-bank',
  '/pathology',
  // Operations
  '/cssd',
  '/equipment-mgmt',
  '/infection-control',
  '/transport',
  // Other
  '/radiology',
  '/lab',
  '/pharmacy',
  '/dental',
  '/obgyn',
  '/icu',
  '/or',
  '/quality',
  '/referrals',
  '/notifications',
  '/settings',
  // Specialty Modules
  '/telemedicine',
  '/analytics',
  '/oncology',
  '/psychiatry',
  '/transplant',
  // Additional
  '/downtime',
  '/handoff',
  '/admission-office',
];

// SAM API routes
const SAM_API_ROUTES = [
  '/api/policies',
  '/api/sam',
  '/api/thea-engine',
  '/api/ai', // Policy-related AI APIs
  '/api/risk-detector',
];

// Health API routes
const HEALTH_API_ROUTES = [
  '/api/departments',
  '/api/patients',
  '/api/encounters',
  '/api/orders',
  '/api/order-sets',
  '/api/handover',
  '/api/tasks',
  '/api/results',
  '/api/attachments',
  '/api/billing',
  '/api/clinical-notes',
  '/api/death',
  '/api/mortuary',
  '/api/search',
  '/api/patient-profile',
  '/api/nursing',
  '/api/opd',
  '/api/er',
  '/api/ipd',
  '/api/patient-experience',
  '/api/equipment',
  '/api/scheduling',
  // New modules
  '/api/physiotherapy',
  '/api/consults',
  '/api/wound-care',
  '/api/nutrition',
  '/api/social-work',
  '/api/patient-education',
  '/api/blood-bank',
  '/api/pathology',
  '/api/cssd',
  '/api/equipment-mgmt',
  '/api/infection-control',
  '/api/radiology',
  '/api/lab',
  '/api/pharmacy',
  '/api/dental',
  '/api/obgyn',
  '/api/icu',
  '/api/or',
  '/api/quality',
  '/api/referrals',
  '/api/clinical-infra',
  '/api/catalogs',
  '/api/clinical',
  '/api/connect',
  // Specialty Modules
  '/api/telemedicine',
  '/api/analytics',
  '/api/oncology',
  '/api/psychiatry',
  '/api/transplant',
  // Additional
  '/api/fhir',
  '/api/ai',
  '/api/integration',
  '/api/downtime',
  '/api/credentialing',
  '/api/compliance',
  '/api/care-gaps',
  '/api/transport',
];

// CVision routes (Employee Lifecycle Management)
const CVISION_ROUTES = [
  '/cvision',
];

// CVision API routes
const CVISION_API_ROUTES = [
  '/api/cvision',
];

// SCM / Imdad routes (Supply Chain Management)
const SCM_ROUTES = [
  '/imdad',
  '/imdad/dashboard',
  '/imdad/inventory',
  '/imdad/procurement',
  '/imdad/warehouse',
  '/imdad/receiving',
  '/imdad/dispensing',
  '/imdad/budgets',
  '/imdad/vendors',
  '/imdad/contracts',
  '/imdad/assets',
  '/imdad/quality',
  '/imdad/analytics',
  '/imdad/admin',
  '/imdad/reports',
  '/imdad/cabinet',
  '/imdad/formulary',
  '/imdad/tenders',
];

// SCM / Imdad API routes
const SCM_API_ROUTES = [
  '/api/imdad',
  '/api/scm',
];

// Common APIs (allowed for all platforms)
const COMMON_API_ROUTES = [
  '/api/auth',
  '/api/notifications',
  '/api/admin',
  '/api/dashboard',
  '/api/platform',
  '/api/init',
  '/api/health', // Health check endpoint
];

/**
 * Check if a path matches any of the route prefixes
 */
function matchesRoute(pathname: string, routePrefixes: string[]): boolean {
  return routePrefixes.some(prefix => pathname.startsWith(prefix));
}

// Maximum request body size (10MB)
const MAX_BODY_SIZE = 10 * 1024 * 1024;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── HTTPS Enforcement (production only, skip for localhost) ──
  const host = request.nextUrl.hostname;
  const isLocalHost = host === 'localhost' || host === '0.0.0.0' || host === '127.0.0.1';
  const xForwardedProto = request.headers.get('x-forwarded-proto');
  const requestHost = request.headers.get('host') ?? 'localhost';

  // Debug logs (safe to remove after verifying local/Railway behavior)
  if (process.env.MIDDLEWARE_DEBUG === '1') {
    // eslint-disable-next-line no-console
    console.log('[middleware]', {
      host,
      isLocalHost,
      xForwardedProto,
      requestUrl: request.url,
      requestHost,
      nextPublicAppUrl: process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    });
  }

  if (process.env.NODE_ENV === 'production' && !isLocalHost) {
    if (xForwardedProto === 'http') {
      // Build redirect URL using Host header (never use 0.0.0.0 in Location)
      const hostForRedirect = requestHost.replace(/^0\.0\.0\.0(:\d+)?$/, (_, port) => `localhost${port ?? ''}`);
      const httpsUrl = new URL(request.url);
      httpsUrl.protocol = 'https:';
      httpsUrl.host = hostForRedirect || 'localhost';
      return NextResponse.redirect(httpsUrl, 302);
    }
  }

  // ── Request Body Size Limit ──
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_SIZE) {
    return NextResponse.json(
      { error: 'Payload too large', message: `Maximum request size is ${MAX_BODY_SIZE / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  // Never enforce UI routing for API paths (API routes enforce themselves)
  // Keep existing API enforcement unchanged.
  if (pathname.startsWith(apiPrefix)) {
    const response = NextResponse.next();
    applySecurityHeaders(response);
    return response;
  }

  // If user is already logged in and visits /login, redirect to /welcome
  if (pathname.startsWith('/login')) {
    const token = request.cookies.get('auth-token')?.value;
    if (token) {
      const payload = await verifyTokenEdge(token);
      if (payload?.userId) {
        return NextResponse.redirect(new URL('/welcome', request.url));
      }
    }
    return NextResponse.next();
  }

  // Early return for public paths (no auth check needed)
  if (
    pathname === '/' ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/select-platform') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/p/') ||
    pathname === '/p' ||
    pathname.startsWith('/portal/') ||
    pathname === '/portal' ||
    pathname === '/api/health' ||
    pathname === '/about' ||
    pathname === '/pricing' ||
    pathname === '/contact' ||
    pathname === '/blog' ||
    pathname.startsWith('/products/') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('auth-token')?.value;
  
  logger.debug('middleware.auth.check', { path: pathname, hasToken: !!token });

  // Validate a redirect path to prevent open redirects
  function isSafeRedirect(value: string): boolean {
    return value.startsWith('/') && !value.startsWith('//') && !/^\/[\\]/.test(value) && !value.includes(':');
  }

  if (!token) {
    // Redirect to login for page requests
    if (!pathname.startsWith(apiPrefix)) {
      const loginUrl = new URL('/login', request.url);
      // Preserve redirect query param if present (validated against open redirect)
      const redirectParam = request.nextUrl.searchParams.get('redirect');
      if (redirectParam && isSafeRedirect(redirectParam)) {
        loginUrl.searchParams.set('redirect', redirectParam);
      } else if (pathname !== '/login') {
        // Add current path as redirect if not already going to login
        loginUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    // Return 401 for API requests
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify token
  const payload = await verifyTokenEdge(token);
  logger.debug('middleware.auth.result', { path: pathname, valid: !!payload });
  if (!payload) {
    if (!pathname.startsWith(apiPrefix)) {
      const loginUrl = new URL('/login', request.url);
      // Preserve redirect query param if present (validated against open redirect)
      const redirectParam = request.nextUrl.searchParams.get('redirect');
      if (redirectParam && isSafeRedirect(redirectParam)) {
        loginUrl.searchParams.set('redirect', redirectParam);
      } else if (pathname !== '/login') {
        // Add current path as redirect if not already going to login
        loginUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Note: Session validation against database is done in API routes
  // Middleware only checks JWT token validity. The actual session validation
  // happens in /api/auth/me and other protected API routes to avoid MongoDB
  // usage in Edge Runtime

  // ── 2FA Enforcement for Admin Roles ──
  // Disabled in development until /account/security 2FA setup flow is fully implemented
  const ENFORCE_2FA = process.env.NODE_ENV === 'production';
  const ROLES_REQUIRING_2FA = ['admin', 'group-admin', 'hospital-admin', 'thea-owner', 'THEA_OWNER'];
  if (
    ENFORCE_2FA &&
    payload.role &&
    ROLES_REQUIRING_2FA.includes(payload.role) &&
    !payload.twoFactorVerified &&
    !pathname.startsWith('/api/auth/2fa') &&
    !pathname.startsWith('/api/auth/login') &&
    !pathname.startsWith('/account/security') &&
    !pathname.startsWith('/login')
  ) {
    if (pathname.startsWith(apiPrefix)) {
      return NextResponse.json(
        { error: '2FA required', message: 'Two-factor authentication is required for admin roles' },
        { status: 403 }
      );
    }
    // Redirect to security settings page to set up 2FA
    return NextResponse.redirect(new URL('/account/security?require2fa=1', request.url));
  }

  const isOwnerRole = payload.role === 'thea-owner' || payload.role === 'THEA_OWNER';
  // SECURITY: Owner bypass only in development (never in production)
  const ownerBypass = isOwnerRole
    && process.env.THEA_TEST_MODE === 'true'
    && process.env.NODE_ENV !== 'production';

  // Subscription check (lightweight - full validation in API routes)
  // Skip for owner roles - subscription status is checked in /api/auth/me
  // Middleware allows access - API routes will enforce subscription
  // This avoids MongoDB calls in Edge Runtime

  // [SEC-08] Validate approved_access_token against the database via internal API call.
  // The middleware cannot access the DB directly (Edge Runtime), so we call the
  // /api/approved-access/validate endpoint — same pattern used for /api/access/tenant-user.
  let approvedAccessValid = false;
  if (isOwnerRole) {
    const approvedAccessCookie = request.cookies.get('approved_access_token')?.value;
    if (approvedAccessCookie) {
      try {
        const validateRes = await fetch(new URL('/api/approved-access/validate', request.url), {
          headers: { cookie: request.headers.get('cookie') || '' },
        });
        if (validateRes.ok) {
          const body = await validateRes.json().catch(() => ({}));
          approvedAccessValid = body?.valid === true;
        }
      } catch {
        // Validation failed — treat as no token
        approvedAccessValid = false;
      }
    }
  }

  // CRITICAL: Block owner from accessing tenant routes (unless approved access OR owner tenant)
  // Owner MUST NOT access tenant platforms or tenant data by default
  // EXCEPTION: Owner can access their own development tenant (thea-owner-dev)
  if (isOwnerRole) {
    // Check if owner is accessing their own development tenant
    // Get activeTenantId from JWT token (included at login for Edge Runtime compatibility)
    const isOwnerTenant =
      payload.activeTenantId === 'thea-owner-dev';

    // If no valid approved access token AND not owner tenant, block tenant routes
    if (!approvedAccessValid && !isOwnerTenant && !ownerBypass) {
      // Owner can ONLY access /owner routes
      // Block all tenant platform routes
      if (pathname.startsWith('/platforms/')) {
        // Owner trying to access tenant platform - redirect to owner console
        if (!pathname.startsWith(apiPrefix)) {
          return NextResponse.redirect(new URL('/owner', request.url));
        }
        return NextResponse.json(
          { error: 'Forbidden', message: 'Owner cannot access tenant platforms without approved access or owner tenant' },
          { status: 403 }
        );
      }
      
      // Block owner from accessing tenant-specific API routes
      // Allow only /api/owner/*, /api/approved-access/*, /api/owner/setup-owner-tenant, and public APIs
      if (pathname.startsWith(apiPrefix)) {
        const isOwnerApi = pathname.startsWith('/api/owner');
        const isApprovedAccessApi = pathname.startsWith('/api/approved-access');
        const isPublicApi = pathname.startsWith('/api/auth/') || 
                           pathname.startsWith('/api/health') ||
                           pathname === '/api/init';
        
        if (!isOwnerApi && !isApprovedAccessApi && !isPublicApi) {
          // Owner trying to access tenant API - block it
          return NextResponse.json(
            { error: 'Forbidden', message: 'Owner cannot access tenant APIs without approved access or owner tenant' },
            { status: 403 }
          );
        }
      }
      
      // Block owner from accessing tenant pages (policies, dashboard, etc.)
      // Only allow /owner, /platforms (hub), /login, /welcome
      if (!pathname.startsWith('/owner') && 
          pathname !== '/platforms' && 
          pathname !== '/login' && 
          pathname !== '/welcome' &&
          pathname !== '/' &&
          !pathname.startsWith(apiPrefix)) {
        // Owner trying to access tenant page - redirect to owner console
        return NextResponse.redirect(new URL('/owner', request.url));
      }
    } else {
      // Owner has validated approved access token OR is using owner tenant
      // [SEC-08] Token is validated against the DB via /api/approved-access/validate
      // API routes perform additional permission checks
    }
  }

  // Backward-compatible redirect: /scm → /imdad
  if (pathname.startsWith('/scm')) {
    const newPath = pathname.replace(/^\/scm/, '/imdad');
    const redirectUrl = new URL(newPath, request.url);
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl, 301);
  }

  // Detect platform from URL path for direct route access (imdad/cvision)
  // Cookie will be set on the final response; use platformFromPath for entitlement checks
  const secureCookie = process.env.NODE_ENV === 'production';
  let platformFromPath: 'imdad' | 'cvision' | null = null;
  if (pathname.startsWith('/imdad')) {
    platformFromPath = 'imdad';
  } else if (pathname.startsWith('/cvision')) {
    platformFromPath = 'cvision';
  }

  // Allow platform landing routes for authenticated users (set activePlatform)
  if (pathname.startsWith('/platforms')) {
    const res = NextResponse.next();
    if (pathname.startsWith('/platforms/thea-health')) {
      res.cookies.set(ACTIVE_PLATFORM_COOKIE, 'health', { path: '/', httpOnly: true, sameSite: 'strict', secure: secureCookie });
    } else if (pathname.startsWith('/platforms/sam')) {
      res.cookies.set(ACTIVE_PLATFORM_COOKIE, 'sam', { path: '/', httpOnly: true, sameSite: 'strict', secure: secureCookie });
    } else if (pathname.startsWith('/platforms/cvision')) {
      res.cookies.set(ACTIVE_PLATFORM_COOKIE, 'cvision', { path: '/', httpOnly: true, sameSite: 'strict', secure: secureCookie });
    } else if (pathname.startsWith('/platforms/scm') || pathname.startsWith('/platforms/imdad')) {
      res.cookies.set(ACTIVE_PLATFORM_COOKIE, 'imdad', { path: '/', httpOnly: true, sameSite: 'strict', secure: secureCookie });
    }
    return res;
  }

  // Owner route protection (owner roles only)
  if (pathname.startsWith('/owner')) {
    if (!isOwnerRole) {
      if (!pathname.startsWith(apiPrefix)) {
        // Redirect non-owners to /platforms (not /login, as they are authenticated)
        return NextResponse.redirect(new URL('/platforms', request.url));
      }
      return NextResponse.json(
        { error: 'Forbidden', message: 'Owner access required' },
        { status: 403 }
      );
    }
    // Owner routes are NOT subject to platform isolation
    // Skip platform cookie check for /owner routes
    return NextResponse.next();
  }

  // Billing page access is enforced via tenant_users RBAC below.

  // Platform isolation enforcement
  // Use cookie value, falling back to URL-derived platform for direct route access
  const platform = parseActivePlatform(request.cookies.get(ACTIVE_PLATFORM_COOKIE)?.value) ?? platformFromPath;
  let entitlements = payload.entitlements; // From JWT token (computed at login)
  
  // For owner roles with approved access, grant entitlements based on approved access token
  // For owner roles without approved access, they shouldn't reach here (blocked above)
  if (isOwnerRole) {
    const isOwnerTenantPlatform = payload.activeTenantId === 'thea-owner-dev';
    if (approvedAccessValid || ownerBypass || isOwnerTenantPlatform) {
      // Owner has approved access or is using owner tenant - grant all entitlements
      entitlements = { sam: true, health: true, edrac: true, cvision: true, imdad: true };
    } else {
      // Owner without approved access should have been blocked above
      // But if they reach here, block them
      if (pathname.startsWith('/platforms/') || (platform && !pathname.startsWith('/owner'))) {
        if (!pathname.startsWith(apiPrefix)) {
          return NextResponse.redirect(new URL('/owner', request.url));
        }
        return NextResponse.json(
          { error: 'Forbidden', message: 'Owner requires approved access to access tenant platforms' },
          { status: 403 }
        );
      }
    }
  }
  
  // If user is logged in but no platform cookie, redirect to platform selection
  // Skip this check for /owner routes (owner doesn't need platform cookie)
  // Skip for owner without approved access (they should be in /owner)
  if (!platform && !pathname.startsWith(apiPrefix) && !pathname.startsWith('/owner') && pathname !== '/platforms' && pathname !== '/welcome' && pathname !== '/select-platform') {
    // For owner without approved access, redirect to /owner
    if (isOwnerRole && !approvedAccessValid && !ownerBypass) {
      return NextResponse.redirect(new URL('/owner', request.url));
    }
    return NextResponse.redirect(new URL('/platforms', request.url));
  }

  // Check if selected platform is allowed by entitlements
  // If entitlements are missing from token (for non-owner users), allow access
  // API routes will enforce entitlements with DB lookup
  if (platform && entitlements) {
    const isPlatformAllowed =
      (platform === 'sam' && entitlements.sam) ||
      (platform === 'health' && entitlements.health) ||
      (platform === 'cvision' && entitlements.cvision) ||
      (platform === 'imdad' && entitlements.imdad);
    
    if (!isPlatformAllowed) {
      // Platform cookie is set but user is not entitled to it
      if (!pathname.startsWith(apiPrefix)) {
        // For owner, redirect to /owner instead of /platforms
        if (isOwnerRole) {
          return NextResponse.redirect(new URL('/owner', request.url));
        }
        return NextResponse.redirect(new URL('/platforms?reason=not_entitled', request.url));
      } else {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You are not entitled to access this platform' },
          { status: 403 }
        );
      }
    }
  }
  // If entitlements are missing from token but user is not owner,
  // allow access - API routes will enforce entitlements with DB lookup

  // Enforce platform isolation for page routes
  // Skip platform isolation for /owner routes (owner doesn't use platforms)
  if (platform && !pathname.startsWith(apiPrefix) && !pathname.startsWith('/owner')) {
    // Allow common routes regardless of platform
    if (pathname === '/platforms' || pathname === '/login' || pathname === '/welcome' || pathname === '/') {
      // Allow these routes
    } else if (matchesRoute(pathname, COMMON_ROUTES)) {
      // Allow common routes (account, notifications) for both platforms
    } else if (platform === 'sam') {
      // SAM platform: only allow SAM routes
      if (!matchesRoute(pathname, SAM_ROUTES)) {
        return NextResponse.redirect(new URL('/platforms?reason=platform_mismatch', request.url));
      }
    } else if (platform === 'health') {
      // Health platform: only allow Health routes
      if (!matchesRoute(pathname, HEALTH_ROUTES)) {
        return NextResponse.redirect(new URL('/platforms?reason=platform_mismatch', request.url));
      }
    } else if (platform === 'cvision') {
      // CVision platform: only allow CVision routes
      if (!matchesRoute(pathname, CVISION_ROUTES)) {
        return NextResponse.redirect(new URL('/platforms?reason=platform_mismatch', request.url));
      }
    } else if (platform === 'imdad') {
      // IMDAD platform: only allow IMDAD routes
      if (!matchesRoute(pathname, SCM_ROUTES)) {
        return NextResponse.redirect(new URL('/platforms?reason=platform_mismatch', request.url));
      }
    }
  }

  // UI-only RBAC enforcement (Health platform) — owner bypasses
  if (platform === 'health' && !isOwnerRole) {
    const req = getUiAccessRequirement(pathname);
    if (req.type !== 'public') {
      // Resolve tenant_user via internal API call (Node runtime) to avoid DB in Edge middleware.
      const authCookie = request.headers.get('cookie') || '';
      const res = await fetch(new URL('/api/access/tenant-user', request.url), {
        headers: { cookie: authCookie },
      });
      const body = res.ok ? await res.json().catch(() => ({})) : null;
      const tenantUser = body?.tenantUser || null;

      const roles = Array.isArray(tenantUser?.roles) ? tenantUser.roles.map((r: unknown) => String(r).toLowerCase()) : [];
      const areas = Array.isArray(tenantUser?.areas) ? tenantUser.areas.map((a: unknown) => String(a).toUpperCase()) : [];
      const isAdminDev = roles.includes('admin') || roles.includes('dev');

      // Admin/dev only: allow Test Mode simulation (cookie-based) — DEVELOPMENT ONLY
      const testCookie = process.env.NODE_ENV !== 'production'
        ? request.cookies.get('ui-test-mode')?.value
        : undefined;
      let effectiveRoles = roles;
      let effectiveAreas = areas;
      if (isAdminDev && testCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(testCookie));
          if (parsed?.enabled && parsed.area && parsed.position) {
            const simulated = getTestModeEffective({ area: parsed.area, position: parsed.position });
            effectiveAreas = simulated.areas;
            effectiveRoles = simulated.roles;
          }
        } catch {
          // ignore invalid cookie
        }
      }

      const deny = () => {
        const redirectUrl = new URL(welcomePath, request.url);
        redirectUrl.searchParams.set('denied', '1');
        redirectUrl.searchParams.set('target', pathname);
        return NextResponse.redirect(redirectUrl);
      };

      const disabled = () => {
        const redirectUrl = new URL(welcomePath, request.url);
        redirectUrl.searchParams.set('disabled', '1');
        redirectUrl.searchParams.set('target', pathname);
        return NextResponse.redirect(redirectUrl);
      };

      // If tenant user is missing/disabled, treat as denied (except admin/dev in DEBUG_AUTH)
      if (!tenantUser) {
        if (pathname === welcomePath) return NextResponse.next();
        return deny();
      }
      // Forced logout for disabled tenant_users (UI-only routing guard).
      // Some deployments use isEnabled; treat either as disabled.
      if (tenantUser?.isActive === false || (tenantUser as Record<string, unknown>)?.isEnabled === false) {
        if (pathname === welcomePath) return NextResponse.next();
        return disabled();
      }

      if (req.type === 'adminOnly') {
        if (!isAdminDev) {
          if (pathname === welcomePath) return NextResponse.next();
          return deny();
        }
      }

      if (req.type === 'area') {
        const allow = (req.allowRoles || []).some((r) => effectiveRoles.includes(String(r).toLowerCase()));
        const roleOk = (req.requireRoles || []).length ? (req.requireRoles || []).some((r) => effectiveRoles.includes(String(r).toLowerCase())) : true;
        const areaOk = effectiveAreas.includes(req.area);
        if (!(isAdminDev || allow) && (!areaOk || !roleOk)) {
          if (pathname === welcomePath) return NextResponse.next();
          return deny();
        }
        // billing must satisfy BOTH area + role
        if (req.area === 'BILLING' && !(effectiveAreas.includes('BILLING') && roleOk)) {
          if (pathname === welcomePath) return NextResponse.next();
          return deny();
        }
      }

      if (req.type === 'anyArea') {
        const allow = (req.allowRoles || []).some((r) => effectiveRoles.includes(String(r).toLowerCase()));
        const anyOk = req.areas.some((a) => effectiveAreas.includes(a));
        if (!(isAdminDev || allow) && !anyOk) {
          if (pathname === welcomePath) return NextResponse.next();
          return deny();
        }
      }
    }
  }

  // [CSRF] Set a CSRF token cookie on authenticated page loads if not already present.
  // The cookie is httpOnly (server-side reference). Client reads the token from the
  // X-CSRF-Token response header and sends it back via X-CSRF-Token request header.
  // withAuthTenant validates the token from the header against the cookie value.
  const response = NextResponse.next();
  // [MW-10] Apply security headers to page responses too
  applySecurityHeaders(response);
  // Set platform cookie for direct imdad/cvision route access (after entitlement checks passed)
  if (platformFromPath) {
    response.cookies.set(ACTIVE_PLATFORM_COOKIE, platformFromPath, { path: '/', httpOnly: true, sameSite: 'strict', secure: secureCookie });
  }
  if (!request.cookies.get(CSRF_COOKIE)?.value) {
    // Generate a random token using Web Crypto (available in Edge Runtime)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const csrfToken = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    response.cookies.set(CSRF_COOKIE, csrfToken, {
      path: '/',
      httpOnly: true, // Must match lib/security/csrf.ts — cookie is server-side reference only
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24h
    });
    // Expose token via response header so client JS can read it for X-CSRF-Token
    response.headers.set('X-CSRF-Token', csrfToken);
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|\\.well-known|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff|woff2|ttf|otf|eot)$).*)',
  ],
};
