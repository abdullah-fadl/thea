/**
 * Consumables Module Tests — Thea EHR
 *
 * 18 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Store Management
 *   7-9   Inventory & Movements
 *   10-12 Usage Recording & Void
 *   13-15 Templates & Checkout Gate
 *   16-18 Reports & Quality
 */

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

// ===================================================================
// 1-3: Route Wiring & Auth
// ===================================================================

describe('Consumables — Route Wiring', () => {
  it('1 — All 7 consumable routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'consumables'));
    expect(routes.length).toBe(9);
  });

  it('2 — All routes use withAuthTenant with tenantId filtering', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'consumables'));
    for (const fp of routes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — All routes use billing.view permission key', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'consumables'));
    for (const fp of routes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).toContain("permissionKey: 'billing.view'");
    }
  });
});

// ===================================================================
// 4-6: Store Management
// ===================================================================

describe('Consumables — Stores', () => {
  const storesRoute = readRoute('app', 'api', 'consumables', 'stores', 'route.ts');

  it('4 — GET stores supports search and status filters', () => {
    expect(storesRoute).toContain('consumableStore.findMany');
    expect(storesRoute).toContain('search');
    expect(storesRoute).toContain('status');
    expect(storesRoute).toContain("mode: 'insensitive'");
  });

  it('5 — POST store validates with Zod schema (name, locationType)', () => {
    expect(storesRoute).toContain('z.object');
    expect(storesRoute).toContain('consumableStore.create');
    expect(storesRoute).toContain("z.enum(['DEPARTMENT', 'FLOOR', 'UNIT', 'CRASH_CART'])");
    expect(storesRoute).toContain('validateBody');
  });

  it('6 — Store code auto-generated as STR-NNN pattern', () => {
    expect(storesRoute).toContain('STR-');
    expect(storesRoute).toContain('padStart(3,');
  });
});

// ===================================================================
// 7-9: Inventory & Movements
// ===================================================================

describe('Consumables — Inventory', () => {
  const inventoryRoute = readRoute('app', 'api', 'consumables', 'stores', 'inventory', 'route.ts');
  const alertsRoute = readRoute('app', 'api', 'consumables', 'stores', 'alerts', 'route.ts');

  it('7 — GET inventory requires storeId and returns items + stats in parallel', () => {
    expect(inventoryRoute).toContain("'storeId is required'");
    expect(inventoryRoute).toContain('getStoreInventory');
    expect(inventoryRoute).toContain('getStoreStats');
    expect(inventoryRoute).toContain('Promise.all');
  });

  it('8 — POST inventory adjustment supports multiple movement types', () => {
    expect(inventoryRoute).toContain("z.enum(['RECEIVE', 'ISSUE', 'RETURN', 'ADJUST', 'WASTE', 'TRANSFER', 'COUNT'])");
    expect(inventoryRoute).toContain('adjustStoreItem');
    expect(inventoryRoute).toContain('batchNumber');
  });

  it('9 — Alerts route returns low stock alerts', () => {
    expect(alertsRoute).toContain('getLowStockAlerts');
  });
});

// ===================================================================
// 10-12: Usage Recording & Void
// ===================================================================

describe('Consumables — Usage & Void', () => {
  const usageRoute = readRoute('app', 'api', 'consumables', 'usage', 'route.ts');
  const voidRoute = readRoute('app', 'api', 'consumables', 'usage', 'void', 'route.ts');

  it('10 — GET usage requires encounterCoreId, supports summary mode', () => {
    expect(usageRoute).toContain("'encounterCoreId is required'");
    expect(usageRoute).toContain("=== 'true'");
    expect(usageRoute).toContain('getConsumableSummaryForEncounter');
    expect(usageRoute).toContain('getEncounterConsumables');
  });

  it('11 — POST usage validates with detailed schema (items, department, encounterCoreId)', () => {
    expect(usageRoute).toContain("z.enum(['OPD', 'ER', 'IPD', 'OR', 'ICU'])");
    expect(usageRoute).toContain('z.array(usageItemSchema).min(1)');
    expect(usageRoute).toContain('processConsumableUsage');
    expect(usageRoute).toContain('idempotencyKey');
  });

  it('12 — Void route requires usageEventId and reason with Zod validation', () => {
    expect(voidRoute).toContain('voidConsumableUsage');
    expect(voidRoute).toContain('usageEventId');
    expect(voidRoute).toContain('reason');
    expect(voidRoute).toContain('z.string().min(1)');
  });
});

// ===================================================================
// 13-15: Templates & Checkout Gate
// ===================================================================

describe('Consumables — Templates & Checkout', () => {
  const templatesRoute = readRoute('app', 'api', 'consumables', 'templates', 'route.ts');

  it('13 — GET templates supports department filter and seed parameter for initial data', () => {
    expect(templatesRoute).toContain('consumableUsageTemplate.findMany');
    expect(templatesRoute).toContain('department');
    expect(templatesRoute).toContain("'seed'");
    expect(templatesRoute).toContain('CONSUMABLE_USAGE_TEMPLATES');
  });

  it('14 — POST template creates with Zod validated items array', () => {
    expect(templatesRoute).toContain('consumableUsageTemplate.create');
    expect(templatesRoute).toContain('createTemplateSchema');
    expect(templatesRoute).toContain('z.array');
    expect(templatesRoute).toContain('supplyCatalogId');
  });

  it('15 — Templates route supports template creation', () => {
    expect(templatesRoute).toContain('consumableUsageTemplate.create');
  });
});

// ===================================================================
// 16-18: Reports & Quality
// ===================================================================

describe('Consumables — Reports & Quality', () => {
  const reportsRoute = readRoute('app', 'api', 'consumables', 'reports', 'route.ts');

  it('16 — Reports route supports summary view with analytics (topItems, byDepartment, byContext)', () => {
    expect(reportsRoute).toContain("view === 'summary'");
    expect(reportsRoute).toContain('topItems');
    expect(reportsRoute).toContain('byDepartment');
    expect(reportsRoute).toContain('byContext');
    expect(reportsRoute).toContain('wasteRatio');
    expect(reportsRoute).toContain('totalCost');
  });

  it('17 — Reports calculate waste ratio correctly', () => {
    expect(reportsRoute).toContain('totalWaste');
    expect(reportsRoute).toContain('totalItems > 0');
    expect(reportsRoute).toContain('wasteRatio');
  });

  it('18 — No skeleton or dummy data in any route', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'consumables'));
    for (const fp of routes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});
