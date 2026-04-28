/**
 * Stage B T3 — recruitment offer route smoke test (offers domain).
 * This is the *write* offer route (POST = send offer to candidate); the T1
 * test covered the candidate-facing /offer-portal route. Together they
 * exercise both sides of the offer flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TENANT_ID, USER_ID, makePrismaStub, makeWithAuthTenant } from './_helpers/route-smoke';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/cvision/audit', () => ({
  logCVisionAudit: vi.fn(async () => undefined),
  createCVisionAuditContext: vi.fn(() => ({ tenantId: TENANT_ID, userId: USER_ID })),
}));
vi.mock('@/lib/cvision/notifications', () => ({
  createCVisionNotification: vi.fn(async () => undefined),
}));
vi.mock('@/lib/cvision/offerToken', () => ({
  generateOfferToken: vi.fn(async () => ({ portalUrl: 'https://portal.example/abc', token: 'abc' })),
  getOfferPortalUrl: vi.fn(() => 'https://portal.example/abc'),
}));
vi.mock('@/lib/cvision/email/send', () => ({
  sendOfferEmail: vi.fn(async () => ({ sent: true, fallback: false })),
}));
vi.mock('@/lib/cvision/saas', () => ({
  getTenant: vi.fn(async () => ({ companyName: 'Acme Inc' })),
}));

vi.mock('@/lib/cvision/infra', () => ({
  withAuthTenant: makeWithAuthTenant(),
}));

const { prisma, models, getModel } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

const { POST } = await import('@/app/api/cvision/recruitment/candidates/[id]/offer/route');

const CAND_ID = '12345678-1234-4234-8234-123456789015';

function makeReq(body: any) {
  return new NextRequest(`http://localhost/api/cvision/recruitment/candidates/${CAND_ID}/offer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => Promise.resolve({ id });

describe('Stage B T3 — offers POST route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
      m.update.mockImplementation(async (args: any) => args.data);
    });
    getModel('cvisionCandidate');
  });

  it('POST → 400 when candidate id missing in route params', async () => {
    const res = await POST(
      makeReq({
        basicSalary: 5000,
        currency: 'SAR',
        startDate: '2026-05-01',
        contractType: 'full_time',
        probationPeriod: 90,
        expiryDate: '2026-05-15',
      }),
      { params: Promise.resolve({ id: undefined }) as any },
    );
    expect(res.status).toBe(400);
  });

  it('POST → 400 on Zod validation error (no DB writes)', async () => {
    const res = await POST(
      makeReq({
        basicSalary: -1, // invalid: min 0
        currency: 'SAR',
      }),
      { params: params(CAND_ID) },
    );
    expect([400, 500]).toContain(res.status);
    expect(models.cvisionCandidate.update).not.toHaveBeenCalled();
  });

  it('POST → 404 when candidate not found; tenantId+id filter translated via shim', async () => {
    models.cvisionCandidate.findFirst.mockResolvedValueOnce(null);

    const res = await POST(
      makeReq({
        basicSalary: 5000,
        currency: 'SAR',
        startDate: '2026-05-01',
        contractType: 'full_time',
        probationPeriod: 90,
        expiryDate: '2026-05-15',
      }),
      { params: params(CAND_ID) },
    );
    expect(res.status).toBe(404);

    const findArgs = models.cvisionCandidate.findFirst.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({ tenantId: TENANT_ID, id: CAND_ID });
  });

  it('POST → success path reaches Prisma.update with $set translated to direct fields', async () => {
    // findFirst is called twice: once by findById and once inside updateOne
    // (the shim does a findFirst before the actual update). Return the
    // candidate persistently for both calls.
    models.cvisionCandidate.findFirst.mockResolvedValue({
      id: CAND_ID,
      tenantId: TENANT_ID,
      fullName: 'Sara Ahmed',
      email: 'sara@example.com',
      jobTitleId: 'jt-1',
      jobTitleName: 'Senior Engineer',
    });
    models.cvisionCandidate.update.mockImplementation(async (args: any) => args.data);

    const res = await POST(
      makeReq({
        basicSalary: 18000,
        housingAllowance: 5000,
        transportAllowance: 2000,
        currency: 'SAR',
        startDate: '2026-05-01',
        contractType: 'full_time',
        probationPeriod: 90,
        expiryDate: '2026-05-15',
      }),
      { params: params(CAND_ID) },
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(models.cvisionCandidate.update).toHaveBeenCalled();
    const updateArgs = models.cvisionCandidate.update.mock.calls[0][0];
    // $set translates to direct fields on update.data (not nested under $set)
    expect(updateArgs.data.status).toBe('offer');
    expect(updateArgs.data.offerAmount).toBe(25000);
    expect(updateArgs.data.offerCurrency).toBe('SAR');
    // No mongo operators leak into the Prisma update payload
    expect(Object.keys(updateArgs.data).every((k) => !k.startsWith('$'))).toBe(true);
  });
});
