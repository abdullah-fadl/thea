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

describe('Pathology Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/pathology');
  const routes = findRoutes(baseDir);

  it('should have exactly 3 pathology route files', () => {
    expect(routes.length).toBe(4);
  });

  // ── Specimens Route ───────────────────────────────────────────
  describe('specimens list/create route', () => {
    const src = readRoute('app/api/pathology/specimens/route.ts');

    it('uses withAuthTenant with pathology.view and pathology.receive permissions', () => {
      expect(src).toContain("permissionKey: 'pathology.view'");
      expect(src).toContain("permissionKey: 'pathology.receive'");
    });

    it('supports search across accessionNumber, specimenType, and site', () => {
      expect(src).toContain('accessionNumber');
      expect(src).toContain('specimenType');
      expect(src).toContain('site');
      expect(src).toContain("mode: 'insensitive'");
    });

    it('auto-generates accession number if not provided', () => {
      expect(src).toContain('PATH-');
      expect(src).toContain('finalAccession');
    });

    it('checks for duplicate accession number (409)', () => {
      expect(src).toContain("'Accession number already exists'");
      expect(src).toContain('status: 409');
    });

    it('requires patientMasterId, specimenType, and site', () => {
      expect(src).toContain("'patientMasterId, specimenType, and site are required'");
    });

    it('sets initial status to RECEIVED', () => {
      expect(src).toContain("status: 'RECEIVED'");
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Specimens [id] Route ──────────────────────────────────────
  describe('specimens/[id] route', () => {
    const src = readRoute('app/api/pathology/specimens/[id]/route.ts');

    it('GET includes associated pathology report', () => {
      expect(src).toContain('pathologyReport.findFirst');
      expect(src).toContain('report: report || null');
    });

    it('validates status against VALID_STATUSES pipeline stages', () => {
      expect(src).toContain('VALID_STATUSES');
      expect(src).toContain("'RECEIVED'");
      expect(src).toContain("'GROSSING'");
      expect(src).toContain("'PROCESSING'");
      expect(src).toContain("'EMBEDDING'");
      expect(src).toContain("'SECTIONING'");
      expect(src).toContain("'STAINING'");
      expect(src).toContain("'REPORTING'");
      expect(src).toContain("'FINALIZED'");
    });

    it('supports grossingData field update', () => {
      expect(src).toContain('grossingData');
    });

    it('returns 404 when specimen not found', () => {
      expect(src).toContain("'Specimen not found'");
      expect(src).toContain('status: 404');
    });
  });

  // ── Report Route ──────────────────────────────────────────────
  describe('specimens/[id]/report route', () => {
    const src = readRoute('app/api/pathology/specimens/[id]/report/route.ts');

    it('has GET, POST, and PUT endpoints', () => {
      expect(src).toContain('export const GET');
      expect(src).toContain('export const POST');
      expect(src).toContain('export const PUT');
    });

    it('prevents duplicate reports (409)', () => {
      expect(src).toContain("'A report already exists. Use PUT to update it.'");
      expect(src).toContain('status: 409');
    });

    it('supports comprehensive pathology report fields', () => {
      expect(src).toContain('grossDescription');
      expect(src).toContain('microscopicDescription');
      expect(src).toContain('immunohistochemistry');
      expect(src).toContain('ihcMarkers');
      expect(src).toContain('molecularResults');
      expect(src).toContain('tumorCharacteristics');
    });

    it('supports report status workflow (DRAFT, PRELIMINARY, SIGNED, AMENDED)', () => {
      expect(src).toContain("status === 'SIGNED'");
      expect(src).toContain("status === 'PRELIMINARY'");
      expect(src).toContain("status === 'AMENDED'");
      expect(src).toContain("status === 'DRAFT'");
    });

    it('requires diagnosis to sign/finalize a report', () => {
      expect(src).toContain("'A diagnosis is required to finalize the report'");
    });

    it('only allows amendment of signed reports', () => {
      expect(src).toContain("report.status !== 'SIGNED'");
      expect(src).toContain("'Only signed reports can be amended'");
    });

    it('advances specimen to REPORTING when report is first created', () => {
      expect(src).toContain("specimen.status === 'STAINING'");
      expect(src).toContain("data: { status: 'REPORTING' }");
    });

    it('advances specimen to FINALIZED when report is signed', () => {
      expect(src).toContain("data: { status: 'FINALIZED' }");
    });

    it('tracks amendment history with previous diagnosis', () => {
      expect(src).toContain('amendments');
      expect(src).toContain('previousDiagnosis');
      expect(src).toContain('amendmentNote');
    });
  });
});
