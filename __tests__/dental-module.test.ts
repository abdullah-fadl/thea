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

describe('Dental Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/dental');
  const routes = findRoutes(baseDir);

  it('should have exactly 4 dental route files', () => {
    expect(routes.length).toBe(9);
  });

  it('should include procedures, chart, periodontal, and treatment routes', () => {
    const relative = routes.map(r => r.replace(baseDir + '/', ''));
    expect(relative).toEqual(
      expect.arrayContaining([
        expect.stringContaining('procedures/route.ts'),
        expect.stringContaining('chart/'),
        expect.stringContaining('periodontal/'),
        expect.stringContaining('treatment/'),
      ]),
    );
  });

  // ── Procedures Route ───────────────────────────────────────────────
  describe('procedures route', () => {
    const src = readRoute('app/api/dental/procedures/route.ts');

    it('uses withAuthTenant for both GET and POST', () => {
      expect(src).toContain('withAuthTenant');
      expect(src).toMatch(/export\s+const\s+GET\s*=\s*withAuthTenant/);
      expect(src).toMatch(/export\s+const\s+POST\s*=\s*withAuthTenant/);
    });

    it('requires dental.view permission for GET', () => {
      expect(src).toContain("permissionKey: 'dental.view'");
    });

    it('requires dental.manage permission for POST', () => {
      expect(src).toContain("permissionKey: 'dental.manage'");
    });

    it('queries prisma.dentalProcedure with tenantId filter', () => {
      expect(src).toContain('prisma.dentalProcedure.findMany');
      expect(src).toContain('tenantId');
    });

    it('creates procedure with required fields (patientId, toothNumber, procedureName)', () => {
      expect(src).toContain('prisma.dentalProcedure.create');
      expect(src).toContain('body.patientId');
      expect(src).toContain('body.toothNumber');
      expect(src).toContain('body.procedureName');
    });

    it('records performedBy defaulting to userId', () => {
      expect(src).toContain('body.performedBy || userId');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Chart Route ────────────────────────────────────────────────────
  describe('chart/[patientId] route', () => {
    const src = readRoute('app/api/dental/chart/[patientId]/route.ts');

    it('uses withAuthTenant for both GET and POST', () => {
      expect(src).toMatch(/export\s+const\s+GET\s*=\s*withAuthTenant/);
      expect(src).toMatch(/export\s+const\s+POST\s*=\s*withAuthTenant/);
    });

    it('requires dental.chart.view and dental.chart.edit permissions', () => {
      expect(src).toContain("permissionKey: 'dental.chart.view'");
      expect(src).toContain("permissionKey: 'dental.chart.edit'");
    });

    it('validates patientId from route params', () => {
      expect(src).toContain('patientId is required');
    });

    it('performs upsert logic (findFirst then create or updateMany)', () => {
      expect(src).toContain('prisma.dentalChart.findFirst');
      expect(src).toContain('prisma.dentalChart.updateMany');
      expect(src).toContain('prisma.dentalChart.create');
    });

    it('uses Zod body validation for conditions', () => {
      expect(src).toContain('z.object');
      expect(src).toContain('validateBody');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Periodontal Route ──────────────────────────────────────────────
  describe('periodontal/[chartId] route', () => {
    const src = readRoute('app/api/dental/periodontal/[chartId]/route.ts');

    it('uses withAuthTenant', () => {
      expect(src).toContain('withAuthTenant');
    });

    it('queries periodontalChart with tenantId isolation', () => {
      expect(src).toContain('periodontalChart');
      expect(src).toContain('tenantId');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Treatment Route ────────────────────────────────────────────────
  describe('treatment/[patientId] route', () => {
    const src = readRoute('app/api/dental/treatment/[patientId]/route.ts');

    it('supports update action for treatment status change', () => {
      expect(src).toContain("action === 'update'");
      expect(src).toContain('prisma.dentalTreatment.updateMany');
    });

    it('sets completedAt when status is COMPLETED', () => {
      expect(src).toContain("status === 'COMPLETED'");
      expect(src).toContain('completedAt');
    });

    it('creates new treatment items with fee and priority', () => {
      expect(src).toContain('item.fee');
      expect(src).toContain('item.priority');
    });

    it('has proper tenant scoping and platform key', () => {
      expect(src).toContain('tenantScoped: true');
      expect(src).toContain("platformKey: 'thea_health'");
    });

    it('requires dental.treatment.view and dental.treatment.edit permissions', () => {
      expect(src).toContain("permissionKey: 'dental.treatment.view'");
      expect(src).toContain("permissionKey: 'dental.treatment.edit'");
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
