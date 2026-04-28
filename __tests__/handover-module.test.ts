/**
 * Handover Module Tests — Thea EHR
 *
 * 16 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Create Handover
 *   7-9   Finalize Handover
 *   10-12 Open & By-Encounter Queries
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

describe('Handover — Route Wiring', () => {
  const createRoute = readRoute('app', 'api', 'handover', 'create', 'route.ts');
  const finalizeRoute = readRoute('app', 'api', 'handover', 'finalize', 'route.ts');
  const openRoute = readRoute('app', 'api', 'handover', 'open', 'route.ts');
  const byEncRoute = readRoute('app', 'api', 'handover', 'by-encounter', 'route.ts');

  it('1 — All 4 handover routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'handover'));
    expect(routes.length).toBe(4);
  });

  it('2 — All routes use withAuthTenant, withErrorHandler, and prisma', () => {
    for (const src of [createRoute, finalizeRoute, openRoute, byEncRoute]) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('withErrorHandler');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — All routes use handover.view permission key', () => {
    for (const src of [createRoute, finalizeRoute, openRoute, byEncRoute]) {
      expect(src).toContain("permissionKey: 'handover.view'");
    }
  });
});

// ===================================================================
// 4-6: Create Handover
// ===================================================================

describe('Handover — Create', () => {
  const createRoute = readRoute('app', 'api', 'handover', 'create', 'route.ts');

  it('4 — Create validates Zod schema with toRole and summary required', () => {
    expect(createRoute).toContain('z.object');
    expect(createRoute).toContain('toRole: z.string().min(1)');
    expect(createRoute).toContain('summary: z.string().min(1)');
    expect(createRoute).toContain('validateBody');
  });

  it('5 — Create captures pending tasks, active orders, and pending results from encounter', () => {
    expect(createRoute).toContain('clinicalTask.findMany');
    expect(createRoute).toContain('ordersHub.findMany');
    expect(createRoute).toContain('orderResult.findMany');
    expect(createRoute).toContain('resultAck.findMany');
    expect(createRoute).toContain('pendingTasks');
    expect(createRoute).toContain('activeOrders');
    expect(createRoute).toContain('pendingResults');
  });

  it('6 — Create uses idempotencyKey to prevent duplicate handovers', () => {
    expect(createRoute).toContain('idempotencyKey');
    expect(createRoute).toContain('clinicalHandover.findFirst');
    expect(createRoute).toContain('noOp: true');
  });
});

// ===================================================================
// 7-9: Finalize Handover
// ===================================================================

describe('Handover — Finalize', () => {
  const finalizeRoute = readRoute('app', 'api', 'handover', 'finalize', 'route.ts');

  it('7 — Finalize requires handoverId and validates via Zod', () => {
    expect(finalizeRoute).toContain('handoverId: z.string().min(1)');
    expect(finalizeRoute).toContain("'handoverId is required'");
    expect(finalizeRoute).toContain('validateBody');
  });

  it('8 — Finalize checks authorization (canFinalize function) before proceeding', () => {
    expect(finalizeRoute).toContain('canFinalize');
    expect(finalizeRoute).toContain("{ error: 'Forbidden' }");
    expect(finalizeRoute).toContain('status: 403');
  });

  it('9 — Finalize sets status to FINALIZED and creates audit log + notification', () => {
    expect(finalizeRoute).toContain("status: 'FINALIZED'");
    expect(finalizeRoute).toContain('finalizedAt: now');
    expect(finalizeRoute).toContain('createAuditLog');
    expect(finalizeRoute).toContain('emitNotification');
    expect(finalizeRoute).toContain("kind: 'HANDOVER_FINALIZED'");
  });
});

// ===================================================================
// 10-12: Open & By-Encounter Queries
// ===================================================================

describe('Handover — Open & By-Encounter', () => {
  const openRoute = readRoute('app', 'api', 'handover', 'open', 'route.ts');
  const byEncRoute = readRoute('app', 'api', 'handover', 'by-encounter', 'route.ts');

  it('10 — Open route returns OPEN handovers for current user/role and recent FINALIZED ones', () => {
    expect(openRoute).toContain("status: 'OPEN'");
    expect(openRoute).toContain("status: 'FINALIZED'");
    expect(openRoute).toContain('toUserId: userId');
    expect(openRoute).toContain('toRole: currentRole');
    expect(openRoute).toContain('{ open, recent }');
  });

  it('11 — Open route uses roleKey helper for doctor/nurse detection', () => {
    expect(openRoute).toContain('roleKey');
    expect(openRoute).toContain("'doctor'");
    expect(openRoute).toContain("'nurse'");
  });

  it('12 — By-encounter route requires encounterCoreId or episodeId', () => {
    expect(byEncRoute).toContain('encounterCoreId');
    expect(byEncRoute).toContain('episodeId');
    expect(byEncRoute).toContain("'encounterCoreId or episodeId is required'");
    expect(byEncRoute).toContain('clinicalHandover.findMany');
  });
});

// ===================================================================
// 13-16: Business Logic & Quality
// ===================================================================

describe('Handover — Business Logic & Quality', () => {
  const createRoute = readRoute('app', 'api', 'handover', 'create', 'route.ts');
  const finalizeRoute = readRoute('app', 'api', 'handover', 'finalize', 'route.ts');

  it('13 — Create uses ensureHandoverWriteAllowed guard', () => {
    expect(createRoute).toContain('ensureHandoverWriteAllowed');
    expect(finalizeRoute).toContain('ensureHandoverWriteAllowed');
  });

  it('14 — Create sends notifications (targeted to user or broadcast to role)', () => {
    expect(createRoute).toContain('emitNotification');
    expect(createRoute).toContain('emitNotificationToRole');
    expect(createRoute).toContain("kind: 'HANDOVER_OPEN'");
  });

  it('15 — Create resolves encounterCoreId from episodeId when needed', () => {
    expect(createRoute).toContain('ipdEpisode.findFirst');
    expect(createRoute).toContain('episode');
    expect(createRoute).toContain('encounterId');
  });

  it('16 — No skeleton or dummy data in any route', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'handover'));
    for (const fp of routes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});
