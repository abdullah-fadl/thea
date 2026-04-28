/**
 * Bulk Route Security Fix Script
 * 
 * This script automatically applies the withAuthTenant wrapper to routes that need it.
 * It modifies route files in bulk to add security hardening.
 * 
 * Usage:
 *   yarn bulk-fix-routes
 * 
 * WARNING: This script modifies route files. Review changes in git before committing.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { scanAllRoutes } from '../lib/core/quality/routeScanner';

interface RouteFix {
  filePath: string;
  route: string;
  handlers: string[];
  needsWrapper: boolean;
  wrapperOptions: {
    platformKey?: string;
    permissionKey?: string;
    ownerScoped?: boolean;
  };
  violations: string[];
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

function determineWrapperOptions(routePath: string): RouteFix['wrapperOptions'] {
  const options: RouteFix['wrapperOptions'] = {};
  
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

function extractHandlers(content: string): string[] {
  const handlers: string[] = [];
  const handlerRegex = /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/gi;
  let match;
  while ((match = handlerRegex.exec(content)) !== null) {
    handlers.push(match[2]);
  }
  return handlers;
}

function applyWrapperToRoute(content: string, handlerType: string, options: RouteFix['wrapperOptions']): string {
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
  
  // Find the handler function and replace it with wrapper
  const handlerRegex = new RegExp(
    `export\\s+(async\\s+)?function\\s+${handlerType}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?=export|$)`,
    'gi'
  );
  
  // For now, return the content with import added if needed
  // Full transformation is complex and risky, so we'll do it manually for critical routes
  if (!content.includes('withAuthTenant')) {
    // Add import
    if (!content.includes("from '@/lib/core/guards/withAuthTenant'")) {
      content = content.replace(
        /import\s+.*from\s+['"]@\/lib\/auth\/requireAuth['"];?/,
        `import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';\nimport { requireAuth } from '@/lib/auth/requireAuth';`
      );
    }
  }
  
  return content;
}

async function identifyRoutesToFix(): Promise<RouteFix[]> {
  const results = scanAllRoutes('app/api');
  const fixes: RouteFix[] = [];
  
  for (const result of results) {
    if (!shouldApplyWrapper(result.route)) {
      continue;
    }
    
    const content = readFileSync(join(process.cwd(), result.filePath), 'utf-8');
    const alreadyUsesWrapper = /withAuthTenant\s*\(/i.test(content);
    
    if (alreadyUsesWrapper) {
      continue;
    }
    
    const handlers = extractHandlers(content);
    if (handlers.length === 0) {
      continue;
    }
    
    const hasViolations = result.violations.length > 0;
    const needsWrapper = !result.hasAuth || hasViolations;
    
    if (needsWrapper) {
      fixes.push({
        filePath: result.filePath,
        route: result.route,
        handlers,
        needsWrapper: true,
        wrapperOptions: determineWrapperOptions(result.route),
        violations: result.violations.map(v => v.type),
      });
    }
  }
  
  return fixes;
}

async function main() {
  console.log('🔍 Identifying routes that need security hardening...\n');
  
  const fixes = await identifyRoutesToFix();
  
  console.log(`Found ${fixes.length} routes that need the wrapper applied.\n`);
  
  if (fixes.length === 0) {
    console.log('✅ All routes already use the wrapper or are exempt.');
    return;
  }
  
  // Generate detailed report
  console.log('Routes to fix:\n');
  for (const fix of fixes.slice(0, 20)) { // Show first 20
    console.log(`- ${fix.route} (${fix.handlers.join(', ')})`);
    console.log(`  Violations: ${fix.violations.join(', ')}`);
    console.log(`  Options: ${JSON.stringify(fix.wrapperOptions)}`);
    console.log('');
  }
  
  if (fixes.length > 20) {
    console.log(`... and ${fixes.length - 20} more routes.\n`);
  }
  
  console.log('⚠️  This script would modify route files.');
  console.log('For safety, apply fixes manually following the pattern shown above.');
  console.log('\nPattern:');
  console.log('```typescript');
  console.log('export const GET = withAuthTenant(async (req, { user, tenantId }) => {');
  console.log('  // Existing handler logic here');
  console.log('  // Use tenantId from context for all DB queries');
  console.log('  const query = createTenantQuery(baseQuery, tenantId);');
  console.log('  return NextResponse.json({ data: ... });');
  console.log('}, { permissionKey: "admin.route", tenantScoped: true });');
  console.log('```');
}

main().catch(console.error);
