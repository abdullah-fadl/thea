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

describe('Equipment Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/equipment-mgmt');
  const routes = findRoutes(baseDir);

  it('should have at least 2 equipment-mgmt route files', () => {
    expect(routes.length).toBeGreaterThanOrEqual(2);
  });

  // ── Equipment List/Create Route ───────────────────────────────
  describe('equipment-mgmt root route', () => {
    const src = readRoute('app/api/equipment-mgmt/route.ts');

    it('uses withAuthTenant with equipment.view and equipment.manage permissions', () => {
      expect(src).toContain("permissionKey: 'equipment.view'");
      expect(src).toContain("permissionKey: 'equipment.manage'");
    });

    it('GET enriches data with warranty and maintenance overdue flags', () => {
      expect(src).toContain('warrantyExpired');
      expect(src).toContain('warrantyExpiringSoon');
      expect(src).toContain('maintenanceOverdue');
    });

    it('includes maintenance records and open issues in query', () => {
      expect(src).toContain('maintenanceRecords');
      expect(src).toContain('issues');
      expect(src).toContain("status: { in: ['OPEN', 'IN_PROGRESS'] }");
    });

    it('supports text search on name, assetTag, manufacturer, serialNumber, location', () => {
      expect(src).toContain("searchParams.get('q')");
      expect(src).toContain('eq.name');
      expect(src).toContain('eq.assetTag');
      expect(src).toContain('eq.manufacturer');
    });

    it('validates category against VALID_CATEGORIES set', () => {
      expect(src).toContain('VALID_CATEGORIES');
      expect(src).toContain("'VENTILATOR'");
      expect(src).toContain("'MONITOR'");
      expect(src).toContain("'PUMP'");
      expect(src).toContain("'IMAGING'");
      expect(src).toContain("'DEFIBRILLATOR'");
    });

    it('requires assetTag, name, and category for creation', () => {
      expect(src).toContain("'assetTag, name, and category are required'");
    });

    it('sets initial status to OPERATIONAL', () => {
      expect(src).toContain("status: 'OPERATIONAL'");
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Equipment [id] Route ──────────────────────────────────────
  describe('equipment-mgmt/[id] route', () => {
    const src = readRoute('app/api/equipment-mgmt/[id]/route.ts');

    it('GET fetches equipment with maintenance records and issues', () => {
      expect(src).toContain('prisma.equipmentMaintenance.findMany');
      expect(src).toContain('prisma.equipmentIssue.findMany');
    });

    it('fetches related data in parallel with Promise.all', () => {
      expect(src).toContain('Promise.all');
    });

    it('validates status against VALID_STATUSES (OPERATIONAL, UNDER_MAINTENANCE, OUT_OF_SERVICE, CALIBRATION_DUE)', () => {
      expect(src).toContain('VALID_STATUSES');
      expect(src).toContain("'OPERATIONAL'");
      expect(src).toContain("'UNDER_MAINTENANCE'");
      expect(src).toContain("'OUT_OF_SERVICE'");
      expect(src).toContain("'CALIBRATION_DUE'");
    });

    it('validates category against VALID_CATEGORIES on update', () => {
      expect(src).toContain('VALID_CATEGORIES');
    });

    it('returns error when no valid fields to update', () => {
      expect(src).toContain("'No valid fields to update'");
    });

    it('returns 404 when equipment not found', () => {
      expect(src).toContain("'Not found'");
      expect(src).toContain('status: 404');
    });
  });
});
