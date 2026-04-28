/**
 * Stage B T3 — public/apply route smoke test (applications domain).
 * Public route (no withAuthTenant). Hits cvisionJobPosting / cvisionKilloutQuestion /
 * cvisionApplication via the shim.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TENANT_ID, makePrismaStub } from './_helpers/route-smoke';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { prisma, models, getModel } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

const { POST } = await import('@/app/api/cvision/public/apply/route');

// RFC 4122 v4 UUID (Zod's .uuid() requires correct version + variant nibbles)
const POSTING_ID = '12345678-1234-4234-8234-123456789012';

function makeReq(body: any) {
  return new NextRequest('http://localhost/api/cvision/public/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Stage B T3 — public/apply route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
      m.create.mockImplementation(async (args: any) => args.data);
    });
    getModel('cvisionJobPosting');
    getModel('cvisionKilloutQuestion');
    getModel('cvisionApplication');
  });

  it('POST → 400 on Zod schema failure (no DB calls)', async () => {
    const res = await POST(
      makeReq({ candidateEmail: 'not-an-email' }),
    );
    expect(res.status).toBe(400);
    expect(models.cvisionJobPosting.findFirst).not.toHaveBeenCalled();
  });

  it('POST → 404 when job posting not found; verify shim translated id+tenantId filter', async () => {
    models.cvisionJobPosting.findFirst.mockResolvedValueOnce(null);

    const res = await POST(
      makeReq({
        postingId: POSTING_ID,
        candidateEmail: 'a@b.com',
        candidateName: 'Test',
        answers: {},
        tenantId: TENANT_ID,
      }),
    );
    expect(res.status).toBe(404);

    const findArgs = models.cvisionJobPosting.findFirst.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({ tenantId: TENANT_ID, id: POSTING_ID });
  });

  it('POST → 400 when posting not OPEN; never calls applications.create', async () => {
    models.cvisionJobPosting.findFirst.mockResolvedValueOnce({
      id: POSTING_ID,
      tenantId: TENANT_ID,
      status: 'CLOSED',
    });

    const res = await POST(
      makeReq({
        postingId: POSTING_ID,
        candidateEmail: 'a@b.com',
        candidateName: 'Test',
        answers: {},
        tenantId: TENANT_ID,
      }),
    );
    expect(res.status).toBe(400);
    expect(models.cvisionApplication.create).not.toHaveBeenCalled();
  });

  it('POST → 200 SUBMITTED when posting OPEN with no questions; reaches applications.create via shim', async () => {
    models.cvisionJobPosting.findFirst.mockResolvedValueOnce({
      id: POSTING_ID,
      tenantId: TENANT_ID,
      status: 'OPEN',
      title: 'Engineer',
    });
    models.cvisionKilloutQuestion.findMany.mockResolvedValueOnce([]);
    models.cvisionApplication.create.mockImplementation(async (args: any) => ({
      ...args.data,
      id: args.data.id ?? 'app-generated',
    }));

    const res = await POST(
      makeReq({
        postingId: POSTING_ID,
        candidateEmail: 'sara@example.com',
        candidateName: 'Sara Ahmed',
        answers: {},
        tenantId: TENANT_ID,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.application.status).toBe('SUBMITTED');

    const createArgs = models.cvisionApplication.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      tenantId: TENANT_ID,
      postingId: POSTING_ID,
      candidateEmail: 'sara@example.com',
      candidateName: 'Sara Ahmed',
      status: 'SUBMITTED',
    });
  });
});
