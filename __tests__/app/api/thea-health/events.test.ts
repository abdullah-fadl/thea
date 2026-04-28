/**
 * Phase 7.4 — Route-level event-emission integration tests.
 *
 * One test per wired route. Each verifies:
 *   • Flag ON  → handler runs to completion AND emit() is invoked with the
 *                exact payload shape required by the registered schema.
 *   • Flag OFF / emit returning { skipped: true } → handler runs to
 *                completion (the SDK-level no-op is what guarantees no
 *                event row is written; that gating is exhaustively covered
 *                by __tests__/lib/events/emit.test.ts case 1 — we don't
 *                re-test SDK internals here).
 *
 * Per-route tests:
 *   1. patient.registered@v1   ← app/api/portal/auth/register/verify/route.ts
 *   2. encounter.opened@v1     ← app/api/opd/encounters/open/route.ts
 *   3. encounter.closed@v1     ← app/api/opd/encounters/[encounterCoreId]/flow-state/route.ts
 *   4. order.placed@v1         ← app/api/opd/encounters/[encounterCoreId]/orders/route.ts
 *   5. lab.result.posted@v1    ← app/api/lab/results/save/route.ts
 *
 * Approach: we mock `withAuthTenant` + `withErrorHandler` as passthrough
 * wrappers so the route's inner handler executes directly with a synthetic
 * { tenantId, userId, user } context. This sidesteps the full auth / CSRF /
 * rate-limit / area-access chain (those have their own tests) and keeps
 * these tests focused on the emit wiring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { FLAGS } from '@/lib/core/flags';

// ─── Hoisted spies ───────────────────────────────────────────────────────────

const { mockEmit } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
}));

vi.mock('@/lib/events', () => ({ emit: mockEmit }));

// ─── Test IDs ────────────────────────────────────────────────────────────────

const TENANT_ID    = '11111111-1111-1111-1111-111111111111';
const USER_ID      = '22222222-2222-2222-2222-222222222222';
const PATIENT_ID   = '33333333-3333-3333-3333-333333333333';
const ENCOUNTER_ID = '44444444-4444-4444-4444-444444444444';
const OPD_ID       = '55555555-5555-5555-5555-555555555555';
const ORDER_ID     = '66666666-6666-6666-6666-666666666666';
const HUB_ID       = '77777777-7777-7777-7777-777777777777';
const LAB_RESULT_ID = '88888888-8888-8888-8888-888888888888';
const PORTAL_USER_ID = '99999999-9999-9999-9999-999999999999';
const PENDING_ID    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const FAR_FUTURE = new Date(Date.now() + 10 * 60 * 1000);

// ─── Passthrough auth/error wrappers ─────────────────────────────────────────

vi.mock('@/lib/core/guards/withAuthTenant', () => ({
  withAuthTenant: (handler: (...a: unknown[]) => Promise<NextResponse>) => {
    return async (req: NextRequest, ctx?: { params?: Record<string, string | string[]> }) => {
      const params = ctx?.params;
      return handler(req, {
        tenantId: TENANT_ID,
        userId: USER_ID,
        user: { id: USER_ID, role: 'admin', email: 'admin@thea.test', permissions: [] },
        sessionId: 'sess-test',
      }, params);
    };
  },
}));

vi.mock('@/lib/core/errors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/core/errors')>('@/lib/core/errors');
  return {
    ...actual,
    withErrorHandler: (handler: (...a: unknown[]) => Promise<unknown>) =>
      async (...args: unknown[]) => handler(...args),
  };
});

// ─── Logger noise suppression (also avoids env validation chains) ────────────

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Per-route prisma mocks (each test sets up only what it needs) ───────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    patientPortalRateLimit: { count: vi.fn(), create: vi.fn() },
    patientPortalPendingRegistration: { findFirst: vi.fn(), updateMany: vi.fn() },
    patientPortalSession: { create: vi.fn() },
    patientMaster: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    patientPortalUser: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    encounterCore: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    opdEncounter: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    opdOrder: { create: vi.fn() },
    ordersHub: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    opdBooking: { findFirst: vi.fn(), updateMany: vi.fn() },
    opdVisitNote: { findFirst: vi.fn() },
    referral: { findFirst: vi.fn() },
    labResult: { create: vi.fn() },
    labOrder: { updateMany: vi.fn() },
    labCriticalAlert: { create: vi.fn() },
    tenant: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));

// ─── Other route-level deps ──────────────────────────────────────────────────

vi.mock('@/lib/portal/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal/auth')>('@/lib/portal/auth');
  return {
    ...actual,
    verifyOtp: vi.fn().mockResolvedValue(true),
    createPortalSession: vi.fn().mockResolvedValue('sess-portal-001'),
    generatePortalToken: vi.fn().mockReturnValue('fake-jwt'),
    setPortalCookie: vi.fn(),
    normalizeMobile: vi.fn((v: string) => v),
  };
});

vi.mock('@/lib/lab/criticalValues', () => ({
  checkCriticalValue: vi.fn().mockReturnValue({ isCritical: false }),
}));
vi.mock('@/lib/billing/paymentGate', () => ({
  checkOrderPayment: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('@/lib/notifications/smsService', () => ({
  sendSMS: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/opd/eventBus', () => ({
  opdEventBus: { emit: vi.fn() },
}));
vi.mock('@/lib/utils/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/core/guards/deathGuard', () => ({
  ensureNotDeceasedFinalized: vi.fn().mockResolvedValue(null),
}));

// labOrder.updateMany returns a thenable that supports .catch() — simulate that.
const labOrderChain = { catch: vi.fn() };
mockPrisma.labOrder.updateMany.mockReturnValue(labOrderChain);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFlagOn()  { process.env[FLAGS.FF_EVENT_BUS_ENABLED] = 'true'; }
function setFlagOff() { delete process.env[FLAGS.FF_EVENT_BUS_ENABLED]; }

beforeEach(() => {
  vi.clearAllMocks();
  setFlagOff();
  mockEmit.mockResolvedValue({ id: 'evt-1', sequence: 1n });
  mockPrisma.tenant.findFirst.mockResolvedValue({ id: TENANT_ID, name: 'Test Tenant' });
  mockPrisma.labOrder.updateMany.mockReturnValue(labOrderChain);
});

afterEach(() => { setFlagOff(); });

// ─── Test 1 — patient.registered@v1 ──────────────────────────────────────────

describe('POST /api/portal/auth/register/verify → emits patient.registered@v1', () => {
  function setupHappyPathPortal() {
    mockPrisma.patientPortalRateLimit.count.mockResolvedValue(0);
    mockPrisma.patientPortalRateLimit.create.mockResolvedValue({});
    mockPrisma.patientPortalPendingRegistration.findFirst.mockResolvedValue({
      id: PENDING_ID,
      tenantId: TENANT_ID,
      mobile: '+966500000000',
      idType: 'NATIONAL_ID',
      idNumber: '1234567890',
      fullName: 'Patient Test',
      attempts: 0,
      expiresAt: FAR_FUTURE,
      status: 'PENDING_OTP',
    });
    mockPrisma.patientPortalPendingRegistration.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.patientMaster.findFirst.mockResolvedValue(null);
    mockPrisma.patientMaster.create.mockResolvedValue({ id: PATIENT_ID });
    mockPrisma.patientPortalUser.findFirst.mockResolvedValue(null);
    mockPrisma.patientPortalUser.create.mockResolvedValue({
      id: PORTAL_USER_ID,
      tenantId: TENANT_ID,
      patientMasterId: PATIENT_ID,
      mobile: '+966500000000',
    });
  }

  it('flag ON: emits patient.registered@v1 with the correct payload after the portal user row is created', async () => {
    setFlagOn();
    setupHappyPathPortal();

    const { POST } = await import('@/app/api/portal/auth/register/verify/route');
    const req = new NextRequest('http://localhost/api/portal/auth/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: TENANT_ID, pendingId: PENDING_ID, otp: '123456' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'patient.registered',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'patient',
      payload: expect.objectContaining({
        portalUserId: PORTAL_USER_ID,
        tenantId: TENANT_ID,
      }),
    }));
  });

  it('flag OFF: route still returns 200; emit returns { skipped: true } (SDK-level gating, route unchanged)', async () => {
    mockEmit.mockResolvedValue({ skipped: true });
    setupHappyPathPortal();

    const { POST } = await import('@/app/api/portal/auth/register/verify/route');
    const req = new NextRequest('http://localhost/api/portal/auth/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: TENANT_ID, pendingId: PENDING_ID, otp: '123456' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

// ─── Test 2 — encounter.opened@v1 ────────────────────────────────────────────

describe('POST /api/opd/encounters/open → emits encounter.opened@v1', () => {
  it('flag ON: emits encounter.opened@v1 with encounterId + patientId + tenantId after both creates succeed', async () => {
    setFlagOn();

    mockPrisma.patientMaster.findFirst.mockResolvedValue({ id: PATIENT_ID, status: 'KNOWN' });
    mockPrisma.encounterCore.findFirst.mockResolvedValue(null);
    mockPrisma.encounterCore.create.mockResolvedValue({
      id: ENCOUNTER_ID, tenantId: TENANT_ID, patientId: PATIENT_ID,
      encounterType: 'OPD', status: 'ACTIVE', openedAt: new Date(),
    });
    mockPrisma.opdEncounter.create.mockResolvedValue({ id: OPD_ID });

    const { POST } = await import('@/app/api/opd/encounters/open/route');
    const req = new NextRequest('http://localhost/api/opd/encounters/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientMasterId: PATIENT_ID }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'encounter.opened',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'encounter',
      aggregateId: ENCOUNTER_ID,
      payload: expect.objectContaining({
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        encounterType: 'OPD',
      }),
    }));
  });
});

// ─── Test 3 — encounter.closed@v1 ────────────────────────────────────────────

describe('POST /api/opd/encounters/[encounterCoreId]/flow-state → emits encounter.closed@v1', () => {
  it('flag ON + transition to COMPLETED: emits encounter.closed@v1 with status=COMPLETED', async () => {
    setFlagOn();

    mockPrisma.encounterCore.findFirst.mockResolvedValue({
      id: ENCOUNTER_ID, tenantId: TENANT_ID, patientId: PATIENT_ID,
      encounterType: 'OPD', status: 'ACTIVE',
    });
    mockPrisma.opdEncounter.findUnique.mockResolvedValue({
      id: OPD_ID, tenantId: TENANT_ID, encounterCoreId: ENCOUNTER_ID,
      patientId: PATIENT_ID, opdFlowState: 'IN_DOCTOR', version: 1,
    });
    mockPrisma.opdEncounter.update.mockResolvedValue({});
    mockPrisma.encounterCore.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.opdVisitNote.findFirst.mockResolvedValue({
      diagnoses: [{ diagnosisType: 'PRIMARY' }],
    });
    mockPrisma.referral.findFirst.mockResolvedValue(null);
    mockPrisma.ordersHub.count.mockResolvedValue(0);
    mockPrisma.opdBooking.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.ordersHub.findMany.mockResolvedValue([]);
    mockPrisma.patientMaster.findFirst.mockResolvedValue({ id: PATIENT_ID, mobile: '' });

    const { POST } = await import('@/app/api/opd/encounters/[encounterCoreId]/flow-state/route');
    const req = new NextRequest(`http://localhost/api/opd/encounters/${ENCOUNTER_ID}/flow-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opdFlowState: 'COMPLETED' }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0], { params: { encounterCoreId: ENCOUNTER_ID } } as unknown as Parameters<typeof POST>[1]);
    expect(res.status).toBe(200);

    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'encounter.closed',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'encounter',
      aggregateId: ENCOUNTER_ID,
      payload: expect.objectContaining({
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        status: 'COMPLETED',
      }),
    }));
  });
});

// ─── Test 4 — order.placed@v1 ────────────────────────────────────────────────

describe('POST /api/opd/encounters/[encounterCoreId]/orders → emits order.placed@v1', () => {
  it('flag ON: emits order.placed@v1 once per created order with the expected kind + ID shape', async () => {
    setFlagOn();

    mockPrisma.encounterCore.findFirst.mockResolvedValue({
      id: ENCOUNTER_ID, tenantId: TENANT_ID, patientId: PATIENT_ID,
      encounterType: 'OPD', status: 'ACTIVE',
    });
    mockPrisma.opdOrder.create.mockResolvedValue({ id: ORDER_ID, tenantId: TENANT_ID, kind: 'LAB' });
    mockPrisma.ordersHub.create.mockResolvedValue({ id: HUB_ID });

    const { POST } = await import('@/app/api/opd/encounters/[encounterCoreId]/orders/route');
    const req = new NextRequest(`http://localhost/api/opd/encounters/${ENCOUNTER_ID}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'LAB', title: 'CBC' }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0], { params: { encounterCoreId: ENCOUNTER_ID } } as unknown as Parameters<typeof POST>[1]);
    expect(res.status).toBe(200);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'order.placed',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'order',
      aggregateId: ORDER_ID,
      payload: expect.objectContaining({
        orderId: ORDER_ID,
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        kind: 'LAB',
      }),
    }));
  });
});

// ─── Test 5 — lab.result.posted@v1 ───────────────────────────────────────────

describe('POST /api/lab/results/save → emits lab.result.posted@v1', () => {
  function setupHappyLab() {
    mockPrisma.ordersHub.findFirst.mockResolvedValue({
      id: ORDER_ID, tenantId: TENANT_ID, kind: 'LAB',
      patientMasterId: PATIENT_ID, encounterCoreId: ENCOUNTER_ID,
      orderName: 'CBC', orderCode: 'CBC',
    });
    mockPrisma.labResult.create.mockResolvedValue({
      id: LAB_RESULT_ID, tenantId: TENANT_ID, orderId: ORDER_ID,
      patientId: PATIENT_ID, encounterId: ENCOUNTER_ID,
    });
    mockPrisma.ordersHub.updateMany.mockResolvedValue({ count: 1 });
  }

  it('flag ON + status=COMPLETED: emits lab.result.posted@v1 with the correct ID + status payload', async () => {
    setFlagOn();
    setupHappyLab();

    const { POST } = await import('@/app/api/lab/results/save/route');
    const req = new NextRequest('http://localhost/api/lab/results/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testId: 'CBC', orderId: ORDER_ID,
        results: [{ name: 'WBC', value: 7.2, unit: '10^9/L' }],
        status: 'COMPLETED',
      }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'lab.result.posted',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'lab_result',
      aggregateId: LAB_RESULT_ID,
      payload: expect.objectContaining({
        labResultId: LAB_RESULT_ID,
        orderId: ORDER_ID,
        testId: 'CBC',
        tenantId: TENANT_ID,
        status: 'COMPLETED',
      }),
    }));
  });

  it('flag ON + status=IN_PROGRESS: route succeeds and does NOT emit (only terminal statuses fire)', async () => {
    setFlagOn();
    setupHappyLab();

    const { POST } = await import('@/app/api/lab/results/save/route');
    const req = new NextRequest('http://localhost/api/lab/results/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testId: 'CBC', orderId: ORDER_ID,
        results: [{ name: 'WBC', value: 7.2 }],
        status: 'IN_PROGRESS',
      }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
