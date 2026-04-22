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

describe('Oncology Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/oncology');
  const routes = findRoutes(baseDir);

  it('should have at least 5 oncology route files (base + protocol-templates + ctcae-toxicity + tnm-staging + radiation-therapy)', () => {
    expect(routes.length).toBeGreaterThanOrEqual(5);
  });

  // ── Patients Routes ───────────────────────────────────────────
  describe('patients list/create route', () => {
    const src = readRoute('app/api/oncology/patients/route.ts');

    it('uses withAuthTenant with oncology.view and oncology.manage permissions', () => {
      expect(src).toContain("permissionKey: 'oncology.view'");
      expect(src).toContain("permissionKey: 'oncology.manage'");
    });

    it('queries prisma.oncologyPatient with tenantId isolation', () => {
      expect(src).toContain('prisma.oncologyPatient.findMany');
      expect(src).toContain('tenantId');
    });

    it('supports status filter in GET query params', () => {
      expect(src).toContain('searchParams.get(\'status\')');
      expect(src).toContain('where.status = status');
    });

    it('creates patient with clinical fields (diagnosis, icdCode, stage, histology, primarySite)', () => {
      expect(src).toContain('body.diagnosis');
      expect(src).toContain('body.icdCode');
      expect(src).toContain('body.stage');
      expect(src).toContain('body.histology');
      expect(src).toContain('body.primarySite');
    });

    it('tracks oncologist with userId fallback', () => {
      expect(src).toContain('body.oncologistId || userId');
    });

    it('records ECOG performance status', () => {
      expect(src).toContain('ecogStatus');
    });
  });

  describe('patients/[id] route', () => {
    const src = readRoute('app/api/oncology/patients/[id]/route.ts');

    it('has GET with include protocols and cycles', () => {
      expect(src).toContain('include: { protocols: true, cycles');
    });

    it('returns 404 when patient not found', () => {
      expect(src).toContain("'Not found'");
      expect(src).toContain('status: 404');
    });

    it('has PUT for updating diagnosis, stage, ecogStatus, status', () => {
      expect(src).toContain('body.diagnosis');
      expect(src).toContain('body.stage');
      expect(src).toContain('body.ecogStatus');
      expect(src).toContain('body.status');
    });
  });

  // ── Cycles Routes ─────────────────────────────────────────────
  describe('cycles list/create route', () => {
    const src = readRoute('app/api/oncology/cycles/route.ts');

    it('queries prisma.chemoCycle with patientId filter', () => {
      expect(src).toContain('prisma.chemoCycle.findMany');
      expect(src).toContain('where.patientId = patientId');
    });

    it('creates cycle with drugs, BSA, weight, and protocolName', () => {
      expect(src).toContain('body.drugs');
      expect(src).toContain('body.bsa');
      expect(src).toContain('body.weight');
      expect(src).toContain('body.protocolName');
    });

    it('tracks administeredBy with userId fallback', () => {
      expect(src).toContain('body.administeredBy || userId');
    });
  });

  describe('cycles/[id] route', () => {
    const src = readRoute('app/api/oncology/cycles/[id]/route.ts');

    it('has PUT for cycle status, toxicity, and vitals updates', () => {
      expect(src).toContain('body.status');
      expect(src).toContain('body.toxicity');
      expect(src).toContain('body.vitals');
    });

    it('returns 404 when cycle not found', () => {
      expect(src).toContain("'Not found'");
      expect(src).toContain('status: 404');
    });
  });

  // ── Tumor Board Route ─────────────────────────────────────────
  describe('tumor-board route', () => {
    const src = readRoute('app/api/oncology/tumor-board/route.ts');

    it('queries prisma.tumorBoardCase with tenantId', () => {
      expect(src).toContain('prisma.tumorBoardCase.findMany');
      expect(src).toContain('tenantId');
    });

    it('creates case with attendees, clinicalSummary, and recommendation', () => {
      expect(src).toContain('body.attendees');
      expect(src).toContain('body.clinicalSummary');
      expect(src).toContain('body.recommendation');
    });

    it('records imaging and pathology findings', () => {
      expect(src).toContain('body.imagingFindings');
      expect(src).toContain('body.pathologyFindings');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
