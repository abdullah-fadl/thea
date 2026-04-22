#!/usr/bin/env ts-node

/**
 * Improved Codemod: Bulk Apply withAuthTenant Wrapper
 * Uses balanced brace matching for accurate function body extraction
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

interface TransformationResult {
  file: string;
  route: string;
  success: boolean;
  changes: string[];
  errors: string[];
}

/**
 * Find matching closing brace for an opening brace
 */
function findMatchingBrace(content: string, startIndex: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let i = startIndex;

  while (i < content.length) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    // Handle string literals
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    i++;
  }

  return -1; // Not found
}

/**
 * Extract function body using balanced brace matching
 * Returns body without the outer braces
 */
function extractFunctionBody(content: string, functionStart: number): { body: string; endIndex: number } | null {
  // Find opening brace
  const braceIndex = content.indexOf('{', functionStart);
  if (braceIndex === -1) return null;

  // Find matching closing brace
  const closingBraceIndex = findMatchingBrace(content, braceIndex);
  if (closingBraceIndex === -1) return null;

  // Extract body (excluding braces)
  const body = content.slice(braceIndex + 1, closingBraceIndex);

  return { body, endIndex: closingBraceIndex };
}

/**
 * Normalize indentation in code block
 * Preserves relative indentation structure
 */
function normalizeIndentation(code: string, baseIndent: number = 2): string {
  const lines = code.split('\n');
  if (lines.length === 0) return '';
  
  // Find minimum indentation across all non-empty lines
  let minIndent = Infinity;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
      minIndent = Math.min(minIndent, leadingSpaces);
    }
  }
  
  if (minIndent === Infinity) minIndent = 0;
  
  // Normalize all lines
  const normalized = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
    const relativeIndent = leadingSpaces - minIndent;
    const newIndent = ' '.repeat(baseIndent + relativeIndent);
    return newIndent + trimmed;
  });
  
  return normalized.join('\n');
}

/**
 * Transform a route file
 */
function transformRouteFile(filePath: string, routePath: string): TransformationResult {
  const result: TransformationResult = {
    file: relative(process.cwd(), filePath),
    route: routePath,
    success: false,
    changes: [],
    errors: [],
  };

  try {
    let content = readFileSync(filePath, 'utf-8');

    // Skip if already wrapped
    if (/withAuthTenant\s*\(/i.test(content)) {
      result.success = true;
      result.changes.push('Already wrapped');
      return result;
    }

    // Skip exempt routes
    const exemptRoutes = ['/api/auth/', '/api/health', '/api/init', '/api/quality/verify', '/api/test/seed'];
    if (exemptRoutes.some(exempt => routePath.startsWith(exempt))) {
      result.success = true;
      result.changes.push('Exempt route');
      return result;
    }

    // Determine wrapper options
    const options: any = { tenantScoped: true };
    if (routePath.startsWith('/api/sam/')) {
      options.platformKey = 'sam';
    }
    if (routePath.startsWith('/api/admin/')) {
      options.permissionKey = `admin.${routePath.replace('/api/admin/', '').replace(/\//g, '.').replace(/\[.*?\]/g, 'id').replace(/\.$/, '')}.access`;
    }
    if (routePath.startsWith('/api/owner/')) {
      options.ownerScoped = true;
      options.tenantScoped = false;
    }

    // Add import if missing
    if (!/from\s+['"]@\/lib\/core\/guards\/withAuthTenant/i.test(content)) {
      const importMatch = content.match(/^import.*from.*$/gm);
      const lastImportIndex = importMatch 
        ? content.lastIndexOf(importMatch[importMatch.length - 1]) + importMatch[importMatch.length - 1].length 
        : 0;
      const importStatement = `import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';\n`;
      content = content.slice(0, lastImportIndex) + importStatement + content.slice(lastImportIndex);
      result.changes.push('Added import');
    }

    // Transform each HTTP method
    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
    let transformed = false;

    for (const method of httpMethods) {
      // Pattern: export async function METHOD(...) { ... }
      const funcPattern = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)`, 'i');
      const match = content.match(funcPattern);

      if (match && match.index !== undefined) {
        const functionStart = match.index;
        const functionHeader = match[0];

        // Extract function body using balanced brace matching
        const bodyResult = extractFunctionBody(content, functionStart + functionHeader.length);
        if (!bodyResult) {
          result.errors.push(`Could not extract body for ${method}`);
          continue;
        }

        const { body, endIndex } = bodyResult;
        const fullFunction = content.slice(functionStart, endIndex + 1);

        // Extract params
        const paramsMatch = functionHeader.match(/\(([^)]*)\)/);
        const params = paramsMatch ? paramsMatch[1].trim() : '';
        const hasParams = /params/.test(params);

        // Transform body - preserve try-catch structure if it exists
        let transformedBody = body.trim();

        // Check if body starts with try
        const hasTryCatch = /^\s*try\s*\{/s.test(transformedBody);
        
        // Remove requireAuth check patterns (multiple variations)
        // Pattern 1: const authResult = await requireAuth(request); if (...) return authResult;
        transformedBody = transformedBody.replace(
          /const\s+authResult\s*=\s*await\s+requireAuth\([^)]*\)\s*;?\s*if\s*\(\s*authResult\s+instanceof\s+NextResponse\s*\)\s*\{[^}]*return\s+authResult\s*;[^}]*\}/gs,
          ''
        );
        // Pattern 2: const { user, tenantId } = authResult;
        transformedBody = transformedBody.replace(
          /const\s*{\s*user[^}]*}\s*=\s*authResult\s*;?\s*/g,
          ''
        );
        // Pattern 3: const user = authResult.user;
        transformedBody = transformedBody.replace(
          /const\s+user\s*=\s*authResult\.user\s*;?\s*/g,
          ''
        );
        // Pattern 4: const tenantId = authResult.tenantId;
        transformedBody = transformedBody.replace(
          /const\s+tenantId\s*=\s*authResult\.tenantId\s*;?\s*/g,
          ''
        );
        // Pattern 5: const { userRole, tenantId } = authContext; (for requireAuthContext)
        transformedBody = transformedBody.replace(
          /const\s*{\s*userRole[^}]*}\s*=\s*authContext\s*;?\s*/g,
          ''
        );
        // Remove authContext checks
        transformedBody = transformedBody.replace(
          /const\s+authContext\s*=\s*await\s+requireAuthContext\([^)]*\)\s*;?\s*if\s*\(\s*authContext\s+instanceof\s+NextResponse\s*\)\s*\{[^}]*return\s+authContext\s*;[^}]*\}/gs,
          ''
        );
        
        // Clean up: Remove duplicate blank lines left by removals
        transformedBody = transformedBody.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
        
        // Ensure body starts with try if original had it
        if (hasTryCatch && !/^\s*try\s*\{/s.test(transformedBody)) {
          transformedBody = 'try {\n' + transformedBody;
          // Find the catch block and ensure it's properly closed
          if (!transformedBody.includes('} catch')) {
            // Try to find catch in original body
            const catchMatch = body.match(/catch\s*\([^)]+\)\s*\{/);
            if (catchMatch) {
              // Find matching closing brace for try
              const tryBodyEnd = findMatchingBrace(transformedBody, transformedBody.indexOf('{'));
              if (tryBodyEnd > 0) {
                const tryContent = transformedBody.substring(transformedBody.indexOf('{') + 1, tryBodyEnd);
                transformedBody = 'try {\n' + normalizeIndentation(tryContent, 4) + '\n  } catch (error: any) {';
              }
            }
          }
        }

        // Replace request with req (but preserve requestId, requestUrl, etc.)
        transformedBody = transformedBody
          .replace(/\brequest\b(?=\s*\.|\(|,|;|\)|\s|$)/g, 'req')
          .replace(/request\./g, 'req.');

        // Handle params for dynamic routes
        if (hasParams) {
          transformedBody = `const resolvedParams = params instanceof Promise ? await params : params;\n${transformedBody}`;
          transformedBody = transformedBody.replace(/\bparams\./g, 'resolvedParams.');
        }

        // Transform DB queries to use createTenantQuery
        // Pattern 1: const collection = await getCollection('name'); const result = await collection.findOne({ ... })
        // More robust: handle multi-line and await
        transformedBody = transformedBody.replace(
          /const\s+(\w+Collection)\s*=\s*await\s+getCollection\(['"]([^'"]+)['"]\)\s*;?\s*const\s+(\w+)\s*=\s*await\s+\1\.findOne\(\s*(\{[^}]*\})\s*\)/gs,
          (match, collectionVar, collectionName, resultVar, queryObj) => {
            // Generate unique query variable name
            const queryVar = resultVar === 'patient' ? 'patientQuery' : `${resultVar}Query`;
            if (!queryObj.includes('tenantId')) {
              return `const ${collectionVar} = await getCollection('${collectionName}');\n      const ${queryVar} = createTenantQuery(${queryObj}, tenantId);\n      const ${resultVar} = await ${collectionVar}.findOne(${queryVar})`;
            }
            return match;
          }
        );

        // Pattern 2: await collection.findOne({ id: ... }) - standalone findOne
        transformedBody = transformedBody.replace(
          /await\s+(\w+Collection)\.findOne\(\s*\{([^}]+)\}\s*\)/g,
          (match, collectionVar, queryContent) => {
            if (!queryContent.includes('tenantId') && !queryContent.includes('createTenantQuery')) {
              // Extract variable name pattern (e.g., id: body.patientId -> patientQuery)
              const idMatch = queryContent.match(/id\s*:\s*(\w+)\.(\w+)/);
              const queryVar = idMatch ? `${idMatch[2]}Query` : 'query';
              return `const ${queryVar} = createTenantQuery({${queryContent}}, tenantId);\n      const result = await ${collectionVar}.findOne(${queryVar})`;
            }
            return match;
          }
        );

        // Pattern 3: collection.find({ ... }) -> createTenantQuery for find operations
        transformedBody = transformedBody.replace(
          /await\s+(\w+Collection)\.find\(\s*(\{[^}]*\})\s*\)/g,
          (match, collectionVar, queryObj) => {
            if (!queryObj.includes('tenantId') && !queryObj.includes('createTenantQuery')) {
              return `createTenantQuery(${queryObj}, tenantId)`;
            }
            return match;
          }
        );

        // Add tenantId to inserted documents
        // Pattern: const objVar: Type = { ... updatedBy: user.id }; ... insertOne(objVar)
        // Use balanced brace matching to find object definitions
        const objectDefRegex = /const\s+(\w+)\s*:\s*\w+\s*=\s*\{/g;
        let objectMatch;
        const objectReplacements: Array<{ varName: string; fullMatch: string; newContent: string }> = [];
        
        // Find all object definitions
        while ((objectMatch = objectDefRegex.exec(transformedBody)) !== null) {
          const objVar = objectMatch[1];
          const objStart = objectMatch.index + objectMatch[0].length - 1; // Position of opening brace
          
          // Find matching closing brace
          const closingBrace = findMatchingBrace(transformedBody, objStart);
          if (closingBrace === -1) continue;
          
          const objContent = transformedBody.slice(objStart + 1, closingBrace);
          const fullMatch = transformedBody.slice(objectMatch.index, closingBrace + 1);
          
          // Check if this object is used in insertOne and doesn't have tenantId
          if (transformedBody.includes(`insertOne(${objVar})`) && !objContent.includes('tenantId') && objContent.includes('updatedBy')) {
            // Add tenantId after updatedBy
            const updatedByMatch = objContent.match(/(updatedBy:\s*user\.id[^,}]*)/);
            if (updatedByMatch) {
              const replacement = objContent.replace(
                /(updatedBy:\s*user\.id[^,}]*)/,
                '$1,\n      tenantId, // CRITICAL: Always include tenantId for tenant isolation'
              );
              const newMatch = fullMatch.replace(objContent, replacement);
              objectReplacements.push({ varName: objVar, fullMatch, newContent: newMatch });
            }
          }
        }
        
        // Apply replacements (in reverse order to preserve indices)
        objectReplacements.reverse().forEach(({ fullMatch, newContent }) => {
          transformedBody = transformedBody.replace(fullMatch, newContent);
        });

        // Update createAuditLog calls to include tenantId
        // Handle multi-line objects in createAuditLog - find the object definition
        transformedBody = transformedBody.replace(
          /await\s+createAuditLog\(\s*\{([\s\S]*?success[^}]*)\}\s*\)/gs,
          (match, objContent) => {
            if (!objContent.includes('tenantId')) {
              // Add tenantId before success property
              return match.replace(/(success:\s*[^,}]+)/, 'tenantId, // CRITICAL: Always include tenantId for tenant isolation\n      $1');
            }
            return match;
          }
        );
        
        // Also handle createAuditLog without await
        transformedBody = transformedBody.replace(
          /createAuditLog\(\s*\{([\s\S]*?success[^}]*)\}\s*\)/g,
          (match, objContent) => {
            if (!objContent.includes('tenantId')) {
              return match.replace(/(success:\s*[^,}]+)/, 'tenantId, // CRITICAL: Always include tenantId for tenant isolation\n      $1');
            }
            return match;
          }
        );

        // Remove requireAuth from error blocks (in catch blocks)
        // Pattern: catch (error: any) { ... const authResult = await requireAuth(req); if (!(authResult instanceof NextResponse)) { ... } }
        transformedBody = transformedBody.replace(
          /catch\s*\([^)]+\)\s*\{([\s\S]*?)\}/gs,
          (match, catchBody) => {
            // Remove requireAuth call and its conditional check, but keep the audit log
            let cleanedBody = catchBody;
            
            // Pattern: const authResult = await requireAuth(req); if (!(authResult instanceof NextResponse)) { ... createAuditLog(...) ... }
            cleanedBody = cleanedBody.replace(
              /const\s+authResult\s*=\s*await\s+requireAuth\([^)]*\)\s*;?\s*/g,
              ''
            );
            cleanedBody = cleanedBody.replace(
              /if\s*\(\s*!\(authResult\s+instanceof\s+NextResponse\)\s*\)\s*\{/g,
              '// Audit log for failure - user is available from context\n      try {'
            );
            // Replace authResult.user.id with user.id (user is available from wrapper context)
            cleanedBody = cleanedBody.replace(/authResult\.user\.id/g, 'user.id');
            cleanedBody = cleanedBody.replace(/authResult\.user/g, 'user');
            
            // Ensure catch block has proper structure
            if (!cleanedBody.trim().startsWith('console.error') && !cleanedBody.trim().startsWith('try')) {
              cleanedBody = '    console.error(\'Error:\', error);\n' + cleanedBody;
            }
            
            return `catch (error: any) {\n${cleanedBody.trim()}\n  }`;
          }
        );

        // Clean up: Remove duplicate blank lines
        transformedBody = transformedBody.replace(/\n\s*\n\s*\n+/g, '\n\n');
        transformedBody = transformedBody.trim();
        
        // Normalize indentation using the helper function
        transformedBody = normalizeIndentation(transformedBody, 2);
        
        // Ensure body starts with try { if it had try-catch originally
        if (hasTryCatch && !transformedBody.trim().startsWith('try')) {
          transformedBody = 'try {\n' + transformedBody.replace(/^/gm, '  ') + '\n} catch (error: any) {';
          // Extract catch block from original body if it exists
          const catchMatch = body.match(/catch\s*\([^)]+\)\s*\{([\s\S]*?)(?=\n\s*\}\s*$|\n\s*\}|$)/);
          if (catchMatch) {
            let catchBody = catchMatch[1];
            // Remove requireAuth from catch body
            catchBody = catchBody.replace(/const\s+authResult\s*=\s*await\s+requireAuth\([^)]*\)\s*;?\s*/g, '');
            catchBody = catchBody.replace(/if\s*\(\s*!\(authResult\s+instanceof\s+NextResponse\)\s*\)\s*\{/g, '');
            catchBody = catchBody.replace(/authResult\.user\.id/g, 'user.id');
            catchBody = catchBody.replace(/authResult\.user/g, 'user');
            catchBody = normalizeIndentation(catchBody, 4);
            transformedBody = transformedBody.replace(/} catch \(error: any\) \{/, `} catch (error: any) {\n${catchBody}\n  }`);
          }
        }
        
        // If no try-catch but body needs it, add it
        if (!hasTryCatch && transformedBody.trim()) {
          // Check if body has error handling that suggests it should have try-catch
          if (transformedBody.includes('catch') || transformedBody.length > 200) {
            transformedBody = 'try {\n' + normalizeIndentation(transformedBody, 2) + '\n} catch (error: any) {\n    console.error(\'Error:\', error);\n    return NextResponse.json(\n      { error: \'Internal server error\', details: error.message },\n      { status: 500 }\n    );\n  }';
          }
        }

        // Build options string
        const optionsParts: string[] = [];
        if (options.tenantScoped && !options.ownerScoped) optionsParts.push('tenantScoped: true');
        if (options.ownerScoped) optionsParts.push('ownerScoped: true');
        if (options.platformKey) optionsParts.push(`platformKey: '${options.platformKey}'`);
        if (options.permissionKey) optionsParts.push(`permissionKey: '${options.permissionKey}'`);
        const optionsString = optionsParts.length > 0 ? `, { ${optionsParts.join(', ')} }` : '';

        // Build new handler
        const handlerArgs = hasParams 
          ? `(req, { user, tenantId }, params)`
          : `(req, { user, tenantId })`;
        
        const newHandler = `export const ${method} = withAuthTenant(async ${handlerArgs} => {\n${transformedBody.trim()}\n}${optionsString});`;

        // Replace old handler
        content = content.slice(0, functionStart) + newHandler + content.slice(endIndex + 1);
        transformed = true;
        result.changes.push(`Transformed ${method}`);
      }
    }

    if (transformed) {
      writeFileSync(filePath, content, 'utf-8');
      result.success = true;
    } else {
      result.errors.push('No handlers transformed');
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message);
  }

  return result;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const targetBatch = args[0];

  console.log('🔧 Improved Codemod: Apply withAuthTenant Wrapper\n');

  if (!targetBatch) {
    console.error('Usage: yarn codemod:improved <path>');
    console.error('Example: yarn codemod:improved admin/ehr/tasks');
    process.exit(1);
  }

  const filePath = join(process.cwd(), 'app/api', targetBatch, 'route.ts');
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const routePath = `/api/${targetBatch}`;
  const result = transformRouteFile(filePath, routePath);

  console.log(`\n📊 Results for ${routePath}:`);
  console.log(`  Success: ${result.success ? '✅' : '❌'}`);
  if (result.changes.length > 0) {
    console.log(`  Changes:`);
    result.changes.forEach(c => console.log(`    - ${c}`));
  }
  if (result.errors.length > 0) {
    console.log(`  Errors:`);
    result.errors.forEach(e => console.log(`    - ${e}`));
  }
}

if (require.main === module) {
  main();
}
