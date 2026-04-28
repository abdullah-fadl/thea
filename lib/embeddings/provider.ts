// =============================================================================
// Phase 5.2 — Embeddings provider abstraction
//
// Behaviour matrix:
//   FF_EMBEDDINGS_ENABLED OFF →
//     getDefaultProvider() returns EmbeddingsDisabledProvider (all calls throw
//     EmbeddingsDisabled).  Zero OpenAI calls at module load or call time.
//
//   FF_EMBEDDINGS_ENABLED ON, OPENAI_API_KEY missing →
//     getDefaultProvider() throws EmbeddingsConfigurationError immediately.
//
//   FF_EMBEDDINGS_ENABLED ON, OPENAI_API_KEY present →
//     getDefaultProvider() returns the lazy OpenAI provider singleton.
//     OpenAI SDK client is NOT instantiated until the first embed() call.
//
// Design notes:
//   1. EmbeddingsProvider is provider-agnostic; swap the default without
//      touching call sites.
//   2. Dimensions are fixed at 1536 (text-embedding-3-large @ 1536 dims).
//      The constant is exported so callers can assert vector lengths.
//   3. EmbeddingsDisabled and EmbeddingsConfigurationError are typed errors
//      so tests and callers can distinguish them via instanceof.
// =============================================================================

import { isEnabled } from '@/lib/core/flags';
import { OpenAIEmbeddingsProvider } from './providers/openai';

export const EMBEDDING_DIMENSIONS = 1536;

// ─── Typed errors ─────────────────────────────────────────────────────────────

export class EmbeddingsDisabled extends Error {
  constructor() {
    super('FF_EMBEDDINGS_ENABLED is OFF — embedding operations are disabled');
    this.name = 'EmbeddingsDisabled';
  }
}

export class EmbeddingsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingsConfigurationError';
  }
}

export class EmbeddingsProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EmbeddingsProviderError';
  }
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  totalTokens: number;
}

export interface EmbeddingsProvider {
  /**
   * Generate a fixed-length embedding vector for the given text.
   * Throws EmbeddingsDisabled if the flag is OFF.
   * Throws EmbeddingsProviderError on API / network failures.
   */
  embed(text: string): Promise<EmbeddingResult>;
}

// ─── Disabled stub ────────────────────────────────────────────────────────────

class EmbeddingsDisabledProvider implements EmbeddingsProvider {
  async embed(_text: string): Promise<EmbeddingResult> {
    throw new EmbeddingsDisabled();
  }
}

// ─── Singleton cache ──────────────────────────────────────────────────────────

let _provider: EmbeddingsProvider | null = null;

/**
 * Returns the configured EmbeddingsProvider.
 *
 * - Flag OFF  → EmbeddingsDisabledProvider (calls throw EmbeddingsDisabled).
 * - Flag ON, key missing → throws EmbeddingsConfigurationError.
 * - Flag ON, key present → lazy OpenAI provider (client not created until
 *   first embed() call).
 *
 * The return value is cached after the first call; call resetProvider() in
 * tests to clear it.
 */
export function getDefaultProvider(): EmbeddingsProvider {
  if (_provider) return _provider;

  if (!isEnabled('FF_EMBEDDINGS_ENABLED')) {
    _provider = new EmbeddingsDisabledProvider();
    return _provider;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new EmbeddingsConfigurationError(
      'FF_EMBEDDINGS_ENABLED is ON but OPENAI_API_KEY is not set',
    );
  }

  // OpenAI SDK is lazily instantiated inside OpenAIEmbeddingsProvider.getClient()
  // — no SDK call happens here at module load or at this call site.
  _provider = new OpenAIEmbeddingsProvider();
  return _provider;
}

/** Reset the cached provider. Use only in tests. */
export function resetProvider(): void {
  _provider = null;
}
