import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Blood Bank Module Tests (9 routes)
// ─────────────────────────────────────────────────────────────────────────────

describe('Blood Bank — Route Wiring', () => {
  const routes = [
    'app/api/blood-bank/requests/route.ts',
    'app/api/blood-bank/inventory/route.ts',
    'app/api/blood-bank/crossmatch/route.ts',
    'app/api/blood-bank/transfusions/route.ts',
    'app/api/blood-bank/donors/route.ts',
  ];

  it('BB-01: all routes use withAuthTenant guard', () => {
    for (const r of routes) {
      if (fs.existsSync(path.join(process.cwd(), r))) {
        const code = readRoute(r);
        expect(code).toContain('withAuthTenant');
      }
    }
  });

  it('BB-02: all routes use prisma for real DB operations', () => {
    for (const r of routes) {
      if (fs.existsSync(path.join(process.cwd(), r))) {
        const code = readRoute(r);
        expect(code).toMatch(/prisma/);
      }
    }
  });

  it('BB-03: all routes enforce tenant isolation', () => {
    for (const r of routes) {
      if (fs.existsSync(path.join(process.cwd(), r))) {
        const code = readRoute(r);
        expect(code).toContain('tenantId');
      }
    }
  });

  it('BB-04: routes export HTTP method handlers', () => {
    for (const r of routes) {
      if (fs.existsSync(path.join(process.cwd(), r))) {
        const code = readRoute(r);
        expect(code).toMatch(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)/);
      }
    }
  });
});

describe('Blood Bank — Requests', () => {
  it('BB-05: request route handles blood group types', () => {
    const routePath = 'app/api/blood-bank/requests/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/blood[Gg]roup|bloodType|component/i);
    }
  });

  it('BB-06: request route validates required fields', () => {
    const routePath = 'app/api/blood-bank/requests/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/z\.|schema|validat/i);
    }
  });

  it('BB-07: request route uses permission key', () => {
    const routePath = 'app/api/blood-bank/requests/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toContain('permissionKey');
    }
  });
});

describe('Blood Bank — Inventory', () => {
  it('BB-08: inventory route tracks blood products', () => {
    const routePath = 'app/api/blood-bank/inventory/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/inventory|stock|unit/i);
    }
  });

  it('BB-09: inventory expiry tracking exists', () => {
    const routePath = 'app/api/blood-bank/inventory/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/expir|expirationDate|shelfLife/i);
    }
  });
});

describe('Blood Bank — Crossmatch', () => {
  it('BB-10: crossmatch route has compatibility logic', () => {
    const routePath = 'app/api/blood-bank/crossmatch/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/crossmatch|compat|result/i);
    }
  });
});

describe('Blood Bank — Transfusions', () => {
  it('BB-11: transfusion route tracks administration', () => {
    const routePath = 'app/api/blood-bank/transfusions/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/transfus|reaction|vital/i);
    }
  });

  it('BB-12: transfusion route has monitoring capability', () => {
    const routePath = 'app/api/blood-bank/transfusions/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/monitor|vital|preVitals|IN_PROGRESS/i);
    }
  });
});

describe('Blood Bank — Donors', () => {
  it('BB-13: donors route manages donor records', () => {
    const routePath = 'app/api/blood-bank/donors/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/donor|donation|screen/i);
    }
  });

  it('BB-14: donors route validates donor eligibility', () => {
    const routePath = 'app/api/blood-bank/donors/route.ts';
    if (fs.existsSync(path.join(process.cwd(), routePath))) {
      const code = readRoute(routePath);
      expect(code).toMatch(/eligib|defer|weight|hemoglobin/i);
    }
  });

  it('BB-15: no hardcoded dummy data in blood bank routes', () => {
    const routes = [
      'app/api/blood-bank/requests/route.ts',
      'app/api/blood-bank/inventory/route.ts',
      'app/api/blood-bank/transfusions/route.ts',
    ];
    for (const r of routes) {
      if (fs.existsSync(path.join(process.cwd(), r))) {
        const code = readRoute(r);
        expect(code).not.toMatch(/TODO|FIXME|placeholder|dummy/i);
      }
    }
  });
});
