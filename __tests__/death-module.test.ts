/**
 * Death Module Tests — Thea EHR
 *
 * 15 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Death Declaration
 *   7-10  Death Finalization (mortuary, encounter close, IPD)
 *   11-12 Death Status Query
 *   13-15 Business Logic & Quality
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

describe('Death — Route Wiring', () => {
  const declareRoute = readRoute('app', 'api', 'death', 'declare', 'route.ts');
  const finalizeRoute = readRoute('app', 'api', 'death', 'finalize', 'route.ts');
  const statusRoute = readRoute('app', 'api', 'death', 'status', 'route.ts');

  it('1 — All 3 death routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'death'));
    expect(routes.length).toBe(3);
  });

  it('2 — All routes use withAuthTenant and prisma with tenantId', () => {
    for (const src of [declareRoute, finalizeRoute, statusRoute]) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — All routes use clinical.edit permission key', () => {
    for (const src of [declareRoute, finalizeRoute, statusRoute]) {
      expect(src).toContain("permissionKey: 'clinical.edit'");
    }
  });
});

// ===================================================================
// 4-6: Death Declaration
// ===================================================================

describe('Death — Declaration', () => {
  const declareRoute = readRoute('app', 'api', 'death', 'declare', 'route.ts');

  it('4 — Declare validates required fields with Zod (encounterCoreId, deathDateTime, placeOfDeath)', () => {
    expect(declareRoute).toContain('z.object');
    expect(declareRoute).toContain('encounterCoreId: z.string().min(1)');
    expect(declareRoute).toContain('deathDateTime: z.string().min(1)');
    expect(declareRoute).toContain('placeOfDeath: z.string().min(1)');
    expect(declareRoute).toContain('validateBody');
  });

  it('5 — Declare validates placeOfDeath against allowed values (ER, IPD, OPD, OTHER)', () => {
    expect(declareRoute).toContain("['ER', 'IPD', 'OPD', 'OTHER']");
    expect(declareRoute).toContain('PLACE_OF_DEATH');
  });

  it('6 — Declare is idempotent — returns existing declaration if already exists', () => {
    expect(declareRoute).toContain('deathDeclaration.findFirst');
    expect(declareRoute).toContain('noOp: true');
    expect(declareRoute).toContain('deathDeclaration.create');
    expect(declareRoute).toContain('createAuditLog');
  });
});

// ===================================================================
// 7-10: Death Finalization
// ===================================================================

describe('Death — Finalization', () => {
  const finalizeRoute = readRoute('app', 'api', 'death', 'finalize', 'route.ts');

  it('7 — Finalize requires encounterCoreId and checks declaration exists', () => {
    expect(finalizeRoute).toContain('encounterCoreId: z.string().min(1)');
    expect(finalizeRoute).toContain('deathDeclaration.findFirst');
    expect(finalizeRoute).toContain("'Death declaration not found'");
    expect(finalizeRoute).toContain('status: 409');
  });

  it('8 — Finalize is idempotent if already finalised', () => {
    expect(finalizeRoute).toContain('declaration.finalisedAt');
    expect(finalizeRoute).toContain('noOp: true');
  });

  it('9 — Finalize creates mortuary case with body tag number', () => {
    expect(finalizeRoute).toContain('mortuaryCase.create');
    expect(finalizeRoute).toContain('buildBodyTagNumber');
    expect(finalizeRoute).toContain('bodyTagNumber');
    expect(finalizeRoute).toContain("status: 'OPEN'");
  });

  it('10 — Finalize closes encounter and updates IPD episode + admission', () => {
    expect(finalizeRoute).toContain('encounterCore.update');
    expect(finalizeRoute).toContain("status: 'CLOSED'");
    expect(finalizeRoute).toContain('closedAt: now');
    expect(finalizeRoute).toContain('ipdEpisode.updateMany');
    expect(finalizeRoute).toContain("status: 'DECEASED'");
    expect(finalizeRoute).toContain('ipdAdmission.updateMany');
    expect(finalizeRoute).toContain('isActive: false');
  });
});

// ===================================================================
// 11-12: Death Status Query
// ===================================================================

describe('Death — Status Query', () => {
  const statusRoute = readRoute('app', 'api', 'death', 'status', 'route.ts');

  it('11 — GET status requires encounterCoreId parameter', () => {
    expect(statusRoute).toContain('encounterCoreId');
    expect(statusRoute).toContain("'encounterCoreId is required'");
    expect(statusRoute).toContain('status: 400');
  });

  it('12 — GET status returns both declaration and mortuaryCase (null if not present)', () => {
    expect(statusRoute).toContain('deathDeclaration.findFirst');
    expect(statusRoute).toContain('mortuaryCase.findFirst');
    expect(statusRoute).toContain('declaration: declaration || null');
    expect(statusRoute).toContain('mortuaryCase: mortuaryCase || null');
  });
});

// ===================================================================
// 13-15: Business Logic & Quality
// ===================================================================

describe('Death — Business Logic & Quality', () => {
  const declareRoute = readRoute('app', 'api', 'death', 'declare', 'route.ts');
  const finalizeRoute = readRoute('app', 'api', 'death', 'finalize', 'route.ts');

  it('13 — Declare validates deathDateTime is a valid date', () => {
    expect(declareRoute).toContain('new Date(deathDateTimeRaw)');
    expect(declareRoute).toContain('Number.isNaN(deathDateTime.getTime())');
  });

  it('14 — Finalize creates comprehensive audit logs for declaration, mortuary case, and encounter', () => {
    const auditCount = (finalizeRoute.match(/createAuditLog/g) || []).length;
    expect(auditCount).toBeGreaterThanOrEqual(2);
    expect(finalizeRoute).toContain("'death_declaration'");
    expect(finalizeRoute).toContain("'mortuary_case'");
    expect(finalizeRoute).toContain("'encounter_core'");
  });

  it('15 — No skeleton or dummy data in any route', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'death'));
    for (const fp of routes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});
