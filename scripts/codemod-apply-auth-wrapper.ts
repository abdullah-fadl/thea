#!/usr/bin/env ts-node

/**
 * Codemod: Bulk Apply withAuthTenant Wrapper
 * 
 * Automatically wraps API route handlers with withAuthTenant() wrapper
 * to enforce authentication and tenant isolation.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';

const API_DIR = 'app/api';
const TARGET_DIRS = [
  'admin',
  'structure',
  'sam',
  'policies',
  'risk-detector',
  'notifications',
  'opd',
  'nursing',
  'patient-experience',
  'integrations',
  'er',
  'ai',
];

const EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/identify',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/health',
  '/api/init',
  '/api/quality/verify',
  '/api/test/seed',
  '/api/thea-engine/health',
  '/api/sam/thea-engine/health',
];

interface RouteTransformResult {
  file: string;
  route: string;
  success: boolean;
  changes: string[];
  errors: string[];
  needsManualReview: boolean;
}

const results: RouteTransformResult[] = [];

/**
 * Get route path from file path
 */
function getRoutePath(filePath: string): string {
  const relativePath = relative(join(process.cwd(), API_DIR), filePath);
  const routePath = '/' + relativePath.replace(/\\/g, '/').replace('/route.ts', '').replace('/route.js', '');
  return routePath === '/api' ? '/api' : routePath;
}

/**
 * Check if route is exempt from transformation
 */
function isExemptRoute(routePath: string): boolean {
  return EXEMPT_ROUTES.some(exempt => routePath === exempt || routePath.startsWith(exempt));
}

/**
 * Determine wrapper options based on route path
 */
function getWrapperOptions(routePath: string): {
  tenantScoped: boolean;
  ownerScoped: boolean;
  platformKey?: string;
  permissionKey?: string;
} {
  const options: any = {
    tenantScoped: true,
    ownerScoped: false,
  };

  // SAM routes need platform check
  if (routePath.startsWith('/api/sam/')) {
    options.platformKey = 'sam';
  }

  // Admin routes need permission check
  if (routePath.startsWith('/api/admin/')) {
    options.permissionKey = `admin.${routePath.replace('/api/admin/', '').replace(/\//g, '.').replace(/\[.*?\]/g, 'id')}`;
    if (!options.permissionKey.endsWith('.')) {
      options.permissionKey = options.permissionKey + '.access';
    }
  }

  // Owner routes are owner-scoped, not tenant-scoped
  if (routePath.startsWith('/api/owner/')) {
    options.ownerScoped = true;
    options.tenantScoped = false;
  }

  return options;
}

/**
 * Check if handler is already wrapped
 */
function isAlreadyWrapped(content: string): boolean {
  return /withAuthTenant\s*\(/i.test(content) || /wrapRoute\s*\(/i.test(content);
}

/**
 * Check if route uses direct getCollection without tenant filtering
 */
function needsTenantFiltering(content: string): boolean {
  const hasGetCollection = /getCollection\s*\(/i.test(content);
  const hasTenantFilter = /tenantId|tenantFilter|getTenantCollection|getTenantDb|createTenantQuery/i.test(content);
  return hasGetCollection && !hasTenantFilter;
}

/**
 * Transform a route file
 */
function transformRouteFile(filePath: string, routePath: string): RouteTransformResult {
  const result: RouteTransformResult = {
    file: relative(process.cwd(), filePath),
    route: routePath,
    success: false,
    changes: [],
    errors: [],
    needsManualReview: false,
  };

  try {
    let content = readFileSync(filePath, 'utf-8');

    // Skip if already wrapped
    if (isAlreadyWrapped(content)) {
      result.success = true;
      result.changes.push('Already wrapped with withAuthTenant');
      return result;
    }

    // Skip exempt routes
    if (isExemptRoute(routePath)) {
      result.success = true;
      result.changes.push('Exempt route (public/auth/test)');
      return result;
    }

    // Get wrapper options
    const options = getWrapperOptions(routePath);

    // Check for imports
    const hasWithAuthTenantImport = /from\s+['"]@\/lib\/core\/guards\/withAuthTenant/i.test(content);
    const hasCreateTenantQueryImport = /from\s+['"]@\/lib\/core\/guards\/withAuthTenant/i.test(content);

    // Add imports if missing
    if (!hasWithAuthTenantImport) {
      // Find last import statement
      const importMatch = content.match(/^import.*from.*$/gm);
      const lastImportIndex = importMatch ? content.lastIndexOf(importMatch[importMatch.length - 1]) + importMatch[importMatch.length - 1].length : 0;
      
      const importStatement = `import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';\n`;
      content = content.slice(0, lastImportIndex) + importStatement + content.slice(lastImportIndex);
      result.changes.push('Added withAuthTenant import');
    }

    // Transform each HTTP method handler
    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
    let transformed = false;

    for (const method of httpMethods) {
      // Pattern 1: export async function GET(request: NextRequest) { ... }
      const functionPattern = new RegExp(
        `export\\s+async\\s+function\\s+${method}\\s*\\(([^)]*)\\)\\s*:\\s*Promise<[^>]*>\\s*{([\\s\\S]*?)(?=^export|^const|^type|^interface|$)`,
        'm'
      );

      // Pattern 2: export const GET = async (request: NextRequest) => { ... }
      const constPattern = new RegExp(
        `export\\s+const\\s+${method}\\s*=\\s*async\\s*\\(([^)]*)\\)\\s*=>\\s*{([\\s\\S]*?)(?=^export|^const|^type|^interface|$)`,
        'm'
      );

      // Try to find the handler - more flexible pattern matching
      // Pattern 1: export async function METHOD(request: NextRequest, ...) { ... }
      // Also matches without return type: export async function METHOD(request: NextRequest) { ... }
      const funcPattern1 = new RegExp(
        `(export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)(?:\\s*:\\s*Promise<[^>]*>)?\\s*\\{)([\\s\\S]*?)(?=^export|^const|^type|^interface|^import|$)`,
        'm'
      );
      
      // Pattern 2: export const METHOD = async (request: NextRequest, ...) => { ... }
      const constPattern1 = new RegExp(
        `(export\\s+const\\s+${method}\\s*=\\s*async\\s*\\([^)]*\\)(?:\\s*:\\s*Promise<[^>]*>)?\\s*=>\\s*\\{)([\\s\\S]*?)(?=^export|^const|^type|^interface|^import|$)`,
        'm'
      );

      // Try function pattern
      let match = content.match(funcPattern1);
      if (match && match[0] && match[0].length > 0 && !match[0].includes('withAuthTenant')) {
        // Extract the full function including signature
        const fullMatch = match[0];
        const functionStart = match[1]; // The signature part
        const functionBody = match[2]; // The body part
        
        // Extract params from functionStart
        const paramsMatch = functionStart.match(/\(([^)]*)\)/);
        const params = paramsMatch ? paramsMatch[1].trim() : '';
        
        // Determine handler signature - withAuthTenant passes (req, params, { user, tenantId })
        const hasParams = params.includes('params') || params.includes('{ params') || params.includes('[ params');
        const handlerArgs = hasParams
          ? `(req, { params }, { user, tenantId })`
          : `(req, { user, tenantId })`;

        // Build wrapper options string
        const optionsParts: string[] = [];
        if (options.tenantScoped && !options.ownerScoped) optionsParts.push('tenantScoped: true');
        if (options.ownerScoped) optionsParts.push('ownerScoped: true');
        if (options.platformKey) optionsParts.push(`platformKey: '${options.platformKey}'`);
        if (options.permissionKey) optionsParts.push(`permissionKey: '${options.permissionKey}'`);
        
        const optionsString = optionsParts.length > 0 ? `, { ${optionsParts.join(', ')} }` : '';

        // Transform request to req in body (but preserve request in variable names like requestId)
        let transformedBody = functionBody;
        
        // For dynamic routes, handle params resolution
        if (hasParams) {
          transformedBody = `const resolvedParams = params instanceof Promise ? await params : params;\n${transformedBody}`;
          // Replace params. with resolvedParams.
          transformedBody = transformedBody.replace(/\bparams\./g, 'resolvedParams.');
        }
        
        transformedBody = transformedBody
          .replace(/\brequest\b(?=\s*\.|\(|\)|,|;|\s*$)/g, 'req')
          .replace(/request\./g, 'req.');

        // Build new handler
        const newHandler = `export const ${method} = withAuthTenant(async ${handlerArgs} => {\n${transformedBody.trim()}\n}${optionsString});`;

        // Replace old handler - need to match the exact content
        content = content.replace(fullMatch, newHandler);
        transformed = true;
        result.changes.push(`Wrapped ${method} handler with withAuthTenant`);
      } else {
        // Try const pattern
        match = content.match(constPattern1);
        if (match && match[0] && match[0].length > 0 && !match[0].includes('withAuthTenant')) {
          const fullMatch = match[0];
          const arrowStart = match[1];
          const arrowBody = match[2];
          
          const paramsMatch = arrowStart.match(/\(([^)]*)\)/);
          const params = paramsMatch ? paramsMatch[1].trim() : '';
          
          const hasParams = params.includes('params') || params.includes('{ params') || params.includes('[ params');
          const handlerArgs = hasParams
            ? `(req, { user, tenantId }, params)`
            : `(req, { user, tenantId })`;

          const optionsParts: string[] = [];
          if (options.tenantScoped && !options.ownerScoped) optionsParts.push('tenantScoped: true');
          if (options.ownerScoped) optionsParts.push('ownerScoped: true');
          if (options.platformKey) optionsParts.push(`platformKey: '${options.platformKey}'`);
          if (options.permissionKey) optionsParts.push(`permissionKey: '${options.permissionKey}'`);
          
          const optionsString = optionsParts.length > 0 ? `, { ${optionsParts.join(', ')} }` : '';

          let transformedBody = arrowBody;
          
          // For dynamic routes, handle params resolution
          if (hasParams) {
            transformedBody = `const resolvedParams = params instanceof Promise ? await params : params;\n${transformedBody}`;
            // Replace params. with resolvedParams.
            transformedBody = transformedBody.replace(/\bparams\./g, 'resolvedParams.');
          }
          
          transformedBody = transformedBody
            .replace(/\brequest\b(?=\s*\.|\(|\)|,|;|\s*$)/g, 'req')
            .replace(/request\./g, 'req.');

          const newHandler = `export const ${method} = withAuthTenant(async ${handlerArgs} => {\n${transformedBody.trim()}\n}${optionsString});`;

          content = content.replace(fullMatch, newHandler);
          transformed = true;
          result.changes.push(`Wrapped ${method} handler with withAuthTenant`);
        }
      }
    }

    // Check if transformation needs manual review
    if (needsTenantFiltering(content) && transformed) {
      result.needsManualReview = true;
      result.errors.push('Route uses getCollection() without tenant filtering - needs manual review');
    }

    // If no handlers were transformed, mark as needing review
    if (!transformed) {
      result.needsManualReview = true;
      result.errors.push('No HTTP method handlers found or handlers have unexpected format');
    } else {
      // Write transformed content
      writeFileSync(filePath, content, 'utf-8');
      result.success = true;
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message || 'Unknown error');
    result.needsManualReview = true;
  }

  return result;
}

/**
 * Scan and transform routes in a directory
 */
function transformDirectory(dir: string, routePrefix: string = ''): void {
  if (!existsSync(dir)) {
    console.log(`⚠️  Directory does not exist: ${dir}`);
    return;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Handle dynamic routes like [id] or [tenantId]
      const segment = entry.startsWith('[') && entry.endsWith(']')
        ? `[${entry.slice(1, -1)}]`
        : entry;
      transformDirectory(fullPath, `${routePrefix}/${segment}`);
    } else if (entry === 'route.ts' || entry === 'route.js') {
      const routePath = routePrefix || '/api';
      const result = transformRouteFile(fullPath, routePath);
      results.push(result);
    }
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const targetBatch = args[0]; // e.g., 'admin/ehr', 'admin', 'structure', etc.

  console.log('🔧 Codemod: Apply withAuthTenant Wrapper\n');

  if (targetBatch) {
    // Transform specific batch
    const batchPath = join(process.cwd(), API_DIR, targetBatch);
    console.log(`📦 Processing batch: ${targetBatch}\n`);
    transformDirectory(batchPath, `/api/${targetBatch}`);
  } else {
    // Transform all target directories
    console.log('📦 Processing all target directories\n');
    for (const targetDir of TARGET_DIRS) {
      const dirPath = join(process.cwd(), API_DIR, targetDir);
      if (existsSync(dirPath)) {
        console.log(`Processing: ${targetDir}`);
        transformDirectory(dirPath, `/api/${targetDir}`);
      }
    }
  }

  // Print results
  console.log('\n📊 Transformation Results:\n');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const needsReview = results.filter(r => r.needsManualReview);

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⚠️  Needs Manual Review: ${needsReview.length}\n`);

  if (needsReview.length > 0) {
    console.log('⚠️  Routes Needing Manual Review:\n');
    needsReview.forEach(r => {
      console.log(`  - ${r.route} (${r.file})`);
      if (r.errors.length > 0) {
        r.errors.forEach(e => console.log(`    Error: ${e}`));
      }
      if (r.changes.length > 0) {
        r.changes.forEach(c => console.log(`    ${c}`));
      }
    });
    console.log('');
  }

  // Write report file
  const reportPath = join(process.cwd(), 'codemod-report.json');
  writeFileSync(
    reportPath,
    JSON.stringify({ results, summary: { successful: successful.length, failed: failed.length, needsReview: needsReview.length } }, null, 2),
    'utf-8'
  );
  console.log(`📄 Report written to: ${reportPath}\n`);
}

if (require.main === module) {
  main();
}

export { transformRouteFile, transformDirectory };
