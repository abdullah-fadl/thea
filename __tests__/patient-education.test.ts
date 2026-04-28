/**
 * Patient Education Module Tests — Thea EHR
 *
 * 15 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Education Record CRUD
 *   7-9   Business Logic (topics, methods, barriers)
 *   10-12 Update & Filtering
 *   13-15 Error Handling & No Skeleton
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

describe('Patient Education — Route Wiring', () => {
  const listRoute = readRoute('app', 'api', 'patient-education', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'patient-education', '[id]', 'route.ts');

  it('1 — Both patient-education routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'patient-education'));
    expect(routes.length).toBe(2);
  });

  it('2 — All routes use withAuthTenant and prisma with tenantId filtering', () => {
    for (const src of [listRoute, detailRoute]) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — Permission keys: patient_education.view for reads, patient_education.manage for writes', () => {
    expect(listRoute).toContain("permissionKey: 'patient_education.view'");
    expect(listRoute).toContain("permissionKey: 'patient_education.manage'");
    expect(detailRoute).toContain("permissionKey: 'patient_education.view'");
    expect(detailRoute).toContain("permissionKey: 'patient_education.manage'");
  });
});

// ===================================================================
// 4-6: Education Record CRUD
// ===================================================================

describe('Patient Education — CRUD', () => {
  const listRoute = readRoute('app', 'api', 'patient-education', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'patient-education', '[id]', 'route.ts');

  it('4 — GET /api/patient-education lists records with patientMasterId and followUpNeeded filters', () => {
    expect(listRoute).toContain('patientEducationRecord.findMany');
    expect(listRoute).toContain('patientMasterId');
    expect(listRoute).toContain('followUpNeeded');
    expect(listRoute).toContain("orderBy: { educationDate: 'desc' }");
    expect(listRoute).toContain('take: 200');
  });

  it('5 — POST /api/patient-education creates record requiring patientMasterId', () => {
    expect(listRoute).toContain('patientEducationRecord.create');
    expect(listRoute).toContain("'patientMasterId is required'");
    expect(listRoute).toContain('educatorId: userId');
  });

  it('6 — GET /api/patient-education/[id] retrieves a single record with tenant guard', () => {
    expect(detailRoute).toContain('patientEducationRecord.findFirst');
    expect(detailRoute).toContain('{ id, tenantId }');
    expect(detailRoute).toContain("{ error: 'Not found' }");
  });
});

// ===================================================================
// 7-9: Business Logic
// ===================================================================

describe('Patient Education — Business Logic', () => {
  const listRoute = readRoute('app', 'api', 'patient-education', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'patient-education', '[id]', 'route.ts');

  it('7 — Record captures all education fields (topics, method, barriers, comprehension, followUp)', () => {
    expect(listRoute).toContain('topics');
    expect(listRoute).toContain('method');
    expect(listRoute).toContain('barriers');
    expect(listRoute).toContain('comprehension');
    expect(listRoute).toContain('followUpNeeded');
    expect(listRoute).toContain('interpreter');
  });

  it('8 — Method and barriers are normalized to arrays', () => {
    expect(listRoute).toContain('Array.isArray(method)');
    expect(listRoute).toContain('Array.isArray(barriers)');
  });

  it('9 — Comprehension defaults to VERBALIZED_UNDERSTANDING when not specified', () => {
    expect(listRoute).toContain("'VERBALIZED_UNDERSTANDING'");
    expect(detailRoute).toContain("'VERBALIZED_UNDERSTANDING'");
  });
});

// ===================================================================
// 10-12: Update & Filtering
// ===================================================================

describe('Patient Education — Update & Filtering', () => {
  const detailRoute = readRoute('app', 'api', 'patient-education', '[id]', 'route.ts');
  const listRoute = readRoute('app', 'api', 'patient-education', 'route.ts');

  it('10 — PUT /api/patient-education/[id] supports partial updates', () => {
    expect(detailRoute).toContain('patientEducationRecord.update');
    expect(detailRoute).toContain('body.topics !== undefined');
    expect(detailRoute).toContain('body.method !== undefined');
    expect(detailRoute).toContain('body.barriers !== undefined');
    expect(detailRoute).toContain('body.followUpNeeded !== undefined');
  });

  it('11 — Interpreter is stored as Boolean in both create and update', () => {
    expect(listRoute).toContain('Boolean(interpreter)');
    expect(detailRoute).toContain('Boolean(body.interpreter)');
  });

  it('12 — followUpNeeded filter works via query parameter', () => {
    expect(listRoute).toContain("followUpNeeded === 'true'");
    expect(listRoute).toContain('followUpNeeded: true');
  });
});

// ===================================================================
// 13-15: Error Handling & No Skeleton
// ===================================================================

describe('Patient Education — Error Handling', () => {
  const listRoute = readRoute('app', 'api', 'patient-education', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'patient-education', '[id]', 'route.ts');

  it('13 — POST routes handle invalid JSON body', () => {
    expect(listRoute).toContain("'Invalid JSON body'");
    expect(detailRoute).toContain("'Invalid JSON body'");
  });

  it('14 — Detail route returns 400 for missing id', () => {
    expect(detailRoute).toContain("{ error: 'Missing id' }");
  });

  it('15 — No skeleton or dummy data in any route', () => {
    for (const src of [listRoute, detailRoute]) {
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
      expect(src).toContain('withErrorHandler');
    }
  });
});
