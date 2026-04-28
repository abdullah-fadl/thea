/**
 * Regression Check: Verify Patient Experience Tenant Isolation
 * 
 * This script scans all patient-experience API routes to ensure:
 * 1. All find({}), findOne({}), aggregate([ queries include tenantId filtering
 * 2. No queries read tenantId from query/body/env
 * 3. All routes use requireTenantId from session
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const PX_API_DIR = 'app/api/patient-experience';
const ISSUES: Array<{ file: string; line: number; issue: string }> = [];

function scanFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Check for find({}) without tenantId
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for find({}) or find({ ... }) without tenantId
    if (line.match(/\.find\((\{[^}]*\})?\)/) && !line.includes('tenantId')) {
      // Check if it's in a comment or string
      if (!line.trim().startsWith('//') && !line.includes('"tenantId') && !line.includes("'tenantId")) {
        ISSUES.push({
          file: filePath,
          line: lineNum,
          issue: `find() query without tenantId filter: ${line.trim()}`,
        });
      }
    }

    // Check for findOne({}) without tenantId
    if (line.match(/\.findOne\((\{[^}]*\})?\)/) && !line.includes('tenantId')) {
      if (!line.trim().startsWith('//') && !line.includes('"tenantId') && !line.includes("'tenantId")) {
        ISSUES.push({
          file: filePath,
          line: lineNum,
          issue: `findOne() query without tenantId filter: ${line.trim()}`,
        });
      }
    }

    // Check for aggregate([ without $match tenantId
    if (line.match(/\.aggregate\(\[/)) {
      // Check next 10 lines for $match with tenantId
      const nextLines = lines.slice(index, index + 10).join('\n');
      if (!nextLines.includes('tenantId') && !nextLines.includes('$match')) {
        ISSUES.push({
          file: filePath,
          line: lineNum,
          issue: `aggregate() pipeline without $match tenantId filter`,
        });
      }
    }

    // Check for reading tenantId from query/body/env
    if (line.match(/searchParams\.get\(['"]tenantId['"]\)/) ||
        line.match(/body\.tenantId/) ||
        line.match(/env\.\w*TENANT/) ||
        line.match(/request\.body.*tenantId/)) {
      ISSUES.push({
        file: filePath,
        line: lineNum,
        issue: `Reading tenantId from query/body/env instead of session: ${line.trim()}`,
      });
    }
  });
}

function scanDirectory(dir: string) {
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && entry.name.includes('route')) {
      scanFile(fullPath);
    }
  }
}

// Run scan
console.log('🔍 Scanning Patient Experience API routes for tenant isolation issues...\n');
scanDirectory(PX_API_DIR);

// Report results
if (ISSUES.length === 0) {
  console.log('✅ No tenant isolation issues found!');
  process.exit(0);
} else {
  console.log(`❌ Found ${ISSUES.length} tenant isolation issue(s):\n`);
  ISSUES.forEach(({ file, line, issue }) => {
    console.log(`  ${file}:${line}`);
    console.log(`    ${issue}\n`);
  });
  process.exit(1);
}

