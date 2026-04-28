/**
 * Phase 7.5 — Imdad route-level event-emission integration tests.
 *
 * Per-route tests:
 *   1. purchase_order.created@v1   ← app/api/imdad/procurement/purchase-orders/route.ts
 *   2. goods_received@v1           ← app/api/imdad/procurement/grn/route.ts
 *   3. stock.threshold_breached@v1 ← app/api/imdad/analytics/alert-instances/route.ts
 *      (+ stock-vs-non-stock kpiCode gate verification)
 *
 * The Imdad PO + GRN routes wrap the create call in `prisma.$transaction`.
 * Our prisma mock implements `$transaction(cb)` as `cb(mockPrisma)` so the
 * inner sequence-counter upsert + create call run against the same mock.
 * The emit is post-transaction, so it lands with the default prisma client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { FLAGS } from '@/lib/core/flags';

// ─── Hoisted spies ───────────────────────────────────────────────────────────

const { mockEmit } = vi.hoisted(() => ({ mockEmit: vi.fn() }));
vi.mock('@/lib/events', () => ({ emit: mockEmit }));

// ─── Test IDs (RFC-4122 v4 — Zod v4 uuid() requires version=4 + variant=10xx) ─

const TENANT_ID         = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const USER_ID           = '550e8400-e29b-41d4-a716-446655440000';
const ORG_ID            = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const VENDOR_ID         = '7d3a9c2e-1b8d-4c4f-9e7a-2f5e8a1d3c4b';
const PO_ID             = '8e4b0d3f-2c9e-45a0-9f8b-3a6f9b2e4d5c';
const GRN_ID            = '9f5c1e40-3dad-46b1-a09c-4b7a0c3f5e6d';
const ITEM_ID           = 'a1b2c3d4-e5f6-4789-9abc-def012345678';
const ALERT_INSTANCE_ID = 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789';
const ALERT_RULE_ID     = 'c3d4e5f6-a7b8-4901-9cde-f01234567890';

// ─── Passthrough auth/error wrappers ─────────────────────────────────────────

vi.mock('@/lib/core/guards/withAuthTenant', () => ({
  withAuthTenant: (handler: (...a: unknown[]) => Promise<NextResponse>) => {
    return async (req: NextRequest, ctx?: { params?: Record<string, string | string[]> }) => {
      const params = ctx?.params;
      return handler(req, {
        tenantId: TENANT_ID,
        userId: USER_ID,
        role: 'admin',
        user: { id: USER_ID, role: 'admin', email: 'admin@thea.test', permissions: [] },
        sessionId: 'sess-test',
      }, params);
    };
  },
}));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Prisma mock with $transaction passthrough ───────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const m = {
    imdadSequenceCounter: { upsert: vi.fn() },
    imdadPurchaseOrder: { create: vi.fn() },
    imdadGoodsReceivingNote: { create: vi.fn() },
    imdadAlertInstance: { create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(m)),
  };
  return { mockPrisma: m };
});
vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));

// ─── Other route-level deps ──────────────────────────────────────────────────

vi.mock('@/lib/imdad/audit', () => ({
  imdadAudit: { log: vi.fn().mockResolvedValue(undefined) },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFlagOn()  { process.env[FLAGS.FF_EVENT_BUS_ENABLED] = 'true'; }
function setFlagOff() { delete process.env[FLAGS.FF_EVENT_BUS_ENABLED]; }

beforeEach(() => {
  vi.clearAllMocks();
  setFlagOff();
  mockEmit.mockResolvedValue({ id: 'evt-1', sequence: 1n });
  // Re-bind $transaction passthrough after clearAllMocks (which resets implementations).
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma));
});
afterEach(() => { setFlagOff(); });

// ─── Test 1 — purchase_order.created@v1 ──────────────────────────────────────

describe('POST /api/imdad/procurement/purchase-orders → emits purchase_order.created@v1', () => {
  it('flag ON: emits purchase_order.created@v1 with poId + vendorId + DRAFT status', async () => {
    setFlagOn();
    mockPrisma.imdadSequenceCounter.upsert.mockResolvedValue({ currentValue: 1 });
    mockPrisma.imdadPurchaseOrder.create.mockResolvedValue({
      id: PO_ID,
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      vendorId: VENDOR_ID,
      status: 'DRAFT',
      currency: 'SAR',
      createdAt: new Date('2026-04-25T10:00:00.000Z'),
      lines: [],
    });

    const { POST } = await import('@/app/api/imdad/procurement/purchase-orders/route');
    const req = new NextRequest('http://localhost/api/imdad/procurement/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: ORG_ID,
        vendorId: VENDOR_ID,
        lines: [{ itemId: ITEM_ID, quantity: 10, unitCost: 50.5 }],
      }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(201);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'purchase_order.created',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'purchase_order',
      aggregateId: PO_ID,
      payload: expect.objectContaining({
        poId: PO_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        vendorId: VENDOR_ID,
        status: 'DRAFT',
        currency: 'SAR',
      }),
    }));
  });
});

// ─── Test 2 — goods_received@v1 ──────────────────────────────────────────────

describe('POST /api/imdad/procurement/grn → emits goods_received@v1', () => {
  it('flag ON: emits goods_received@v1 with grnId + poId + DRAFT status', async () => {
    setFlagOn();
    mockPrisma.imdadSequenceCounter.upsert.mockResolvedValue({ currentValue: 1 });
    mockPrisma.imdadGoodsReceivingNote.create.mockResolvedValue({
      id: GRN_ID,
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      poId: PO_ID,
      vendorId: VENDOR_ID,
      status: 'DRAFT',
      receivedAt: new Date('2026-04-25T10:00:00.000Z'),
      lines: [],
    });

    const { POST } = await import('@/app/api/imdad/procurement/grn/route');
    const req = new NextRequest('http://localhost/api/imdad/procurement/grn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: ORG_ID,
        purchaseOrderId: PO_ID,
        vendorId: VENDOR_ID,
        lines: [{
          itemId: ITEM_ID,
          itemName: 'Insulin glargine 100 IU/mL',
          orderedQuantity: 10,
          receivedQuantity: 10,
          unitOfMeasure: 'EA',
        }],
      }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(201);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'goods_received',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'goods_receiving_note',
      aggregateId: GRN_ID,
      payload: expect.objectContaining({
        grnId: GRN_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        poId: PO_ID,
        vendorId: VENDOR_ID,
        status: 'DRAFT',
      }),
    }));
  });
});

// ─── Test 3 — stock.threshold_breached@v1 (+ kpi-gate) ───────────────────────

describe('POST /api/imdad/analytics/alert-instances → emits stock.threshold_breached@v1', () => {
  function createAlert() {
    mockPrisma.imdadAlertInstance.create.mockResolvedValue({
      id: ALERT_INSTANCE_ID,
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      alertRuleId: ALERT_RULE_ID,
      kpiCode: 'STOCK_BELOW_REORDER',
      severity: 'CRITICAL',
      firedAt: new Date('2026-04-25T10:00:00.000Z'),
    });
  }

  it('flag ON + stock-related kpiCode: emits stock.threshold_breached@v1 with severity', async () => {
    setFlagOn();
    createAlert();

    const { POST } = await import('@/app/api/imdad/analytics/alert-instances/route');
    const req = new NextRequest('http://localhost/api/imdad/analytics/alert-instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: ORG_ID,
        alertRuleId: ALERT_RULE_ID,
        ruleCode: 'STOCK_LOW_INSULIN',
        ruleName: 'Insulin glargine reorder threshold',
        severity: 'CRITICAL',
        kpiCode: 'STOCK_BELOW_REORDER',
        actualValue: 4,
        thresholdValue: 50,
        message: 'Reorder needed',
      }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(201);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'stock.threshold_breached',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'alert_instance',
      aggregateId: ALERT_INSTANCE_ID,
      payload: expect.objectContaining({
        alertInstanceId: ALERT_INSTANCE_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        alertRuleId: ALERT_RULE_ID,
        kpiCode: 'STOCK_BELOW_REORDER',
        severity: 'CRITICAL',
      }),
    }));
    // Sanity: actualValue / thresholdValue / message are NOT in the emit payload.
    const callArg = mockEmit.mock.calls[0][0] as { payload: Record<string, unknown> };
    expect(callArg.payload).not.toHaveProperty('actualValue');
    expect(callArg.payload).not.toHaveProperty('thresholdValue');
    expect(callArg.payload).not.toHaveProperty('message');
  });

  it('flag ON + non-stock kpiCode (FINANCIAL_*): does NOT emit (kpi-gate filter)', async () => {
    setFlagOn();
    mockPrisma.imdadAlertInstance.create.mockResolvedValue({
      id: ALERT_INSTANCE_ID,
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      alertRuleId: ALERT_RULE_ID,
      kpiCode: 'FINANCIAL_BUDGET_OVERRUN',
      severity: 'WARNING',
      firedAt: new Date('2026-04-25T10:00:00.000Z'),
    });

    const { POST } = await import('@/app/api/imdad/analytics/alert-instances/route');
    const req = new NextRequest('http://localhost/api/imdad/analytics/alert-instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: ORG_ID,
        alertRuleId: ALERT_RULE_ID,
        ruleCode: 'BUDGET_Q2_OVERRUN',
        ruleName: 'Q2 budget threshold',
        severity: 'WARNING',
        kpiCode: 'FINANCIAL_BUDGET_OVERRUN',
        actualValue: 1.15,
        thresholdValue: 1.0,
        message: 'Q2 budget exceeded by 15%',
      }),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(201);
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
