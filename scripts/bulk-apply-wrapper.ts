/**
 * Bulk Security Wrapper Application Script
 * 
 * This script applies the withAuthTenant wrapper to API routes in bulk.
 * It modifies route files to use the centralized wrapper instead of manual auth checks.
 * 
 * Usage:
 *   yarn bulk-apply-wrapper
 * 
 * WARNING: This script modifies route files. Review changes before committing.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { scanAllRoutes } from '../lib/core/quality/routeScanner';

interface RouteModification {
  filePath: string;
  route: string;
  needsWrapper: boolean;
  wrapperOptions: {
    platformKey?: string;
    permissionKey?: string;
    ownerScoped?: boolean;
  };
  currentHandler?: string; // Current handler signature
}

const routePatterns = [
  '/admin/**',
  '/structure/**',
  '/sam/**',
  '/policies/**',
  '/notifications/**',
  '/opd/**',
  '/nursing/**',
  '/patient-experience/**',
  '/risk-detector/**',
  '/integrations/**',
  '/er/**',
  '/ai/**',
];

function shouldApplyWrapper(routePath: string): boolean {
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/identify',
    '/api/auth/refresh',
    '/api/health',
    '/api/test/seed',
  ];
  
  if (publicRoutes.some(r => routePath.includes(r))) {
    return false;
  }
  
  return routePatterns.some(pattern => {
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]+'));
    return regex.test(routePath);
  }) || routePath.startsWith('/api/owner/');
}

function determineWrapperOptions(routePath: string): RouteModification['wrapperOptions'] {
  const options: RouteModification['wrapperOptions'] = {};
  
  if (routePath.includes('/sam/')) {
    options.platformKey = 'sam';
  } else if (routePath.includes('/thea-health/')) {
    options.platformKey = 'thea-health';
  } else if (routePath.includes('/cvision/')) {
    options.platformKey = 'cvision';
  } else if (routePath.includes('/edrac/')) {
    options.platformKey = 'edrac';
  }
  
  if (routePath.startsWith('/api/owner/')) {
    options.ownerScoped = true;
  }
  
  if (routePath.includes('/admin/')) {
    const routeName = routePath.split('/').pop() || '';
    options.permissionKey = `admin.${routeName}`;
  }
  
  return options;
}

function extractHandlerSignatures(content: string): string[] {
  const handlers: string[] = [];
  
  // Match export async function GET/POST/PUT/PATCH/DELETE
  const handlerRegex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/gi;
  let match;
  while ((match = handlerRegex.exec(content)) !== null) {
    handlers.push(match[1]);
  }
  
  return handlers;
}

function generateWrapperCode(handlerType: string, options: RouteModification['wrapperOptions']): string {
  const { platformKey, permissionKey, ownerScoped } = options;
  
  const optionsObj: string[] = [];
  if (platformKey) {
    optionsObj.push(`platformKey: '${platformKey}'`);
  }
  if (permissionKey) {
    optionsObj.push(`permissionKey: '${permissionKey}'`);
  }
  if (ownerScoped) {
    optionsObj.push(`ownerScoped: true`);
  }
  if (!ownerScoped) {
    optionsObj.push(`tenantScoped: true`);
  }
  
  const optionsStr = optionsObj.length > 0 ? `{ ${optionsObj.join(', ')} }` : '{}';
  
  return `export const ${handlerType} = withAuthTenant(async (req, { user, tenantId }) => {
  // TODO: Migrate existing handler logic here
  // Use tenantId from context for all DB queries
  // Use createTenantQuery() helper for tenant-filtered queries
  \n  return NextResponse.json({ data: [] });
}, ${optionsStr});`;
}

async function analyzeRoutes(): Promise<RouteModification[]> {
  const results = scanAllRoutes('app/api');
  const modifications: RouteModification[] = [];
  
  for (const result of results) {
    if (!shouldApplyWrapper(result.route)) {
      continue;
    }
    
    // Check if route already uses wrapper
    const content = readFileSync(join(process.cwd(), result.filePath), 'utf-8');
    const alreadyUsesWrapper = /withAuthTenant\s*\(/i.test(content);
    
    if (alreadyUsesWrapper) {
      continue; // Skip routes that already use wrapper
    }
    
    const handlers = extractHandlerSignatures(content);
    if (handlers.length === 0) {
      continue; // Skip routes without handlers
    }
    
    const hasViolations = result.violations.length > 0;
    const needsWrapper = !result.hasAuth || hasViolations;
    
    if (needsWrapper) {
      for (const handler of handlers) {
        modifications.push({
          filePath: result.filePath,
          route: result.route,
          needsWrapper: true,
          wrapperOptions: determineWrapperOptions(result.route),
          currentHandler: handler,
        });
      }
    }
  }
  
  return modifications;
}

async function main() {
  console.log('🔍 Analyzing routes for bulk wrapper application...\n');
  
  const modifications = await analyzeRoutes();
  
  console.log(`Found ${modifications.length} route handlers that need the wrapper applied.\n`);
  
  if (modifications.length === 0) {
    console.log('✅ All routes already use the wrapper or are exempt.');
    return;
  }
  
  // Group by file (one file may have multiple handlers)
  const byFile: Record<string, RouteModification[]> = {};
  for (const mod of modifications) {
    if (!byFile[mod.filePath]) {
      byFile[mod.filePath] = [];
    }
    byFile[mod.filePath].push(mod);
  }
  
  console.log(`Found ${Object.keys(byFile).length} files to modify.\n`);
  console.log('WARNING: This script would modify route files.');
  console.log('Review the modifications below before applying.\n');
  
  // Generate report
  let report = '# Bulk Security Wrapper Application Report\n\n';
  report += `Total route handlers to modify: ${modifications.length}\n`;
  report += `Total files to modify: ${Object.keys(byFile).length}\n\n`;
  
  for (const [filePath, mods] of Object.entries(byFile)) {
    report += `## ${filePath}\n\n`;
    report += `Route: ${mods[0].route}\n\n`;
    
    for (const mod of mods) {
      report += `### Handler: ${mod.currentHandler}\n\n`;
      report += `Wrapper Options: ${JSON.stringify(mod.wrapperOptions, null, 2)}\n\n`;
      report += '```typescript\n';
      report += generateWrapperCode(mod.currentHandler || 'GET', mod.wrapperOptions);
      report += '\n```\n\n';
    }
  }
  
  // Write report
  const reportPath = join(process.cwd(), 'BULK_WRAPPER_APPLICATION_REPORT.md');
  writeFileSync(reportPath, report, 'utf-8');
  
  console.log(`✅ Generated report: ${reportPath}`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the report`);
  console.log(`2. Apply the wrapper to routes following the pattern`);
  console.log(`3. Update DB queries to use tenantId from context`);
  console.log(`4. Run yarn test:quality to verify`);
  console.log(`\n⚠️  This script does NOT automatically modify files.`);
  console.log(`   Manual application is required to ensure correctness.`);
}

main().catch(console.error);
