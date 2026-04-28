/**
 * Anthropic (Claude) Provider
 *
 * Wraps the Anthropic API behind the common AIProvider interface.
 * Uses direct HTTP calls to avoid an extra SDK dependency.
 */

import { logger } from '@/lib/monitoring/logger';
import type {
  AIProvider,
  CompletionOptions,
  CompletionResult,
} from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const API_VERSION = '2023-06-01';
// [AI-07] Request timeout to prevent indefinite hangs
const REQUEST_TIMEOUT_MS = 60_000; // 60 seconds

function getApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic' as const;
  readonly defaultModel = DEFAULT_MODEL;

  isAvailable(): boolean {
    const key = getApiKey();
    return !!key && key !== '<not-set>' && !key.startsWith('change');
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const model = options.model || this.defaultModel;

    // Separate system message from conversation
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const conversationMessages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      // [AI-07] AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
          },
          body: JSON.stringify({
            model,
            max_tokens: options.maxTokens ?? 4096,
            temperature: options.temperature ?? 0.3,
            ...(systemMessage ? { system: systemMessage.content } : {}),
            messages: conversationMessages,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
      const content = textBlock?.text?.trim() || '';

      return {
        content,
        provider: 'anthropic',
        model: data.model || model,
        usage: data.usage
          ? {
              promptTokens: data.usage.input_tokens || 0,
              completionTokens: data.usage.output_tokens || 0,
              totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
            }
          : undefined,
        finishReason: data.stop_reason || undefined,
      };
    } catch (error) {
      logger.error('Anthropic completion failed', {
        category: 'api',
        error,
      });
      throw error;
    }
  }
}
