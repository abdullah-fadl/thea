/**
 * Phase 1 — Portal slug routing tests
 *
 * Cases:
 *  1. GET /api/portal/tenant/:slug — existing slug returns correct tenant
 *  2. GET /api/portal/tenant/:slug — unknown slug returns 404
 *  3. GET /api/portal/tenants      — returns 410 when FF_PORTAL_SLUG_ROUTING=true
 *  4. GET /api/portal/tenants      — returns list when FF_PORTAL_SLUG_ROUTING is off
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Mocks (must be declared before any imports that use them)
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tenant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    patientPortalRateLimit: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import route handlers after mocks are in place
// ---------------------------------------------------------------------------

import { GET as getBySlug } from '@/app/api/portal/tenant/[slug]/route';
import { GET as getTenants } from '@/app/api/portal/tenants/route';

// ---------------------------------------------------------------------------
// Helper: build a minimal NextRequest-compatible Request for the slug route
// ---------------------------------------------------------------------------
function makeReq(url: string): Request {
  return new Request(url);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Portal tenant slug routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_PORTAL_SLUG_ROUTING];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_PORTAL_SLUG_ROUTING];
  });

  // ── Case 1: existing slug returns correct tenant ─────────────────────────

  it('1 — existing slug returns the correct tenant (200)', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue({
      id: 'uuid-aaa-111',
      tenantId: 'hmg-whh',
      name: 'HMG West Hospitals',
      portalSlug: 'hmg-whh',
    });

    const res = await getBySlug(
      makeReq('http://localhost/api/portal/tenant/hmg-whh') as any,
      { params: { slug: 'hmg-whh' } },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe('hmg-whh');
    expect(body.name).toBe('HMG West Hospitals');
    expect(body.tenantId).toBe('hmg-whh');
    // Must not leak internal DB id beyond what we explicitly include
    expect(Object.keys(body).sort()).toEqual(['id', 'name', 'slug', 'tenantId'].sort());
  });

  // ── Case 2: unknown slug returns 404 ─────────────────────────────────────

  it('2 — unknown slug returns 404', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(null);

    const res = await getBySlug(
      makeReq('http://localhost/api/portal/tenant/no-such-hospital') as any,
      { params: { slug: 'no-such-hospital' } },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // ── Case 3: legacy tenants endpoint → 410 when flag is on ────────────────

  it('3 — legacy /api/portal/tenants returns 410 when FF_PORTAL_SLUG_ROUTING=true', async () => {
    process.env[FLAGS.FF_PORTAL_SLUG_ROUTING] = 'true';

    const res = await getTenants(
      makeReq('http://localhost/api/portal/tenants') as any,
    );

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.gone).toBe(true);
    expect(typeof body.message).toBe('string');
    // Prisma must NOT have been called — the 410 should short-circuit before any DB work
    expect(mockPrisma.patientPortalRateLimit.count).not.toHaveBeenCalled();
    expect(mockPrisma.tenant.findMany).not.toHaveBeenCalled();
  });

  // ── Case 4: legacy tenants endpoint → 200 when flag is off ───────────────

  it('4 — legacy /api/portal/tenants returns the list when flag is off', async () => {
    // Flag is off (env var not set)
    mockPrisma.patientPortalRateLimit.count.mockResolvedValue(0);
    mockPrisma.patientPortalRateLimit.create.mockResolvedValue({});
    mockPrisma.tenant.findMany.mockResolvedValue([
      { tenantId: 'hosp-1', name: 'Hospital One' },
      { tenantId: 'hosp-2', name: 'Hospital Two' },
    ]);

    const res = await getTenants(
      makeReq('http://localhost/api/portal/tenants') as any,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].tenantId).toBe('hosp-1');
  });
});
