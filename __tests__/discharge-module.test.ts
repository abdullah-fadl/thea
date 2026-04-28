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

describe('Discharge Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/discharge');
  const routes = findRoutes(baseDir);

  it('should have exactly 1 discharge route file (finalize)', () => {
    expect(routes.length).toBe(1);
    expect(routes[0]).toContain('finalize');
  });

  describe('finalize route', () => {
    const src = readRoute('app/api/discharge/finalize/route.ts');

    it('uses withAuthTenant for both GET and POST', () => {
      expect(src).toMatch(/export\s+const\s+GET\s*=\s*withAuthTenant/);
      expect(src).toMatch(/export\s+const\s+POST\s*=\s*withAuthTenant/);
    });

    it('requires ipd.live-beds.edit permission', () => {
      expect(src).toContain("permissionKey: 'ipd.live-beds.edit'");
    });

    it('uses Zod validation with encounterCoreId, disposition, summaryText', () => {
      expect(src).toContain('z.object');
      expect(src).toContain('encounterCoreId: z.string().min(1)');
      expect(src).toContain('disposition: z.string().min(1)');
      expect(src).toContain('summaryText: z.string().min(1)');
    });

    it('validates disposition against allowed list (HOME, AMA, LAMA, TRANSFER_OUT, DEATH_PENDING)', () => {
      expect(src).toContain('DISPOSITIONS');
      expect(src).toContain("'HOME'");
      expect(src).toContain("'AMA'");
      expect(src).toContain("'LAMA'");
      expect(src).toContain("'TRANSFER_OUT'");
      expect(src).toContain("'DEATH_PENDING'");
    });

    it('handles OPD encounter discharge (requires COMPLETED or LEFT)', () => {
      expect(src).toContain("sourceSystem === 'OPD'");
      expect(src).toContain("opdStatus !== 'COMPLETED'");
      expect(src).toContain("arrivalState !== 'LEFT'");
    });

    it('handles ER encounter discharge (requires DISCHARGED)', () => {
      expect(src).toContain("sourceSystem === 'ER'");
      expect(src).toContain("erStatus !== 'DISCHARGED'");
    });

    it('handles IPD discharge with handover check', () => {
      expect(src).toContain("sourceSystem === 'IPD'");
      expect(src).toContain('handoverReady');
      expect(src).toContain("code: 'HANDOVER_REQUIRED'");
    });

    it('checks for pending billing before discharge (D-01 guard)', () => {
      expect(src).toContain('prisma.billingChargeEvent.count');
      expect(src).toContain("code: 'PENDING_BILLING'");
      expect(src).toContain('acknowledgePendingBilling');
    });

    it('prevents duplicate discharge summaries (D-02 idempotency)', () => {
      expect(src).toContain('prisma.dischargeSummary.findFirst');
      expect(src).toContain('noOp: true');
    });

    it('closes encounter and creates audit log', () => {
      expect(src).toContain("status: 'CLOSED'");
      expect(src).toContain('createAuditLog');
    });

    it('releases IPD beds on discharge (ipdAdmission.updateMany)', () => {
      expect(src).toContain('prisma.ipdAdmission.updateMany');
      expect(src).toContain('isActive: false');
    });

    it('creates discharge summary in DB with real fields', () => {
      expect(src).toContain('prisma.dischargeSummary.create');
      expect(src).toContain('sourceSystem');
      expect(src).toContain('disposition');
      expect(src).toContain('summaryText');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
