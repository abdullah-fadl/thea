#!/usr/bin/env ts-node

/**
 * Improved Codemod v2: Bulk Apply withAuthTenant Wrapper
 * More robust transformations with better edge case handling
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

interface TransformationResult {
  file: string;
  route: string;
  success: boolean;
  changes: string[];
  errors: string[];
  warnings: string[];
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
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }

    i++;
  }

  return -1;
}

/**
 * Extract function body using balanced brace matching
 */
function extractFunctionBody(content: string, functionStart: number): { body: string; endIndex: number } | null {
  const braceIndex = content.indexOf('{', functionStart);
  if (braceIndex === -1) return null;

  const closingBraceIndex = findMatchingBrace(content, braceIndex);
  if (closingBraceIndex === -1) return null;

  const body = content.slice(braceIndex + 1, closingBraceIndex);
  return { body, endIndex: closingBraceIndex };
}

/**
 * Normalize indentation preserving relative structure
 */
function normalizeIndentation(code: string, baseIndent: number = 2): string {
  const lines = code.split('\n');
  if (lines.length === 0) return '';
  
  let minIndent = Infinity;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
      minIndent = Math.min(minIndent, leadingSpaces);
    }
  }
  
  if (minIndent === Infinity) minIndent = 0;
  
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
    const relativeIndent = leadingSpaces - minIndent;
    return ' '.repeat(baseIndent + relativeIndent) + trimmed;
  }).join('\n');
}

/**
 * Transform a route file with improved handling
 */
function transformRouteFile(filePath: string, routePath: string): TransformationResult {
  const result: TransformationResult = {
    file: relative(process.cwd(), filePath),
    route: routePath,
    success: false,
    changes: [],
    errors: [],
    warnings: [],
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
    const exemptRoutes = ['/api/auth/', '/api/health', '/api/init', '/api/quality/verify', '/api/test/seed', '/api/thea-engine/health'];
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
      const pathParts = routePath.replace('/api/admin/', '').replace(/\//g, '.').replace(/\[.*?\]/g, 'id');
      options.permissionKey = `admin.${pathParts}.access`;
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
      const funcPattern = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)`, 'i');
      const match = content.match(funcPattern);

      if (match && match.index !== undefined) {
        const functionStart = match.index;
        const functionHeader = match[0];

        const bodyResult = extractFunctionBody(content, functionStart + functionHeader.length);
        if (!bodyResult) {
          result.errors.push(`Could not extract body for ${method}`);
          continue;
        }

        const { body, endIndex } = bodyResult;
        const fullFunction = content.slice(functionStart, endIndex + 1);

        const paramsMatch = functionHeader.match(/\(([^)]*)\)/);
        const params = paramsMatch ? paramsMatch[1].trim() : '';
        const hasParams = /params/.test(params);

        // Transform body step by step
        let transformedBody = body.trim();

        // Step 1: Remove requireAuth checks
        transformedBody = transformedBody.replace(
          /const\s+authResult\s*=\s*await\s+requireAuth\([^)]*\)\s*;?\s*if\s*\(\s*authResult\s+instanceof\s+NextResponse\s*\)\s*\{[^}]*return\s+authResult\s*;[^}]*\}/gs,
          ''
        );
        transformedBody = transformedBody.replace(/const\s*{\s*user[^}]*}\s*=\s*authResult\s*;?\s*/g, '');
        transformedBody = transformedBody.replace(/const\s+user\s*=\s*authResult\.user\s*;?\s*/g, '');
        transformedBody = transformedBody.replace(/const\s+tenantId\s*=\s*authResult\.tenantId\s*;?\s*/g, '');

        // Step 2: Replace request with req
        transformedBody = transformedBody.replace(/\brequest\b(?=\s*\.|\(|,|;|\)|\s|$)/g, 'req');

        // Step 3: Handle params for dynamic routes
        if (hasParams) {
          transformedBody = `const resolvedParams = params instanceof Promise ? await params : params;\n${transformedBody}`;
          transformedBody = transformedBody.replace(/\bparams\./g, 'resolvedParams.');
        }

        // Step 4: Transform DB queries to use createTenantQuery
        // Pattern: await collection.findOne({ id: ... }) -> createTenantQuery({ id: ... }, tenantId)
        transformedBody = transformedBody.replace(
          /const\s+(\w+Collection)\s*=\s*await\s+getCollection\(['"]([^'"]+)['"]\)\s*;?\s*const\s+(\w+)\s*=\s*await\s+\1\.findOne\(\s*\{([^}]+)\}\s*\)/gs,
          (match, collectionVar, collectionName, resultVar, queryContent) => {
            if (!queryContent.includes('tenantId') && !queryContent.includes('createTenantQuery')) {
              const queryVar = resultVar === 'patient' ? 'patientQuery' : `${resultVar}Query`;
              return `const ${collectionVar} = await getCollection('${collectionName}');\n      const ${queryVar} = createTenantQuery({${queryContent}}, tenantId);\n      const ${resultVar} = await ${collectionVar}.findOne(${queryVar})`;
            }
            return match;
          }
        );

        // Step 5: Add tenantId to object definitions used in insertOne
        const objectDefRegex = /const\s+(\w+)\s*:\s*\w+\s*=\s*\{/g;
        let objMatch;
        while ((objMatch = objectDefRegex.exec(transformedBody)) !== null) {
          const objVar = objMatch[1];
          const objStart = objMatch.index + objMatch[0].length - 1;
          const closingBrace = findMatchingBrace(transformedBody, objStart);
          if (closingBrace === -1) continue;

          const objContent = transformedBody.slice(objStart + 1, closingBrace);
          if (transformedBody.includes(`insertOne(${objVar})`) && !objContent.includes('tenantId') && objContent.includes('updatedBy')) {
            // Add tenantId after updatedBy
            const updatedByMatch = objContent.match(/updatedBy:\s*user\.id[^,}]*/);
            if (updatedByMatch) {
              const replacement = objContent.replace(
                /(updatedBy:\s*user\.id[^,}]*)/,
                '$1,\n      tenantId, // CRITICAL: Always include tenantId for tenant isolation'
              );
              transformedBody = transformedBody.slice(0, objStart + 1) + replacement + transformedBody.slice(closingBrace);
            }
          }
        }

        // Step 6: Add tenantId to createAuditLog calls
        // Use balanced brace matching for accurate transformation
        // Process all audit logs in the body (both main body and catch blocks)
        const auditLogRegex = /(await\s+)?createAuditLog\(\s*\{/g;
        const auditLogMatches: Array<{ start: number; end: number; content: string; fullMatch: string }> = [];
        
        // Collect all audit log matches first (to avoid index issues)
        let auditLogMatch;
        auditLogRegex.lastIndex = 0; // Reset regex
        while ((auditLogMatch = auditLogRegex.exec(transformedBody)) !== null) {
          const auditStart = auditLogMatch.index + auditLogMatch[0].length - 1;
          const auditEnd = findMatchingBrace(transformedBody, auditStart);
          if (auditEnd > 0) {
            const auditContent = transformedBody.slice(auditStart + 1, auditEnd);
            const fullMatch = transformedBody.slice(auditLogMatch.index, auditEnd + 1);
            auditLogMatches.push({ start: auditStart, end: auditEnd, content: auditContent, fullMatch });
          }
        }
        
        // Process matches in reverse order (to preserve indices)
        // First, detect context (main body vs catch block) for each audit log
        auditLogMatches.reverse().forEach(({ start, end, content }) => {
          // Detect if this audit log is inside a catch block
          const beforeAudit = transformedBody.slice(0, start);
          const catchBlockStart = beforeAudit.lastIndexOf('catch');
          const tryBlockStart = beforeAudit.lastIndexOf('try');
          const isInCatchBlock = catchBlockStart > tryBlockStart && catchBlockStart >= 0;
          
          // Build complete replacement for this audit log
          let updatedContent = content;
          let needsUpdate = false;
          
          // Step 1: Add tenantId if missing
          if (!updatedContent.includes('tenantId')) {
            const successMatch = updatedContent.match(/(success:\s*(?:true|false))/);
            const errorMatch = updatedContent.match(/(errorMessage:\s*[^,}]+)/);
            const indent = isInCatchBlock ? '        ' : '      ';
            
            if (successMatch && successMatch.index !== undefined) {
              const beforeSuccess = updatedContent.substring(0, successMatch.index).trim();
              const afterSuccess = updatedContent.substring(successMatch.index);
              const lines = beforeSuccess.split('\n').filter(l => l.trim());
              const lastLine = lines[lines.length - 1] || '';
              const needsComma = lastLine && !lastLine.trim().endsWith(',');
              updatedContent = beforeSuccess + (needsComma ? ',' : '') + '\n' + indent + 'tenantId, // CRITICAL: Always include tenantId for tenant isolation\n' + indent + afterSuccess;
              needsUpdate = true;
            } else if (errorMatch && errorMatch.index !== undefined) {
              const beforeError = updatedContent.substring(0, errorMatch.index).trim();
              const afterError = updatedContent.substring(errorMatch.index);
              const lines = beforeError.split('\n').filter(l => l.trim());
              const lastLine = lines[lines.length - 1] || '';
              const needsComma = lastLine && !lastLine.trim().endsWith(',');
              updatedContent = beforeError + (needsComma ? ',' : '') + '\n' + indent + 'tenantId, // CRITICAL: Always include tenantId for tenant isolation\n' + indent + afterError;
              needsUpdate = true;
            } else {
              const trimmed = updatedContent.trim();
              const needsComma = trimmed && !trimmed.endsWith(',');
              updatedContent = updatedContent + (needsComma ? ',' : '') + '\n' + indent + 'tenantId, // CRITICAL: Always include tenantId for tenant isolation';
              needsUpdate = true;
            }
          }
          
          // Step 2: For main body audit logs, add standard properties if missing
          // Note: We don't automatically add success/ipAddress/userAgent to avoid breaking existing code.
          // These should be added manually or verified after transformation.
          
          // Step 3: For catch block audit logs, ensure errorMessage is present if success: false exists
          if (isInCatchBlock && /success:\s*false/.test(updatedContent) && !updatedContent.includes('errorMessage:')) {
            const successMatch = updatedContent.match(/success:\s*false/);
            if (successMatch && successMatch.index !== undefined) {
              const afterSuccess = updatedContent.substring(successMatch.index + successMatch[0].length);
              updatedContent = updatedContent.substring(0, successMatch.index + successMatch[0].length) + ',\n        errorMessage: error.message,' + afterSuccess;
              needsUpdate = true;
            }
          }
          
          // Apply single replacement to avoid index issues
          if (needsUpdate) {
            transformedBody = transformedBody.slice(0, start + 1) + updatedContent + transformedBody.slice(end);
          }
        });
        
        // Clean up duplicate commas after all replacements
        transformedBody = transformedBody.replace(/,\s*,/g, ',');
        transformedBody = transformedBody.replace(/(\w+):\s*([^,}]+),,/g, '$1: $2,');
        transformedBody = transformedBody.replace(/,\s*,\s*\/\/\s*CRITICAL/g, ', // CRITICAL');

        // Step 7: Fix catch blocks - remove requireAuth, use user from context, preserve audit log
        // Find catch block using balanced brace matching
        const catchRegex = /catch\s*\([^)]+\)\s*\{/;
        const catchMatch = transformedBody.match(catchRegex);
        if (catchMatch && catchMatch.index !== undefined) {
          const catchStart = catchMatch.index + catchMatch[0].length - 1; // Position of opening brace
          const catchEnd = findMatchingBrace(transformedBody, catchStart);
          if (catchEnd > 0) {
            let catchBody = transformedBody.slice(catchStart + 1, catchEnd);
            
            // FIRST: Find and update audit log BEFORE removing try-catch
            // Pattern: try { const authResult = await requireAuth(...); if (!(authResult instanceof NextResponse)) { await createAuditLog({ ... userId: authResult.user.id, ... }); } } catch {}
            const auditLogInCatchRegex = /createAuditLog\(\s*\{/g;
            let auditInCatchMatch;
            while ((auditInCatchMatch = auditLogInCatchRegex.exec(catchBody)) !== null) {
              const auditStart = auditInCatchMatch.index + auditInCatchMatch[0].length - 1;
              const auditEnd = findMatchingBrace(catchBody, auditStart);
              if (auditEnd > 0) {
                const auditContent = catchBody.slice(auditStart + 1, auditEnd);
                // Update audit log to use user from context and add tenantId
                let updatedAudit = auditContent;
                updatedAudit = updatedAudit.replace(/authResult\.user\.id/g, 'user.id');
                updatedAudit = updatedAudit.replace(/authResult\.user/g, 'user');
                // Add tenantId if missing - preserve ALL existing properties
                if (!updatedAudit.includes('tenantId')) {
                  // Find success or errorMessage property to add tenantId before it
                  const successMatch = updatedAudit.match(/(success:\s*false)/);
                  const errorMatch = updatedAudit.match(/(errorMessage:\s*[^,}]+)/);
                  
                  if (successMatch && successMatch.index !== undefined) {
                    // Add tenantId before success: false (for catch blocks)
                    const beforeSuccess = updatedAudit.substring(0, successMatch.index).trim();
                    const afterSuccess = updatedAudit.substring(successMatch.index);
                    // Check if beforeSuccess needs a comma
                    const lines = beforeSuccess.split('\n').filter(l => l.trim());
                    const lastLine = lines[lines.length - 1] || '';
                    const needsComma = lastLine && !lastLine.trim().endsWith(',');
                    updatedAudit = beforeSuccess + (needsComma ? ',' : '') + '\n        tenantId, // CRITICAL: Always include tenantId for tenant isolation\n        ' + afterSuccess;
                  } else if (errorMatch && errorMatch.index !== undefined) {
                    // Add tenantId before errorMessage (for catch blocks)
                    const beforeError = updatedAudit.substring(0, errorMatch.index).trim();
                    const afterError = updatedAudit.substring(errorMatch.index);
                    const lines = beforeError.split('\n').filter(l => l.trim());
                    const lastLine = lines[lines.length - 1] || '';
                    const needsComma = lastLine && !lastLine.trim().endsWith(',');
                    updatedAudit = beforeError + (needsComma ? ',' : '') + '\n        tenantId, // CRITICAL: Always include tenantId for tenant isolation\n        ' + afterError;
                  } else {
                    // Add at end if no success/errorMessage found (preserve all existing content)
                    const trimmed = updatedAudit.trim();
                    const needsComma = trimmed && !trimmed.endsWith(',');
                    updatedAudit = updatedAudit + (needsComma ? ',' : '') + '\n        tenantId, // CRITICAL: Always include tenantId for tenant isolation';
                  }
                }
                // Replace audit content in catch body
                catchBody = catchBody.slice(0, auditStart + 1) + updatedAudit + catchBody.slice(auditEnd);
                break; // Exit after first audit log update
              }
            }
            
            // NOW: Remove requireAuth and its conditional checks (but preserve audit log)
            // Strategy: Find the pattern: if (!(authResult instanceof NextResponse)) { await createAuditLog(...) }
            // Replace with: try { await createAuditLog(...) } catch {}
            
            // Pattern 1: Remove requireAuth call
            catchBody = catchBody.replace(/const\s+authResult\s*=\s*await\s+requireAuth\([^)]*\)\s*;?\s*/g, '');
            
            // Pattern 2: Handle conditional with audit log inside
            // Look for: try { const authResult = await requireAuth(...); if (!(authResult instanceof NextResponse)) { await createAuditLog(...) } } catch {}
            // Replace with: try { await createAuditLog(...) } catch {}
            
            // First, check if there's already an audit log that was updated in the first pass
            if (catchBody.includes('createAuditLog') && catchBody.includes('user.id')) {
              // Audit log already updated, just need to remove requireAuth and conditional
              catchBody = catchBody.replace(/const\s+authResult\s*=\s*await\s+requireAuth\([^)]*\)\s*;?\s*/g, '');
              catchBody = catchBody.replace(/if\s*\(\s*!\(authResult\s+instanceof\s+NextResponse\)\s*\)\s*\{/g, 'try {');
              
              // Find the closing brace of the conditional and replace with } catch {}
              // This is tricky - we need to find the matching brace
              const tryStart = catchBody.indexOf('try {');
              if (tryStart >= 0) {
                const tryBraceStart = catchBody.indexOf('{', tryStart);
                const tryBraceEnd = findMatchingBrace(catchBody, tryBraceStart);
                if (tryBraceEnd > 0) {
                  // Check if there's already a catch after this try
                  const afterTry = catchBody.slice(tryBraceEnd + 1);
                  if (!afterTry.trim().startsWith('} catch')) {
                    // No catch, add it
                    catchBody = catchBody.slice(0, tryBraceEnd + 1) + '\n    } catch {}' + afterTry;
                  }
                }
              }
            } else {
              // No audit log found yet, look for the full pattern
              const conditionalPattern = /if\s*\(\s*!\(authResult\s+instanceof\s+NextResponse\)\s*\)\s*\{([\s\S]*?await\s+createAuditLog\([\s\S]*?\)[\s\S]*?)\}/s;
              const conditionalMatch = catchBody ? catchBody.match(conditionalPattern) : null;
              
              if (conditionalMatch && conditionalMatch[1]) {
                // Extract audit log call
                const auditLogCall = conditionalMatch[1].match(/await\s+createAuditLog\([\s\S]*?\)/s);
                if (auditLogCall && auditLogCall[0]) {
                  // Replace conditional with try-catch wrapped audit log
                  catchBody = catchBody.replace(conditionalPattern, `try {\n      ${auditLogCall[0]};\n    } catch {}`);
                } else {
                  // Just remove the conditional
                  catchBody = catchBody.replace(/if\s*\(\s*!\(authResult\s+instanceof\s+NextResponse\)\s*\)\s*\{[^}]*\}/gs, '');
                }
              } else {
                // No conditional pattern, just remove requireAuth checks
                catchBody = catchBody.replace(/if\s*\(\s*!\(authResult\s+instanceof\s+NextResponse\)\s*\)\s*\{[^}]*\}/gs, '');
                catchBody = catchBody.replace(/if\s*\(\s*authResult\s+instanceof\s+NextResponse\s*\)\s*\{[^}]*return[^}]*\}/gs, '');
              }
            }
            
            // Pattern 3: Remove empty try-catch blocks
            catchBody = catchBody.replace(/try\s*\{\s*\}\s*catch\s*\([^)]*\)\s*\{\s*\}/g, '');
            catchBody = catchBody.replace(/try\s*\{\s*\}\s*catch\s*\{\s*\}/g, '');
            
            // Pattern 4: Fix broken try-catch structures (like "try { ); } catch {}" or "try { } } catch {}")
            catchBody = catchBody.replace(/try\s*\{\s*\)\s*;\s*\}\s*catch\s*\{\}/g, '');
            catchBody = catchBody.replace(/try\s*\{\s*\)\s*;\s*\}/g, '');
            catchBody = catchBody.replace(/try\s*\{\s*\}\s*\}/g, '');
            catchBody = catchBody.replace(/\}\s*\}\s*catch\s*\{\}/g, '} catch {}');
            
            // Pattern 5: Remove duplicate nested try blocks
            catchBody = catchBody.replace(/try\s*\{\s*try\s*\{/g, 'try {');
            catchBody = catchBody.replace(/\}\s*catch\s*\{\s*\}\s*catch\s*\{\s*\}/g, '} catch {}');
            
            // Pattern 6: Fix duplicate commas in catch body
            catchBody = catchBody.replace(/,\s*,/g, ',');
            catchBody = catchBody.replace(/(\w+):\s*([^,}]+),,/g, '$1: $2,');
            catchBody = catchBody.replace(/userId:\s*user\.id,,/g, 'userId: user.id,');
            
            // Clean up: remove duplicate comments and blank lines
            catchBody = catchBody.replace(/\/\/ Audit log for failure[\s\n]*\/\/ Audit log for failure/g, '// Audit log for failure - user is available from context');
            catchBody = catchBody.replace(/\n\s*\n\s*\n+/g, '\n\n');
            
            // Ensure console.error is first (if not already present)
            if (!catchBody.trim().includes('console.error')) {
              catchBody = 'console.error(\'Error:\', error);\n\n' + catchBody.trim();
            } else if (!catchBody.trim().startsWith('console.error')) {
              // Move console.error to the beginning if it exists but isn't first
              const errorMatch = catchBody.match(/console\.error\([^)]+\)/);
              if (errorMatch) {
                catchBody = catchBody.replace(/console\.error\([^)]+\)\s*;?\s*/g, '');
                catchBody = 'console.error(\'Error:\', error);\n\n' + catchBody.trim();
              }
            }
            
            // Normalize indentation
            catchBody = normalizeIndentation(catchBody.trim(), 4);
            
            // Replace catch block in transformed body
            transformedBody = transformedBody.slice(0, catchStart + 1) + '\n' + catchBody + '\n  ' + transformedBody.slice(catchEnd);
          }
        }

        // Step 8: Clean up duplicate comments, trailing commas, and syntax errors
        transformedBody = transformedBody.replace(/tenantId,\s*\/\/\s*CRITICAL[^}]*tenantId,\s*\/\/\s*CRITICAL/g, 'tenantId, // CRITICAL: Always include tenantId for tenant isolation');
        transformedBody = transformedBody.replace(/tenantId,\s*\/\/\s*CRITICAL[^}]*,\s*\}/g, 'tenantId, // CRITICAL: Always include tenantId for tenant isolation\n    }');
        transformedBody = transformedBody.replace(/,\s*\n\s*tenantId,\s*\/\/\s*CRITICAL.*?\/\/\s*CRITICAL/g, ',\n      tenantId, // CRITICAL: Always include tenantId for tenant isolation');
        
        // Fix duplicate commas
        transformedBody = transformedBody.replace(/,\s*,/g, ',');
        transformedBody = transformedBody.replace(/(\w+):\s*([^,}]+),,/g, '$1: $2,');
        transformedBody = transformedBody.replace(/,\s*,\s*\/\/\s*CRITICAL/g, ', // CRITICAL');
        
        // Fix broken try-catch structures in catch blocks
        transformedBody = transformedBody.replace(/try\s*\{\s*\)\s*;\s*\}/g, '');
        transformedBody = transformedBody.replace(/try\s*\{\s*\)\s*;\s*\}\s*catch\s*\{\}/g, '');
        transformedBody = transformedBody.replace(/\}\s*\}\s*catch\s*\{\}/g, '} catch {}');
        
        // Step 9: Normalize indentation
        transformedBody = normalizeIndentation(transformedBody, 2);

        // Step 10: Ensure proper try-catch structure
        const hasTryCatch = /^\s*try\s*\{/s.test(transformedBody.trim());
        if (!hasTryCatch && transformedBody.trim()) {
          // Wrap in try-catch if missing
          transformedBody = 'try {\n' + transformedBody.replace(/^/gm, '  ') + '\n} catch (error: any) {\n    console.error(\'Error:\', error);\n    return NextResponse.json(\n      { error: \'Internal server error\', details: error.message },\n      { status: 500 }\n    );\n  }';
        }
        
        // Step 11: Remove unused requireAuth import if not used anywhere
        // This will be done after writing the transformed file

        // Build wrapper options
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
        
        const newHandler = `export const ${method} = withAuthTenant(async ${handlerArgs} => {\n${transformedBody}\n}${optionsString});`;

        // Replace old handler
        content = content.slice(0, functionStart) + newHandler + content.slice(endIndex + 1);
        transformed = true;
        result.changes.push(`Transformed ${method}`);
      }
    }

    if (transformed) {
      // Remove unused requireAuth import if not used anywhere (after transformation)
      if (!/requireAuth\(/g.test(content)) {
        content = content.replace(/import\s+{\s*requireAuth\s*}\s+from\s+['"]@\/lib\/auth\/requireAuth['"];?\s*\n?/g, '');
        result.changes.push('Removed unused requireAuth import');
      }
      
      // Clean up: remove duplicate blank lines
      content = content.replace(/\n\s*\n\s*\n+/g, '\n\n');
      
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

  console.log('🔧 Improved Codemod v2: Apply withAuthTenant Wrapper\n');

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
    result.changes.forEach(c => console.log(`    ✅ ${c}`));
  }
  if (result.warnings.length > 0) {
    console.log(`  Warnings:`);
    result.warnings.forEach(w => console.log(`    ⚠️  ${w}`));
  }
  if (result.errors.length > 0) {
    console.log(`  Errors:`);
    result.errors.forEach(e => console.log(`    ❌ ${e}`));
  }
}

if (require.main === module) {
  main();
}
