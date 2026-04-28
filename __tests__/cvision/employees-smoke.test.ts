/**
 * Stage B T3 — employees route smoke test.
 * Exercises the Mongo→Prisma shim path on
 * app/api/cvision/employees/route.ts (GET only — POST has very deep
 * lifecycle/sequence/contract dependencies; T3 covers the read path).
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
  cvisionRole: 'OWNER',
  employeeId: null,
};

vi.mock('@/lib/cvision/authz/enforce', () => ({
  requireCtx: vi.fn(async () => mockCtx),
  enforce: vi.fn(async () => null),
  deny: vi.fn((code: string, message: string) =>
    NextResponse.json({ error: code, message }, { status: 403 }),
  ),
}));

vi.mock('@/lib/cvision/authz/policy', () => ({
  canListEmployees: vi.fn(() => ({ allowed: true })),
  canWriteEmployee: vi.fn(() => ({ allowed: true })),
}));

vi.mock('@/lib/cvision/authz/context', () => ({
  hasTenantWideAccess: vi.fn(() => true),
}));

vi.mock('@/lib/cvision/org/permission-engine', () => ({
  getEmployeeScopeFilter: vi.fn(async () => null),
}));

vi.mock('@/lib/cvision/auth/field-permissions', () => ({
  filterEmployeeList: vi.fn((data: any[]) => data),
}));

vi.mock('@/lib/policy', () => ({
  shadowEvaluate: vi.fn(() => undefined),
}));

vi.mock('@/lib/events', () => ({
  emit: vi.fn(async () => undefined),
}));

vi.mock('@/lib/cvision/infra', () => ({
  withAuthTenant: makeWithAuthTenant(),
}));

const { prisma, models, getModel } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

const { GET } = await import('@/app/api/cvision/employees/route');

const DEPT_ID = '12345678-1234-4234-8234-123456789013';

function makeReq(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('Stage B T3 — employees route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
      m.count.mockResolvedValue(0);
    });
    getModel('cvisionEmployee');
  });

  it('GET → 200 empty list; tenantId filter reaches Prisma via shim', async () => {
    const res = await GET(makeReq('http://localhost/api/cvision/employees'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);

    expect(models.cvisionEmployee.findMany).toHaveBeenCalled();
    const findArgs = models.cvisionEmployee.findMany.mock.calls[0][0];
    expect(findArgs.where.tenantId).toBe(TENANT_ID);
  });

  it('GET ?departmentId=... → departmentId merged into Prisma where', async () => {
    const res = await GET(makeReq(`http://localhost/api/cvision/employees?departmentId=${DEPT_ID}`));
    expect(res.status).toBe(200);

    const findArgs = models.cvisionEmployee.findMany.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({ tenantId: TENANT_ID, departmentId: DEPT_ID });
  });

  it('GET ?statuses=ACTIVE → status $in [ACTIVE] translates to Prisma { in: [...] }', async () => {
    models.cvisionEmployee.findMany.mockResolvedValueOnce([
      { id: 'e-1', tenantId: TENANT_ID, firstName: 'John', status: 'ACTIVE' },
    ]);
    models.cvisionEmployee.count.mockResolvedValueOnce(1);

    const res = await GET(makeReq('http://localhost/api/cvision/employees?statuses=ACTIVE'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);

    const findArgs = models.cvisionEmployee.findMany.mock.calls[0][0];
    expect(findArgs.where.tenantId).toBe(TENANT_ID);
    // Mongo $in: [...] → Prisma { in: [...] }
    expect(findArgs.where.status).toMatchObject({ in: ['ACTIVE'] });
  });
});
