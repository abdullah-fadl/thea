/**
 * Translation utility for Patient Experience module
 * Translates Arabic text to English for dashboard consistency
 * Supports OpenAI translation provider (server-side only)
 */

import { getOpenAI } from '@/lib/openai/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/monitoring/logger';

type TranslationProvider = 'none' | 'openai';

/**
 * Translates text to English
 * @param text - The text to translate
 * @param sourceLang - The source language ('ar' or 'en')
 * @returns Promise<string> - The English translation (or original if already English or no provider)
 */
export async function translateToEnglish(
  text: string,
  sourceLang: 'ar' | 'en'
): Promise<string> {
  // If already English, return as-is
  if (sourceLang === 'en') {
    return text.trim();
  }

  // If empty text, return empty
  if (!text || !text.trim()) {
    return text.trim();
  }

  // Guard: Skip translation for very short text (< 6 chars) to avoid unnecessary API calls
  const trimmedText = text.trim();
  if (trimmedText.length < 6) {
    return trimmedText;
  }

  // Get translation provider from environment
  const provider = env.TRANSLATION_PROVIDER as TranslationProvider;

  // If provider is 'none', use fallback (return original text but store in detailsEn)
  if (provider === 'none') {
    // Fallback: return original text (will be stored in detailsEn for consistency)
    // This ensures dashboard always uses detailsEn field, even if it contains Arabic
    return trimmedText;
  }

  // OpenAI provider
  if (provider === 'openai') {
    try {
      const openai = getOpenAI();
      
      if (!openai) {
        logger.warn('OpenAI client not available, using fallback translation', { category: 'system' });
        return trimmedText;
      }

      // Get model from env or use default
      const model = env.OPENAI_TRANSLATION_MODEL;

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Translate Arabic to English. Output ONLY English translation. Preserve clinical terms. No extra text.',
          },
          {
            role: 'user',
            content: trimmedText,
          },
        ],
        temperature: 0, // Use 0 for consistent, deterministic translations
        max_tokens: 1000,
      });

      const translatedText = completion.choices?.[0]?.message?.content?.trim();
      
      if (translatedText) {
        return translatedText;
      }
      
      // Fallback if response format is unexpected
      logger.warn('Unexpected OpenAI response format, using fallback', { category: 'system' });
      return trimmedText;
    } catch (error: any) {
      logger.error('Translation error', { category: 'system', error });
      // Fallback to original text on error
      return trimmedText;
    }
  }

  // Unknown provider, use fallback
  logger.warn('Unknown translation provider, using fallback', { category: 'system', provider });
  return trimmedText;
}
