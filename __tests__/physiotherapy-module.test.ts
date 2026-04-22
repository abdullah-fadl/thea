/**
 * Physiotherapy Module Tests — Thea EHR
 *
 * 16 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Referral CRUD
 *   7-9   Session Management
 *   10-13 Business Logic (auto-advance, validation)
 *   14-16 Error Handling & Quality
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

describe('Physiotherapy — Route Wiring', () => {
  const listRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', '[id]', 'route.ts');
  const sessionsRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', '[id]', 'sessions', 'route.ts');

  it('1 — All 3 physiotherapy routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'physiotherapy'));
    expect(routes.length).toBe(3);
  });

  it('2 — All routes use withAuthTenant and prisma with tenantId', () => {
    for (const src of [listRoute, detailRoute, sessionsRoute]) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — Permission keys: physiotherapy.view for reads, physiotherapy.create/edit for writes', () => {
    expect(listRoute).toContain("permissionKey: 'physiotherapy.view'");
    expect(listRoute).toContain("permissionKey: 'physiotherapy.create'");
    expect(detailRoute).toContain("permissionKey: 'physiotherapy.view'");
    expect(detailRoute).toContain("permissionKey: 'physiotherapy.edit'");
    expect(sessionsRoute).toContain("permissionKey: 'physiotherapy.view'");
    expect(sessionsRoute).toContain("permissionKey: 'physiotherapy.edit'");
  });
});

// ===================================================================
// 4-6: Referral CRUD
// ===================================================================

describe('Physiotherapy — Referral CRUD', () => {
  const listRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', '[id]', 'route.ts');

  it('4 — GET /api/physiotherapy/referrals lists with status and patientMasterId filters', () => {
    expect(listRoute).toContain('ptReferral.findMany');
    expect(listRoute).toContain('status');
    expect(listRoute).toContain('patientMasterId');
    expect(listRoute).toContain("orderBy: { createdAt: 'desc' }");
    expect(listRoute).toContain('take: 100');
  });

  it('5 — POST /api/physiotherapy/referrals validates required fields (patientMasterId, reason, urgency, specialty)', () => {
    expect(listRoute).toContain('ptReferral.create');
    expect(listRoute).toContain("'patientMasterId, reason, urgency, and specialty are required'");
    expect(listRoute).toContain("status: 'PENDING'");
    expect(listRoute).toContain('referredBy: userId');
  });

  it('6 — GET /api/physiotherapy/referrals/[id] returns referral with assessments and sessions', () => {
    expect(detailRoute).toContain('ptReferral.findFirst');
    expect(detailRoute).toContain('ptAssessment.findMany');
    expect(detailRoute).toContain('ptSession.findMany');
    expect(detailRoute).toContain('{ referral, assessments, sessions }');
  });
});

// ===================================================================
// 7-9: Session Management
// ===================================================================

describe('Physiotherapy — Sessions', () => {
  const sessionsRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', '[id]', 'sessions', 'route.ts');

  it('7 — GET sessions returns all sessions for a referral, validates referral exists', () => {
    expect(sessionsRoute).toContain('ptSession.findMany');
    expect(sessionsRoute).toContain('ptReferral.findFirst');
    expect(sessionsRoute).toContain("{ error: 'Referral not found' }");
  });

  it('8 — POST session requires sessionDate, interventions, and progressNote', () => {
    expect(sessionsRoute).toContain('ptSession.create');
    expect(sessionsRoute).toContain("'sessionDate, interventions, and progressNote are required'");
  });

  it('9 — Session captures pain assessment (painBefore, painAfter) and duration', () => {
    expect(sessionsRoute).toContain('painBefore');
    expect(sessionsRoute).toContain('painAfter');
    expect(sessionsRoute).toContain('duration');
    expect(sessionsRoute).toContain('therapistId');
  });
});

// ===================================================================
// 10-13: Business Logic
// ===================================================================

describe('Physiotherapy — Business Logic', () => {
  const detailRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', '[id]', 'route.ts');
  const sessionsRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', '[id]', 'sessions', 'route.ts');

  it('10 — PUT referral validates status against allowed values', () => {
    expect(detailRoute).toContain('validStatuses');
    expect(detailRoute).toContain("'PENDING'");
    expect(detailRoute).toContain("'ACCEPTED'");
    expect(detailRoute).toContain("'IN_PROGRESS'");
    expect(detailRoute).toContain("'COMPLETED'");
    expect(detailRoute).toContain("'CANCELLED'");
    expect(detailRoute).toContain("'Invalid status value'");
  });

  it('11 — Creating a session auto-advances referral from PENDING/ACCEPTED to IN_PROGRESS', () => {
    expect(sessionsRoute).toContain("referral.status === 'PENDING'");
    expect(sessionsRoute).toContain("referral.status === 'ACCEPTED'");
    expect(sessionsRoute).toContain("status: 'IN_PROGRESS'");
    expect(sessionsRoute).toContain('ptReferral.update');
  });

  it('12 — Therapist defaults to current user if not specified', () => {
    expect(sessionsRoute).toContain('therapistId: therapistId ?? userId');
  });

  it('13 — Session creation returns 201 status', () => {
    expect(sessionsRoute).toContain('{ status: 201 }');
  });
});

// ===================================================================
// 14-16: Error Handling & Quality
// ===================================================================

describe('Physiotherapy — Error Handling', () => {
  const listRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', '[id]', 'route.ts');
  const sessionsRoute = readRoute('app', 'api', 'physiotherapy', 'referrals', '[id]', 'sessions', 'route.ts');

  it('14 — List route uses logger.error for structured error reporting', () => {
    expect(listRoute).toContain('logger.error');
  });

  it('15 — Detail and sessions routes use withErrorHandler', () => {
    expect(detailRoute).toContain('withErrorHandler');
    expect(sessionsRoute).toContain('withErrorHandler');
  });

  it('16 — No skeleton or dummy data in any route', () => {
    for (const src of [listRoute, detailRoute, sessionsRoute]) {
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});
