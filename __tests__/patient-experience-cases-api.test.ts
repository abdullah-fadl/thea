import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('Patient Experience — API surface', () => {
  describe('cases route (POST creation)', () => {
    const src = read('app/api/patient-experience/cases/route.ts');

    it('uses withAuthTenant + withErrorHandler', () => {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('withErrorHandler');
    });

    it('declares POST and is gated by px.cases.create', () => {
      expect(src).toMatch(/export\s+const\s+POST\s*=/);
      expect(src).toContain("permissionKey: 'px.cases.create'");
    });

    it('declares GET and is gated by px.cases.view', () => {
      expect(src).toMatch(/export\s+const\s+GET\s*=/);
      expect(src).toContain("permissionKey: 'px.cases.view'");
    });

    it('runs the body through a zod schema (createSchema.safeParse)', () => {
      expect(src).toContain('createSchema');
      expect(src).toMatch(/createSchema\.safeParse/);
    });

    it('threads tenantUuid into prisma.pxCase.create', () => {
      expect(src).toContain('resolvePxTenantUuid(tenantId)');
      expect(src).toMatch(/prisma\.pxCase\.create\(/);
      expect(src).toContain('tenantId: tenantUuid');
    });

    it('emits a STATUS_CHANGE timeline entry on creation', () => {
      expect(src).toContain("kind: 'STATUS_CHANGE'");
      expect(src).toContain('prisma.pxComment.create');
    });

    it('computes dueAt from the severity SLA table', () => {
      expect(src).toContain('PX_SLA_MINUTES');
      expect(src).toContain('dueAt');
    });
  });

  describe('full PX route surface', () => {
    const expected = [
      'app/api/patient-experience/kpis/route.ts',
      'app/api/patient-experience/cases/route.ts',
      'app/api/patient-experience/cases/[id]/route.ts',
      'app/api/patient-experience/cases/[id]/comments/route.ts',
      'app/api/patient-experience/visits/route.ts',
      'app/api/patient-experience/visits/[id]/feedback/route.ts',
      'app/api/patient-experience/reports/[reportType]/route.ts',
      'app/api/patient-experience/reports/[reportType]/export/route.ts',
    ];

    it('all PX routes exist on disk', () => {
      const missing = expected.filter(
        (p) => !fs.existsSync(path.join(ROOT, p)),
      );
      expect(missing).toEqual([]);
    });

    it('every PX route uses withAuthTenant', () => {
      const offenders: string[] = [];
      for (const p of expected) {
        const src = read(p);
        if (!src.includes('withAuthTenant')) offenders.push(p);
      }
      expect(offenders).toEqual([]);
    });

    it('every PX route is platform-gated to thea_health', () => {
      const offenders: string[] = [];
      for (const p of expected) {
        const src = read(p);
        if (!src.includes("platformKey: 'thea_health'")) offenders.push(p);
      }
      expect(offenders).toEqual([]);
    });
  });

  describe('PX permission registry', () => {
    const defs = read('lib/permissions/definitions.ts');
    const routes = read('lib/permissions/routes.ts');

    it('defines all PX permission keys referenced by the routes', () => {
      const keys = [
        'px.dashboard.view',
        'px.cases.view',
        'px.cases.create',
        'px.cases.edit',
        'px.cases.comment',
        'px.visits.view',
        'px.reports.view',
        'px.reports.export',
      ];
      for (const k of keys) {
        expect(defs).toContain(`'${k}'`);
      }
    });

    it('maps every PX page route to a permission', () => {
      expect(routes).toContain("'/patient-experience/dashboard': 'px.dashboard.view'");
      expect(routes).toContain("'/patient-experience/cases':     'px.cases.view'");
      expect(routes).toContain("'/patient-experience/visits':    'px.visits.view'");
      expect(routes).toContain("'/patient-experience/reports':   'px.reports.view'");
    });
  });
});
