/**
 * Stage B T3 — recruitment/candidates route smoke test.
 * Exercises Mongo→Prisma shim path on
 * app/api/cvision/recruitment/candidates/route.ts.
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
  canReadCandidate: vi.fn(() => ({ allowed: true })),
  canWriteCandidate: vi.fn(() => ({ allowed: true })),
}));

vi.mock('@/lib/cvision/authz/context', () => ({
  hasTenantWideAccess: vi.fn(() => true),
  isCandidate: vi.fn(() => false),
}));

vi.mock('@/lib/cvision/infra', () => ({
  withAuthTenant: makeWithAuthTenant(),
}));

const { prisma, models, getModel } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

const { GET, POST } = await import('@/app/api/cvision/recruitment/candidates/route');

const REQ_ID = '12345678-1234-4234-8234-123456789012';
const DEPT_ID = '12345678-1234-4234-8234-123456789013';
const JT_ID = '12345678-1234-4234-8234-123456789014';

function makeReq(method: 'GET' | 'POST', url: string, body?: any) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Stage B T3 — candidates route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
      m.count.mockResolvedValue(0);
      m.create.mockImplementation(async (args: any) => args.data);
    });
    getModel('cvisionCandidate');
    getModel('cvisionDepartment');
    getModel('cvisionJobTitle');
    getModel('cvisionJobRequisition');
  });

  it('GET → 200 empty list; tenantId + isArchived $ne true translated via shim', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/cvision/recruitment/candidates'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);

    const findArgs = models.cvisionCandidate.findMany.mock.calls[0][0];
    expect(findArgs.where.tenantId).toBe(TENANT_ID);
    // $ne: true translates to { not: true }
    expect(findArgs.where.isArchived).toMatchObject({ not: true });
  });

  it('GET → enriches candidates with department and job title names', async () => {
    models.cvisionCandidate.findMany.mockResolvedValueOnce([
      { id: 'c-1', tenantId: TENANT_ID, fullName: 'Sara', departmentId: DEPT_ID, jobTitleId: JT_ID },
    ]);
    models.cvisionCandidate.count.mockResolvedValueOnce(1);
    models.cvisionDepartment.findMany.mockResolvedValueOnce([
      { id: DEPT_ID, tenantId: TENANT_ID, name: 'Engineering' },
    ]);
    models.cvisionJobTitle.findMany.mockResolvedValueOnce([
      { id: JT_ID, tenantId: TENANT_ID, name: 'Senior Engineer' },
    ]);

    const res = await GET(makeReq('GET', 'http://localhost/api/cvision/recruitment/candidates'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].departmentName).toBe('Engineering');
    expect(body.data[0].jobTitleName).toBe('Senior Engineer');
  });

  it('POST → 400 when requisitionId provided but requisition not found', async () => {
    models.cvisionJobRequisition.findFirst.mockResolvedValueOnce(null);

    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/recruitment/candidates', {
        fullName: 'New Candidate',
        requisitionId: REQ_ID,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/requisition/i);

    const findArgs = models.cvisionJobRequisition.findFirst.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({ tenantId: TENANT_ID, id: REQ_ID });
  });

  it('POST → creates candidate when requisitionId resolves; reaches Prisma.create with cleaned payload', async () => {
    models.cvisionJobRequisition.findFirst.mockResolvedValueOnce({
      id: REQ_ID,
      tenantId: TENANT_ID,
      departmentId: DEPT_ID,
      jobTitleId: JT_ID,
      title: 'Senior Engineer',
      status: 'OPEN',
    });
    // Duplicate-application check returns null (no prior apply)
    models.cvisionCandidate.findFirst.mockResolvedValueOnce(null);
    models.cvisionCandidate.create.mockImplementation(async (args: any) => ({
      ...args.data,
      id: args.data.id ?? 'gen',
    }));

    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/recruitment/candidates', {
        fullName: 'Sara Ahmed',
        email: 'sara@example.com',
        requisitionId: REQ_ID,
      }),
    );
    expect([200, 201]).toContain(res.status);

    expect(models.cvisionCandidate.create).toHaveBeenCalled();
    const args = models.cvisionCandidate.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      tenantId: TENANT_ID,
      fullName: 'Sara Ahmed',
      requisitionId: REQ_ID,
    });
    expect(Object.keys(args.data).every((k) => !k.startsWith('$'))).toBe(true);
  });
});
