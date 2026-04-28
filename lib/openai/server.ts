/**
 * OpenAI server-side client
 * This file must NOT be imported in client components
 * Only use in API routes and server utilities
 */

import OpenAI from 'openai';
import { env } from '../env';
import { logger } from '@/lib/monitoring/logger';

let openaiClient: OpenAI | null = null;

/**
 * Get OpenAI client singleton instance
 * Uses OPENAI_API_KEY from environment variables
 * @returns OpenAI client instance or null if API key is not configured
 */

export function getOpenAI(): OpenAI | null {
  if (openaiClient) {
    return openaiClient;
  }

  if (!env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not configured in environment variables', { category: 'system' });
    return null;
  }

  try {
    openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    return openaiClient;
  } catch (error) {
    logger.error('Failed to initialize OpenAI client', { category: 'system', error });
    return null;
  }
}

/**
 * Reset the OpenAI client (useful for testing)
 */
export function resetOpenAIClient(): void {
  openaiClient = null;
}
