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

describe('Transport Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/transport');
  const routes = findRoutes(baseDir);

  it('should have exactly 5 transport route files', () => {
    expect(routes.length).toBe(5);
  });

  // ── Requests Route ────────────────────────────────────────────
  describe('requests list/create route', () => {
    const src = readRoute('app/api/transport/requests/route.ts');

    it('uses withAuthTenant with transport.view and transport.create permissions', () => {
      expect(src).toContain("permissionKey: 'transport.view'");
      expect(src).toContain("permissionKey: 'transport.create'");
    });

    it('validates POST with comprehensive Zod createRequestSchema', () => {
      expect(src).toContain('createRequestSchema');
      expect(src).toContain('z.object');
    });

    it('supports request types (intra_facility, inter_facility, ambulance, discharge)', () => {
      expect(src).toContain("'intra_facility'");
      expect(src).toContain("'inter_facility'");
      expect(src).toContain("'ambulance'");
      expect(src).toContain("'discharge'");
    });

    it('supports transport modes (wheelchair, stretcher, bed, ambulatory, ambulance, neonatal_isolette)', () => {
      expect(src).toContain("'wheelchair'");
      expect(src).toContain("'stretcher'");
      expect(src).toContain("'neonatal_isolette'");
    });

    it('checks for stat escalation alerts', () => {
      expect(src).toContain('checkStatEscalation');
      expect(src).toContain("escalation === 'true'");
    });

    it('generates isolation alert when isolationRequired', () => {
      expect(src).toContain('isolationAlert');
      expect(src).toContain('data.isolationRequired');
      expect(src).toContain('isolationType');
    });

    it('tracks equipment needs (oxygen, monitor, ivPump)', () => {
      expect(src).toContain('oxygenRequired');
      expect(src).toContain('monitorRequired');
      expect(src).toContain('ivPumpRequired');
    });
  });

  // ── Requests [id] Route ───────────────────────────────────────
  describe('requests/[id] route', () => {
    const src = readRoute('app/api/transport/requests/[id]/route.ts');

    it('GET includes escalation warning for stat requests pending > 5 minutes', () => {
      expect(src).toContain('escalationWarning');
      expect(src).toContain('minutesPending >= 5');
      expect(src).toContain("level: 'critical'");
    });

    it('includes bilingual escalation messages', () => {
      expect(src).toContain('messageAr');
    });

    it('PATCH validates with updateStatusSchema', () => {
      expect(src).toContain('updateStatusSchema');
      expect(src).toContain("'pending'");
      expect(src).toContain("'assigned'");
      expect(src).toContain("'in_transit'");
      expect(src).toContain("'completed'");
      expect(src).toContain("'cancelled'");
    });

    it('delegates status update to updateTransportStatus engine', () => {
      expect(src).toContain('updateTransportStatus');
    });
  });

  // ── Assign Route ──────────────────────────────────────────────
  describe('requests/[id]/assign route', () => {
    const src = readRoute('app/api/transport/requests/[id]/assign/route.ts');

    it('validates with assignSchema requiring staffId', () => {
      expect(src).toContain('assignSchema');
      expect(src).toContain("staffId: z.string().min(1");
    });

    it('delegates to assignTransporter engine function', () => {
      expect(src).toContain('assignTransporter');
    });

    it('requires transport.manage permission', () => {
      expect(src).toContain("permissionKey: 'transport.manage'");
    });
  });

  // ── Staff Route ───────────────────────────────────────────────
  describe('staff route', () => {
    const src = readRoute('app/api/transport/staff/route.ts');

    it('GET supports workload query with getStaffWorkload', () => {
      expect(src).toContain('getStaffWorkload');
      expect(src).toContain("get('workload') === 'true'");
    });

    it('POST validates with createStaffSchema (name, userId, zone, shift)', () => {
      expect(src).toContain('createStaffSchema');
      expect(src).toContain('userId: z.string().min(1');
      expect(src).toContain('name: z.string().min(1');
    });

    it('checks for duplicate transport staff (409)', () => {
      expect(src).toContain("'User is already registered as transport staff'");
      expect(src).toContain('status: 409');
    });

    it('PATCH supports status changes (available, busy, off_duty, break)', () => {
      expect(src).toContain("'available'");
      expect(src).toContain("'busy'");
      expect(src).toContain("'off_duty'");
      expect(src).toContain("'break'");
    });

    it('releases assigned request when staff goes off_duty while busy', () => {
      expect(src).toContain("staff.status === 'busy'");
      expect(src).toContain('prisma.transportRequest.updateMany');
      expect(src).toContain("status: 'pending'");
    });
  });

  // ── Metrics Route ─────────────────────────────────────────────
  describe('metrics route', () => {
    const src = readRoute('app/api/transport/metrics/route.ts');

    it('delegates to getTransportMetrics engine function', () => {
      expect(src).toContain('getTransportMetrics');
    });

    it('supports date range filter (from, to)', () => {
      expect(src).toContain("searchParams.get('from')");
      expect(src).toContain("searchParams.get('to')");
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
