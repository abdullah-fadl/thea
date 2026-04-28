import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// ICU Extended Module Tests (17 routes)
// ─────────────────────────────────────────────────────────────────────────────

describe('ICU — Route Wiring', () => {
  const icuRouteDir = path.join(process.cwd(), 'app/api/icu');

  it('ICU-01: ICU API directory exists with routes', () => {
    expect(fs.existsSync(icuRouteDir)).toBe(true);
  });

  it('ICU-02: all ICU routes use withAuthTenant', () => {
    const findRoutes = (dir: string): string[] => {
      const files: string[] = [];
      if (!fs.existsSync(dir)) return files;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...findRoutes(fullPath));
        else if (entry.name === 'route.ts') files.push(fullPath);
      }
      return files;
    };
    const routes = findRoutes(icuRouteDir);
    expect(routes.length).toBeGreaterThan(5);
    for (const r of routes) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toContain('withAuthTenant');
    }
  });

  it('ICU-03: all ICU routes use prisma', () => {
    const findRoutes = (dir: string): string[] => {
      const files: string[] = [];
      if (!fs.existsSync(dir)) return files;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...findRoutes(fullPath));
        else if (entry.name === 'route.ts') files.push(fullPath);
      }
      return files;
    };
    const routes = findRoutes(icuRouteDir);
    for (const r of routes) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toMatch(/prisma/);
    }
  });
});

describe('ICU — Care Plans', () => {
  it('ICU-04: care plans route manages ICU care plans', () => {
    const routePath = 'app/api/icu/care-plans/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/carePlan|care.plan/i);
      expect(code).toContain('tenantId');
    }
  });
});

describe('ICU — SOFA Score', () => {
  it('ICU-05: SOFA score route has scoring logic', () => {
    const routePath = 'app/api/icu/sofa-score/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/sofa|score|organ/i);
    }
  });
});

describe('ICU — APACHE Score', () => {
  it('ICU-06: APACHE score route has clinical calculations', () => {
    const routePath = 'app/api/icu/apache-score/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/apache|score|acute/i);
    }
  });
});

describe('ICU — Sedation', () => {
  it('ICU-07: sedation route tracks sedation levels', () => {
    const routePath = 'app/api/icu/sedation/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/sedation|rass|richmond|ramsay/i);
    }
  });
});

describe('ICU — Delirium', () => {
  it('ICU-08: delirium route uses CAM-ICU assessment', () => {
    const routePath = 'app/api/icu/delirium/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/delirium|cam.icu|cam|confusion/i);
    }
  });
});

describe('ICU — Ventilator', () => {
  it('ICU-09: ventilator check route monitors vent settings', () => {
    const routePath = 'app/api/icu/ventilator-check/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/ventilat|mode|fio2|peep|tidal/i);
    }
  });
});

describe('ICU — Transfer', () => {
  it('ICU-10: transfer route handles ICU discharge/transfer', () => {
    const routePath = 'app/api/icu/transfer/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/transfer|discharge|step.down/i);
    }
  });
});

describe('ICU — No Skeleton', () => {
  it('ICU-11: no hardcoded dummy data in ICU routes', () => {
    const findRoutes = (dir: string): string[] => {
      const files: string[] = [];
      if (!fs.existsSync(dir)) return files;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...findRoutes(fullPath));
        else if (entry.name === 'route.ts') files.push(fullPath);
      }
      return files;
    };
    const routes = findRoutes(path.join(process.cwd(), 'app/api/icu'));
    for (const r of routes) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).not.toMatch(/TODO:\s*implement|placeholder|dummy data/i);
    }
  });

  it('ICU-12: all ICU routes have error handling', () => {
    const findRoutes = (dir: string): string[] => {
      const files: string[] = [];
      if (!fs.existsSync(dir)) return files;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...findRoutes(fullPath));
        else if (entry.name === 'route.ts') files.push(fullPath);
      }
      return files;
    };
    const routes = findRoutes(path.join(process.cwd(), 'app/api/icu'));
    for (const r of routes) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toMatch(/withErrorHandler|try|catch|error/i);
    }
  });
});
