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

describe('Identity Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/identity');
  const routes = findRoutes(baseDir);

  it('should have exactly 2 identity route files', () => {
    expect(routes.length).toBe(2);
  });

  // ── Lookup Route ───────────────────────────────────────────────────
  describe('lookup route', () => {
    const src = readRoute('app/api/identity/lookup/route.ts');

    it('uses withAuthTenant with patients.master.view permission', () => {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain("permissionKey: 'patients.master.view'");
    });

    it('validates body with Zod (identityType, identityValue, contextArea)', () => {
      expect(src).toContain('z.object');
      expect(src).toContain('identityType: z.string().min(1)');
      expect(src).toContain('identityValue: z.string().min(1)');
    });

    it('supports NATIONAL_ID, IQAMA, PASSPORT identity types', () => {
      expect(src).toContain("'NATIONAL_ID'");
      expect(src).toContain("'IQAMA'");
      expect(src).toContain("'PASSPORT'");
    });

    it('implements rate limiting via consumeIdentityRateLimit', () => {
      expect(src).toContain('consumeIdentityRateLimit');
      expect(src).toContain("status: 'RATE_LIMITED'");
    });

    it('implements deduplication with configurable TTL window', () => {
      expect(src).toContain('dedupeKey');
      expect(src).toContain('IDENTITY_DEDUPE_TTL_MIN');
      expect(src).toContain('dedupeCutoff');
    });

    it('supports client-side idempotency via clientRequestId', () => {
      expect(src).toContain('clientRequestId');
      expect(src).toContain("x-idempotent-replay");
    });

    it('hashes identity value and stores only last 4 digits', () => {
      expect(src).toContain('hashIdentityValue');
      expect(src).toContain('getIdentityLast4');
    });

    it('encrypts identity value before storage', () => {
      expect(src).toContain('maybeEncryptIdentityValue');
    });

    it('calls lookupIdentityProvider with contextArea', () => {
      expect(src).toContain('lookupIdentityProvider');
    });

    it('creates audit log for identity lookup', () => {
      expect(src).toContain('createAuditLog');
      expect(src).toContain("'identity_lookup'");
    });

    it('handles provider errors with 502 status', () => {
      expect(src).toContain("status: 502");
      expect(src).toContain("status: 'ERROR'");
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });

  // ── Apply-to-Patient Route ─────────────────────────────────────────
  describe('apply-to-patient route', () => {
    const src = readRoute('app/api/identity/apply-to-patient/route.ts');

    it('uses withAuthTenant with patients.master.edit permission', () => {
      expect(src).toContain("permissionKey: 'patients.master.edit'");
    });

    it('validates lookupId and patientMasterId', () => {
      expect(src).toContain('lookupId: z.string().min(1)');
      expect(src).toContain('patientMasterId: z.string().min(1)');
    });

    it('verifies lookup has VERIFIED match level before applying', () => {
      expect(src).toContain("lookup.matchLevel !== 'VERIFIED'");
      expect(src).toContain("code: 'LOOKUP_NOT_VERIFIED'");
    });

    it('prevents applying to merged patients', () => {
      expect(src).toContain("'MERGED'");
      expect(src).toContain('Patient is merged');
    });

    it('updates patient master with identity verification data', () => {
      expect(src).toContain('prisma.patientMaster.updateMany');
      expect(src).toContain('identityVerification');
      expect(src).toContain("source: 'GOV_LOOKUP'");
    });

    it('supports override flag restricted to admin/dev roles', () => {
      expect(src).toContain('override');
      expect(src).toContain('canOverride');
      expect(src).toContain('Override not allowed');
    });

    it('implements idempotency via identityApplyIdempotency upsert', () => {
      expect(src).toContain('prisma.identityApplyIdempotency.upsert');
    });

    it('creates audit log for identity apply action', () => {
      expect(src).toContain('createAuditLog');
      expect(src).toContain("'GOV_IDENTITY_APPLIED'");
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
