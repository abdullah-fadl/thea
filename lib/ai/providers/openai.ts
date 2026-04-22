/**
 * OpenAI Provider
 *
 * Wraps the existing OpenAI client (lib/openai/server.ts) behind
 * the common AIProvider interface.
 */

import { getOpenAI } from '@/lib/openai/server';
import { logger } from '@/lib/monitoring/logger';
import type {
  AIProvider,
  CompletionOptions,
  CompletionResult,
} from './types';

const DEFAULT_MODEL = 'gpt-4o-mini';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const;
  readonly defaultModel = DEFAULT_MODEL;

  isAvailable(): boolean {
    return getOpenAI() !== null;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const openai = getOpenAI();
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || this.defaultModel;

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: options.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4096,
        ...(options.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      });

      const choice = response.choices?.[0];

      return {
        content: choice?.message?.content?.trim() || '',
        provider: 'openai',
        model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        finishReason: choice?.finish_reason || undefined,
      };
    } catch (error) {
      logger.error('OpenAI completion failed', {
        category: 'api',
        error,
      });
      throw error;
    }
  }
}
