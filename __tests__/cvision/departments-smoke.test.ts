/**
 * Stage B T3 — departments route smoke test.
 *
 * Exercises the Mongo→Prisma shim path end-to-end on
 * app/api/cvision/departments/route.ts. The route's `db.collection(...)`
 * calls go through cvisionDb (lib/cvision/prisma-db.ts), which translates
 * Mongo-style filters via the shim and lands on the mocked Prisma model.
 *
 * We assert the *translated* shape on the Prisma stub — that's what proves
 * the shim path is alive.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  TENANT_ID,
  USER_ID,
  makePrismaStub,
  makeWithAuthTenant,
} from './_helpers/route-smoke';

// ─── Mocks (hoisted) ────────────────────────────────────────────────────────

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/cvision/audit', () => ({
  logCVisionAudit: vi.fn(async () => undefined),
  createCVisionAuditContext: vi.fn(() => ({ tenantId: TENANT_ID, userId: USER_ID })),
}));

vi.mock('@/lib/cvision/infra', () => ({
  withAuthTenant: makeWithAuthTenant(),
}));

const { prisma, models } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

// Route import after mocks
const { GET, POST } = await import('@/app/api/cvision/departments/route');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq(method: 'GET' | 'POST', url: string, body?: any) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Stage B T3 — departments route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      // Restore baseline implementations
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
      m.create.mockImplementation(async (args: any) => args.data);
      m.count.mockResolvedValue(0);
    });
  });

  it('GET → 200 with empty list; shim translates tenantId filter to Prisma where clause', async () => {
    const res = await GET(
      makeReq('GET', `http://localhost/api/cvision/departments?page=1&limit=10`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);

    // Proves shim ran: Prisma model received a translated where clause with tenantId
    expect(models.cvisionDepartment.findMany).toHaveBeenCalled();
    const findArgs = models.cvisionDepartment.findMany.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({ tenantId: TENANT_ID });
    expect(models.cvisionDepartment.count).toHaveBeenCalled();
  });

  it('GET → returns seeded data; verifies isActive filter passes through shim', async () => {
    models.cvisionDepartment.findMany.mockResolvedValue([
      {
        id: 'dept-1',
        tenantId: TENANT_ID,
        code: 'HR',
        name: 'Human Resources',
        isActive: true,
      },
    ]);
    models.cvisionDepartment.count.mockResolvedValue(1);

    const res = await GET(
      makeReq('GET', `http://localhost/api/cvision/departments?isActive=true`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].code).toBe('HR');

    const findArgs = models.cvisionDepartment.findMany.mock.calls[0][0];
    // Shim merged tenantId + isActive into a single Prisma where clause
    expect(findArgs.where).toMatchObject({ tenantId: TENANT_ID, isActive: true });
  });

  it('POST → 201 creates a department; insertOne reaches Prisma.create with cleaned data', async () => {
    // isCodeUnique → findOne returns null → unique
    models.cvisionDepartment.findFirst.mockResolvedValue(null);
    models.cvisionDepartment.create.mockImplementation(async (args: any) => ({
      ...args.data,
      id: args.data.id ?? 'generated-id',
    }));

    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/departments', {
        code: 'IT',
        name: 'Information Technology',
        isActive: true,
      }),
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.department.code).toBe('IT');

    expect(models.cvisionDepartment.create).toHaveBeenCalled();
    const createArgs = models.cvisionDepartment.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      tenantId: TENANT_ID,
      code: 'IT',
      name: 'Information Technology',
    });
    // No mongo operators leaked into the create payload
    expect(Object.keys(createArgs.data).every((k) => !k.startsWith('$'))).toBe(true);
  });

  it('POST → 400 when department code is duplicate (isCodeUnique check passes through shim)', async () => {
    // isCodeUnique → findOne returns existing record → not unique
    models.cvisionDepartment.findFirst.mockResolvedValue({
      id: 'existing-1',
      tenantId: TENANT_ID,
      code: 'HR',
      name: 'HR',
    });

    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/departments', {
        code: 'HR',
        name: 'Duplicate HR',
        isActive: true,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/code already exists/i);
    // create must NOT have been invoked
    expect(models.cvisionDepartment.create).not.toHaveBeenCalled();
  });

  it('POST → 400 on Zod validation error (no Prisma call)', async () => {
    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/departments', {
        // missing required `name` and `code`
      }),
    );
    expect(res.status).toBe(400);
    expect(models.cvisionDepartment.create).not.toHaveBeenCalled();
  });
});
