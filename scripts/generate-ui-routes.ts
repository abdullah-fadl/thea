#!/usr/bin/env tsx

/**
 * Generate UI Route Inventory
 * 
 * Scans Next.js App Router structure and generates:
 * - ui-routes.json (all page routes)
 * - ui-routes.meta.json (route metadata)
 * - UI_CRAWL_ROUTE_REPORT.md (report)
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface RouteInfo {
  path: string;
  filePath: string;
  isDynamic: boolean;
  dynamicParams: string[];
  placeholders?: Record<string, string>;
  excludeReason?: string;
  tags?: string[];
}

interface RouteMetadata {
  path: string;
  filePath: string;
  isDynamic: boolean;
  dynamicParams: string[];
  placeholders?: Record<string, string>;
  tags?: string[];
  expectedAccess: 'public' | 'authenticated' | 'admin' | 'owner' | 'platform-specific';
  platform?: 'sam' | 'health' | 'any';
}

// Test data IDs for placeholders
const TEST_DATA_IDS = {
  tenantId: ['test-tenant-a', 'test-tenant-nosam'],
  id: 'test-id-placeholder', // Generic ID placeholder
  // Add more as needed
};

/**
 * Convert file path to route path
 * e.g., app/(dashboard)/policies/page.tsx -> /policies
 */
function filePathToRoute(filePath: string, appDir: string = 'app'): string {
  // Remove app/ prefix
  let route = filePath.replace(new RegExp(`^${appDir}/`), '');
  
  // Remove (dashboard) route groups
  route = route.replace(/\([^)]+\)\//g, '');
  
  // Remove /page.tsx
  route = route.replace(/\/page\.tsx$/, '');
  
  // Handle root page
  if (route === 'page' || route === '' || route === 'page.tsx') {
    return '/';
  }
  
  // Convert to URL path
  route = '/' + route;
  
  // Normalize multiple slashes
  route = route.replace(/\/+/g, '/');
  
  // Handle dynamic segments: [param] -> :param
  route = route.replace(/\[([^\]]+)\]/g, '[$1]');
  
  return route;
}

/**
 * Extract dynamic parameters from route path
 */
function extractDynamicParams(route: string): string[] {
  const matches = route.matchAll(/\[([^\]]+)\]/g);
  return Array.from(matches, m => m[1]);
}

/**
 * Generate placeholder values for dynamic parameters
 */
function generatePlaceholders(dynamicParams: string[]): Record<string, string> | undefined {
  if (dynamicParams.length === 0) return undefined;
  
  const placeholders: Record<string, string> = {};
  
  for (const param of dynamicParams) {
    // Try to match common patterns
    if (param.toLowerCase().includes('tenant')) {
      placeholders[param] = TEST_DATA_IDS.tenantId[0];
    } else if (param.toLowerCase() === 'id') {
      placeholders[param] = TEST_DATA_IDS.id;
    } else {
      // For unknown params, use a generic placeholder
      // Mark as manual if we can't determine a good value
      placeholders[param] = `PLACEHOLDER_${param.toUpperCase()}`;
    }
  }
  
  return placeholders;
}

/**
 * Determine if route should be excluded from crawl
 */
function shouldExcludeRoute(route: string, filePath: string): { exclude: boolean; reason?: string } {
  // Exclude catch-all routes that require manual testing
  if (route.includes('[[...')) {
    return { exclude: true, reason: 'Catch-all route requires manual testing' };
  }
  
  // Exclude routes with complex dynamic params we can't handle
  const dynamicParams = extractDynamicParams(route);
  const placeholders = generatePlaceholders(dynamicParams);
  
  // Check if we have generic placeholders (couldn't determine proper values)
  if (placeholders) {
    for (const [param, value] of Object.entries(placeholders)) {
      if (value.startsWith('PLACEHOLDER_')) {
        return { exclude: true, reason: `Dynamic param '${param}' requires manual placeholder determination` };
      }
    }
  }
  
  return { exclude: false };
}

/**
 * Determine route tags and metadata
 */
function getRouteMetadata(route: string, filePath: string): Partial<RouteMetadata> {
  const tags: string[] = [];
  let expectedAccess: RouteMetadata['expectedAccess'] = 'authenticated';
  let platform: RouteMetadata['platform'] = 'any';
  
  // Platform detection
  if (filePath.includes('/sam/')) {
    platform = 'sam';
    tags.push('platform:sam');
  } else if (filePath.includes('/nursing/') || filePath.includes('/opd/') || filePath.includes('/er/')) {
    platform = 'health';
    tags.push('platform:health');
  }
  
  // Access level detection
  if (route === '/' || route === '/login' || route === '/welcome' || route === '/platforms') {
    expectedAccess = 'public';
    tags.push('access:public');
  } else if (filePath.includes('/admin/') || route.startsWith('/admin')) {
    expectedAccess = 'admin';
    tags.push('access:admin');
  } else if (filePath.includes('/owner/') || route.startsWith('/owner')) {
    expectedAccess = 'owner';
    tags.push('access:owner');
  } else {
    tags.push('access:authenticated');
  }
  
  return { expectedAccess, platform, tags };
}

/**
 * Scan app directory for page routes
 */
async function scanRoutes(appDir: string = 'app'): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];
  
  // Find all page.tsx files
  const pageFiles = await glob(`${appDir}/**/page.tsx`, {
    ignore: ['**/node_modules/**', '**/.next/**', '**/api/**'],
  });
  
  for (const filePath of pageFiles) {
    const route = filePathToRoute(filePath, appDir);
    const dynamicParams = extractDynamicParams(route);
    const isDynamic = dynamicParams.length > 0;
    const { exclude, reason } = shouldExcludeRoute(route, filePath);
    
    const routeInfo: RouteInfo = {
      path: route,
      filePath,
      isDynamic,
      dynamicParams,
    };
    
    if (exclude) {
      routeInfo.excludeReason = reason;
    } else if (isDynamic) {
      routeInfo.placeholders = generatePlaceholders(dynamicParams);
    }
    
    // Add metadata
    const metadata = getRouteMetadata(route, filePath);
    routeInfo.tags = metadata.tags;
    
    routes.push(routeInfo);
  }
  
  // Sort routes (static first, then dynamic)
  routes.sort((a, b) => {
    if (a.isDynamic !== b.isDynamic) {
      return a.isDynamic ? 1 : -1;
    }
    return a.path.localeCompare(b.path);
  });
  
  return routes;
}

/**
 * Generate route URL with placeholders filled
 */
function generateRouteUrl(route: RouteInfo): string {
  let url = route.path;
  
  if (route.isDynamic && route.placeholders) {
    for (const [param, value] of Object.entries(route.placeholders)) {
      url = url.replace(`[${param}]`, value);
    }
  }
  
  return url;
}

/**
 * Generate report markdown
 */
function generateReport(routes: RouteInfo[]): string {
  const crawled = routes.filter(r => !r.excludeReason);
  const excluded = routes.filter(r => r.excludeReason);
  const staticRoutes = crawled.filter(r => !r.isDynamic);
  const dynamicRoutes = crawled.filter(r => r.isDynamic);
  
  let report = `# UI Crawl Route Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total Routes:** ${routes.length}\n`;
  report += `- **Crawled Routes:** ${crawled.length}\n`;
  report += `  - Static: ${staticRoutes.length}\n`;
  report += `  - Dynamic: ${dynamicRoutes.length}\n`;
  report += `- **Excluded Routes:** ${excluded.length}\n\n`;
  
  if (excluded.length > 0) {
    report += `## Excluded Routes\n\n`;
    report += `| Route | Reason |\n`;
    report += `|-------|--------|\n`;
    for (const route of excluded) {
      report += `| \`${route.path}\` | ${route.excludeReason} |\n`;
    }
    report += `\n`;
  }
  
  report += `## Route Breakdown\n\n`;
  report += `### Static Routes (${staticRoutes.length})\n\n`;
  for (const route of staticRoutes) {
    report += `- \`${route.path}\`\n`;
  }
  report += `\n`;
  
  report += `### Dynamic Routes (${dynamicRoutes.length})\n\n`;
  for (const route of dynamicRoutes) {
    report += `- \`${route.path}\`\n`;
    if (route.placeholders) {
      report += `  - Placeholders: ${JSON.stringify(route.placeholders)}\n`;
    }
    report += `  - Generated URL: \`${generateRouteUrl(route)}\`\n`;
  }
  report += `\n`;
  
  return report;
}

/**
 * Main function
 */
async function main() {
  const appDir = path.join(process.cwd(), 'app');
  
  console.log('🔍 Scanning app directory for routes...');
  const routes = await scanRoutes(appDir);
  
  console.log(`✅ Found ${routes.length} routes`);
  
  // Generate JSON outputs
  const outputDir = process.cwd();
  
  // ui-routes.json (routes with placeholders for crawl)
  const crawledRoutes = routes
    .filter(r => !r.excludeReason)
    .map(r => ({
      path: r.path,
      url: generateRouteUrl(r),
      isDynamic: r.isDynamic,
      dynamicParams: r.dynamicParams,
      placeholders: r.placeholders,
      tags: r.tags,
    }));
  
  fs.writeFileSync(
    path.join(outputDir, 'ui-routes.json'),
    JSON.stringify(crawledRoutes, null, 2)
  );
  console.log(`✅ Generated ui-routes.json (${crawledRoutes.length} routes)`);
  
  // ui-routes.meta.json (full metadata)
  const metadata = routes.map(r => ({
    path: r.path,
    filePath: r.filePath,
    isDynamic: r.isDynamic,
    dynamicParams: r.dynamicParams,
    placeholders: r.placeholders,
    excludeReason: r.excludeReason,
    tags: r.tags,
    ...getRouteMetadata(r.path, r.filePath),
  }));
  
  fs.writeFileSync(
    path.join(outputDir, 'ui-routes.meta.json'),
    JSON.stringify(metadata, null, 2)
  );
  console.log(`✅ Generated ui-routes.meta.json (${metadata.length} routes)`);
  
  // UI_CRAWL_ROUTE_REPORT.md
  const report = generateReport(routes);
  fs.writeFileSync(
    path.join(outputDir, 'UI_CRAWL_ROUTE_REPORT.md'),
    report
  );
  console.log(`✅ Generated UI_CRAWL_ROUTE_REPORT.md`);
  
  console.log('\n🎉 Route inventory generation complete!');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
