/**
 * Phase 7.1 — PolicyChunk embedding writer tests
 *
 * Cases:
 *  1. Flag OFF → embedPolicyChunk() returns skipped:true (no DB / OpenAI calls)
 *  2. Flag ON, happy path → UPDATE called with vector literal + correct id
 *  3. Flag ON, idempotent → second call writes again with same vector
 *  4. Flag ON, provider error → error propagates (caller decides to retry)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { EMBEDDING_DIMENSIONS } from '@/lib/embeddings/provider';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockEmbed = vi.fn();
const mockFindUnique = vi.fn();
const mockExecuteRawUnsafe = vi.fn();

vi.mock('@/lib/embeddings/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/embeddings/provider')>();
  return {
    ...actual,
    getDefaultProvider: vi.fn(() => ({ embed: mockEmbed })),
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    policyChunk: { findUnique: mockFindUnique },
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { getDefaultProvider } = await import('@/lib/embeddings/provider');

function fakeVector(len = EMBEDDING_DIMENSIONS): number[] {
  return Array.from({ length: len }, (_, i) => i / len);
}

const CHUNK_ID = '550e8400-e29b-41d4-a716-446655440010';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('embedPolicyChunk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED];
  });
  afterEach(() => { delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED]; });

  it('Case 1: flag OFF → returns skipped:true without any DB or OpenAI call', async () => {
    delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED];
    const { embedPolicyChunk } = await import('@/lib/embeddings/writers/policyChunk');
    const result = await embedPolicyChunk(CHUNK_ID);
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toMatch(/FF_EMBEDDINGS_ENABLED is OFF/);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it('Case 2: flag ON, happy path → UPDATE called with vector literal targeting embeddingVec column', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    const vec = fakeVector();
    mockEmbed.mockResolvedValue({ embedding: vec, model: 'text-embedding-3-large', totalTokens: 42 });
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockFindUnique.mockResolvedValue({
      id: CHUNK_ID,
      content: 'Hand hygiene policy: staff must perform hand hygiene before/after every patient contact.',
    });
    mockExecuteRawUnsafe.mockResolvedValue(1);

    const { embedPolicyChunk } = await import('@/lib/embeddings/writers/policyChunk');
    const result = await embedPolicyChunk(CHUNK_ID);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.totalTokens).toBe(42);
      expect(result.model).toBe('text-embedding-3-large');
      expect(result.id).toBe(CHUNK_ID);
    }
    expect(mockExecuteRawUnsafe).toHaveBeenCalledOnce();
    const [sql, vectorArg, idArg] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/UPDATE "policy_chunks"/);
    expect(sql).toMatch(/"embeddingVec"/);
    expect(sql).toMatch(/\$1::vector/);
    expect(vectorArg).toMatch(/^\[/);
    expect(vectorArg).toContain(',');
    expect(idArg).toBe(CHUNK_ID);
  });

  it('Case 3: idempotent — second call overwrites with same vector', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    const vec = fakeVector();
    mockEmbed.mockResolvedValue({ embedding: vec, model: 'text-embedding-3-large', totalTokens: 42 });
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockFindUnique.mockResolvedValue({ id: CHUNK_ID, content: 'Same content for both runs.' });
    mockExecuteRawUnsafe.mockResolvedValue(1);

    const { embedPolicyChunk } = await import('@/lib/embeddings/writers/policyChunk');
    const r1 = await embedPolicyChunk(CHUNK_ID);
    const r2 = await embedPolicyChunk(CHUNK_ID);

    expect(r1.skipped).toBe(false);
    expect(r2.skipped).toBe(false);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2);
    // Both calls used identical vector literal
    const arg1 = mockExecuteRawUnsafe.mock.calls[0][1];
    const arg2 = mockExecuteRawUnsafe.mock.calls[1][1];
    expect(arg1).toBe(arg2);
  });

  it('Case 4: flag ON, provider throws → error propagates (no UPDATE executed)', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    mockEmbed.mockRejectedValue(new Error('OpenAI rate limit'));
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockFindUnique.mockResolvedValue({ id: CHUNK_ID, content: 'some policy text' });

    const { embedPolicyChunk } = await import('@/lib/embeddings/writers/policyChunk');
    await expect(embedPolicyChunk(CHUNK_ID)).rejects.toThrow(/OpenAI rate limit/);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });
});
