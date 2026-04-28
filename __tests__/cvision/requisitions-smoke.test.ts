/**
 * Stage B T3 — recruitment/requisitions route smoke test (vacancies domain).
 * Exercises the Mongo→Prisma shim path on
 * app/api/cvision/recruitment/requisitions/route.ts.
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
  enforce: vi.fn(async () => null),
  deny: vi.fn((code: string, message: string) =>
    NextResponse.json({ error: code, message }, { status: 403 }),
  ),
}));

vi.mock('@/lib/cvision/authz/policy', () => ({
  canListRequisitions: vi.fn(() => ({ allowed: true })),
}));

vi.mock('@/lib/cvision/authz/context', () => ({
  hasTenantWideAccess: vi.fn(() => true),
}));

vi.mock('@/lib/cvision/infra', () => ({
  withAuthTenant: makeWithAuthTenant(),
}));

const { prisma, models, getModel } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

const { GET } = await import('@/app/api/cvision/recruitment/requisitions/route');

const DEPT_ID = '12345678-1234-4234-8234-123456789013';
const JT_ID = '12345678-1234-4234-8234-123456789014';

function makeReq(method: 'GET', url: string) {
  return new NextRequest(url, { method });
}

describe('Stage B T3 — requisitions route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
      m.count.mockResolvedValue(0);
    });
    getModel('cvisionJobRequisition');
    getModel('cvisionDepartment');
    getModel('cvisionJobTitle');
    getModel('cvisionCandidate');
  });

  it('GET → 200 empty list; tenantId + isArchived $ne true filter translated via shim', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/cvision/recruitment/requisitions'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);

    const findArgs = models.cvisionJobRequisition.findMany.mock.calls[0][0];
    expect(findArgs.where.tenantId).toBe(TENANT_ID);
    expect(findArgs.where.isArchived).toMatchObject({ not: true });
  });

  it('GET ?status=OPEN&departmentId=... → status + departmentId merged into where', async () => {
    const res = await GET(
      makeReq(
        'GET',
        `http://localhost/api/cvision/recruitment/requisitions?status=OPEN&departmentId=${DEPT_ID}`,
      ),
    );
    expect(res.status).toBe(200);

    const findArgs = models.cvisionJobRequisition.findMany.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({
      tenantId: TENANT_ID,
      status: 'OPEN',
      departmentId: DEPT_ID,
    });
  });

  it('GET → enriches requisitions with departmentName + jobTitleName + applicantCount', async () => {
    models.cvisionJobRequisition.findMany.mockResolvedValueOnce([
      {
        id: 'req-1',
        tenantId: TENANT_ID,
        title: 'Senior Engineer',
        departmentId: DEPT_ID,
        jobTitleId: JT_ID,
        status: 'OPEN',
        applicantCount: 0,
      },
    ]);
    models.cvisionJobRequisition.count.mockResolvedValueOnce(1);
    models.cvisionDepartment.findMany.mockResolvedValueOnce([
      { id: DEPT_ID, tenantId: TENANT_ID, name: 'Engineering' },
    ]);
    models.cvisionJobTitle.findMany.mockResolvedValueOnce([
      { id: JT_ID, tenantId: TENANT_ID, name: 'Senior Engineer' },
    ]);
    models.cvisionCandidate.count.mockResolvedValueOnce(7);

    const res = await GET(makeReq('GET', 'http://localhost/api/cvision/recruitment/requisitions'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].departmentName).toBe('Engineering');
    expect(body.data[0].jobTitleName).toBe('Senior Engineer');
    expect(body.data[0].applicantCount).toBe(7);
  });
});
