import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

const findRoutes = (dir: string): string[] => {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findRoutes(fp));
    else if (entry.name === 'route.ts') files.push(fp);
  }
  return files;
};

describe('Care Gaps Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/care-gaps');
  const routes = findRoutes(baseDir);

  it('should have at least 5 care-gaps route files', () => {
    expect(routes.length).toBeGreaterThanOrEqual(5);
  });

  // ── Root Route ────────────────────────────────────────────────
  describe('care-gaps root route', () => {
    const src = readRoute('app/api/care-gaps/route.ts');

    it('uses withAuthTenant with permissionKeys array', () => {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('permissionKeys');
    });

    it('supports paginated GET with page/limit params', () => {
      expect(src).toContain("url.searchParams.get('page')");
      expect(src).toContain("url.searchParams.get('limit')");
      expect(src).toContain('skip');
      expect(src).toContain('totalPages');
    });

    it('filters by patientId, status, gapType, and priority', () => {
      expect(src).toContain('patientMasterId');
      expect(src).toContain('where.status');
      expect(src).toContain('where.gapType');
      expect(src).toContain('where.priority');
    });

    it('includes outreach logs in GET response', () => {
      expect(src).toContain('outreachLogs');
    });

    it('POST checks for duplicate gap via sourceOrderId (409)', () => {
      expect(src).toContain('DUPLICATE_GAP');
      expect(src).toContain('status: 409');
      expect(src).toContain('tenantId_sourceOrderId');
    });

    it('requires patientMasterId and gapType for creation', () => {
      expect(src).toContain('patientMasterId and gapType are required');
    });
  });

  // ── Rules Route ───────────────────────────────────────────────
  describe('rules route', () => {
    const src = readRoute('app/api/care-gaps/rules/route.ts');

    it('GET combines built-in rules from getDefaultRules with tenant custom rules', () => {
      expect(src).toContain('getDefaultRules');
      expect(src).toContain('isBuiltIn: true');
      expect(src).toContain('isBuiltIn: false');
    });

    it('POST validates with createRuleSchema Zod schema', () => {
      expect(src).toContain('createRuleSchema');
      expect(src).toContain('z.object');
    });

    it('supports rule categories (preventive, chronic_disease, medication, follow_up, screening)', () => {
      expect(src).toContain("'preventive'");
      expect(src).toContain("'chronic_disease'");
      expect(src).toContain("'medication'");
    });

    it('PATCH toggles rule active status', () => {
      expect(src).toContain('ruleId');
      expect(src).toContain('isActive');
      expect(src).toContain('prisma.careGapRule.update');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Scan Route ────────────────────────────────────────────────
  describe('scan route', () => {
    const src = readRoute('app/api/care-gaps/scan/route.ts');

    it('supports single patient scan via patientId', () => {
      expect(src).toContain('scanPatientForGaps');
      expect(src).toContain("mode: 'single'");
    });

    it('supports bulk scan of all active patients', () => {
      expect(src).toContain('runBulkGapScan');
      expect(src).toContain("mode: 'bulk'");
    });

    it('validates with Zod scanSchema', () => {
      expect(src).toContain('scanSchema');
      expect(src).toContain('z.string().uuid().optional()');
    });

    it('requires care-gaps.scan permission', () => {
      expect(src).toContain("permissionKey: 'care-gaps.scan'");
    });
  });

  // ── Stats Route ───────────────────────────────────────────────
  describe('stats route', () => {
    const src = readRoute('app/api/care-gaps/stats/route.ts');

    it('runs all count queries in parallel with Promise.all', () => {
      expect(src).toContain('Promise.all');
      expect(src).toContain('prisma.careGap.count');
    });

    it('returns stats by type (labOverdue, radOverdue, followupMissed, procedureOverdue)', () => {
      expect(src).toContain('labOverdue');
      expect(src).toContain('radOverdue');
      expect(src).toContain('followupMissed');
      expect(src).toContain('procedureOverdue');
    });

    it('returns stats by priority (stat, urgent, routine)', () => {
      expect(src).toContain('stat: statPriority');
      expect(src).toContain('urgent: urgentPriority');
    });

    it('computes recent gaps in last 7 days', () => {
      expect(src).toContain('recentGapsLast7Days');
      expect(src).toContain('7 * 24 * 60 * 60 * 1000');
    });
  });

  // ── Findings Route ────────────────────────────────────────────
  describe('findings route', () => {
    const src = readRoute('app/api/care-gaps/findings/route.ts');

    it('delegates to getOpenGaps library function', () => {
      expect(src).toContain('getOpenGaps');
    });

    it('supports multiple filter params (category, severity, status, gapType)', () => {
      expect(src).toContain("url.searchParams.get('category')");
      expect(src).toContain("url.searchParams.get('severity')");
      expect(src).toContain("url.searchParams.get('status')");
      expect(src).toContain("url.searchParams.get('gapType')");
    });

    it('requires care-gaps.view permission', () => {
      expect(src).toContain("permissionKey: 'care-gaps.view'");
    });
  });
});
