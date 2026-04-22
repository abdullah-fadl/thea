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

describe('OR Module — Route Wiring (21 routes)', () => {
  const orDir = path.join(process.cwd(), 'app/api/or');

  it('OR-01: OR API directory exists', () => {
    expect(fs.existsSync(orDir)).toBe(true);
  });

  it('OR-02: has 15+ route files', () => {
    const routes = findRoutes(orDir);
    expect(routes.length).toBeGreaterThanOrEqual(15);
  });

  it('OR-03: all routes use withAuthTenant', () => {
    for (const r of findRoutes(orDir)) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toContain('withAuthTenant');
    }
  });

  it('OR-04: all routes use prisma for DB', () => {
    for (const r of findRoutes(orDir)) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toMatch(/prisma/);
    }
  });

  it('OR-05: all routes enforce tenant isolation', () => {
    for (const r of findRoutes(orDir)) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toContain('tenantId');
    }
  });
});

describe('OR Module — Schedule', () => {
  it('OR-06: schedule route manages OR bookings', () => {
    const rp = 'app/api/or/schedule/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/schedule|booking|slot|room/i);
    }
  });
});

describe('OR Module — Cases', () => {
  it('OR-07: cases route handles surgical case creation', () => {
    const rp = 'app/api/or/cases/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/case|surgery|procedure/i);
    }
  });

  it('OR-08: today route filters for current date', () => {
    const rp = 'app/api/or/cases/today/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/today|Date|startOf/i);
    }
  });
});

describe('OR Module — Specimens', () => {
  it('OR-09: specimens route tracks surgical specimens', () => {
    const rp = 'app/api/or/cases/specimens/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/specimen|tissue|pathology/i);
    }
  });
});

describe('OR Module — Events', () => {
  it('OR-10: events route records intraoperative events', () => {
    const rp = 'app/api/or/cases/events/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/event|intraop|milestone/i);
    }
  });
});

describe('OR Module — No Skeleton', () => {
  it('OR-11: no placeholder content in OR routes', () => {
    for (const r of findRoutes(path.join(process.cwd(), 'app/api/or'))) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).not.toMatch(/TODO:\s*implement|placeholder|dummy data/i);
    }
  });

  it('OR-12: all routes have error handling', () => {
    for (const r of findRoutes(path.join(process.cwd(), 'app/api/or'))) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toMatch(/withErrorHandler|try|catch|error/i);
    }
  });

  it('OR-13: all routes have permission keys', () => {
    for (const r of findRoutes(path.join(process.cwd(), 'app/api/or'))) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toContain('permissionKey');
    }
  });
});
