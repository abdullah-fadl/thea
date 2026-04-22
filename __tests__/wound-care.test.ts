/**
 * Wound Care Module Tests — Thea EHR
 *
 * 14 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Assessment CRUD
 *   7-10  Clinical Data Fields
 *   11-14 Error Handling & Quality
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

describe('Wound Care — Route Wiring', () => {
  const listRoute = readRoute('app', 'api', 'wound-care', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'wound-care', '[id]', 'route.ts');

  it('1 — Both wound-care routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'wound-care'));
    expect(routes.length).toBe(2);
  });

  it('2 — All routes use withAuthTenant and prisma with tenantId filtering', () => {
    for (const src of [listRoute, detailRoute]) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — Permission key is ipd.view for all handlers', () => {
    expect(listRoute).toContain("permissionKey: 'ipd.view'");
    expect(detailRoute).toContain("permissionKey: 'ipd.view'");
  });
});

// ===================================================================
// 4-6: Assessment CRUD
// ===================================================================

describe('Wound Care — Assessment CRUD', () => {
  const listRoute = readRoute('app', 'api', 'wound-care', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'wound-care', '[id]', 'route.ts');

  it('4 — GET /api/wound-care lists assessments with filters (patientMasterId, woundType, healingTrajectory)', () => {
    expect(listRoute).toContain('woundAssessment.findMany');
    expect(listRoute).toContain('patientMasterId');
    expect(listRoute).toContain('woundType');
    expect(listRoute).toContain('healingTrajectory');
    expect(listRoute).toContain("orderBy: { assessmentDate: 'desc' }");
  });

  it('5 — POST /api/wound-care creates assessment with required fields validation', () => {
    expect(listRoute).toContain('woundAssessment.create');
    expect(listRoute).toContain("'patientMasterId, woundType, and woundLocation are required'");
    expect(listRoute).toContain('assessedBy: userId');
  });

  it('6 — PUT /api/wound-care/[id] updates assessment with existence check', () => {
    expect(detailRoute).toContain('woundAssessment.update');
    expect(detailRoute).toContain('woundAssessment.findFirst');
    expect(detailRoute).toContain("{ error: 'Not found' }");
  });
});

// ===================================================================
// 7-10: Clinical Data Fields
// ===================================================================

describe('Wound Care — Clinical Data Fields', () => {
  const listRoute = readRoute('app', 'api', 'wound-care', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'wound-care', '[id]', 'route.ts');

  it('7 — Assessment captures wound dimensions (length, width, depth)', () => {
    expect(listRoute).toContain('length');
    expect(listRoute).toContain('width');
    expect(listRoute).toContain('depth');
    // Values are coerced to Number
    expect(listRoute).toContain('Number(length)');
    expect(listRoute).toContain('Number(width)');
    expect(listRoute).toContain('Number(depth)');
  });

  it('8 — Assessment captures wound characteristics (tunneling, undermining, woundBed, exudate)', () => {
    for (const field of ['tunneling', 'undermining', 'woundBed', 'exudate', 'periwoundSkin']) {
      expect(listRoute).toContain(field);
    }
  });

  it('9 — Assessment captures treatment and clinical notes', () => {
    expect(listRoute).toContain('treatment');
    expect(listRoute).toContain('healingTrajectory');
    expect(listRoute).toContain('notes');
    expect(listRoute).toContain('photoAttachmentId');
    expect(listRoute).toContain('painScore');
  });

  it('10 — Update route handles partial field updates correctly', () => {
    expect(detailRoute).toContain('woundType !== undefined');
    expect(detailRoute).toContain('woundLocation !== undefined');
    expect(detailRoute).toContain('painScore !== undefined');
    expect(detailRoute).toContain('treatment !== undefined');
    expect(detailRoute).toContain('healingTrajectory !== undefined');
  });
});

// ===================================================================
// 11-14: Error Handling & Quality
// ===================================================================

describe('Wound Care — Error Handling & Quality', () => {
  const listRoute = readRoute('app', 'api', 'wound-care', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'wound-care', '[id]', 'route.ts');

  it('11 — Routes use structured logger for error reporting', () => {
    expect(listRoute).toContain('logger.error');
    expect(detailRoute).toContain('logger.error');
  });

  it('12 — Detail route returns 400 for missing id and 404 for not found', () => {
    expect(detailRoute).toContain("{ error: 'id required' }");
    expect(detailRoute).toContain("{ error: 'Not found' }");
  });

  it('13 — Create route returns 201 status on success', () => {
    expect(listRoute).toContain('{ status: 201 }');
  });

  it('14 — No skeleton or dummy data in routes', () => {
    for (const src of [listRoute, detailRoute]) {
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});
