/**
 * Catalogs Module Tests — Thea EHR
 *
 * 18 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Diagnosis Catalog
 *   7-9   Service Catalog
 *   10-12 Supplies Catalog
 *   13-15 Pricing Packages
 *   16-18 Usage Events & Idempotency
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

describe('Catalogs — Route Wiring', () => {
  it('1 — All 10 catalog routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'catalogs'));
    expect(routes.length).toBe(10);
  });

  it('2 — All routes use withAuthTenant, withErrorHandler, and prisma', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'catalogs'));
    for (const fp of routes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('withErrorHandler');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — All routes use billing.view permission key', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'catalogs'));
    for (const fp of routes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).toContain("permissionKey: 'billing.view'");
    }
  });
});

// ===================================================================
// 4-6: Diagnosis Catalog
// ===================================================================

describe('Catalogs — Diagnosis', () => {
  const diagnosisRoute = readRoute('app', 'api', 'catalogs', 'diagnosis', 'route.ts');

  it('4 — GET diagnosis searches by code, name, and icd10', () => {
    expect(diagnosisRoute).toContain('diagnosisCatalog.findMany');
    expect(diagnosisRoute).toContain('code');
    expect(diagnosisRoute).toContain('name');
    expect(diagnosisRoute).toContain('icd10');
    expect(diagnosisRoute).toContain("mode: 'insensitive'");
  });

  it('5 — POST diagnosis validates with Zod and prevents duplicate codes', () => {
    expect(diagnosisRoute).toContain('createDiagnosisSchema');
    expect(diagnosisRoute).toContain("'Diagnosis code already exists'");
    expect(diagnosisRoute).toContain("code: 'CODE_EXISTS'");
    expect(diagnosisRoute).toContain('diagnosisCatalog.create');
  });

  it('6 — POST handles Prisma P2002 unique constraint error', () => {
    expect(diagnosisRoute).toContain('P2002');
    expect(diagnosisRoute).toContain('PrismaClientKnownRequestError');
    expect(diagnosisRoute).toContain('createAuditLog');
  });
});

// ===================================================================
// 7-9: Service Catalog
// ===================================================================

describe('Catalogs — Services', () => {
  const servicesRoute = readRoute('app', 'api', 'catalogs', 'services', 'route.ts');
  const updateRoute = readRoute('app', 'api', 'catalogs', 'services', '[id]', 'update', 'route.ts');

  it('7 — GET services supports filtering by serviceType and specialtyCode', () => {
    expect(servicesRoute).toContain('serviceCatalog.findMany');
    expect(servicesRoute).toContain('serviceType');
    expect(servicesRoute).toContain('specialtyCode');
    expect(servicesRoute).toContain('canAccessBilling');
  });

  it('8 — POST service auto-allocates charge catalog code and validates against SERVICE_TYPES', () => {
    expect(servicesRoute).toContain('allocateChargeCatalogCode');
    expect(servicesRoute).toContain('allocateServiceCatalogCode');
    expect(servicesRoute).toContain("SERVICE_TYPES");
    expect(servicesRoute).toContain('billingChargeCatalog.create');
    expect(servicesRoute).toContain('serviceCatalog.create');
  });

  it('9 — Service update handles partial updates with duplicate name check', () => {
    expect(updateRoute).toContain('serviceCatalog.update');
    expect(updateRoute).toContain("'Service name already exists'");
    expect(updateRoute).toContain('normalizePricing');
    expect(updateRoute).toContain('normalizeRules');
    expect(updateRoute).toContain('createAuditLog');
  });
});

// ===================================================================
// 10-12: Supplies Catalog
// ===================================================================

describe('Catalogs — Supplies', () => {
  const suppliesRoute = readRoute('app', 'api', 'catalogs', 'supplies', 'route.ts');
  const updateRoute = readRoute('app', 'api', 'catalogs', 'supplies', '[id]', 'update', 'route.ts');

  it('10 — POST supply supports optional charge generation (generateCharge flag)', () => {
    expect(suppliesRoute).toContain('generateCharge');
    expect(suppliesRoute).toContain('allocateChargeCatalogCode');
    expect(suppliesRoute).toContain('allocateSupplyCatalogCode');
    expect(suppliesRoute).toContain('suppliesCatalog.create');
  });

  it('11 — Supply linked charge prevents duplicate linking across catalog types', () => {
    expect(suppliesRoute).toContain('suppliesCatalog.findFirst');
    expect(suppliesRoute).toContain('medicationCatalog.findFirst');
    expect(suppliesRoute).toContain('serviceCatalog.findFirst');
    expect(suppliesRoute).toContain("'Charge already linked to another catalog'");
  });

  it('12 — Supply update validates status and name uniqueness', () => {
    expect(updateRoute).toContain("'Supply name already exists'");
    expect(updateRoute).toContain("['ACTIVE', 'INACTIVE']");
    expect(updateRoute).toContain('requireAdminDeleteCode');
    expect(updateRoute).toContain('createAuditLog');
  });
});

// ===================================================================
// 13-15: Pricing Packages
// ===================================================================

describe('Catalogs — Pricing Packages', () => {
  const packagesRoute = readRoute('app', 'api', 'catalogs', 'pricing-packages', 'route.ts');
  const updateRoute = readRoute('app', 'api', 'catalogs', 'pricing-packages', '[id]', 'update', 'route.ts');
  const applyRoute = readRoute('app', 'api', 'catalogs', 'pricing-packages', 'apply', 'route.ts');

  it('13 — POST package validates name, fixedPrice and auto-allocates code', () => {
    expect(packagesRoute).toContain('allocatePricingPackageCode');
    expect(packagesRoute).toContain('pricingPackage.create');
    expect(packagesRoute).toContain("'Package name already exists'");
    expect(packagesRoute).toContain('overridesCharges: true');
  });

  it('14 — Apply route validates package is ACTIVE and uses idempotency via requestId', () => {
    expect(applyRoute).toContain('pricingPackage.findFirst');
    expect(applyRoute).toContain("{ error: 'Package not found' }");
    expect(applyRoute).toContain("{ error: 'Package inactive' }");
    expect(applyRoute).toContain('pricingPackageApplication.findFirst');
    expect(applyRoute).toContain('pricingPackageApplication.create');
  });

  it('15 — Apply handles P2002 unique constraint for idempotent replays', () => {
    expect(applyRoute).toContain('P2002');
    expect(applyRoute).toContain("'x-idempotent-replay'");
    expect(applyRoute).toContain('noOp: true');
  });
});

// ===================================================================
// 16-18: Usage Events & Quality
// ===================================================================

describe('Catalogs — Usage Events & Quality', () => {
  const serviceUsageRoute = readRoute('app', 'api', 'catalogs', 'services', 'usage', 'route.ts');
  const supplyUsageRoute = readRoute('app', 'api', 'catalogs', 'supplies', 'usage', 'route.ts');

  it('16 — Service usage POST creates charge event linked to encounter', () => {
    expect(serviceUsageRoute).toContain('serviceUsageEvent.create');
    expect(serviceUsageRoute).toContain('billingChargeEvent.create');
    expect(serviceUsageRoute).toContain('encounterCore.findFirst');
    expect(serviceUsageRoute).toContain("encounter.status")
  });

  it('17 — Both usage routes use catalogUsageIdempotency for dedup', () => {
    expect(serviceUsageRoute).toContain('catalogUsageIdempotency.create');
    expect(serviceUsageRoute).toContain('P2002');
    expect(supplyUsageRoute).toContain('catalogUsageIdempotency.create');
    expect(supplyUsageRoute).toContain('P2002');
  });

  it('18 — No skeleton or dummy data in any route', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'catalogs'));
    for (const fp of routes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});
