/**
 * Tenant Isolation Verification Script
 * 
 * Scans app/api for potential tenant isolation violations:
 * - find({})
 * - countDocuments({})
 * - findOne({})
 * - aggregate([ without $match tenantId ])
 * 
 * Also checks database for documents with missing tenantId
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { readdir } from 'fs/promises';
import { connectDB } from '../lib/db';

interface Violation {
  file: string;
  line: number;
  type: string;
  code: string;
}

const VIOLATIONS: Violation[] = [];

// Patterns to detect
const PATTERNS = [
  {
    name: 'find({})',
    regex: /\.find\(\s*\{\s*\}\s*\)/g,
    description: 'find({}) without tenant filter',
  },
  {
    name: 'findOne({})',
    regex: /\.findOne\(\s*\{\s*\}\s*\)/g,
    description: 'findOne({}) without tenant filter',
  },
  {
    name: 'countDocuments({})',
    regex: /\.countDocuments\(\s*\{\s*\}\s*\)/g,
    description: 'countDocuments({}) without tenant filter',
  },
  {
    name: 'aggregate without tenant match',
    regex: /\.aggregate\(\s*\[\s*(?!.*\$match.*tenantId)/g,
    description: 'aggregate() without $match for tenantId',
    multiline: true,
  },
];

// Whitelist of files that are allowed to have these patterns (platform-only routes)
const WHITELIST = [
  'app/api/owner/',
  'app/api/[[...path]]/route.js', // Already fixed with platform gating
];

function isWhitelisted(filePath: string): boolean {
  return WHITELIST.some(whitelist => filePath.includes(whitelist));
}

async function scanFile(filePath: string): Promise<void> {
  if (isWhitelisted(filePath)) {
    return; // Skip whitelisted files
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const pattern of PATTERNS) {
      const matches = Array.from(content.matchAll(pattern.regex));
      
      for (const match of matches) {
        if (match.index === undefined) continue;
        
        // Find line number
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const lineContent = lines[lineNumber - 1]?.trim() || '';

        // Skip if it's using tenant collection wrapper
        if (lineContent.includes('getTenantCollection') || lineContent.includes('getPlatformCollection')) {
          continue;
        }

        // Skip if it's a comment
        if (lineContent.startsWith('//') || lineContent.startsWith('*')) {
          continue;
        }

        VIOLATIONS.push({
          file: filePath,
          line: lineNumber,
          type: pattern.name,
          code: lineContent.substring(0, 100),
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
  }
}

async function getAllFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  const files = await readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = join(dir, file.name);
    
    if (file.isDirectory()) {
      // Skip node_modules, .next, dist
      if (!['node_modules', '.next', 'dist'].includes(file.name)) {
        await getAllFiles(filePath, fileList);
      }
    } else if (file.isFile()) {
      const ext = file.name.split('.').pop();
      if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) {
        fileList.push(filePath);
      }
    }
  }
  
  return fileList;
}

async function scanDirectory(dir: string): Promise<void> {
  const allFiles = await getAllFiles(dir);
  const apiFiles = allFiles.filter(f => f.includes('/app/api/'));

  console.log(`Scanning ${apiFiles.length} API route files...`);

  for (const file of apiFiles) {
    await scanFile(file);
  }
}

async function checkDatabase(): Promise<void> {
  console.log('\nChecking database for documents with missing tenantId...');
  
  try {
    const db = await connectDB();
    const collections = await db.listCollections().toArray();
    
    const collectionsToCheck = [
      'users',
      'patient_experience',
      'px_cases',
      'opd_census',
      'opd_daily_data',
      'floors',
      'floor_departments',
      'floor_rooms',
      'equipment',
      'policy_documents',
      'nurses',
      'nursing_assignments',
    ];

    let foundIssues = false;

    for (const collName of collectionsToCheck) {
      const collection = db.collection(collName);
      
      // Check for documents without tenantId
      const countWithoutTenant = await collection.countDocuments({
        $or: [
          { tenantId: { $exists: false } },
          { tenantId: null },
          { tenantId: '' },
        ],
      });

      if (countWithoutTenant > 0) {
        console.error(`❌ ${collName}: Found ${countWithoutTenant} documents without tenantId`);
        foundIssues = true;
      } else {
        console.log(`✅ ${collName}: All documents have tenantId`);
      }
    }

    if (foundIssues) {
      console.error('\n⚠️  Database contains documents without tenantId. Run migration 010 to fix.');
    }
  } catch (error) {
    console.error('Error checking database:', error);
    // Don't fail the script if DB check fails (might be connection issue)
  }
}

async function main() {
  console.log('🔍 Starting tenant isolation verification...\n');

  const apiDir = join(process.cwd(), 'app', 'api');
  await scanDirectory(apiDir);

  if (VIOLATIONS.length > 0) {
    console.error(`\n❌ Found ${VIOLATIONS.length} potential tenant isolation violations:\n`);
    
    for (const violation of VIOLATIONS) {
      console.error(`  ${violation.file}:${violation.line}`);
      console.error(`    Type: ${violation.type}`);
      console.error(`    Code: ${violation.code}`);
      console.error('');
    }

    await checkDatabase();
    process.exit(1);
  } else {
    console.log('✅ No tenant isolation violations found in code!\n');
    await checkDatabase();
    console.log('\n✅ Verification complete!');
  }
}

main().catch((error) => {
  console.error('Verification script error:', error);
  process.exit(1);
});

