/**
 * Care Path Module Tests — Thea EHR
 *
 * 18 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Daily Care Path Listing
 *   7-9   Care Path Generation
 *   10-12 Alerts Management
 *   13-15 Bedside View (Public)
 *   16-18 Task Updates & Shift Sign-Off
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

describe('Care Path — Route Wiring', () => {
  it('1 — All 6 care-path routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'care-path'));
    expect(routes.length).toBe(6);
  });

  it('2 — Protected routes use withAuthTenant and prisma', () => {
    const protectedRoutes = [
      readRoute('app', 'api', 'care-path', 'route.ts'),
      readRoute('app', 'api', 'care-path', 'generate', 'route.ts'),
      readRoute('app', 'api', 'care-path', '[carePathId]', 'alerts', 'route.ts'),
      readRoute('app', 'api', 'care-path', '[carePathId]', 'shifts', '[shiftId]', 'sign-off', 'route.ts'),
      readRoute('app', 'api', 'care-path', '[carePathId]', 'tasks', '[taskId]', 'route.ts'),
    ];
    for (const src of protectedRoutes) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — Permission keys use nursing.care_path.view for reads, nursing.care_path.manage for writes', () => {
    const listRoute = readRoute('app', 'api', 'care-path', 'route.ts');
    const genRoute = readRoute('app', 'api', 'care-path', 'generate', 'route.ts');
    const alertsRoute = readRoute('app', 'api', 'care-path', '[carePathId]', 'alerts', 'route.ts');
    const signOffRoute = readRoute('app', 'api', 'care-path', '[carePathId]', 'shifts', '[shiftId]', 'sign-off', 'route.ts');
    const taskRoute = readRoute('app', 'api', 'care-path', '[carePathId]', 'tasks', '[taskId]', 'route.ts');

    expect(listRoute).toContain("permissionKey: 'nursing.care_path.view'");
    expect(genRoute).toContain("permissionKey: 'nursing.care_path.manage'");
    expect(alertsRoute).toContain("permissionKey: 'nursing.care_path.view'");
    expect(alertsRoute).toContain("permissionKey: 'nursing.care_path.manage'");
    expect(signOffRoute).toContain("permissionKey: 'nursing.care_path.manage'");
    expect(taskRoute).toContain("permissionKey: 'nursing.care_path.manage'");
  });
});

// ===================================================================
// 4-6: Daily Care Path Listing
// ===================================================================

describe('Care Path — Listing', () => {
  const listRoute = readRoute('app', 'api', 'care-path', 'route.ts');

  it('4 — GET care paths filters by patientMasterId, date, and department', () => {
    expect(listRoute).toContain('dailyCarePath.findMany');
    expect(listRoute).toContain('patientMasterId');
    expect(listRoute).toContain('date');
    expect(listRoute).toContain('department');
    expect(listRoute).toContain('departmentType');
  });

  it('5 — GET includes shifts, tasks, and unacknowledged alerts', () => {
    expect(listRoute).toContain('include');
    expect(listRoute).toContain('shifts');
    expect(listRoute).toContain('tasks');
    expect(listRoute).toContain('alerts');
    expect(listRoute).toContain('acknowledged: false');
  });

  it('6 — Date defaults to today when not specified', () => {
    expect(listRoute).toContain('new Date()');
    expect(listRoute).toContain('getFullYear');
    expect(listRoute).toContain('getMonth');
    expect(listRoute).toContain('getDate');
  });
});

// ===================================================================
// 7-9: Care Path Generation
// ===================================================================

describe('Care Path — Generation', () => {
  const genRoute = readRoute('app', 'api', 'care-path', 'generate', 'route.ts');

  it('7 — Generate requires patientMasterId and department', () => {
    expect(genRoute).toContain("'patientMasterId and department are required'");
    expect(genRoute).toContain('status: 400');
  });

  it('8 — Generate delegates to carePathEngine.generateDailyCarePath', () => {
    expect(genRoute).toContain('generateDailyCarePath');
    expect(genRoute).toContain('patientMasterId');
    expect(genRoute).toContain('encounterCoreId');
    expect(genRoute).toContain('episodeId');
    expect(genRoute).toContain('erEncounterId');
    expect(genRoute).toContain('department');
  });

  it('9 — Generate handles alreadyExists case and returns existing path', () => {
    expect(genRoute).toContain('alreadyExists');
    expect(genRoute).toContain('dailyCarePath.findFirst');
    expect(genRoute).toContain('tasksCreated');
  });
});

// ===================================================================
// 10-12: Alerts Management
// ===================================================================

describe('Care Path — Alerts', () => {
  const alertsRoute = readRoute('app', 'api', 'care-path', '[carePathId]', 'alerts', 'route.ts');

  it('10 — GET alerts returns all alerts for a care path', () => {
    expect(alertsRoute).toContain('carePathAlert.findMany');
    expect(alertsRoute).toContain('carePathId');
    expect(alertsRoute).toContain("orderBy: { createdAt: 'desc' }");
  });

  it('11 — PATCH alerts acknowledges an alert with user info and action', () => {
    expect(alertsRoute).toContain('carePathAlert.update');
    expect(alertsRoute).toContain('acknowledged: true');
    expect(alertsRoute).toContain('acknowledgedAt');
    expect(alertsRoute).toContain('acknowledgedByUserId');
    expect(alertsRoute).toContain('acknowledgedByName');
    expect(alertsRoute).toContain('acknowledgedAction');
  });

  it('12 — PATCH requires alertId, returns 400 if missing', () => {
    expect(alertsRoute).toContain("'alertId required'");
    expect(alertsRoute).toContain('status: 400');
  });
});

// ===================================================================
// 13-15: Bedside View (Public)
// ===================================================================

describe('Care Path — Bedside View', () => {
  const bedsideRoute = readRoute('app', 'api', 'care-path', 'bedside', '[token]', 'route.ts');

  it('13 — Bedside route is public (no withAuthTenant), uses token-based access', () => {
    expect(bedsideRoute).not.toContain('withAuthTenant');
    expect(bedsideRoute).toContain('bedsideToken: token');
    expect(bedsideRoute).toContain("status: 'ACTIVE'");
  });

  it('14 — Bedside validates token minimum length of 16 characters', () => {
    expect(bedsideRoute).toContain('token.length < 16');
    expect(bedsideRoute).toContain("'Invalid token'");
  });

  it('15 — Bedside sanitizes medication titles for patient safety', () => {
    expect(bedsideRoute).toContain('sanitizeMedTitle');
    expect(bedsideRoute).toContain("category === 'MEDICATION'");
    expect(bedsideRoute).toContain("'Medication'");
    // Excludes sensitive patient details
    expect(bedsideRoute).toContain('safeView');
    expect(bedsideRoute).toContain('patientSnapshot');
  });
});

// ===================================================================
// 16-18: Task Updates & Shift Sign-Off
// ===================================================================

describe('Care Path — Tasks & Shift Sign-Off', () => {
  const taskRoute = readRoute('app', 'api', 'care-path', '[carePathId]', 'tasks', '[taskId]', 'route.ts');
  const signOffRoute = readRoute('app', 'api', 'care-path', '[carePathId]', 'shifts', '[shiftId]', 'sign-off', 'route.ts');

  it('16 — PATCH task validates status against allowed values and updates accordingly', () => {
    expect(taskRoute).toContain('validStatuses');
    expect(taskRoute).toContain("'DONE'");
    expect(taskRoute).toContain("'MISSED'");
    expect(taskRoute).toContain("'HELD'");
    expect(taskRoute).toContain("'REFUSED'");
    expect(taskRoute).toContain('carePathTask.update');
    expect(taskRoute).toContain('completedAt');
    expect(taskRoute).toContain('missedReason');
  });

  it('17 — Task completion triggers module sync and updates shift/path completion percentages', () => {
    expect(taskRoute).toContain('syncTaskToModules');
    expect(taskRoute).toContain('carePathShift.update');
    expect(taskRoute).toContain('completedTasks');
    expect(taskRoute).toContain('missedTasks');
    expect(taskRoute).toContain('heldTasks');
    expect(taskRoute).toContain('dailyCarePath.update');
    expect(taskRoute).toContain('completionPct');
  });

  it('18 — Shift sign-off delegates to signOffShift engine and requires carePathId + shiftId', () => {
    expect(signOffRoute).toContain('signOffShift');
    expect(signOffRoute).toContain('carePathId');
    expect(signOffRoute).toContain('shiftId');
    expect(signOffRoute).toContain("{ error: 'Missing IDs' }");
    expect(signOffRoute).toContain('signatureData');
  });
});
