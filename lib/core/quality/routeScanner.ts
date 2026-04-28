/**
 * Automated Route Scanner
 *
 * Scans ALL /app/api/** routes and verifies:
 * - Protected routes call requireAuthGuard() or requireAuth()
 * - Tenant filtering is enforced (withTenantFilter or equivalent)
 * - Platform/permission checks are present where required
 * - No route accepts tenantId from client input
 *
 * NOTE: This file uses Node.js `fs` APIs (readFileSync, readdirSync) for static
 * code analysis. It does NOT use MongoDB or any database — no migration needed.
 * The only change is removing the MongoDB-related pattern strings from the scanner
 * to also recognise Prisma patterns.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

export interface RouteViolation {
  route: string;
  type: 'missing_auth' | 'missing_tenant_filter' | 'tenant_id_from_client' | 'missing_platform_check' | 'missing_permission_check';
  severity: 'critical' | 'high' | 'medium';
  message: string;
  line?: number;
  codeSnippet?: string;
}

export interface RouteScanResult {
  route: string;
  filePath: string;
  violations: RouteViolation[];
  hasAuth: boolean;
  hasTenantFilter: boolean;
  acceptsTenantIdFromClient: boolean;
  hasPlatformCheck: boolean;
  hasPermissionCheck: boolean;
}

/**
 * Check if a route file is public (doesn't require auth)
 */
function isPublicRoute(routePath: string): boolean {
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/identify',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/health',
    '/api/init',
    '/api/thea-engine/health',
    '/api/sam/thea-engine/health',
    '/api/quality/verify',
  ];

  const normalizedPath = routePath.startsWith('/api') ? routePath : `/api${routePath}`;
  return publicRoutes.some(publicRoute => normalizedPath === publicRoute || normalizedPath.startsWith(publicRoute));
}

/**
 * Check if a route is test-only
 */
function isTestOnlyRoute(routePath: string): boolean {
  const testRoutes = ['/api/test/seed'];
  return testRoutes.some(testRoute => routePath.includes(testRoute));
}

/**
 * Check if a route is an owner route
 */
function isOwnerRoute(routePath: string): boolean {
  if (routePath.startsWith('/api/owner/tenants/') && routePath.includes('[tenantId]')) {
    return true;
  }
  if (routePath === '/api/[[...path]]' || routePath.includes('[[...path]]')) {
    return true;
  }
  return false;
}

/**
 * Scan a single route file
 */
function scanRouteFile(filePath: string, routePath: string): RouteScanResult {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const result: RouteScanResult = {
    route: routePath,
    filePath: relative(process.cwd(), filePath),
    violations: [],
    hasAuth: false,
    hasTenantFilter: false,
    acceptsTenantIdFromClient: false,
    hasPlatformCheck: false,
    hasPermissionCheck: false,
  };

  if (isPublicRoute(routePath)) {
    return result;
  }

  if (isTestOnlyRoute(routePath)) {
    const hasTestModeCheck = /Thea_TEST_MODE|NODE_ENV.*===.*['"]test['"]|NODE_ENV.*===.*['"]production['"]/i.test(content);
    const hasTestSecretCheck = /x-test-secret/i.test(content) || /TEST_SECRET/i.test(content);
    const hasProductionBlock = /isProduction|NODE_ENV.*===.*['"]production['"]/i.test(content);

    if (!hasTestModeCheck || !hasTestSecretCheck || !hasProductionBlock) {
      result.violations.push({
        route: routePath,
        type: 'missing_auth',
        severity: 'high',
        message: 'Test-only route must be guarded by Thea_TEST_MODE check + x-test-secret header check + production block',
      });
    } else {
      result.hasAuth = true;
      const usesPlatformDb = /getPlatformCollection|prisma\./i.test(content);
      result.hasTenantFilter = usesPlatformDb;
    }
    return result;
  }

  // Check for authentication
  const hasRequireAuthGuard = /requireAuthGuard\s*\(/i.test(content);
  const hasRequireAuth = /requireAuth\s*\(/i.test(content) || /await\s+requireAuth\s*\(/i.test(content);
  const hasRequireAuthContext = /requireAuthContext\s*\(/i.test(content) || /await\s+requireAuthContext\s*\(/i.test(content);
  const hasRequireOwner = /requireOwner\s*\(/i.test(content);
  const hasRequireRole = /requireRole\s*\(/i.test(content) || /requireRoleAsync\s*\(/i.test(content);
  const hasWithAuthTenant = /withAuthTenant\s*\(/i.test(content);
  const hasGetTenantContext = /getTenantContextOrThrow\s*\(/i.test(content) || /getTenantContext\s*\(/i.test(content);
  const hasGetActiveTenantId = /getActiveTenantId\s*\(/i.test(content);
  const hasRequireRoleImport = /from\s+['"]@\/lib\/(rbac|auth\/requireRole)/i.test(content);
  const usesRequireRole = hasRequireRoleImport && /requireRole\s*\(/i.test(content);

  const hasAuthImport = /from\s+['"]@\/lib\/(auth|security|core\/guards)\//i.test(content) &&
                       /requireAuth|requireAuthGuard|requireAuthContext|requireOwner|withAuthTenant/i.test(content);

  const hasActiveTenantIdWithAuth = hasGetActiveTenantId && hasRequireAuth;

  result.hasAuth = hasRequireAuthGuard || hasRequireAuth || hasRequireAuthContext || hasRequireOwner ||
                   hasWithAuthTenant || hasGetTenantContext || hasActiveTenantIdWithAuth ||
                   hasRequireRole || usesRequireRole ||
                   (hasRequireRole && hasAuthImport);

  if (!result.hasAuth && !isPublicRoute(routePath)) {
    const isGetOnly = /export\s+async\s+function\s+GET/i.test(content) &&
                     !/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/i.test(content);

    const needsAuth = routePath.includes('/api/owner') || routePath.includes('/api/admin');

    if (needsAuth || (!isGetOnly && !routePath.includes('/health'))) {
      result.violations.push({
        route: routePath,
        type: 'missing_auth',
        severity: 'critical',
        message: 'Protected route does not call requireAuthGuard(), requireAuth(), requireAuthContext(), or requireOwner()',
      });
    }
  }

  // Check for tenant filtering — recognise both MongoDB and Prisma patterns
  const hasWithTenantFilter = /withTenantFilter\s*\(/i.test(content);
  const hasCreateTenantQuery = /createTenantQuery\s*\(/i.test(content);
  const hasEnforceDataScope = /enforceDataScope\s*\(/i.test(content);

  const hasTenantIdFromTenantId = /tenantId\s*:\s*tenantId/i.test(content);
  const hasTenantIdFromActiveTenantIdVar = /tenantId\s*:\s*activeTenantId|\{\s*tenantId\s*:\s*activeTenantId\s*\}/i.test(content);
  const hasTenantIdFromVariable = /tenantId\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[,\}]/i.test(content);
  const hasTenantFilterVariable = /(const|let|var)\s+tenantFilter\s*=/i.test(content) ||
                                  /tenantFilter\s*[:=]/i.test(content) ||
                                  /\.\.\.\s*tenantFilter/i.test(content) ||
                                  /\{.*tenantFilter|tenantFilter\s*\{|\{\s*\.\.\.\s*tenantFilter/i.test(content);
  const hasTenantIdInOrPattern = /\$\s*or\s*:.*tenantId|tenantId.*\$\s*or|\{\s*\$or\s*:.*tenantId|tenantFilter.*\$or|\$or.*tenantFilter/i.test(content);
  const hasTenantIdAnywhereInQuery = /tenantId\s*:/i.test(content) &&
                                     (/tenantId|activeTenantId|tenantContext/i.test(content));

  // Prisma-specific patterns
  const hasPrismaWhereTenant = /where\s*:\s*\{[^}]*tenantId/i.test(content);
  const hasPrismaFindWithTenant = /prisma\.\w+\.find(First|Many|Unique)\s*\(\s*\{[^}]*where\s*:\s*\{[^}]*tenantId/im.test(content);

  const hasTenantIdInQuery = hasTenantIdFromTenantId || hasTenantIdFromActiveTenantIdVar ||
                             hasTenantIdFromVariable || hasTenantFilterVariable || hasTenantIdInOrPattern ||
                             hasTenantIdAnywhereInQuery || hasPrismaWhereTenant || hasPrismaFindWithTenant;

  const usesTenantDb = /getTenantDb|getTenantClient|getTenantDbByKey|getTenantCollection|getTenantDbFromRequest/i.test(content);

  const isOwnerApiRoute = routePath.startsWith('/api/owner');

  const hasAnyAuth = hasRequireAuth || hasRequireRole || hasGetActiveTenantId || hasActiveTenantIdWithAuth ||
                    hasGetTenantContext || hasRequireAuthContext || hasRequireOwner;
  const hasAnyValidPattern = hasTenantFilterVariable || hasTenantIdInOrPattern || hasTenantIdFromActiveTenantIdVar ||
                             hasTenantIdInQuery || hasTenantIdAnywhereInQuery || hasPrismaWhereTenant;
  const hasUltraLenientPattern = hasAnyAuth && hasAnyValidPattern;

  result.hasTenantFilter = hasWithTenantFilter || hasCreateTenantQuery || hasEnforceDataScope ||
                          hasWithAuthTenant ||
                          usesTenantDb ||
                          hasUltraLenientPattern ||
                          (hasTenantFilterVariable && hasAnyAuth) ||
                          isOwnerApiRoute;

  // Check if route accepts tenantId from client (BAD)
  const acceptsTenantIdFromQuery = /searchParams\.(get|has)\s*\(\s*['"]tenantId['"]/i.test(content) ||
                                  /request\.nextUrl\.searchParams\.(get|has)\s*\(\s*['"]tenantId['"]/i.test(content);

  const acceptsTenantIdFromBody = /body\.tenantId/i.test(content) ||
                                 /request\.json\s*\(\s*\)\s*\.then\s*\([^)]*tenantId/i.test(content) ||
                                 /const\s*{\s*tenantId[^}]*}\s*=\s*await\s*request\.json/i.test(content);

  const acceptsTenantIdFromParams = /params\.tenantId/i.test(content) ||
                                    /\[tenantId\]/i.test(routePath) &&
                                    /const\s*{\s*tenantId[^}]*}\s*=\s*params/i.test(content);

  const isOwnerTenantRoute = isOwnerRoute(routePath);

  result.acceptsTenantIdFromClient = (acceptsTenantIdFromQuery || acceptsTenantIdFromBody ||
                                     (acceptsTenantIdFromParams && !isOwnerTenantRoute));

  const isOwnerRouteWithAuth = isOwnerTenantRoute && (hasRequireOwner ||
                                                      (hasWithAuthTenant && /ownerScoped\s*:\s*true/i.test(content)));

  if (result.acceptsTenantIdFromClient && !isOwnerRouteWithAuth) {
    let lineNumber: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      if (acceptsTenantIdFromQuery && /searchParams.*tenantId/i.test(lines[i])) {
        lineNumber = i + 1;
        break;
      }
      if (acceptsTenantIdFromBody && /body.*tenantId/i.test(lines[i])) {
        lineNumber = i + 1;
        break;
      }
      if (acceptsTenantIdFromParams && !isOwnerTenantRoute && /params.*tenantId/i.test(lines[i])) {
        lineNumber = i + 1;
        break;
      }
    }

    result.violations.push({
      route: routePath,
      type: 'tenant_id_from_client',
      severity: 'critical',
      message: 'Route accepts tenantId from client input (query, body, or params). tenantId MUST come from JWT only. Owner routes must use requireOwner() or withAuthTenant({ ownerScoped: true }).',
      line: lineNumber,
      codeSnippet: lineNumber ? lines[lineNumber - 1]?.trim() : undefined,
    });
  } else if (isOwnerTenantRoute && !isOwnerRouteWithAuth) {
    result.violations.push({
      route: routePath,
      type: 'missing_permission_check',
      severity: 'critical',
      message: 'Owner route that accepts tenantId from params must validate owner role with requireOwner() or withAuthTenant({ ownerScoped: true })',
    });
  }

  // Check for platform checks
  if (routePath.includes('/sam/') || routePath.includes('/thea-health/') ||
      routePath.includes('/cvision/') || routePath.includes('/edrac/')) {
    const hasRequirePlatform = /requirePlatform\s*\(/i.test(content);
    const hasPlatformKeyInWrapper = hasWithAuthTenant &&
                                    /platformKey\s*:\s*['"](sam|thea-health|cvision|edrac)['"]/i.test(content);
    result.hasPlatformCheck = hasRequirePlatform || hasPlatformKeyInWrapper;

    if (!result.hasPlatformCheck) {
      result.violations.push({
        route: routePath,
        type: 'missing_platform_check',
        severity: 'high',
        message: 'Platform-specific route does not call requirePlatform() or use withAuthTenant({ platformKey })',
      });
    }
  }

  // Check for permission checks
  if (routePath.includes('/admin/') || routePath.includes('/owner/')) {
    const hasRequirePermission = /requirePermission\s*\(/i.test(content);
    const hasRequireOwnerCheck = /requireOwner\s*\(/i.test(content) ||
                           (hasWithAuthTenant && /ownerScoped\s*:\s*true/i.test(content));
    const hasRequireRoleCheck = /requireRole\s*\(/i.test(content);
    const hasPermissionKeyInWrapper = hasWithAuthTenant &&
                                     /permissionKey\s*:\s*['"][^'"]+['"]/i.test(content);

    const hasManualRoleCheck = /userRole\s*[!=<>]|userRole\s*in\s*\[|\.includes\s*\(\s*userRole|userRole\s*\)\s*in\s*\[|\['"][^'"]+['"]\]\.includes\s*\(\s*userRole/i.test(content) &&
                              /status\s*:\s*403|error\s*:\s*['"]Forbidden/i.test(content);
    const hasManualRoleCheckWithArray = /!?\s*\['"][^'"]+['"]\s*\]\s*\.\s*includes\s*\(\s*userRole|userRole\s*\)\s*in\s*\[|userRole\s*[!=<>]|isPlatformRole/i.test(content) &&
                                        (hasRequireAuth || hasRequireAuthContext || hasGetTenantContext);

    result.hasPermissionCheck = hasRequirePermission || hasRequireOwnerCheck || hasRequireRoleCheck ||
                               hasPermissionKeyInWrapper || hasManualRoleCheck || hasManualRoleCheckWithArray;

    if (!result.hasPermissionCheck && !hasRequireOwnerCheck) {
      result.violations.push({
        route: routePath,
        type: 'missing_permission_check',
        severity: 'high',
        message: 'Admin/Owner route does not call requirePermission(), requireOwner(), requireRole(), or use withAuthTenant({ permissionKey })',
      });
    }
  }

  if (isPublicRoute(routePath)) {
    result.hasTenantFilter = true;
    return result;
  }

  // Check for tenant filter in database queries
  if (result.hasAuth && !result.hasTenantFilter) {
    const hasDbQuery = /\.findOne\s*\(/i.test(content) ||
                      /\.find\s*\(/i.test(content) ||
                      /\.insertOne\s*\(/i.test(content) ||
                      /\.updateOne\s*\(/i.test(content) ||
                      /\.deleteOne\s*\(/i.test(content) ||
                      /\.countDocuments\s*\(/i.test(content) ||
                      /\.aggregate\s*\(/i.test(content) ||
                      /prisma\.\w+\.(findFirst|findMany|findUnique|create|update|delete|count)\s*\(/i.test(content);

    if (hasDbQuery) {
      const isOwnerApiRouteCheck = routePath.startsWith('/api/owner');
      const isTestOnly = isTestOnlyRoute(routePath);
      const accessesPlatformDb = /getPlatformCollection/i.test(content);
      const usesTenantDbCheck = /getTenantDb|getTenantClient|getTenantDbByKey|getTenantCollection|getTenantDbFromRequest/i.test(content);

      const hasValidTenantScoping = result.hasTenantFilter ||
                                    usesTenantDbCheck ||
                                    accessesPlatformDb;

      if (!isOwnerApiRouteCheck && !isTestOnly && !hasValidTenantScoping) {
        result.violations.push({
          route: routePath,
          type: 'missing_tenant_filter',
          severity: 'critical',
          message: 'Route makes database queries but does not enforce tenant filtering. Use withAuthTenant(), withTenantFilter(), createTenantQuery(), getTenantDb(), prisma with tenantId in where clause, or add tenantId to queries.',
        });
      }
    }
  }

  // Owner routes validation
  if (routePath.startsWith('/api/owner/')) {
    const hasOwnerCheck = hasRequireOwner || (hasWithAuthTenant && /ownerScoped\s*:\s*true/i.test(content));
    if (!hasOwnerCheck) {
      result.violations.push({
        route: routePath,
        type: 'missing_permission_check',
        severity: 'critical',
        message: 'Owner route must call requireOwner() or use withAuthTenant({ ownerScoped: true })',
      });
    }
  }

  return result;
}

/**
 * Recursively scan all route files in app/api
 */
export function scanAllRoutes(apiDir: string = 'app/api'): RouteScanResult[] {
  const results: RouteScanResult[] = [];
  const basePath = join(process.cwd(), apiDir);

  function scanDirectory(dir: string, routePrefix: string = '/api'): void {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        const segment = entry.startsWith('[') && entry.endsWith(']')
          ? `[${entry.slice(1, -1)}]`
          : entry;
        scanDirectory(fullPath, `${routePrefix}/${segment}`);
      } else if (entry === 'route.ts' || entry === 'route.js') {
        const routePath = routePrefix;
        const scanResult = scanRouteFile(fullPath, routePath);
        results.push(scanResult);
      }
    }
  }

  scanDirectory(basePath, '/api');

  return results;
}

/**
 * Generate a summary report
 */
export function generateScanReport(results: RouteScanResult[]): {
  totalRoutes: number;
  routesWithViolations: number;
  criticalViolations: number;
  highViolations: number;
  mediumViolations: number;
  violations: RouteViolation[];
  summary: string;
} {
  const violations: RouteViolation[] = [];
  let routesWithViolations = 0;
  let criticalViolations = 0;
  let highViolations = 0;
  let mediumViolations = 0;

  for (const scanResult of results) {
    if (scanResult.violations.length > 0) {
      routesWithViolations++;
      violations.push(...scanResult.violations);

      for (const violation of scanResult.violations) {
        if (violation.severity === 'critical') criticalViolations++;
        else if (violation.severity === 'high') highViolations++;
        else if (violation.severity === 'medium') mediumViolations++;
      }
    }
  }

  const summary = `
Route Security Scan Report
==========================
Total Routes Scanned: ${results.length}
Routes with Violations: ${routesWithViolations}
Critical Violations: ${criticalViolations}
High Violations: ${highViolations}
Medium Violations: ${mediumViolations}

${criticalViolations > 0 || highViolations > 0
  ? 'SECURITY CHECKS FAILED - DO NOT DEPLOY'
  : 'All security checks passed'}
  `.trim();

  return {
    totalRoutes: results.length,
    routesWithViolations,
    criticalViolations,
    highViolations,
    mediumViolations,
    violations,
    summary,
  };
}
