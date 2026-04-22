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

describe('Credentialing Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/credentialing');
  const routes = findRoutes(baseDir);

  it('should have exactly 7 credentialing route files', () => {
    expect(routes.length).toBe(7);
  });

  // ── Credentials Route ─────────────────────────────────────────
  describe('credentials list/create route', () => {
    const src = readRoute('app/api/credentialing/credentials/route.ts');

    it('uses withAuthTenant with credentialing.view and credentialing.manage permissions', () => {
      expect(src).toContain("permissionKey: 'credentialing.view'");
      expect(src).toContain("permissionKey: 'credentialing.manage'");
    });

    it('supports expiring filter with 30-day window', () => {
      expect(src).toContain("expiring === 'true'");
      expect(src).toContain('30 * 24 * 60 * 60 * 1000');
      expect(src).toContain('thirtyDaysFromNow');
    });

    it('validates POST with createSchema Zod schema', () => {
      expect(src).toContain('createSchema');
      expect(src).toContain('z.object');
      expect(src).toContain('credentialType: z.string().min(1)');
    });

    it('queries prisma.staffCredential with tenant isolation', () => {
      expect(src).toContain('prisma.staffCredential.findMany');
      expect(src).toContain('prisma.staffCredential.create');
    });

    it('creates audit log on credential creation', () => {
      expect(src).toContain('createAuditLog');
      expect(src).toContain("'staff_credential'");
    });
  });

  // ── Credentials [id] Route ────────────────────────────────────
  describe('credentials/[id] route', () => {
    const src = readRoute('app/api/credentialing/credentials/[id]/route.ts');

    it('supports verify action via verifyCredential engine call', () => {
      expect(src).toContain("data.action === 'verify'");
      expect(src).toContain('verifyCredential');
    });

    it('supports reject action setting verificationStatus to failed', () => {
      expect(src).toContain("data.action === 'reject'");
      expect(src).toContain("verificationStatus: 'failed'");
    });

    it('creates audit log for REJECT_VERIFICATION action', () => {
      expect(src).toContain("'REJECT_VERIFICATION'");
    });

    it('returns 404 when credential not found', () => {
      expect(src).toContain("'Credential not found'");
      expect(src).toContain('status: 404');
    });
  });

  // ── Privileges Route ──────────────────────────────────────────
  describe('privileges list/create route', () => {
    const src = readRoute('app/api/credentialing/privileges/route.ts');

    it('queries prisma.clinicalPrivilege with multiple filters', () => {
      expect(src).toContain('prisma.clinicalPrivilege.findMany');
      expect(src).toContain('where.department');
    });

    it('POST delegates to grantPrivilege engine call', () => {
      expect(src).toContain('grantPrivilege');
      expect(src).toContain('grantSchema');
    });

    it('supports caseLogRequired and supervisorId fields', () => {
      expect(src).toContain('caseLogRequired');
      expect(src).toContain('supervisorId');
    });
  });

  // ── Privileges [id] Route ────────────────────────────────────
  describe('privileges/[id] route', () => {
    const src = readRoute('app/api/credentialing/privileges/[id]/route.ts');

    it('supports revoke action via revokePrivilege engine call', () => {
      expect(src).toContain("data.action === 'revoke'");
      expect(src).toContain('revokePrivilege');
    });

    it('supports suspend action setting status to suspended', () => {
      expect(src).toContain("data.action === 'suspend'");
      expect(src).toContain("status: 'suspended'");
    });

    it('supports reinstate action setting status to active', () => {
      expect(src).toContain("data.action === 'reinstate'");
      expect(src).toContain("status: 'active'");
    });

    it('creates audit log for SUSPEND and REINSTATE actions', () => {
      expect(src).toContain("'SUSPEND'");
      expect(src).toContain("'REINSTATE'");
    });
  });

  // ── Alerts Route ──────────────────────────────────────────────
  describe('alerts route', () => {
    const src = readRoute('app/api/credentialing/alerts/route.ts');

    it('queries prisma.credentialAlert with isDismissed filter', () => {
      expect(src).toContain('prisma.credentialAlert.findMany');
      expect(src).toContain('isDismissed: false');
    });

    it('POST supports generate, mark_read, dismiss actions', () => {
      expect(src).toContain("action === 'generate'");
      expect(src).toContain("action === 'mark_read'");
      expect(src).toContain("action === 'dismiss'");
    });

    it('delegates to generateExpiryAlerts and checkCredentialStatus', () => {
      expect(src).toContain('generateExpiryAlerts');
      expect(src).toContain('checkCredentialStatus');
    });
  });

  // ── Dashboard Route ───────────────────────────────────────────
  describe('dashboard route', () => {
    const src = readRoute('app/api/credentialing/dashboard/route.ts');

    it('delegates to getCredentialingDashboardStats', () => {
      expect(src).toContain('getCredentialingDashboardStats');
    });
  });

  // ── Practitioner Status Route ─────────────────────────────────
  describe('practitioner-status route', () => {
    const src = readRoute('app/api/credentialing/practitioner-status/route.ts');

    it('requires userId query parameter', () => {
      expect(src).toContain("'userId query parameter is required'");
    });

    it('delegates to checkPractitionerReady', () => {
      expect(src).toContain('checkPractitionerReady');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
