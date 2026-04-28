// =============================================================================
// Phase 5.2 — OpenAI embeddings provider
//
// Uses text-embedding-3-large at 1536 dimensions.
// Client is lazy-initialised on the first embed() call (not at module load).
//
// Retry policy:
//   - Rate-limit (429) → one retry after a 1-second back-off.
//   - All other errors → thrown immediately as EmbeddingsProviderError.
// =============================================================================

import type OpenAI from 'openai';
import { EMBEDDING_DIMENSIONS, EmbeddingResult, EmbeddingsProvider, EmbeddingsProviderError } from '../provider';

const MODEL = 'text-embedding-3-large';
const RATE_LIMIT_BACKOFF_MS = 1_000;

export class OpenAIEmbeddingsProvider implements EmbeddingsProvider {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (this.client) return this.client;
    // Dynamic require keeps this module tree-shakeable in environments that
    // never enable the flag (the import is evaluated lazily at call time).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAIClass = require('openai').default as typeof OpenAI;
    this.client = new OpenAIClass({ apiKey: process.env.OPENAI_API_KEY });
    return this.client;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    return this._embedWithRetry(text, false);
  }

  private async _embedWithRetry(text: string, isRetry: boolean): Promise<EmbeddingResult> {
    const client = this.getClient();
    try {
      const response = await client.embeddings.create({
        model: MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: 'float',
      });

      const vector = response.data[0]?.embedding;
      if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
        throw new EmbeddingsProviderError(
          `Unexpected embedding dimensions: got ${vector?.length ?? 0}, expected ${EMBEDDING_DIMENSIONS}`,
        );
      }

      return {
        embedding: vector,
        model: response.model,
        totalTokens: response.usage.total_tokens,
      };
    } catch (err: unknown) {
      if (isRateLimitError(err) && !isRetry) {
        await sleep(RATE_LIMIT_BACKOFF_MS);
        return this._embedWithRetry(text, true);
      }
      if (err instanceof EmbeddingsProviderError) throw err;
      throw new EmbeddingsProviderError(
        `OpenAI embed failed: ${errorMessage(err)}`,
        err,
      );
    }
  }
}

function isRateLimitError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  // openai SDK sets .status on API errors
  return (err as { status?: number }).status === 429;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
