/**
 * Telemedicine Module Tests — Thea EHR
 *
 * 15 scenarios covering:
 *   1-3   Route Wiring & Auth
 *   4-6   Consultation CRUD
 *   7-9   Availability Management
 *   10-12 Status Transitions & Duration Calc
 *   13-15 Error Handling & Quality
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

describe('Telemedicine — Route Wiring', () => {
  const consultationsRoute = readRoute('app', 'api', 'telemedicine', 'consultations', 'route.ts');
  const consultationDetailRoute = readRoute('app', 'api', 'telemedicine', 'consultations', '[id]', 'route.ts');
  const availabilityRoute = readRoute('app', 'api', 'telemedicine', 'availability', 'route.ts');

  it('1 — All 3 telemedicine routes exist on disk', () => {
    const routes = findRoutes(path.join(process.cwd(), 'app', 'api', 'telemedicine'));
    expect(routes.length).toBe(20);
  });

  it('2 — All routes use withAuthTenant, withErrorHandler, and prisma', () => {
    for (const src of [consultationsRoute, consultationDetailRoute, availabilityRoute]) {
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('withErrorHandler');
      expect(src).toContain('prisma');
      expect(src).toContain('tenantId');
    }
  });

  it('3 — Permission keys: telemedicine.view for reads, telemedicine.manage for writes', () => {
    expect(consultationsRoute).toContain("permissionKey: 'telemedicine.view'");
    expect(consultationsRoute).toContain("permissionKey: 'telemedicine.manage'");
    expect(consultationDetailRoute).toContain("permissionKey: 'telemedicine.view'");
    expect(consultationDetailRoute).toContain("permissionKey: 'telemedicine.manage'");
    expect(availabilityRoute).toContain("permissionKey: 'telemedicine.view'");
    expect(availabilityRoute).toContain("permissionKey: 'telemedicine.manage'");
  });
});

// ===================================================================
// 4-6: Consultation CRUD
// ===================================================================

describe('Telemedicine — Consultations', () => {
  const consultationsRoute = readRoute('app', 'api', 'telemedicine', 'consultations', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'telemedicine', 'consultations', '[id]', 'route.ts');

  it('4 — GET consultations supports filtering by status, doctorId, dateFrom, dateTo', () => {
    expect(consultationsRoute).toContain('teleConsultation.findMany');
    expect(consultationsRoute).toContain('status');
    expect(consultationsRoute).toContain('doctorId');
    expect(consultationsRoute).toContain('dateFrom');
    expect(consultationsRoute).toContain('dateTo');
    expect(consultationsRoute).toContain("orderBy: { scheduledAt: 'desc' }");
  });

  it('5 — POST creates consultation with default type VIDEO and duration 30', () => {
    expect(consultationsRoute).toContain('teleConsultation.create');
    expect(consultationsRoute).toContain("body.type || 'VIDEO'");
    expect(consultationsRoute).toContain('body.duration ? Number(body.duration) : 30');
    expect(consultationsRoute).toContain('{ status: 201 }');
  });

  it('6 — GET consultation detail returns single consultation with tenant guard', () => {
    expect(detailRoute).toContain('teleConsultation.findFirst');
    expect(detailRoute).toContain('{ id, tenantId }');
    expect(detailRoute).toContain("{ error: 'Not found' }");
  });
});

// ===================================================================
// 7-9: Availability Management
// ===================================================================

describe('Telemedicine — Availability', () => {
  const availabilityRoute = readRoute('app', 'api', 'telemedicine', 'availability', 'route.ts');

  it('7 — GET availability filters by doctorId and only returns active slots', () => {
    expect(availabilityRoute).toContain('teleAvailability.findMany');
    expect(availabilityRoute).toContain('isActive: true');
    expect(availabilityRoute).toContain('doctorId');
  });

  it('8 — POST availability creates slot with dayOfWeek, startTime, endTime', () => {
    expect(availabilityRoute).toContain('teleAvailability.create');
    expect(availabilityRoute).toContain('dayOfWeek');
    expect(availabilityRoute).toContain('startTime');
    expect(availabilityRoute).toContain('endTime');
    expect(availabilityRoute).toContain('slotDuration');
  });

  it('9 — Slot duration defaults to 30 minutes', () => {
    expect(availabilityRoute).toContain('body.slotDuration ? Number(body.slotDuration) : 30');
  });
});

// ===================================================================
// 10-12: Status Transitions & Duration Calc
// ===================================================================

describe('Telemedicine — Status Transitions', () => {
  const detailRoute = readRoute('app', 'api', 'telemedicine', 'consultations', '[id]', 'route.ts');

  it('10 — IN_PROGRESS status auto-sets startedAt timestamp', () => {
    expect(detailRoute).toContain("body.status === 'IN_PROGRESS'");
    expect(detailRoute).toContain('!existing.startedAt');
    expect(detailRoute).toContain('updateData.startedAt = new Date()');
  });

  it('11 — COMPLETED status auto-sets endedAt and calculates actualDuration in minutes', () => {
    expect(detailRoute).toContain("body.status === 'COMPLETED'");
    expect(detailRoute).toContain('!existing.endedAt');
    expect(detailRoute).toContain('updateData.endedAt = new Date()');
    expect(detailRoute).toContain('updateData.actualDuration');
    expect(detailRoute).toContain('60000');
  });

  it('12 — PUT supports follow-up, prescription, rating, and feedback fields', () => {
    expect(detailRoute).toContain('body.followUpNeeded');
    expect(detailRoute).toContain('body.followUpDate');
    expect(detailRoute).toContain('body.prescription');
    expect(detailRoute).toContain('body.patientRating');
    expect(detailRoute).toContain('body.patientFeedback');
  });
});

// ===================================================================
// 13-15: Error Handling & Quality
// ===================================================================

describe('Telemedicine — Error Handling', () => {
  const consultationsRoute = readRoute('app', 'api', 'telemedicine', 'consultations', 'route.ts');
  const detailRoute = readRoute('app', 'api', 'telemedicine', 'consultations', '[id]', 'route.ts');
  const availabilityRoute = readRoute('app', 'api', 'telemedicine', 'availability', 'route.ts');

  it('13 — Detail route returns 400 for missing id', () => {
    expect(detailRoute).toContain("{ error: 'Missing id' }");
  });

  it('14 — Consultation data includes meetingUrl and meetingId for video link', () => {
    expect(consultationsRoute).toContain('meetingUrl');
    expect(consultationsRoute).toContain('meetingId');
    expect(detailRoute).toContain('body.meetingUrl');
  });

  it('15 — No skeleton or dummy data in any route', () => {
    for (const src of [consultationsRoute, detailRoute, availabilityRoute]) {
      expect(src).not.toContain('TODO');
      expect(src).not.toContain('placeholder');
      expect(src).not.toContain('dummy');
      expect(src).not.toContain('mock data');
    }
  });
});
