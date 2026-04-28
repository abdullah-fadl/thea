/**
 * Script to add permissionKey to all CVision API routes missing it.
 *
 * Strategy: Use AST-like approach to find the actual withAuthTenant closing
 * by counting parentheses depth from the export const line.
 *
 * Usage: npx tsx scripts/fix-cvision-permissions.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const CVISION_API_DIR = path.join(__dirname, '..', 'app', 'api', 'cvision');

// Map route directory names to permission keys
const ROUTE_TO_PERMISSION: Record<string, { read: string; write: string }> = {
  'employees': { read: 'cvision.employees.read', write: 'cvision.employees.write' },
  'recruitment': { read: 'cvision.recruitment.read', write: 'cvision.recruitment.write' },
  'payroll': { read: 'cvision.payroll.read', write: 'cvision.payroll.write' },
  'leaves': { read: 'cvision.leaves.read', write: 'cvision.leaves.write' },
  'attendance': { read: 'cvision.attendance.read', write: 'cvision.attendance.write' },
  'scheduling': { read: 'cvision.scheduling.read', write: 'cvision.scheduling.write' },
  'schedules': { read: 'cvision.scheduling.read', write: 'cvision.scheduling.write' },
  'performance': { read: 'cvision.performance.read', write: 'cvision.performance.write' },
  'promotions': { read: 'cvision.promotions.read', write: 'cvision.promotions.write' },
  'disciplinary': { read: 'cvision.disciplinary.read', write: 'cvision.disciplinary.write' },
  'contracts': { read: 'cvision.contracts.read', write: 'cvision.contracts.write' },
  'letters': { read: 'cvision.letters.read', write: 'cvision.letters.write' },
  'training': { read: 'cvision.training.read', write: 'cvision.training.write' },
  'insurance': { read: 'cvision.insurance.read', write: 'cvision.insurance.write' },
  'travel': { read: 'cvision.travel.read', write: 'cvision.travel.write' },
  'compensation': { read: 'cvision.compensation.read', write: 'cvision.compensation.write' },
  'succession': { read: 'cvision.succession.read', write: 'cvision.succession.write' },
  'surveys': { read: 'cvision.surveys.read', write: 'cvision.surveys.write' },
  'grievances': { read: 'cvision.grievances.read', write: 'cvision.grievances.write' },
  'assets': { read: 'cvision.assets.read', write: 'cvision.assets.write' },
  'compliance': { read: 'cvision.compliance.read', write: 'cvision.compliance.write' },
  'safety': { read: 'cvision.safety.read', write: 'cvision.safety.write' },
  'reports': { read: 'cvision.reports.read', write: 'cvision.reports.read' },
  'report-engine': { read: 'cvision.reports.read', write: 'cvision.reports.read' },
  'workflows': { read: 'cvision.workflows.read', write: 'cvision.workflows.write' },
  'notifications': { read: 'cvision.notifications.read', write: 'cvision.notifications.write' },
  'onboarding': { read: 'cvision.onboarding.read', write: 'cvision.onboarding.write' },
  'org': { read: 'cvision.org.read', write: 'cvision.org.write' },
  'org-design': { read: 'cvision.org_design.read', write: 'cvision.org_design.write' },
  'org-health': { read: 'cvision.org_health.read', write: 'cvision.org_health.write' },
  'departments': { read: 'cvision.org.read', write: 'cvision.org.write' },
  'units': { read: 'cvision.org.read', write: 'cvision.org.write' },
  'positions': { read: 'cvision.org.read', write: 'cvision.org.write' },
  'job-titles': { read: 'cvision.org.read', write: 'cvision.org.write' },
  'grades': { read: 'cvision.org.read', write: 'cvision.config.write' },
  'branches': { read: 'cvision.branches.read', write: 'cvision.branches.write' },
  'requests': { read: 'cvision.requests.read', write: 'cvision.requests.write' },
  'delegations': { read: 'cvision.delegation.manage', write: 'cvision.delegation.manage' },
  'assignments': { read: 'cvision.employees.read', write: 'cvision.employees.write' },
  'calendar': { read: 'cvision.attendance.read', write: 'cvision.attendance.write' },
  'dashboard': { read: 'cvision.dashboards.read', write: 'cvision.dashboards.write' },
  'dashboards': { read: 'cvision.dashboards.read', write: 'cvision.dashboards.write' },
  'analytics': { read: 'cvision.dashboards.read', write: 'cvision.dashboards.read' },
  'bi': { read: 'cvision.dashboards.read', write: 'cvision.dashboards.read' },
  'ai': { read: 'cvision.view', write: 'cvision.view' },
  'chatbot': { read: 'cvision.view', write: 'cvision.view' },
  'admin': { read: 'cvision.config.write', write: 'cvision.config.write' },
  'integrations': { read: 'cvision.integrations.read', write: 'cvision.integrations.write' },
  'integrations-mgr': { read: 'cvision.integrations.manage', write: 'cvision.integrations.manage' },
  'webhooks': { read: 'cvision.webhooks.manage', write: 'cvision.webhooks.manage' },
  'import': { read: 'cvision.import.execute', write: 'cvision.import.execute' },
  'export': { read: 'cvision.export.execute', write: 'cvision.export.execute' },
  'audit-log': { read: 'cvision.audit.read', write: 'cvision.audit.read' },
  'audit': { read: 'cvision.audit.read', write: 'cvision.audit.read' },
  'bulk': { read: 'cvision.bulk_operations', write: 'cvision.bulk_operations' },
  'self-service': { read: 'cvision.self_service', write: 'cvision.self_service' },
  'sessions': { read: 'cvision.view', write: 'cvision.view' },
  'auth': { read: 'cvision.view', write: 'cvision.view' },
  'authz': { read: 'cvision.view', write: 'cvision.view' },
  'authz-context': { read: 'cvision.view', write: 'cvision.view' },
  'muqeem': { read: 'cvision.muqeem.read', write: 'cvision.muqeem.write' },
  'absher': { read: 'cvision.muqeem.read', write: 'cvision.muqeem.write' },
  'gosi': { read: 'cvision.integrations.read', write: 'cvision.integrations.write' },
  'iban': { read: 'cvision.employees.read', write: 'cvision.employees.write' },
  'housing': { read: 'cvision.employees.read', write: 'cvision.employees.write' },
  'meals': { read: 'cvision.employees.read', write: 'cvision.employees.write' },
  'paycards': { read: 'cvision.payroll.read', write: 'cvision.payroll.write' },
  'loans': { read: 'cvision.loans.read', write: 'cvision.loans.write' },
  'headcount-budget': { read: 'cvision.manpower.read', write: 'cvision.manpower.write' },
  'headcount': { read: 'cvision.manpower.read', write: 'cvision.manpower.write' },
  'manpower': { read: 'cvision.manpower.read', write: 'cvision.manpower.write' },
  'predictive': { read: 'cvision.dashboards.read', write: 'cvision.dashboards.read' },
  'process-analysis': { read: 'cvision.process.read', write: 'cvision.process.write' },
  'strategic-alignment': { read: 'cvision.strategic.read', write: 'cvision.strategic.write' },
  'change-management': { read: 'cvision.change_mgmt.read', write: 'cvision.change_mgmt.write' },
  'culture': { read: 'cvision.culture.read', write: 'cvision.culture.write' },
  'company-policies': { read: 'cvision.policies.read', write: 'cvision.policies.write' },
  'profile-schemas': { read: 'cvision.config.write', write: 'cvision.config.write' },
  'recognition': { read: 'cvision.rewards.read', write: 'cvision.rewards.write' },
  'retention': { read: 'cvision.employees.read', write: 'cvision.employees.write' },
  'engagement': { read: 'cvision.culture.read', write: 'cvision.culture.write' },
  'investigations': { read: 'cvision.disciplinary.read', write: 'cvision.disciplinary.write' },
  'okrs': { read: 'cvision.performance.read', write: 'cvision.performance.write' },
  'communications': { read: 'cvision.notifications.read', write: 'cvision.notifications.write' },
  'announcements': { read: 'cvision.notifications.read', write: 'cvision.notifications.write' },
  'files': { read: 'cvision.files.read', write: 'cvision.files.write' },
  'data-quality': { read: 'cvision.audit.read', write: 'cvision.config.write' },
  'data-warehouse': { read: 'cvision.dashboards.read', write: 'cvision.config.write' },
  'diagnostics': { read: 'cvision.config.write', write: 'cvision.config.write' },
  'dev-override': { read: 'cvision.config.write', write: 'cvision.config.write' },
  'segments': { read: 'cvision.dashboards.read', write: 'cvision.dashboards.write' },
  'approval-matrix': { read: 'cvision.config.write', write: 'cvision.config.write' },
  'bookings': { read: 'cvision.scheduling.read', write: 'cvision.scheduling.write' },
  'directory': { read: 'cvision.employees.read', write: 'cvision.employees.read' },
  'jobs': { read: 'cvision.recruitment.read', write: 'cvision.recruitment.write' },
  'offer-portal': { read: 'cvision.recruitment.read', write: 'cvision.recruitment.write' },
  'internal': { read: 'cvision.recruitment.read', write: 'cvision.recruitment.write' },
  'teams': { read: 'cvision.org.read', write: 'cvision.org.write' },
  'table-preferences': { read: 'cvision.view', write: 'cvision.view' },
  'timesheets': { read: 'cvision.attendance.read', write: 'cvision.attendance.write' },
  'transport': { read: 'cvision.employees.read', write: 'cvision.employees.write' },
  'undo': { read: 'cvision.view', write: 'cvision.view' },
  'violations': { read: 'cvision.disciplinary.read', write: 'cvision.disciplinary.write' },
  'wellness': { read: 'cvision.employees.read', write: 'cvision.employees.write' },
  'whatif': { read: 'cvision.dashboards.read', write: 'cvision.dashboards.read' },
  'workflow-instances': { read: 'cvision.workflows.read', write: 'cvision.workflows.write' },
};

// Skip list
const SKIP_DIRS = ['health', 'docs', 'public', 'cron', 'seed', 'saas'];

function getPermissionForPath(filePath: string): { read: string; write: string } {
  const relPath = path.relative(CVISION_API_DIR, filePath);
  const parts = relPath.split(path.sep);
  const moduleName = parts[0];
  return ROUTE_TO_PERMISSION[moduleName] || { read: 'cvision.view', write: 'cvision.view' };
}

function shouldSkip(filePath: string): boolean {
  const relPath = path.relative(CVISION_API_DIR, filePath);
  const parts = relPath.split(path.sep);
  return SKIP_DIRS.some(skip => parts.includes(skip));
}

function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === 'route.ts') {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Find the closing ");' of withAuthTenant by counting parentheses depth.
 * Starting from the opening "(" of withAuthTenant, track depth until we reach 0.
 */
function findWithAuthTenantClose(content: string, openParenIndex: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let templateDepth = 0;

  for (let i = openParenIndex; i < content.length; i++) {
    const ch = content[i];
    const prev = i > 0 ? content[i - 1] : '';

    // Skip escaped characters
    if (prev === '\\') continue;

    // Handle string literals
    if (!inString && !inTemplate && (ch === "'" || ch === '"' || ch === '`')) {
      if (ch === '`') {
        inTemplate = true;
        templateDepth = 0;
      } else {
        inString = true;
        stringChar = ch;
      }
      continue;
    }

    if (inString && ch === stringChar) {
      inString = false;
      continue;
    }

    if (inTemplate) {
      if (ch === '`' && templateDepth === 0) {
        inTemplate = false;
        continue;
      }
      if (ch === '{' && prev === '$') templateDepth++;
      if (ch === '}' && templateDepth > 0) templateDepth--;
      continue;
    }

    if (inString) continue;

    // Track parentheses
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function processFile(filePath: string): { modified: boolean; reason: string } {
  if (shouldSkip(filePath)) {
    return { modified: false, reason: 'skipped' };
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  if (content.includes('permissionKey')) {
    return { modified: false, reason: 'already has permissionKey' };
  }

  if (!content.includes('withAuthTenant')) {
    return { modified: false, reason: 'no withAuthTenant' };
  }

  const perms = getPermissionForPath(filePath);
  const methods: string[] = [];

  // Find all: export const METHOD = withAuthTenant(
  const methodRegex = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*withAuthTenant\s*\(/g;
  let match;
  const edits: { closeIdx: number; method: string; hasOptions: boolean }[] = [];

  while ((match = methodRegex.exec(content)) !== null) {
    const method = match[1];
    const openParenIdx = match.index + match[0].length - 1; // index of '('
    const closeParenIdx = findWithAuthTenantClose(content, openParenIdx);

    if (closeParenIdx === -1) continue;

    // Check if there's already an options object as second arg
    // Look backwards from closeParenIdx for a '}'
    const beforeClose = content.substring(openParenIdx, closeParenIdx).trimEnd();

    // Check pattern: the second argument is an object literal { ... }
    // We need to check if the content before ')' has a second argument
    // Simple heuristic: find the last '}' before closeParenIdx and check if it's
    // part of an options object (not the handler function body)

    // Find the handler function end by looking for the pattern:
    // async (...) => { ... }, { options }) or async (...) => { ... })
    // The handler's closing brace is followed by either ',' (has options) or ')' (no options)

    // Better approach: look at what comes right before the closing ')'
    const textBeforeClose = content.substring(openParenIdx, closeParenIdx);

    // Count: if there's a , { ... } after the main handler function, it has options
    // The handler is always: async (req, ctx) => { ... }
    // So we look for }, { after the handler block

    // Find if there's an existing options object
    // Match: }, { ... } at the end of the withAuthTenant call
    const optionsMatch = textBeforeClose.match(/\}\s*,\s*(\{[^{}]*\})\s*$/);
    const hasOptions = !!optionsMatch;

    edits.push({ closeIdx: closeParenIdx, method, hasOptions });
    methods.push(method);
  }

  if (edits.length === 0) {
    return { modified: false, reason: 'could not find withAuthTenant pattern' };
  }

  // Apply edits from end to start
  edits.sort((a, b) => b.closeIdx - a.closeIdx);

  for (const edit of edits) {
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(edit.method);
    const permKey = isWrite ? perms.write : perms.read;

    if (edit.hasOptions) {
      // Find the existing options object and add permissionKey
      const beforeClose = content.substring(0, edit.closeIdx);
      // Find the last '}' before the closing ')'
      const lastBrace = beforeClose.lastIndexOf('}');
      if (lastBrace > -1) {
        // Insert permissionKey before the closing }
        content = content.substring(0, lastBrace) +
          `, permissionKey: '${permKey}' ` +
          content.substring(lastBrace);
      }
    } else {
      // No options — insert before the closing ')'
      // The pattern is: ...handler_body}\n)
      // We want: ...handler_body},\n  { platformKey: 'cvision', permissionKey: '...' }\n)
      const beforeClose = content.substring(0, edit.closeIdx);
      const lastBrace = beforeClose.lastIndexOf('}');
      if (lastBrace > -1) {
        // Check: is this the handler's closing brace?
        // It should be followed by whitespace/newline then ')'
        const between = content.substring(lastBrace + 1, edit.closeIdx).trim();
        if (between === '' || between === ',') {
          // Good - this is the handler's closing brace
          content = content.substring(0, lastBrace + 1) +
            `,\n  { platformKey: 'cvision', permissionKey: '${permKey}' }` +
            content.substring(lastBrace + 1, edit.closeIdx) +
            content.substring(edit.closeIdx);
        }
      }
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
  return { modified: true, reason: `${methods.join(', ')}` };
}

// Main
const routeFiles = findRouteFiles(CVISION_API_DIR);
console.log(`Found ${routeFiles.length} CVision route files${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

let modifiedCount = 0;
let skippedCount = 0;
let alreadyCount = 0;
let noAuthCount = 0;

for (const file of routeFiles) {
  const relPath = path.relative(CVISION_API_DIR, file);
  const result = processFile(file);

  if (result.modified) {
    console.log(`✅ ${relPath} — ${result.reason}`);
    modifiedCount++;
  } else if (result.reason === 'already has permissionKey') {
    alreadyCount++;
  } else if (result.reason === 'skipped') {
    skippedCount++;
  } else if (result.reason === 'no withAuthTenant') {
    console.log(`⚠️  ${relPath} — ${result.reason}`);
    noAuthCount++;
  }
}

console.log(`\n--- Summary ---`);
console.log(`Modified: ${modifiedCount}`);
console.log(`Already had permissions: ${alreadyCount}`);
console.log(`Skipped (intentional): ${skippedCount}`);
console.log(`No withAuthTenant: ${noAuthCount}`);
console.log(`Total: ${routeFiles.length}`);
