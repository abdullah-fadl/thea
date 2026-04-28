/**
 * Stage B T1 — offer-portal smoke test.
 *
 * Verifies the route's GET + POST handlers don't crash on the previously-broken
 * `null.db()` path. Before the fix in Stage B T1, both handlers destructured
 * `{ client }` from `getPlatformClient()` and called `client.db('...')` — but
 * the platform client is now `null` since the Mongo→Prisma cutover landed on
 * 2026-04-22. This caused `TypeError: Cannot read properties of null (reading
 * 'db')` on first hit. The route now uses `{ db }` (the Prisma-backed shim).
 *
 * These tests stub `validateOfferToken` so we exercise the post-validation code
 * path that previously crashed, without needing a CvisionOfferToken Prisma model
 * (which doesn't exist yet — see lib/cvision/offerToken.ts NOTE).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks (must be hoisted before the route import) ───────────────────────

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockValidateOfferToken = vi.fn();
vi.mock('@/lib/cvision/offerToken', () => ({
  validateOfferToken: (...args: any[]) => mockValidateOfferToken(...args),
}));

const mockCreateNotification = vi.fn();
vi.mock('@/lib/cvision/notifications', () => ({
  createCVisionNotification: (...args: any[]) => mockCreateNotification(...args),
}));

const mockFindOne = vi.fn();
const mockUpdateOne = vi.fn();
vi.mock('@/lib/db/mongo', () => ({
  getPlatformClient: vi.fn(async () => ({
    client: null, // intentional — proves we never deref client
    db: {
      collection: () => ({
        findOne: (...args: any[]) => mockFindOne(...args),
        updateOne: (...args: any[]) => mockUpdateOne(...args),
      }),
    },
  })),
}));

// ─── Route import (after mocks) ─────────────────────────────────────────────

const { GET, POST } = await import('@/app/api/cvision/offer-portal/[token]/route');

// ─── Helpers ────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'a'.repeat(64);
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

function makeGet(token: string, tenantId?: string) {
  const url = tenantId
    ? `http://localhost/api/cvision/offer-portal/${token}?tenantId=${tenantId}`
    : `http://localhost/api/cvision/offer-portal/${token}`;
  return new NextRequest(url, { method: 'GET' });
}

function makePost(token: string, body: any, tenantId?: string) {
  const url = tenantId
    ? `http://localhost/api/cvision/offer-portal/${token}?tenantId=${tenantId}`
    : `http://localhost/api/cvision/offer-portal/${token}`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = (token: string) => Promise.resolve({ token });

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Stage B T1 — offer-portal route does not crash on null platform client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET → 400 when token is too short (length < 20)', async () => {
    const res = await GET(makeGet('short'), { params: params('short') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid offer token/i);
  });

  it('GET → 400 when tenantId query param is missing', async () => {
    const res = await GET(makeGet(VALID_TOKEN), { params: params(VALID_TOKEN) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing tenantId/i);
  });

  it('GET → 404 when token does not validate (does not crash)', async () => {
    mockValidateOfferToken.mockResolvedValueOnce(null);
    const res = await GET(makeGet(VALID_TOKEN, TENANT_ID), { params: params(VALID_TOKEN) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/expired|not found/i);
  });

  it('GET → 404 when token validates but candidate not found (proves db.collection path runs without crash)', async () => {
    mockValidateOfferToken.mockResolvedValueOnce({
      token: VALID_TOKEN,
      tenantId: TENANT_ID,
      candidateId: 'candidate-abc',
      candidateName: 'Test',
      candidateEmail: 't@t.com',
      jobTitleName: 'Engineer',
      companyName: 'Acme',
      offerAmount: 1000,
      offerCurrency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000),
      active: true,
      createdAt: new Date(),
      createdBy: 'user-1',
    });
    mockFindOne.mockResolvedValueOnce(null);

    const res = await GET(makeGet(VALID_TOKEN, TENANT_ID), { params: params(VALID_TOKEN) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Candidate not found/i);
    // The critical assertion: we reached findOne, which means we did NOT crash on null.db().
    expect(mockFindOne).toHaveBeenCalledOnce();
  });

  it('GET → 200 with candidate offer payload when both token + candidate exist', async () => {
    mockValidateOfferToken.mockResolvedValueOnce({
      token: VALID_TOKEN,
      tenantId: TENANT_ID,
      candidateId: 'candidate-abc',
      candidateName: 'Sara',
      candidateEmail: 'sara@example.com',
      jobTitleName: 'Senior Engineer',
      companyName: 'Acme Inc',
      companyLogo: 'https://logo.png',
      offerAmount: 25000,
      offerCurrency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000),
      active: true,
      createdAt: new Date(),
      createdBy: 'user-1',
    });
    mockFindOne.mockResolvedValueOnce({
      id: 'candidate-abc',
      tenantId: TENANT_ID,
      fullName: 'Sara Ahmed',
      email: 'sara@example.com',
      jobTitleName: 'Senior Engineer',
      offer: {
        totalSalary: 25000,
        basicSalary: 18000,
        housingAllowance: 5000,
        transportAllowance: 2000,
        currency: 'SAR',
        status: 'sent',
      },
    });

    const res = await GET(makeGet(VALID_TOKEN, TENANT_ID), { params: params(VALID_TOKEN) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.candidate.name).toBe('Sara Ahmed');
    expect(body.offer.totalSalary).toBe(25000);
    expect(body.company.name).toBe('Acme Inc');
  });

  it('POST → 400 when validation body is invalid', async () => {
    const res = await POST(
      makePost(VALID_TOKEN, { action: 'maybe' }, TENANT_ID),
      { params: params(VALID_TOKEN) }
    );
    expect(res.status).toBe(400);
  });

  it('POST → 404 when token does not validate (does not crash)', async () => {
    mockValidateOfferToken.mockResolvedValueOnce(null);
    const res = await POST(
      makePost(VALID_TOKEN, { action: 'accept' }, TENANT_ID),
      { params: params(VALID_TOKEN) }
    );
    expect(res.status).toBe(404);
  });

  it('POST → 200 accept flow runs end-to-end without dereferencing null client', async () => {
    mockValidateOfferToken.mockResolvedValueOnce({
      token: VALID_TOKEN,
      tenantId: TENANT_ID,
      candidateId: 'candidate-abc',
      candidateName: 'Sara',
      candidateEmail: 'sara@example.com',
      jobTitleName: 'Senior Engineer',
      companyName: 'Acme',
      offerAmount: 25000,
      offerCurrency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000),
      active: true,
      createdAt: new Date(),
      createdBy: 'user-1',
    });
    mockFindOne.mockResolvedValueOnce({
      id: 'candidate-abc',
      tenantId: TENANT_ID,
      fullName: 'Sara Ahmed',
      jobTitleName: 'Senior Engineer',
      jobTitleId: 'job-1',
      status: 'offer_sent',
      offer: { totalSalary: 25000, currency: 'SAR', status: 'sent' },
    });
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1, matchedCount: 1, upsertedCount: 0 });
    mockCreateNotification.mockResolvedValue(undefined);

    const res = await POST(
      makePost(VALID_TOKEN, { action: 'accept', notes: 'Looks good' }, TENANT_ID),
      { params: params(VALID_TOKEN) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.action).toBe('accept');
    // candidate updateOne + token deactivate updateOne = 2 calls
    expect(mockUpdateOne).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledOnce();
  });
});
