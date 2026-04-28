/**
 * Stage B T3 — workflows route smoke test.
 * Exercises the shim path on app/api/cvision/workflows/route.ts. The route
 * does heavy ensureDefaults() bootstrapping — first call seeds defaults
 * via insertMany, then list returns the seeded set.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { TENANT_ID, USER_ID, makePrismaStub, makeWithAuthTenant } from './_helpers/route-smoke';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/cvision/audit', () => ({
  logCVisionAudit: vi.fn(async () => undefined),
  createCVisionAuditContext: vi.fn(() => ({ tenantId: TENANT_ID, userId: USER_ID })),
}));

const mockCtx = {
  userId: USER_ID,
  tenantId: TENANT_ID,
  user: { id: USER_ID, email: 'a@b.c', name: 'Admin', role: 'admin' },
  roles: ['admin'],
  isOwner: true,
  departmentIds: [],
  permissions: ['*'],
};

vi.mock('@/lib/cvision/authz/enforce', () => ({
  requireCtx: vi.fn(async () => mockCtx),
  deny: vi.fn((code: string, message: string) =>
    NextResponse.json({ error: code, message }, { status: 403 }),
  ),
  enforce: vi.fn(async () => null),
}));

vi.mock('@/lib/cvision/infra', () => ({
  withAuthTenant: makeWithAuthTenant(),
}));

const { prisma, models, getModel } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

const { GET, POST } = await import('@/app/api/cvision/workflows/route');

function makeReq(method: 'GET' | 'POST', url: string, body?: any) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Stage B T3 — workflows route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
      m.createMany.mockResolvedValue({ count: 10 });
      m.create.mockImplementation(async (args: any) => args.data);
      m.deleteMany.mockResolvedValue({ count: 0 });
    });
    getModel('cvisionWorkflow');
  });

  it('GET ?action=list → seeds defaults on first call (insertMany via shim)', async () => {
    // ensureDefaults: existing.length === 0 → insertMany defaults
    // Then second find inside list returns the seeded items
    models.cvisionWorkflow.findMany
      .mockResolvedValueOnce([]) // existing is empty
      .mockResolvedValueOnce([
        { workflowId: 'w-1', tenantId: TENANT_ID, name: 'Leave Approval', triggerType: 'LEAVE', isActive: true },
      ]);

    const res = await GET(makeReq('GET', 'http://localhost/api/cvision/workflows?action=list'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);

    expect(models.cvisionWorkflow.createMany).toHaveBeenCalled();
    const createManyArgs = models.cvisionWorkflow.createMany.mock.calls[0][0];
    expect(Array.isArray(createManyArgs.data)).toBe(true);
    expect(createManyArgs.data.length).toBeGreaterThan(0);
    // Each seeded record must carry tenantId and triggerType
    expect(createManyArgs.data[0]).toMatchObject({ tenantId: TENANT_ID });
    expect(createManyArgs.data[0].triggerType).toBeTruthy();
  });

  it('GET ?action=get&id=... → 200 with single doc; shim translated workflowId filter', async () => {
    // ensureDefaults skips insertMany when existing.length > 0; second findMany used for dedup
    models.cvisionWorkflow.findMany
      .mockResolvedValueOnce([{ workflowId: 'w-1', triggerType: 'LEAVE', isActive: true }])
      .mockResolvedValueOnce([{ workflowId: 'w-1', triggerType: 'LEAVE', isActive: true }]);
    models.cvisionWorkflow.findFirst.mockResolvedValueOnce({
      workflowId: 'w-1',
      tenantId: TENANT_ID,
      name: 'Leave Approval',
    });

    const res = await GET(makeReq('GET', 'http://localhost/api/cvision/workflows?action=get&id=w-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.workflowId).toBe('w-1');

    const findOneArgs = models.cvisionWorkflow.findFirst.mock.calls.at(-1)![0];
    expect(findOneArgs.where).toMatchObject({ tenantId: TENANT_ID, workflowId: 'w-1' });
  });

  it('POST ?action=create → reaches Prisma.create with cleaned data', async () => {
    models.cvisionWorkflow.findMany
      .mockResolvedValueOnce([{ workflowId: 'w-1', triggerType: 'LEAVE', isActive: true }])
      .mockResolvedValueOnce([{ workflowId: 'w-1', triggerType: 'LEAVE', isActive: true }]);
    models.cvisionWorkflow.create.mockImplementation(async (args: any) => args.data);

    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/workflows', {
        action: 'create',
        name: 'Custom Workflow',
        triggerType: 'CUSTOM',
        steps: [],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(models.cvisionWorkflow.create).toHaveBeenCalled();
    const createArgs = models.cvisionWorkflow.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      tenantId: TENANT_ID,
      name: 'Custom Workflow',
      triggerType: 'CUSTOM',
      isActive: true,
    });
  });

  it('POST ?action=update → 400 when workflowId missing; otherwise updateOne via shim', async () => {
    models.cvisionWorkflow.findMany
      .mockResolvedValue([{ workflowId: 'w-1', triggerType: 'LEAVE', isActive: true }]);

    const missing = await POST(
      makeReq('POST', 'http://localhost/api/cvision/workflows', { action: 'update' }),
    );
    expect(missing.status).toBe(400);

    // updateOne path: findFirst by id → update
    models.cvisionWorkflow.findFirst.mockResolvedValueOnce({ id: 'row-1', workflowId: 'w-1' });
    models.cvisionWorkflow.update.mockResolvedValueOnce({ workflowId: 'w-1', name: 'New' });

    const ok = await POST(
      makeReq('POST', 'http://localhost/api/cvision/workflows', {
        action: 'update',
        workflowId: 'w-1',
        name: 'New Name',
      }),
    );
    expect(ok.status).toBe(200);
    expect(models.cvisionWorkflow.update).toHaveBeenCalled();
  });
});
