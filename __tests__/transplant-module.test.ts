/**
 * Transplant Module Tests — Thea EHR
 *
 * 16 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Transplant Case CRUD
 *   7-9   Follow-Up Management
 *   10-12 Rejection Episodes
 *   13-16 Business Logic & Quality
 */

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

// ===================================================================
// 1-3: Route Wiring & Auth
// ===================================================================

describe('Transplant — Route Wiring', () => {
  const casesRoute = readRoute('app', 'api', 'transplant', 'cases', 'route.ts');
  const caseDetailRoute = readRoute('app', 'api', 'transplant', 'cases', '[id]', 'route.ts');
  const followUpsRoute = readRoute('app', 'api', 'transplant', 'cases', '[id]', 'follow-ups', 'route.ts');
  const rejectionsRoute = readRoute('app', 'api', 'transplant', 'cases', '[id]', 'rejections', 'route.ts');

  it('1 — All transplant routes exist on disk (base + waitlist)', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'transplant'));
    expect(routes.length).toBeGreaterThanOrEqual(4);
  });

  it('2 — All routes use withAuthTenant, withErrorHandler, and prisma', () => {
    for (const src of [casesRoute, caseDetailRoute, followUpsRoute, rejectionsRoute]) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('withErrorHandler');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — Permission keys: transplant.view for reads, transplant.manage for writes', () => {
    expect(casesRoute).toContain("permissionKey: 'transplant.view'");
    expect(casesRoute).toContain("permissionKey: 'transplant.manage'");
    expect(caseDetailRoute).toContain("permissionKey: 'transplant.view'");
    expect(caseDetailRoute).toContain("permissionKey: 'transplant.manage'");
    expect(followUpsRoute).toContain("permissionKey: 'transplant.manage'");
    expect(rejectionsRoute).toContain("permissionKey: 'transplant.view'");
    expect(rejectionsRoute).toContain("permissionKey: 'transplant.manage'");
  });
});

// ===================================================================
// 4-6: Transplant Case CRUD
// ===================================================================

describe('Transplant — Case CRUD', () => {
  const casesRoute = readRoute('app', 'api', 'transplant', 'cases', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'transplant', 'cases', '[id]', 'route.ts');

  it('4 — GET /api/transplant/cases lists cases ordered by createdAt desc', () => {
    expect(casesRoute).toContain('transplantCase.findMany');
    expect(casesRoute).toContain("orderBy: { createdAt: 'desc' }");
    expect(casesRoute).toContain('take: 100');
  });

  it('5 — POST creates case with organType, transplantType (defaults to DECEASED_DONOR), and PRA', () => {
    expect(casesRoute).toContain('transplantCase.create');
    expect(casesRoute).toContain('organType');
    expect(casesRoute).toContain("body.transplantType || 'DECEASED_DONOR'");
    expect(casesRoute).toContain('pra');
    expect(casesRoute).toContain('hlaMatch');
    expect(casesRoute).toContain('{ status: 201 }');
  });

  it('6 — GET /api/transplant/cases/[id] includes followUps and rejectionEpisodes', () => {
    expect(detailRoute).toContain('transplantCase.findFirst');
    expect(detailRoute).toContain('include');
    expect(detailRoute).toContain('followUps');
    expect(detailRoute).toContain('rejectionEpisodes');
    expect(detailRoute).toContain("{ error: 'Not found' }");
  });
});

// ===================================================================
// 7-9: Follow-Up Management
// ===================================================================

describe('Transplant — Follow-Ups', () => {
  const followUpsRoute = readRoute('app', 'api', 'transplant', 'cases', '[id]', 'follow-ups', 'route.ts');

  it('7 — POST creates follow-up with graft function, labs, medications, complications', () => {
    expect(followUpsRoute).toContain('transplantFollowUp.create');
    expect(followUpsRoute).toContain('graftFunction');
    expect(followUpsRoute).toContain('labs');
    expect(followUpsRoute).toContain('medications');
    expect(followUpsRoute).toContain('complications');
  });

  it('8 — Follow-up captures biopsy info (biopsyDone, biopsyResult)', () => {
    expect(followUpsRoute).toContain('biopsyDone');
    expect(followUpsRoute).toContain('biopsyResult');
    expect(followUpsRoute).toContain('Boolean(body.biopsyDone)');
  });

  it('9 — Follow-up tracks daysPostTransplant and nextVisit scheduling', () => {
    expect(followUpsRoute).toContain('daysPostTransplant');
    expect(followUpsRoute).toContain('nextVisit');
    expect(followUpsRoute).toContain('plan');
    expect(followUpsRoute).toContain('clinicianId');
  });
});

// ===================================================================
// 10-12: Rejection Episodes
// ===================================================================

describe('Transplant — Rejection Episodes', () => {
  const rejectionsRoute = readRoute('app', 'api', 'transplant', 'cases', '[id]', 'rejections', 'route.ts');

  it('10 — GET rejections validates case exists before returning rejection list', () => {
    expect(rejectionsRoute).toContain('transplantCase.findFirst');
    expect(rejectionsRoute).toContain("{ error: 'Case not found' }");
    expect(rejectionsRoute).toContain('transplantRejection.findMany');
  });

  it('11 — POST rejection requires onsetDate, type, and treatment', () => {
    expect(rejectionsRoute).toContain('transplantRejection.create');
    expect(rejectionsRoute).toContain("'onsetDate, type, and treatment are required'");
  });

  it('12 — Rejection captures Banff grading, response, and graft loss boolean', () => {
    expect(rejectionsRoute).toContain('banffGrade');
    expect(rejectionsRoute).toContain('response');
    expect(rejectionsRoute).toContain('graftLoss');
    expect(rejectionsRoute).toContain('Boolean(graftLoss)');
  });
});

// ===================================================================
// 13-16: Business Logic & Quality
// ===================================================================

describe('Transplant — Business Logic & Quality', () => {
  const detailRoute = readRoute('app', 'api', 'transplant', 'cases', '[id]', 'route.ts');
  const casesRoute = readRoute('app', 'api', 'transplant', 'cases', 'route.ts');

  it('13 — PUT case update handles coldIschemiaTime as number', () => {
    expect(detailRoute).toContain('coldIschemiaTime');
    expect(detailRoute).toContain('Number(body.coldIschemiaTime)');
  });

  it('14 — PUT case updates crossmatchResult and transplantDate', () => {
    expect(detailRoute).toContain('crossmatchResult');
    expect(detailRoute).toContain('transplantDate');
    expect(detailRoute).toContain('new Date(body.transplantDate)');
  });

  it('15 — Surgeon defaults to current user if not specified', () => {
    expect(casesRoute).toContain('body.surgeonId || userId');
  });

  it('16 — No skeleton or dummy data in any route', () => {
    const allRoutes = findRoutes(path.join(process.cwd(), 'app', 'api', 'transplant'));
    for (const fp of allRoutes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});
