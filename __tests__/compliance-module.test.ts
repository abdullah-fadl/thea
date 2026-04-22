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

describe('Compliance Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/compliance');
  const routes = findRoutes(baseDir);

  it('should have exactly 4 compliance route files', () => {
    expect(routes.length).toBe(4);
  });

  // ── Standards Route ───────────────────────────────────────────
  describe('cbahi/standards route', () => {
    const src = readRoute('app/api/compliance/cbahi/standards/route.ts');

    it('uses withAuthTenant with compliance.cbahi.view permission', () => {
      expect(src).toContain("permissionKey: 'compliance.cbahi.view'");
    });

    it('imports CBAHI_STANDARDS and CBAHI_DOMAINS from lib', () => {
      expect(src).toContain('CBAHI_STANDARDS');
      expect(src).toContain('CBAHI_DOMAINS');
    });

    it('supports domain, search, and priority filters', () => {
      expect(src).toContain("url.searchParams.get('domain')");
      expect(src).toContain("url.searchParams.get('search')");
      expect(src).toContain("url.searchParams.get('priority')");
    });

    it('filters by priority (essential, standard, advanced)', () => {
      expect(src).toContain("'essential'");
      expect(src).toContain("'standard'");
      expect(src).toContain("'advanced'");
    });

    it('serializes standards removing automatedCheck functions', () => {
      expect(src).toContain('hasAutomatedCheck');
      expect(src).toContain('measurableElements');
    });

    it('returns totalCount and filteredCount', () => {
      expect(src).toContain('totalCount');
      expect(src).toContain('filteredCount');
    });
  });

  // ── Audit Route ───────────────────────────────────────────────
  describe('cbahi/audit route', () => {
    const src = readRoute('app/api/compliance/cbahi/audit/route.ts');

    it('has GET/POST/PATCH endpoints', () => {
      expect(src).toContain('export const GET');
      expect(src).toContain('export const POST');
      expect(src).toContain('export const PATCH');
    });

    it('validates with createAssessmentSchema and updateAssessmentSchema', () => {
      expect(src).toContain('createAssessmentSchema');
      expect(src).toContain('updateAssessmentSchema');
    });

    it('supports assessment statuses (draft, in_progress, completed, submitted)', () => {
      expect(src).toContain("'draft'");
      expect(src).toContain("'in_progress'");
      expect(src).toContain("'completed'");
      expect(src).toContain("'submitted'");
    });

    it('creates audit log via createAuditLog on create and update', () => {
      expect(src).toContain('createAuditLog');
      expect(src).toContain("'cbahi_assessment'");
      expect(src).toContain("'CREATE'");
      expect(src).toContain("'UPDATE'");
    });

    it('supports actionPlan with standardId, gap, action, owner, priority', () => {
      expect(src).toContain('actionPlan');
      expect(src).toContain('standardId: z.string()');
      expect(src).toContain('gap: z.string()');
    });

    it('returns 404 when assessment not found', () => {
      expect(src).toContain("'Assessment not found'");
      expect(src).toContain('status: 404');
    });
  });

  // ── Audit Run Route ───────────────────────────────────────────
  describe('cbahi/audit/run route', () => {
    const src = readRoute('app/api/compliance/cbahi/audit/run/route.ts');

    it('runs automated compliance audit via runFullComplianceAudit', () => {
      expect(src).toContain('runFullComplianceAudit');
    });

    it('requires compliance.cbahi.audit permission', () => {
      expect(src).toContain("permissionKey: 'compliance.cbahi.audit'");
    });

    it('supports updating existing assessment or creating new one', () => {
      expect(src).toContain('assessmentId');
      expect(src).toContain('cbahiAssessment.update');
      expect(src).toContain('cbahiAssessment.create');
    });

    it('creates audit log with RUN_AUDIT action', () => {
      expect(src).toContain("'RUN_AUDIT'");
    });
  });

  // ── Evidence Route ────────────────────────────────────────────
  describe('cbahi/evidence route', () => {
    const src = readRoute('app/api/compliance/cbahi/evidence/route.ts');

    it('requires assessmentId for GET', () => {
      expect(src).toContain("'assessmentId is required'");
    });

    it('validates with createEvidenceSchema including evidenceType enum', () => {
      expect(src).toContain('createEvidenceSchema');
      expect(src).toContain("'document'");
      expect(src).toContain("'screenshot'");
      expect(src).toContain("'report'");
      expect(src).toContain("'certificate'");
    });

    it('PATCH supports review workflow (pending, accepted, rejected)', () => {
      expect(src).toContain("'pending'");
      expect(src).toContain("'accepted'");
      expect(src).toContain("'rejected'");
      expect(src).toContain('reviewedAt');
    });

    it('creates audit log for evidence create and review', () => {
      expect(src).toContain("'cbahi_evidence'");
      expect(src).toContain("'REVIEW'");
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
