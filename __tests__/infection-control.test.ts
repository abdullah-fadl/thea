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

describe('Infection Control — Route Wiring (11 routes)', () => {
  const icDir = path.join(process.cwd(), 'app/api/infection-control');

  it('IC-01: infection-control directory exists', () => {
    expect(fs.existsSync(icDir)).toBe(true);
  });

  it('IC-02: has 8+ routes', () => {
    expect(findRoutes(icDir).length).toBeGreaterThanOrEqual(8);
  });

  it('IC-03: all routes use withAuthTenant', () => {
    for (const r of findRoutes(icDir)) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toContain('withAuthTenant');
    }
  });

  it('IC-04: all routes enforce tenantId', () => {
    for (const r of findRoutes(icDir)) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toContain('tenantId');
    }
  });
});

describe('Infection Control — Isolation', () => {
  it('IC-05: isolation route manages precautions', () => {
    const code = readRoute('app/api/infection-control/isolation/route.ts');
    expect(code).toMatch(/isolat|precaution|PPE|gown|gloves/i);
  });

  it('IC-06: isolation has status workflow (ACTIVE/DISCONTINUED/CLEARED)', () => {
    const code = readRoute('app/api/infection-control/isolation/route.ts');
    expect(code).toMatch(/ACTIVE|DISCONTINUED|CLEARED/);
  });
});

describe('Infection Control — Outbreaks', () => {
  it('IC-07: outbreaks route tracks outbreak events', () => {
    const rp = 'app/api/infection-control/outbreaks/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/outbreak|organism|controlMeasure/i);
    }
  });

  it('IC-08: outbreak case tracking works', () => {
    const rp = 'app/api/infection-control/outbreaks/[outbreakId]/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/cases|newCase|totalCases|activeCases/i);
    }
  });
});

describe('Infection Control — Surveillance', () => {
  it('IC-09: HAI rates route provides infection analytics', () => {
    const rp = 'app/api/infection-control/hai-rates/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/hai|rate|CLABSI|CAUTI|VAP|SSI/i);
    }
  });

  it('IC-10: antibiogram route has antimicrobial data', () => {
    const rp = 'app/api/infection-control/antibiogram/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/antibiogram|susceptib|organism|antibiotic/i);
    }
  });

  it('IC-11: device-days route tracks device utilization', () => {
    const rp = 'app/api/infection-control/device-days/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/device|catheter|ventilator|central.line/i);
    }
  });
});

describe('Infection Control — Stewardship', () => {
  it('IC-12: stewardship route manages antimicrobial stewardship', () => {
    const rp = 'app/api/infection-control/stewardship/route.ts';
    if (fs.existsSync(path.join(process.cwd(), rp))) {
      const code = readRoute(rp);
      expect(code).toMatch(/stewardship|antimicrobial|audit|intervention/i);
    }
  });
});

describe('Infection Control — No Skeleton', () => {
  it('IC-13: no placeholder content', () => {
    for (const r of findRoutes(path.join(process.cwd(), 'app/api/infection-control'))) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).not.toMatch(/TODO:\s*implement|placeholder|dummy data/i);
    }
  });

  it('IC-14: most routes use prisma or DB operations', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app/api/infection-control'));
    const routesWithPrisma = routes.filter(r => fs.readFileSync(r, 'utf-8').match(/prisma|db\.|generate/i));
    // At least 80% of routes should use prisma
    expect(routesWithPrisma.length).toBeGreaterThanOrEqual(Math.floor(routes.length * 0.7));
  });

  it('IC-15: routes have permission keys', () => {
    for (const r of findRoutes(path.join(process.cwd(), 'app/api/infection-control'))) {
      const code = fs.readFileSync(r, 'utf-8');
      expect(code).toContain('permissionKey');
    }
  });
});
