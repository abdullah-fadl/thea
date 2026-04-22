/**
 * Bulk Security Wrapper Application Script
 * 
 * This script helps identify routes that need the security wrapper applied.
 * It does NOT automatically modify routes (to avoid breaking changes),
 * but provides a report of routes to update.
 * 
 * Usage:
 *   yarn bulk-apply-security
 */

import { scanAllRoutes } from '../lib/core/quality/routeScanner';
import { writeFileSync } from 'fs';
import { join } from 'path';

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

interface RouteFixPlan {
  route: string;
  filePath: string;
  needsWrapper: boolean;
  wrapperOptions: {
    platformKey?: string;
    permissionKey?: string;
    ownerScoped?: boolean;
  };
  violations: string[];
}

function shouldApplyWrapper(routePath: string): boolean {
  // Skip public routes
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/identify',
    '/api/auth/refresh',
    '/api/health',
    '/api/init',
    '/api/test/seed',
  ];
  
  if (publicRoutes.some(r => routePath.includes(r))) {
    return false;
  }
  
  // Apply to routes matching patterns
  return routePatterns.some(pattern => {
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]+'));
    return regex.test(routePath);
  }) || routePath.startsWith('/api/owner/');
}

function determineWrapperOptions(routePath: string): RouteFixPlan['wrapperOptions'] {
  const options: RouteFixPlan['wrapperOptions'] = {};
  
  // Platform-specific routes
  if (routePath.includes('/sam/')) {
    options.platformKey = 'sam';
  } else if (routePath.includes('/thea-health/')) {
    options.platformKey = 'thea-health';
  } else if (routePath.includes('/cvision/')) {
    options.platformKey = 'cvision';
  } else if (routePath.includes('/edrac/')) {
    options.platformKey = 'edrac';
  }
  
  // Owner routes
  if (routePath.startsWith('/api/owner/')) {
    options.ownerScoped = true;
  }
  
  // Admin routes - need permission check
  if (routePath.includes('/admin/')) {
    // Permission key can be inferred from route path
    const routeName = routePath.split('/').pop() || '';
    options.permissionKey = `admin.${routeName}`;
  }
  
  return options;
}

async function generateFixPlan() {
  const results = scanAllRoutes('app/api');
  const fixPlan: RouteFixPlan[] = [];
  
  for (const result of results) {
    if (!shouldApplyWrapper(result.route)) {
      continue;
    }
    
    const hasViolations = result.violations.length > 0;
    const needsWrapper = !result.hasAuth || hasViolations;
    
    if (needsWrapper) {
      fixPlan.push({
        route: result.route,
        filePath: result.filePath,
        needsWrapper: true,
        wrapperOptions: determineWrapperOptions(result.route),
        violations: result.violations.map(v => v.type),
      });
    }
  }
  
  return fixPlan;
}

async function main() {
  console.log('🔍 Analyzing routes for bulk security wrapper application...\n');
  
  const fixPlan = await generateFixPlan();
  
  console.log(`Found ${fixPlan.length} routes that need the security wrapper applied.\n`);
  
  // Group by category
  const byCategory: Record<string, RouteFixPlan[]> = {
    'admin': [],
    'structure': [],
    'sam': [],
    'policies': [],
    'notifications': [],
    'opd': [],
    'nursing': [],
    'patient-experience': [],
    'risk-detector': [],
    'integrations': [],
    'er': [],
    'ai': [],
    'owner': [],
    'other': [],
  };
  
  for (const plan of fixPlan) {
    let category = 'other';
    if (plan.route.includes('/admin/')) category = 'admin';
    else if (plan.route.includes('/structure/')) category = 'structure';
    else if (plan.route.includes('/sam/')) category = 'sam';
    else if (plan.route.includes('/policies/')) category = 'policies';
    else if (plan.route.includes('/notifications/')) category = 'notifications';
    else if (plan.route.includes('/opd/')) category = 'opd';
    else if (plan.route.includes('/nursing/')) category = 'nursing';
    else if (plan.route.includes('/patient-experience/')) category = 'patient-experience';
    else if (plan.route.includes('/risk-detector/')) category = 'risk-detector';
    else if (plan.route.includes('/integrations/')) category = 'integrations';
    else if (plan.route.includes('/er/')) category = 'er';
    else if (plan.route.includes('/ai/')) category = 'ai';
    else if (plan.route.includes('/owner/')) category = 'owner';
    
    byCategory[category].push(plan);
  }
  
  // Generate report
  let report = '# Bulk Security Wrapper Application Report\n\n';
  report += `Total routes needing wrapper: ${fixPlan.length}\n\n`;
  
  for (const [category, plans] of Object.entries(byCategory)) {
    if (plans.length === 0) continue;
    
    report += `## ${category.toUpperCase()} Routes (${plans.length})\n\n`;
    
    for (const plan of plans) {
      report += `### ${plan.route}\n`;
      report += `File: ${plan.filePath}\n`;
      report += `Violations: ${plan.violations.join(', ')}\n`;
      report += `Wrapper Options: ${JSON.stringify(plan.wrapperOptions, null, 2)}\n\n`;
      
      // Generate code snippet
      const optionsStr = JSON.stringify(plan.wrapperOptions, null, 2).replace(/\n/g, '\n  ');
      report += '```typescript\n';
      report += `export const GET = withAuthTenant(async (req, { user, tenantId }) => {\n`;
      report += `  // TODO: Migrate existing handler logic here\n`;
      report += `  // Use tenantId from context for all DB queries\n`;
      report += `  // Use createTenantQuery() helper for tenant-filtered queries\n`;
      report += `  \n`;
      report += `  return NextResponse.json({ data: ... });\n`;
      report += `}, ${optionsStr});\n`;
      report += '```\n\n';
    }
  }
  
  // Write report
  const reportPath = join(process.cwd(), 'BULK_SECURITY_MIGRATION_REPORT.md');
  writeFileSync(reportPath, report, 'utf-8');
  
  console.log(`✅ Generated migration report: ${reportPath}`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the report`);
  console.log(`2. Apply withAuthTenant wrapper to routes following the pattern`);
  console.log(`3. Update DB queries to use tenantId from context`);
  console.log(`4. Run yarn test:quality to verify`);
}

main().catch(console.error);
