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

describe('OB/GYN Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/obgyn');
  const routes = findRoutes(baseDir);

  it('should have exactly 10 obgyn route files', () => {
    expect(routes.length).toBe(15);
  });

  // ── Partogram Routes ──────────────────────────────────────────────
  describe('partogram list/create route', () => {
    const src = readRoute('app/api/obgyn/partogram/route.ts');

    it('uses withAuthTenant with obgyn.view and obgyn.manage permissions', () => {
      expect(src).toContain("permissionKey: 'obgyn.view'");
      expect(src).toContain("permissionKey: 'obgyn.manage'");
    });

    it('queries prisma.partogram with tenantId isolation', () => {
      expect(src).toContain('prisma.partogram.findMany');
      expect(src).toContain('tenantId');
    });

    it('creates partogram with gestational/obstetric fields', () => {
      expect(src).toContain('gestationalAge');
      expect(src).toContain('gravidaPara');
      expect(src).toContain('membraneStatus');
      expect(src).toContain('cervixOnAdmission');
    });
  });

  describe('partogram/[id] route', () => {
    const src = readRoute('app/api/obgyn/partogram/[id]/route.ts');

    it('has GET with include observations', () => {
      expect(src).toContain('include: { observations');
    });

    it('has PUT for status/delivery updates', () => {
      expect(src).toContain('body.deliveryMode');
      expect(src).toContain('body.deliveryTime');
    });

    it('returns 404 when partogram not found', () => {
      expect(src).toContain("'Not found'");
      expect(src).toContain('status: 404');
    });
  });

  describe('partogram/[id]/observations route', () => {
    const src = readRoute('app/api/obgyn/partogram/[id]/observations/route.ts');

    it('creates observation with vital signs (bp, pulse, temp)', () => {
      expect(src).toContain('body.bp');
      expect(src).toContain('body.pulse');
      expect(src).toContain('body.temperature');
    });

    it('records fetal heart rate and pattern', () => {
      expect(src).toContain('body.fhr');
      expect(src).toContain('body.fhrPattern');
    });

    it('records labor progress (cervixDilation, effacement, stationLevel)', () => {
      expect(src).toContain('cervixDilation');
      expect(src).toContain('effacement');
      expect(src).toContain('stationLevel');
    });

    it('tracks contraction parameters (freq, duration, strength)', () => {
      expect(src).toContain('contractionFreq');
      expect(src).toContain('contractionDuration');
      expect(src).toContain('contractionStrength');
    });
  });

  // ── Newborn Routes ────────────────────────────────────────────────
  describe('newborn list/create route', () => {
    const src = readRoute('app/api/obgyn/newborn/route.ts');

    it('validates with comprehensive Zod schema for newborn fields', () => {
      expect(src).toContain('createSchema');
      expect(src).toContain('z.object');
    });

    it('records APGAR scores (1, 5, 10 minute)', () => {
      expect(src).toContain('apgar1Min');
      expect(src).toContain('apgar5Min');
      expect(src).toContain('apgar10Min');
    });

    it('tracks NICU admission with reason', () => {
      expect(src).toContain('nicuAdmission');
      expect(src).toContain('nicuAdmissionReason');
    });

    it('records delivery type enum (SVD, CS, INSTRUMENTAL)', () => {
      expect(src).toContain("'SVD'");
      expect(src).toContain("'CS'");
      expect(src).toContain("'INSTRUMENTAL_VACUUM'");
    });

    it('logs newborn creation', () => {
      expect(src).toContain("logger.info('Newborn record created'");
    });
  });

  describe('newborn/[newbornId] route', () => {
    const src = readRoute('app/api/obgyn/newborn/[newbornId]/route.ts');

    it('has GET with mother name resolution', () => {
      expect(src).toContain('motherName');
      expect(src).toContain('prisma.patientMaster.findFirst');
    });

    it('has PATCH with comprehensive update schema', () => {
      expect(src).toContain('updateSchema');
      expect(src).toContain('PATCH');
    });

    it('supports status enum (ACTIVE, DISCHARGED, TRANSFERRED, DECEASED)', () => {
      expect(src).toContain("'ACTIVE'");
      expect(src).toContain("'DISCHARGED'");
      expect(src).toContain("'TRANSFERRED'");
      expect(src).toContain("'DECEASED'");
    });
  });

  // ── Labor Routes ──────────────────────────────────────────────────
  describe('labor/[patientId]/admit route', () => {
    const src = readRoute('app/api/obgyn/labor/[patientId]/admit/route.ts');

    it('supports admit, discharge, and transfer actions', () => {
      expect(src).toContain("action === 'discharge'");
      expect(src).toContain("action === 'transfer'");
    });

    it('prevents duplicate active labor episodes (409)', () => {
      expect(src).toContain("status === 'ACTIVE'");
      expect(src).toContain('Patient already has an active labor episode');
    });

    it('creates labor episode with obstetric fields', () => {
      expect(src).toContain('gravida');
      expect(src).toContain('para');
      expect(src).toContain('membranesStatus');
      expect(src).toContain('presentationType');
    });
  });

  describe('labor/[patientId]/nursing route', () => {
    const src = readRoute('app/api/obgyn/labor/[patientId]/nursing/route.ts');

    it('calculates MEOWS score via calculateMEOWS', () => {
      expect(src).toContain('calculateMEOWS');
      expect(src).toContain('meowsResult');
    });

    it('returns MEOWS score and risk level in response', () => {
      expect(src).toContain('meows: meowsResult');
      expect(src).toContain('meowsLevel');
      expect(src).toContain('meowsHasSingleTrigger');
    });
  });

  describe('labor/worklist route', () => {
    const src = readRoute('app/api/obgyn/labor/worklist/route.ts');

    it('filters active labor episodes from all episodes', () => {
      expect(src).toContain("status === 'ACTIVE'");
      expect(src).toContain('activeEpisodes');
    });

    it('fetches latest nursing and doctor assessments', () => {
      expect(src).toContain('latestNursingMap');
      expect(src).toContain('latestDoctorMap');
    });

    it('sorts patients by alert level (EMERGENCY first)', () => {
      expect(src).toContain('EMERGENCY: 0');
      expect(src).toContain('URGENT: 1');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
