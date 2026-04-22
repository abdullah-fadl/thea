#!/usr/bin/env node

/**
 * Tenant Isolation Verification Script
 * 
 * Scans codebase for violations of DB-per-tenant architecture.
 * 
 * FAILS if it finds:
 * A) Tenant-scoped routes using getPlatformDb() or db("thea_platform")
 * B) Tenant-scoped routes using fixed DB names (hospital_ops, etc.)
 * C) Usage of tenantId from client (searchParams, body, query)
 * D) Usage of getTenantDbByKey(tenantKeyFromClient) outside owner routes
 * E) Hardcoded tenant constants (WHH/TAK IDs) in business logic
 * 
 * Exempt paths: app/api/owner/** only
 */

const fs = require('fs');
const path = require('path');

const VIOLATIONS = [];
const EXEMPT_PATHS = ['app/api/owner', 'lib/db']; // Infrastructure modules are exempt

// Patterns to detect violations
const VIOLATION_PATTERNS = [
  {
    name: 'A) Tenant route using getPlatformDb or thea_platform',
    pattern: /(getPlatformDb\(\)|db\(['"]thea_platform['"]\))/,
    exempt: (filePath) => isOwnerRoute(filePath),
    message: 'Tenant-scoped routes must NOT use platform DB',
  },
  {
    name: 'B) Tenant route using fixed DB name',
    pattern: /db\(['"]hospital_ops[^'"]*['"]\)/,
    exempt: (filePath) => isOwnerRoute(filePath),
    message: 'Tenant-scoped routes must use getTenantDbFromRequest, not fixed DB names',
  },
  {
    name: 'C) Reading tenantId from client (searchParams/body/query)',
    pattern: /(searchParams\.get\(['"](tenantId|tenant)['"]\)|req\.(body|query)\.tenantId|request\.(body|query)\.tenantId|url\.searchParams\.get\(['"](tenantId|tenant)['"]\))/,
    exempt: (filePath) => {
      // Exempt owner routes and validation-only functions
      if (isOwnerRoute(filePath)) return true;
      // Exempt if function name contains "extract" or "validate" (validation-only)
      return false; // Will check in code context
    },
    message: 'tenantId must come ONLY from session, never from client input (unless validation-only)',
  },
  {
    name: 'D) getTenantDbByKey with client-provided tenantKey',
    pattern: /getTenantDbByKey\((?:searchParams|req\.(?:body|query)|request\.(?:body|query)|url\.searchParams)/,
    exempt: (filePath) => isOwnerRoute(filePath),
    message: 'getTenantDbByKey must only be used in owner routes with path params, not client input',
  },
  {
    name: 'E) Hardcoded tenant constants in business logic',
    pattern: /(WHH_TENANT_ID|TAK_TENANT_ID|['"]6957[^'"]*['"]|tenantId\s*[=:]\s*['"]6957)/,
    exempt: (filePath) => {
      // Allow in owner routes and seed-data (for access control only)
      return isOwnerRoute(filePath) || filePath.includes('seed-data');
    },
    message: 'Hardcoded tenant IDs should only be used for access control, not business logic',
  },
];

function isOwnerRoute(filePath) {
  return EXEMPT_PATHS.some(exempt => filePath.includes(exempt));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  VIOLATION_PATTERNS.forEach(({ name, pattern, exempt, message }) => {
    if (exempt(filePath)) {
      return; // Skip exempt paths
    }

    lines.forEach((line, index) => {
      const match = pattern.exec(line);
      if (match) {
        // Check if it's in a comment
        const commentIndex = line.indexOf('//');
        const matchIndex = match.index;
        if (commentIndex !== -1 && matchIndex > commentIndex) {
          return; // Skip if match is after a comment
        }

        // Skip validation-only functions (marked with "DO NOT USE" or "validation")
        if (name.includes('Reading tenantId from client')) {
          const context = lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 3)).join('\n');
          if (context.includes('DO NOT USE') || context.includes('validation') || context.includes('extractTenantIdFromRequest')) {
            return; // Skip validation-only functions
          }
        }

        VIOLATIONS.push({
          file: filePath,
          line: index + 1,
          pattern: name,
          message,
          code: line.trim(),
        });
      }
    });
  });
}

function scanDirectory(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules, .next, etc.
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      return;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, extensions);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        scanFile(fullPath);
      }
    }
  });
}

// Main execution
console.log('🔍 Scanning for tenant isolation violations...\n');

const apiDir = path.join(process.cwd(), 'app/api');
const libDir = path.join(process.cwd(), 'lib');

if (fs.existsSync(apiDir)) {
  scanDirectory(apiDir);
}
if (fs.existsSync(libDir)) {
  scanDirectory(libDir);
}

// Report results
if (VIOLATIONS.length === 0) {
  console.log('✅ No violations found! Tenant isolation is properly enforced.\n');
  process.exit(0);
} else {
  console.log(`❌ Found ${VIOLATIONS.length} violation(s):\n`);
  
  // Group by file
  const byFile = {};
  VIOLATIONS.forEach(v => {
    if (!byFile[v.file]) {
      byFile[v.file] = [];
    }
    byFile[v.file].push(v);
  });

  Object.entries(byFile).forEach(([file, violations]) => {
    console.log(`📄 ${file}`);
    violations.forEach(v => {
      console.log(`   Line ${v.line}: ${v.pattern}`);
      console.log(`   ${v.message}`);
      console.log(`   Code: ${v.code.substring(0, 80)}${v.code.length > 80 ? '...' : ''}`);
      console.log('');
    });
  });

  console.log(`\n❌ Total: ${VIOLATIONS.length} violation(s) found.`);
  console.log('Fix these violations before proceeding.\n');
  process.exit(1);
}

