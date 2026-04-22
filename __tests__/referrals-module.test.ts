/**
 * Referrals Module Tests — Thea EHR
 *
 * 18 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Referral List & Create
 *   7-9   Accept Flow (booking, billing transfer)
 *   10-12 Reject Flow & State Guards
 *   13-15 Smart Recommend Engine
 *   16-18 Business Logic & Quality
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

describe('Referrals — Route Wiring', () => {
  const mainRoute = readRoute('app', 'api', 'referrals', 'route.ts');
  const acceptRoute = readRoute('app', 'api', 'referrals', '[referralId]', 'accept', 'route.ts');
  const rejectRoute = readRoute('app', 'api', 'referrals', '[referralId]', 'reject', 'route.ts');
  const smartRoute = readRoute('app', 'api', 'referrals', 'smart-recommend', 'route.ts');

  it('1 — All 4 referral routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'referrals'));
    expect(routes.length).toBe(4);
  });

  it('2 — All routes use withAuthTenant and prisma with tenantId', () => {
    for (const src of [mainRoute, acceptRoute, rejectRoute, smartRoute]) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — Permission keys follow referral.* pattern', () => {
    expect(mainRoute).toContain("permissionKey: 'referral.view'");
    expect(mainRoute).toContain("permissionKey: 'referral.create'");
    expect(acceptRoute).toContain("permissionKey: 'referral.edit'");
    expect(rejectRoute).toContain("permissionKey: 'referral.edit'");
  });
});

// ===================================================================
// 4-6: Referral List & Create
// ===================================================================

describe('Referrals — List & Create', () => {
  const mainRoute = readRoute('app', 'api', 'referrals', 'route.ts');

  it('4 — GET supports direction (outgoing/incoming), status, search, and scope filters', () => {
    expect(mainRoute).toContain('direction');
    expect(mainRoute).toContain('status');
    expect(mainRoute).toContain('search');
    expect(mainRoute).toContain('scope');
    expect(mainRoute).toContain("direction === 'outgoing'");
  });

  it('5 — POST creates referral with Zod validation and resolves provider via email', () => {
    expect(mainRoute).toContain('referral.create');
    expect(mainRoute).toContain('z.object');
    expect(mainRoute).toContain('validateBody');
    expect(mainRoute).toContain('clinicalInfraProvider.findUnique');
    expect(mainRoute).toContain("status: 'PENDING'");
    expect(mainRoute).toContain('createdBy: userId');
  });

  it('6 — POST sends notification to receiving provider', () => {
    expect(mainRoute).toContain('notification.create');
    expect(mainRoute).toContain('referralId');
  });
});

// ===================================================================
// 7-9: Accept Flow
// ===================================================================

describe('Referrals — Accept Flow', () => {
  const acceptRoute = readRoute('app', 'api', 'referrals', '[referralId]', 'accept', 'route.ts');

  it('7 — Accept validates referral is in PENDING status, returns 409 otherwise', () => {
    expect(acceptRoute).toContain("currentStatus !== 'PENDING'");
    expect(acceptRoute).toContain("code: 'INVALID_STATE'");
    expect(acceptRoute).toContain('status: 409');
  });

  it('8 — Accept checks source encounter is not CLOSED (stale referral guard)', () => {
    expect(acceptRoute).toContain('encounterCore.findFirst');
    expect(acceptRoute).toContain("code: 'ENCOUNTER_CLOSED'");
  });

  it('9 — Accept creates OPD booking with transfer billing vs new payment scenarios', () => {
    expect(acceptRoute).toContain('opdBooking.create');
    expect(acceptRoute).toContain('transferBilling');
    expect(acceptRoute).toContain("bookingStatus = transferBilling ? 'ACTIVE' : 'PENDING_PAYMENT'");
    expect(acceptRoute).toContain('encounterCore.create');
    expect(acceptRoute).toContain('opdEncounter.create');
  });
});

// ===================================================================
// 10-12: Reject Flow & State Guards
// ===================================================================

describe('Referrals — Reject Flow', () => {
  const rejectRoute = readRoute('app', 'api', 'referrals', '[referralId]', 'reject', 'route.ts');
  const acceptRoute = readRoute('app', 'api', 'referrals', '[referralId]', 'accept', 'route.ts');

  it('10 — Reject validates referral is in PENDING status', () => {
    expect(rejectRoute).toContain("currentStatus !== 'PENDING'");
    expect(rejectRoute).toContain("code: 'INVALID_STATE'");
  });

  it('11 — Reject stores rejection reason and creates audit log', () => {
    expect(rejectRoute).toContain("status: 'REJECTED'");
    expect(rejectRoute).toContain('rejectedBy: userId');
    expect(rejectRoute).toContain('rejectionReason: reason');
    expect(rejectRoute).toContain('createAuditLog');
  });

  it('12 — Accept creates audit log and notifies referring doctor', () => {
    expect(acceptRoute).toContain('createAuditLog');
    expect(acceptRoute).toContain('notification.create');
    expect(acceptRoute).toContain('referral.fromProviderId');
  });
});

// ===================================================================
// 13-15: Smart Recommend Engine
// ===================================================================

describe('Referrals — Smart Recommend', () => {
  const smartRoute = readRoute('app', 'api', 'referrals', 'smart-recommend', 'route.ts');

  it('13 — Smart recommend requires specialtyCode, returns 400 if missing', () => {
    expect(smartRoute).toContain('specialtyCode');
    expect(smartRoute).toContain("'specialtyCode required'");
    expect(smartRoute).toContain('status: 400');
  });

  it('14 — Score calculation uses weighted formula (40% available, 30% utilization, 30% active)', () => {
    expect(smartRoute).toContain('AVAILABLE_WEIGHT = 40');
    expect(smartRoute).toContain('UTILIZATION_WEIGHT = 30');
    expect(smartRoute).toContain('ACTIVE_NOW_WEIGHT = 30');
    expect(smartRoute).toContain('calculateScore');
  });

  it('15 — Recommendations include bilingual reasons (Arabic + English) with confidence levels', () => {
    expect(smartRoute).toContain('reason:');
    expect(smartRoute).toContain('reasonEn:');
    expect(smartRoute).toContain("confidence: 'HIGH'");
    expect(smartRoute).toContain("confidence: 'MEDIUM'");
    expect(smartRoute).toContain("confidence: 'LOW'");
  });
});

// ===================================================================
// 16-18: Business Logic & Quality
// ===================================================================

describe('Referrals — Business Logic & Quality', () => {
  const smartRoute = readRoute('app', 'api', 'referrals', 'smart-recommend', 'route.ts');
  const mainRoute = readRoute('app', 'api', 'referrals', 'route.ts');

  it('16 — Smart recommend handles __ALL__ special case for all providers', () => {
    expect(smartRoute).toContain("specialtyCode === '__ALL__'");
    expect(smartRoute).toContain('allProviders');
  });

  it('17 — Smart recommend has fallback to clinic-based specialty matching', () => {
    expect(smartRoute).toContain('clinicalInfraSpecialty.findFirst');
    expect(smartRoute).toContain('clinicalInfraClinic.findMany');
    expect(smartRoute).toContain('clinicIds');
  });

  it('18 — No skeleton or dummy data in any route', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'referrals'));
    for (const fp of routes) {
      const src = fs.readFileSync(fp, 'utf-8');
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});
