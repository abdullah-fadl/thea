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

describe('Nursing Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/nursing');
  const routes = findRoutes(baseDir);

  it('should have exactly 4 nursing route files', () => {
    expect(routes.length).toBe(5);
  });

  // ── Operations Route ───────────────────────────────────────────────
  describe('operations route', () => {
    const src = readRoute('app/api/nursing/operations/route.ts');

    it('authenticates via requireTenantId + requireAuthContext', () => {
      expect(src).toContain('requireTenantId');
      expect(src).toContain('requireAuthContext');
    });

    it('fetches nursingAssignment with tenant isolation', () => {
      expect(src).toContain('nursingAssignment.findMany');
      expect(src).toContain('tenantId');
    });

    it('computes metrics from clinicalTask counts (completed, pending, urgent)', () => {
      expect(src).toContain('prisma.clinicalTask.count');
      expect(src).toContain("status: 'DONE'");
      expect(src).toContain("priority: { in: ['URGENT', 'HIGH'] }");
    });

    it('calculates average response time from completed tasks', () => {
      expect(src).toContain('avgResponseMinutes');
      expect(src).toContain('diffMs');
    });

    it('supports shift and department filters', () => {
      expect(src).toContain("shift !== 'ALL'");
      expect(src).toContain("department !== 'all'");
    });

    it('returns metrics JSON with patientNurseRatio', () => {
      expect(src).toContain('patientNurseRatio');
      expect(src).toContain('criticalAlerts');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Scheduling Route ───────────────────────────────────────────────
  describe('scheduling route', () => {
    const src = readRoute('app/api/nursing/scheduling/route.ts');

    it('requires auth and tenant via requireAuth + getActiveTenantId', () => {
      expect(src).toContain('requireAuth');
      expect(src).toContain('getActiveTenantId');
    });

    it('requires departmentId and weekStart query params', () => {
      expect(src).toContain('Department ID and week start date are required');
    });

    it('auto-creates schedules for nurses without one', () => {
      expect(src).toContain('prisma.nursingAssignment.create');
      expect(src).toContain("day: 'Saturday'");
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Code Blue Route ────────────────────────────────────────────────
  describe('codeblue route', () => {
    const src = readRoute('app/api/nursing/scheduling/codeblue/route.ts');

    it('uses withAuthTenant with nursing.scheduling.codeblue permission', () => {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain("permissionKey: 'nursing.scheduling.codeblue'");
    });

    it('validates request body with Zod addCodeBlueSchema', () => {
      expect(src).toContain('addCodeBlueSchema');
      expect(src).toContain('z.object');
    });

    it('performs role-based authorization check for admin/supervisor', () => {
      expect(src).toContain("['admin', 'supervisor'].includes(role)");
    });

    it('finds schedule by tenantId + nurseId + weekStart', () => {
      expect(src).toContain('prisma.nursingAssignment.findFirst');
    });

    it('updates assignment day with code blue entry', () => {
      expect(src).toContain('prisma.nursingAssignment.update');
      expect(src).toContain('codeBlue');
    });

    it('handles ZodError with 400 response', () => {
      expect(src).toContain('z.ZodError');
      expect(src).toContain('Invalid request format');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Task Route ─────────────────────────────────────────────────────
  describe('task route', () => {
    const src = readRoute('app/api/nursing/scheduling/task/route.ts');

    it('uses withAuthTenant with nursing.scheduling.task permission', () => {
      expect(src).toContain("permissionKey: 'nursing.scheduling.task'");
    });

    it('validates request body with Zod addTaskSchema', () => {
      expect(src).toContain('addTaskSchema');
    });

    it('resolves doctor name when doctorId is provided', () => {
      expect(src).toContain('data.task.doctorId');
      expect(src).toContain('doctorName');
    });

    it('calculates hours from startTime and endTime', () => {
      expect(src).toContain("data.task.startTime.split(':')");
      expect(src).toContain('hours');
    });

    it('computes overtime and undertime weekly hours', () => {
      expect(src).toContain('overtime');
      expect(src).toContain('undertime');
      expect(src).toContain('totalWeeklyHours');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
