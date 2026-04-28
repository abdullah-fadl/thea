/**
 * Phase 7.2 — ImdadVendor semantic search tests
 *
 * Cases:
 *  1. Flag OFF (EmbeddingsDisabled) → returns [] without DB call
 *  2. Flag ON → results returned, sorted by similarity desc, mapped correctly with CR
 *  3. Flag ON → tenantId is passed through to the raw query (scope enforced)
 *  4. Flag ON → limit parameter is passed through (default 10, custom honored)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { EMBEDDING_DIMENSIONS, EmbeddingsDisabled } from '@/lib/embeddings/provider';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockEmbed = vi.fn();
const mockQueryRawUnsafe = vi.fn();

vi.mock('@/lib/embeddings/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/embeddings/provider')>();
  return {
    ...actual,
    getDefaultProvider: vi.fn(() => ({ embed: mockEmbed })),
    EmbeddingsDisabled: actual.EmbeddingsDisabled,
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { getDefaultProvider } = await import('@/lib/embeddings/provider');

function fakeVector(len = EMBEDDING_DIMENSIONS): number[] {
  return Array.from({ length: len }, (_, i) => i / len);
}

const TENANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const OTHER_TENANT_ID = '11111111-2222-3333-4444-555555555555';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('searchImdadVendorsByText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED];
  });
  afterEach(() => { delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED]; });

  it('Case 1: flag OFF (EmbeddingsDisabled) → returns [] without calling DB', async () => {
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      embed: async () => { throw new EmbeddingsDisabled(); },
    }));

    const { searchImdadVendorsByText } = await import('@/lib/embeddings/search/imdadVendor');
    const results = await searchImdadVendorsByText('saudi pharmaceutical', TENANT_ID);
    expect(results).toEqual([]);
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('Case 2: flag ON → results sorted by similarity desc, commercialRegistration surfaced', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockEmbed.mockResolvedValue({ embedding: fakeVector(), model: 'text-embedding-3-large', totalTokens: 5 });
    mockQueryRawUnsafe.mockResolvedValue([
      { id: 'v-1', name: 'Pfizer Saudi Arabia', crNumber: '1010012345', similarity: 0.88 },
      { id: 'v-2', name: 'Generic Pharma KSA', crNumber: null, similarity: 0.72 },
    ]);

    const { searchImdadVendorsByText } = await import('@/lib/embeddings/search/imdadVendor');
    const results = await searchImdadVendorsByText('pharmaceutical riyadh', TENANT_ID);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('v-1');
    expect(results[0].name).toBe('Pfizer Saudi Arabia');
    expect(results[0].commercialRegistration).toBe('1010012345');
    expect(results[0].similarity).toBeCloseTo(0.88);
    // Vendor without CR — null preserved
    expect(results[1].commercialRegistration).toBeNull();
  });

  it('Case 3: flag ON → tenantId is passed to the raw query (scope enforced)', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockEmbed.mockResolvedValue({ embedding: fakeVector(), model: 'text-embedding-3-large', totalTokens: 5 });
    mockQueryRawUnsafe.mockResolvedValue([]);

    const { searchImdadVendorsByText } = await import('@/lib/embeddings/search/imdadVendor');
    await searchImdadVendorsByText('cold-chain logistics', TENANT_ID);

    expect(mockQueryRawUnsafe).toHaveBeenCalledOnce();
    const [sql, _vectorArg, tenantArg] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/"tenantId"\s*=\s*\$2/);
    expect(sql).toMatch(/"embeddingVec"/);
    expect(sql).toMatch(/imdad_vendors/);
    expect(tenantArg).toBe(TENANT_ID);
    expect(tenantArg).not.toBe(OTHER_TENANT_ID);
  });

  it('Case 4: flag ON → limit parameter is passed through (default 10, custom value honored)', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockEmbed.mockResolvedValue({ embedding: fakeVector(), model: 'text-embedding-3-large', totalTokens: 5 });
    mockQueryRawUnsafe.mockResolvedValue([]);

    const { searchImdadVendorsByText } = await import('@/lib/embeddings/search/imdadVendor');

    await searchImdadVendorsByText('q1', TENANT_ID);
    const [, , , limit1] = mockQueryRawUnsafe.mock.calls[0];
    expect(limit1).toBe(10);

    await searchImdadVendorsByText('q2', TENANT_ID, 7);
    const [, , , limit2] = mockQueryRawUnsafe.mock.calls[1];
    expect(limit2).toBe(7);
  });
});
