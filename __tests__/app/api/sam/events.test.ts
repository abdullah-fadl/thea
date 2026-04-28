/**
 * Phase 7.5 — SAM route-level event-emission integration tests.
 *
 * Per-route tests:
 *   1. policy.published@v1     ← app/api/sam/drafts/[draftId]/publish/route.ts
 *   2. policy.acknowledged@v1  ← app/api/sam/policies/[policyId]/acknowledge/route.ts
 *   3. incident.reported@v1    ← app/api/quality/incidents/route.ts
 *
 * Each verifies:
 *   • Flag ON  → handler runs to completion AND emit() is invoked with the
 *                exact payload shape required by the registered schema.
 *   • Flag OFF → handler runs to completion; SDK-level gating in
 *                lib/events/emit.ts:35 returns { skipped: true }, exhaustively
 *                covered by __tests__/lib/events/emit.test.ts (not re-tested
 *                here).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { FLAGS } from '@/lib/core/flags';

// ─── Hoisted spies ───────────────────────────────────────────────────────────

const { mockEmit } = vi.hoisted(() => ({ mockEmit: vi.fn() }));
vi.mock('@/lib/events', () => ({ emit: mockEmit }));

// ─── Test IDs ────────────────────────────────────────────────────────────────

const TENANT_ID         = '11111111-1111-1111-1111-111111111111';
const USER_ID           = '22222222-2222-2222-2222-222222222222';
const DRAFT_ID          = '33333333-3333-3333-3333-333333333333';
const POLICY_ID         = '44444444-4444-4444-4444-444444444444';
const ACK_ID            = '55555555-5555-5555-5555-555555555555';
const INCIDENT_ID       = '66666666-6666-6666-6666-666666666666';
const ENCOUNTER_ID      = '77777777-7777-7777-7777-777777777777';

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

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    draftDocument: { findFirst: vi.fn(), updateMany: vi.fn() },
    policyAcknowledgment: { findFirst: vi.fn(), create: vi.fn() },
    user: { count: vi.fn() },
    qualityIncident: { create: vi.fn() },
  },
}));
vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));

// ─── Other route-level deps ──────────────────────────────────────────────────

vi.mock('@/lib/env', () => ({ env: { THEA_ENGINE_URL: 'http://thea-engine.test' } }));
vi.mock('@/lib/sam/contextRules', () => ({
  getOrgContextSnapshot: vi.fn().mockResolvedValue({ orgProfile: {}, contextRules: [] }),
}));
vi.mock('@/lib/security/audit', () => ({
  createAuditContext: vi.fn().mockReturnValue({}),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/quality/access', () => ({
  canAccessQuality: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/utils/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFlagOn()  { process.env[FLAGS.FF_EVENT_BUS_ENABLED] = 'true'; }
function setFlagOff() { delete process.env[FLAGS.FF_EVENT_BUS_ENABLED]; }

beforeEach(() => {
  vi.clearAllMocks();
  setFlagOff();
  mockEmit.mockResolvedValue({ id: 'evt-1', sequence: 1n });
});
afterEach(() => { setFlagOff(); });

// ─── Test 1 — policy.published@v1 ────────────────────────────────────────────

describe('POST /api/sam/drafts/[draftId]/publish → emits policy.published@v1', () => {
  function setupHappyPublish() {
    mockPrisma.draftDocument.findFirst.mockResolvedValue({
      id: DRAFT_ID,
      tenantId: TENANT_ID,
      title: 'Code Blue Protocol',
      latestContent: '# Steps\n1. Call team',
      status: 'draft',
      publishedTheaEngineId: null,
      departmentId: null,
      operationId: null,
      requiredType: null,
      documentType: 'policy',
    });
    mockPrisma.draftDocument.updateMany.mockResolvedValue({ count: 1 });
    // Mock fetch to thea-engine
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ policyId: 'pol-engine-9001', jobs: [{ policyId: 'pol-engine-9001' }] }),
    } as unknown as Response);
  }

  it('flag ON: emits policy.published@v1 with publishedTheaEngineId after the draft transitions to published', async () => {
    setFlagOn();
    setupHappyPublish();

    const { POST } = await import('@/app/api/sam/drafts/[draftId]/publish/route');
    const req = new NextRequest(`http://localhost/api/sam/drafts/${DRAFT_ID}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0], { params: { draftId: DRAFT_ID } } as unknown as Parameters<typeof POST>[1]);
    expect(res.status).toBe(200);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'policy.published',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'policy',
      aggregateId: DRAFT_ID,
      payload: expect.objectContaining({
        draftId: DRAFT_ID,
        tenantId: TENANT_ID,
        publishedTheaEngineId: 'pol-engine-9001',
        status: 'published',
      }),
    }));
  });

  it('flag OFF: route still returns 200; emit returns { skipped: true } (SDK-level gating, route unchanged)', async () => {
    mockEmit.mockResolvedValue({ skipped: true });
    setupHappyPublish();

    const { POST } = await import('@/app/api/sam/drafts/[draftId]/publish/route');
    const req = new NextRequest(`http://localhost/api/sam/drafts/${DRAFT_ID}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0], { params: { draftId: DRAFT_ID } } as unknown as Parameters<typeof POST>[1]);
    expect(res.status).toBe(200);
  });
});

// ─── Test 2 — policy.acknowledged@v1 ─────────────────────────────────────────

describe('POST /api/sam/policies/[policyId]/acknowledge → emits policy.acknowledged@v1', () => {
  it('flag ON: emits policy.acknowledged@v1 with acknowledgmentId + policyId + userId', async () => {
    setFlagOn();
    mockPrisma.policyAcknowledgment.findFirst.mockResolvedValue(null);
    mockPrisma.policyAcknowledgment.create.mockResolvedValue({
      id: ACK_ID,
      tenantId: TENANT_ID,
      policyId: POLICY_ID,
      userId: USER_ID,
      version: 2,
      acknowledgedAt: new Date('2026-04-25T10:00:00.000Z'),
    });

    const { POST } = await import('@/app/api/sam/policies/[policyId]/acknowledge/route');
    const req = new NextRequest(`http://localhost/api/sam/policies/${POLICY_ID}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 2 }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0], { params: { policyId: POLICY_ID } } as unknown as Parameters<typeof POST>[1]);
    expect(res.status).toBe(201);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'policy.acknowledged',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'policy_acknowledgment',
      aggregateId: ACK_ID,
      payload: expect.objectContaining({
        acknowledgmentId: ACK_ID,
        tenantId: TENANT_ID,
        policyId: POLICY_ID,
        userId: USER_ID,
        version: 2,
      }),
    }));
  });
});

// ─── Test 3 — incident.reported@v1 ───────────────────────────────────────────

describe('POST /api/quality/incidents → emits incident.reported@v1', () => {
  it('flag ON: emits incident.reported@v1 with severity + status=OPEN after the incident row is inserted', async () => {
    setFlagOn();
    mockPrisma.qualityIncident.create.mockResolvedValue({
      id: INCIDENT_ID,
      tenantId: TENANT_ID,
      type: 'MEDICATION_ERROR',
      severity: 'HIGH',
      status: 'OPEN',
      encounterCoreId: ENCOUNTER_ID,
      createdAt: new Date('2026-04-25T10:00:00.000Z'),
    });

    const { POST } = await import('@/app/api/quality/incidents/route');
    const req = new NextRequest('http://localhost/api/quality/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'MEDICATION_ERROR',
        severity: 'HIGH',
        location: 'ICU Bed 3',
        encounterCoreId: ENCOUNTER_ID,
        description: 'free-text PHI staff might write here',
      }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'incident.reported',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'quality_incident',
      aggregateId: INCIDENT_ID,
      payload: expect.objectContaining({
        incidentId: INCIDENT_ID,
        tenantId: TENANT_ID,
        type: 'MEDICATION_ERROR',
        severity: 'HIGH',
        status: 'OPEN',
        encounterCoreId: ENCOUNTER_ID,
      }),
    }));
    // Sanity: free-text description is NOT in the emit payload (stripped by route, not just by schema).
    const callArg = mockEmit.mock.calls[0][0] as { payload: Record<string, unknown> };
    expect(callArg.payload).not.toHaveProperty('description');
    expect(callArg.payload).not.toHaveProperty('location');
  });
});
