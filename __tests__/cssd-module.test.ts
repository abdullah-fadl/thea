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

describe('CSSD Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/cssd');
  const routes = findRoutes(baseDir);

  it('should have at least 6 CSSD route files (base + recalls)', () => {
    expect(routes.length).toBeGreaterThanOrEqual(6);
  });

  // ── Trays Route ───────────────────────────────────────────────
  describe('trays list/create route', () => {
    const src = readRoute('app/api/cssd/trays/route.ts');

    it('uses withAuthTenant with cssd.view permission', () => {
      expect(src).toContain("permissionKey: 'cssd.view'");
    });

    it('queries prisma.cssdTray with department filter', () => {
      expect(src).toContain('prisma.cssdTray.findMany');
      expect(src).toContain('department');
    });

    it('supports active-only filter defaulting to true', () => {
      expect(src).toContain("searchParams.get('active')");
      expect(src).toContain('active: true');
    });

    it('requires trayName and trayCode for creation', () => {
      expect(src).toContain("'trayName and trayCode are required'");
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Trays [id] Route ──────────────────────────────────────────
  describe('trays/[id] route', () => {
    const src = readRoute('app/api/cssd/trays/[id]/route.ts');

    it('has GET and PUT endpoints', () => {
      expect(src).toContain('export const GET');
      expect(src).toContain('export const PUT');
    });

    it('returns 404 when tray not found', () => {
      expect(src).toContain("'Not found'");
      expect(src).toContain('status: 404');
    });

    it('updates instruments and totalInstruments', () => {
      expect(src).toContain('body.instruments');
      expect(src).toContain('body.totalInstruments');
    });
  });

  // ── Cycles Route ──────────────────────────────────────────────
  describe('cycles list/create route', () => {
    const src = readRoute('app/api/cssd/cycles/route.ts');

    it('queries prisma.cssdCycle with tray include', () => {
      expect(src).toContain('prisma.cssdCycle.findMany');
      expect(src).toContain('include');
      expect(src).toContain('tray');
    });

    it('validates tray exists before creating cycle', () => {
      expect(src).toContain('prisma.cssdTray.findFirst');
      expect(src).toContain("'Tray not found'");
    });

    it('requires trayId, loadNumber, machine, and method for creation', () => {
      expect(src).toContain("'trayId, loadNumber, machine, and method are required'");
    });

    it('creates cycle with sterilization fields (temperature, pressure, duration)', () => {
      expect(src).toContain('temperature');
      expect(src).toContain('pressure');
      expect(src).toContain('duration');
      expect(src).toContain('biologicalIndicator');
    });

    it('sets initial status to IN_PROGRESS', () => {
      expect(src).toContain("status: 'IN_PROGRESS'");
    });
  });

  // ── Cycles [id] Route ─────────────────────────────────────────
  describe('cycles/[id] route', () => {
    const src = readRoute('app/api/cssd/cycles/[id]/route.ts');

    it('GET includes tray and dispatches', () => {
      expect(src).toContain('dispatches');
      expect(src).toContain('tray');
    });

    it('validates status against VALID_STATUSES (IN_PROGRESS, COMPLETED, FAILED, RECALLED)', () => {
      expect(src).toContain('VALID_STATUSES');
      expect(src).toContain("'IN_PROGRESS'");
      expect(src).toContain("'COMPLETED'");
      expect(src).toContain("'FAILED'");
      expect(src).toContain("'RECALLED'");
    });

    it('sets endTime automatically on COMPLETED or FAILED', () => {
      expect(src).toContain("body.status === 'COMPLETED'");
      expect(src).toContain("body.status === 'FAILED'");
      expect(src).toContain('endTime: now');
    });
  });

  // ── Dispatch Route ────────────────────────────────────────────
  describe('cycles/[id]/dispatch route', () => {
    const src = readRoute('app/api/cssd/cycles/[id]/dispatch/route.ts');

    it('only allows dispatching COMPLETED cycles', () => {
      expect(src).toContain("cycle.status !== 'COMPLETED'");
      expect(src).toContain("'Can only dispatch completed cycles'");
    });

    it('requires dispatchedTo field', () => {
      expect(src).toContain("'dispatchedTo is required'");
    });

    it('creates prisma.cssdDispatch with DISPATCHED status', () => {
      expect(src).toContain('prisma.cssdDispatch.create');
      expect(src).toContain("status: 'DISPATCHED'");
    });
  });

  // ── Dispatches [id] Route ─────────────────────────────────────
  describe('dispatches/[id] route', () => {
    const src = readRoute('app/api/cssd/dispatches/[id]/route.ts');

    it('GET includes cycle with tray details', () => {
      expect(src).toContain('include');
      expect(src).toContain('cycle');
      expect(src).toContain('trayName');
    });

    it('PUT supports receive and return actions', () => {
      expect(src).toContain("action === 'receive'");
      expect(src).toContain("action === 'return'");
    });

    it('validates dispatch status before receive (must be DISPATCHED)', () => {
      expect(src).toContain("existing.status !== 'DISPATCHED'");
    });

    it('sets receivedBy/returnedBy and timestamps on actions', () => {
      expect(src).toContain('receivedBy: userId');
      expect(src).toContain('returnedBy: userId');
      expect(src).toContain('receivedAt');
      expect(src).toContain('returnedAt');
    });
  });
});
