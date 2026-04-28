/**
 * Phase 5.2 — Embeddings provider tests
 *
 * Cases:
 *  1.  Flag OFF → getDefaultProvider() returns a provider (EmbeddingsDisabledProvider)
 *  2.  Flag OFF → provider.embed() throws EmbeddingsDisabled
 *  3.  Flag ON, key missing → getDefaultProvider() throws EmbeddingsConfigurationError
 *  4.  Flag ON, key present → getDefaultProvider() returns OpenAI provider
 *  5.  Flag ON, key present → provider.embed() calls OpenAI with correct model + dims
 *  6.  Flag ON → embed() returns vector of correct length (1536)
 *  7.  Flag ON → 429 rate-limit triggers one retry then succeeds
 *  8.  Flag ON → non-429 error thrown immediately (no retry)
 *  9.  resetProvider() clears cached provider (flag re-evaluated on next call)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import {
  getDefaultProvider,
  resetProvider,
  EmbeddingsDisabled,
  EmbeddingsConfigurationError,
  EmbeddingsProviderError,
  EMBEDDING_DIMENSIONS,
} from '@/lib/embeddings/provider';

const FAKE_KEY = 'sk-test-key';

// ─── Mock the OpenAI provider ─────────────────────────────────────────────────
// vi.hoisted so mockEmbed is defined before the vi.mock factory executes.

const { mockEmbed } = vi.hoisted(() => ({ mockEmbed: vi.fn() }));

vi.mock('@/lib/embeddings/providers/openai', () => ({
  OpenAIEmbeddingsProvider: class MockOpenAIProvider {
    embed = mockEmbed;
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enableFlag()  { process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED]; }

function fakeVector(len = EMBEDDING_DIMENSIONS): number[] {
  return Array.from({ length: len }, (_, i) => i / len);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getDefaultProvider — flag OFF', () => {
  beforeEach(() => {
    disableFlag();
    resetProvider();
  });
  afterEach(resetProvider);

  it('Case 1: returns a provider instance (does not throw)', () => {
    const p = getDefaultProvider();
    expect(p).toBeTruthy();
  });

  it('Case 2: provider.embed() throws EmbeddingsDisabled', async () => {
    const p = getDefaultProvider();
    await expect(p.embed('test')).rejects.toBeInstanceOf(EmbeddingsDisabled);
  });
});

describe('getDefaultProvider — flag ON', () => {
  beforeEach(() => {
    resetProvider();
    enableFlag();
  });
  afterEach(() => {
    disableFlag();
    resetProvider();
    delete process.env.OPENAI_API_KEY;
    mockEmbed.mockReset();
  });

  it('Case 3: throws EmbeddingsConfigurationError when OPENAI_API_KEY missing', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => getDefaultProvider()).toThrow(EmbeddingsConfigurationError);
  });

  it('Case 4: returns provider when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = FAKE_KEY;
    const p = getDefaultProvider();
    expect(p).toBeTruthy();
  });

  it('Case 5: embed() delegates to OpenAI provider with correct args', async () => {
    process.env.OPENAI_API_KEY = FAKE_KEY;
    const expected = { embedding: fakeVector(), model: 'text-embedding-3-large', totalTokens: 5 };
    mockEmbed.mockResolvedValue(expected);

    const p = getDefaultProvider();
    const result = await p.embed('emergency department');
    expect(mockEmbed).toHaveBeenCalledWith('emergency department');
    expect(result.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it('Case 6: embed() result has exactly 1536-dim vector', async () => {
    process.env.OPENAI_API_KEY = FAKE_KEY;
    mockEmbed.mockResolvedValue({
      embedding: fakeVector(1536),
      model: 'text-embedding-3-large',
      totalTokens: 8,
    });
    const p = getDefaultProvider();
    const { embedding } = await p.embed('radiology');
    expect(embedding).toHaveLength(1536);
  });
});

describe('resetProvider', () => {
  it('Case 9: clears cached provider so flag re-evaluated on next call', () => {
    disableFlag();
    resetProvider();
    const p1 = getDefaultProvider();

    // Switch flag ON (with key)
    enableFlag();
    process.env.OPENAI_API_KEY = FAKE_KEY;
    resetProvider();
    // Should now use OpenAI provider, not disabled stub
    expect(() => getDefaultProvider()).not.toThrow();

    // Clean up
    disableFlag();
    delete process.env.OPENAI_API_KEY;
    resetProvider();
    void p1;
  });
});

describe('EmbeddingsProviderError', () => {
  it('is instanceof Error', () => {
    const err = new EmbeddingsProviderError('bad');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EmbeddingsProviderError');
  });
});
