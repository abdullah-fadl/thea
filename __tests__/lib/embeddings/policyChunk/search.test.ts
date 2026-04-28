/**
 * Phase 7.1 — PolicyChunk semantic search tests
 *
 * Cases:
 *  1. Flag OFF (EmbeddingsDisabled) → returns [] without DB call
 *  2. Flag ON → results returned, sorted by similarity desc, mapped correctly
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

describe('searchPolicyChunksByText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED];
  });
  afterEach(() => { delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED]; });

  it('Case 1: flag OFF (EmbeddingsDisabled) → returns [] without calling DB', async () => {
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      embed: async () => { throw new EmbeddingsDisabled(); },
    }));

    const { searchPolicyChunksByText } = await import('@/lib/embeddings/search/policyChunk');
    const results = await searchPolicyChunksByText('hand hygiene', TENANT_ID);
    expect(results).toEqual([]);
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('Case 2: flag ON → results sorted by similarity desc, content truncated, parent doc id surfaced', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockEmbed.mockResolvedValue({ embedding: fakeVector(), model: 'text-embedding-3-large', totalTokens: 5 });
    const longContent = 'A'.repeat(500);
    mockQueryRawUnsafe.mockResolvedValue([
      { id: 'chunk-1', documentId: 'doc-A', content: longContent, similarity: 0.91 },
      { id: 'chunk-2', documentId: 'doc-B', content: 'short policy text', similarity: 0.74 },
    ]);

    const { searchPolicyChunksByText } = await import('@/lib/embeddings/search/policyChunk');
    const results = await searchPolicyChunksByText('hand hygiene', TENANT_ID);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('chunk-1');
    expect(results[0].policyDocumentId).toBe('doc-A');
    expect(results[0].similarity).toBeCloseTo(0.91);
    // First result has long content — truncated to 200 chars + ellipsis
    expect(results[0].content.length).toBeLessThanOrEqual(201);
    expect(results[0].content.endsWith('…')).toBe(true);
    // Second result is short — passed through as-is
    expect(results[1].content).toBe('short policy text');
    expect(results[1].policyDocumentId).toBe('doc-B');
  });

  it('Case 3: flag ON → tenantId is passed to the raw query (scope enforced)', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockEmbed.mockResolvedValue({ embedding: fakeVector(), model: 'text-embedding-3-large', totalTokens: 5 });
    mockQueryRawUnsafe.mockResolvedValue([]);

    const { searchPolicyChunksByText } = await import('@/lib/embeddings/search/policyChunk');
    await searchPolicyChunksByText('infection control', TENANT_ID);

    expect(mockQueryRawUnsafe).toHaveBeenCalledOnce();
    const [sql, _vectorArg, tenantArg] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/"tenantId"\s*=\s*\$2/);
    expect(sql).toMatch(/"embeddingVec"/);
    expect(tenantArg).toBe(TENANT_ID);
    expect(tenantArg).not.toBe(OTHER_TENANT_ID);
  });

  it('Case 4: flag ON → limit parameter is passed through (default 10, custom value honored)', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockEmbed.mockResolvedValue({ embedding: fakeVector(), model: 'text-embedding-3-large', totalTokens: 5 });
    mockQueryRawUnsafe.mockResolvedValue([]);

    const { searchPolicyChunksByText } = await import('@/lib/embeddings/search/policyChunk');

    // Default limit 10
    await searchPolicyChunksByText('q1', TENANT_ID);
    const [, , , limit1] = mockQueryRawUnsafe.mock.calls[0];
    expect(limit1).toBe(10);

    // Custom limit 3
    await searchPolicyChunksByText('q2', TENANT_ID, 3);
    const [, , , limit2] = mockQueryRawUnsafe.mock.calls[1];
    expect(limit2).toBe(3);
  });
});
