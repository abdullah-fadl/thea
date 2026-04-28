/**
 * Social Work Module Tests — Thea EHR
 *
 * 15 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Assessment CRUD
 *   7-9   Notes Management
 *   10-12 Business Logic
 *   13-15 Error Handling
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

describe('Social Work — Route Wiring', () => {
  const listRoute = readRoute('app', 'api', 'social-work', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'social-work', '[id]', 'route.ts');
  const notesRoute = readRoute('app', 'api', 'social-work', '[id]', 'notes', 'route.ts');

  it('1 — All social-work routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'social-work'));
    expect(routes.length).toBe(3);
    const basenames = routes.map(r => r.replace(/.*social-work/, ''));
    expect(basenames).toEqual(expect.arrayContaining([
      expect.stringContaining('route.ts'),
    ]));
  });

  it('2 — All routes use withAuthTenant and prisma for tenant isolation', () => {
    for (const src of [listRoute, detailRoute, notesRoute]) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — Permission keys are set correctly (social_work.view / social_work.manage)', () => {
    expect(listRoute).toContain("permissionKey: 'social_work.view'");
    expect(listRoute).toContain("permissionKey: 'social_work.manage'");
    expect(detailRoute).toContain("permissionKey: 'social_work.view'");
    expect(detailRoute).toContain("permissionKey: 'social_work.manage'");
    expect(notesRoute).toContain("permissionKey: 'social_work.manage'");
  });
});

// ===================================================================
// 4-6: Assessment CRUD
// ===================================================================

describe('Social Work — Assessment CRUD', () => {
  const listRoute = readRoute('app', 'api', 'social-work', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'social-work', '[id]', 'route.ts');

  it('4 — GET /api/social-work lists assessments with optional filters (patientMasterId, status)', () => {
    expect(listRoute).toContain('socialWorkAssessment.findMany');
    expect(listRoute).toContain('patientMasterId');
    expect(listRoute).toContain('status');
    expect(listRoute).toContain("orderBy: { assessmentDate: 'desc' }");
    expect(listRoute).toContain('take: 200');
  });

  it('5 — POST /api/social-work creates assessment with required fields validation', () => {
    expect(listRoute).toContain('socialWorkAssessment.create');
    expect(listRoute).toContain('patientMasterId');
    expect(listRoute).toContain('referralReason');
    expect(listRoute).toContain("'patientMasterId and referralReason are required'");
    expect(listRoute).toContain('assessedBy: userId');
  });

  it('6 — PUT /api/social-work/[id] updates assessment with tenant guard and existence check', () => {
    expect(detailRoute).toContain('socialWorkAssessment.update');
    expect(detailRoute).toContain('socialWorkAssessment.findFirst');
    expect(detailRoute).toContain("{ error: 'Not found' }");
    expect(detailRoute).toContain('body.referralReason');
    expect(detailRoute).toContain('body.status');
  });
});

// ===================================================================
// 7-9: Notes Management
// ===================================================================

describe('Social Work — Notes', () => {
  const detailRoute = readRoute('app', 'api', 'social-work', '[id]', 'route.ts');
  const notesRoute = readRoute('app', 'api', 'social-work', '[id]', 'notes', 'route.ts');

  it('7 — GET /api/social-work/[id] returns both assessment and notes', () => {
    expect(detailRoute).toContain('socialWorkAssessment.findFirst');
    expect(detailRoute).toContain('socialWorkNote.findMany');
    expect(detailRoute).toContain('{ assessment, notes }');
  });

  it('8 — POST notes route creates a note linked to assessment with required content', () => {
    expect(notesRoute).toContain('socialWorkNote.create');
    expect(notesRoute).toContain('assessmentId: id');
    expect(notesRoute).toContain('authorId: userId');
    expect(notesRoute).toContain("'content is required'");
  });

  it('9 — Notes route validates assessment exists before creating note', () => {
    expect(notesRoute).toContain('socialWorkAssessment.findFirst');
    expect(notesRoute).toContain("'Assessment not found'");
  });
});

// ===================================================================
// 10-12: Business Logic
// ===================================================================

describe('Social Work — Business Logic', () => {
  const listRoute = readRoute('app', 'api', 'social-work', 'route.ts');
  const notesRoute = readRoute('app', 'api', 'social-work', '[id]', 'notes', 'route.ts');

  it('10 — Assessment captures all social work fields (living arrangement, support, barriers, plan)', () => {
    expect(listRoute).toContain('livingArrangement');
    expect(listRoute).toContain('supportSystem');
    expect(listRoute).toContain('barriers');
    expect(listRoute).toContain('plan');
    expect(listRoute).toContain('dischargeBarriers');
    expect(listRoute).toContain('followUpPlan');
  });

  it('11 — Note type defaults to GENERAL when not specified', () => {
    expect(notesRoute).toContain("noteType: noteType ? String(noteType) : 'GENERAL'");
  });

  it('12 — No skeleton or hardcoded dummy data patterns in routes', () => {
    const allRoutes = [
      readRoute('app', 'api', 'social-work', 'route.ts'),
      readRoute('app', 'api', 'social-work', '[id]', 'route.ts'),
      readRoute('app', 'api', 'social-work', '[id]', 'notes', 'route.ts'),
    ];
    for (const src of allRoutes) {
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});

// ===================================================================
// 13-15: Error Handling
// ===================================================================

describe('Social Work — Error Handling', () => {
  const listRoute = readRoute('app', 'api', 'social-work', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'social-work', '[id]', 'route.ts');
  const notesRoute = readRoute('app', 'api', 'social-work', '[id]', 'notes', 'route.ts');

  it('13 — POST routes handle invalid JSON body gracefully', () => {
    expect(listRoute).toContain("'Invalid JSON body'");
    expect(detailRoute).toContain("'Invalid JSON body'");
    expect(notesRoute).toContain("'Invalid JSON body'");
  });

  it('14 — Detail routes return 400 for missing id parameter', () => {
    expect(detailRoute).toContain("{ error: 'Missing id' }");
    expect(notesRoute).toContain("{ error: 'Missing assessment id' }");
  });

  it('15 — All routes use withErrorHandler for consistent error wrapping', () => {
    expect(listRoute).toContain('withErrorHandler');
    expect(detailRoute).toContain('withErrorHandler');
    expect(notesRoute).toContain('withErrorHandler');
  });
});
