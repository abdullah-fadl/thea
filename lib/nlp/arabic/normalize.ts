import { isEnabled } from '@/lib/core/flags';

// U+0640 ARABIC TATWEEL (kashida)
const TATWEEL = /\u0640/g;

// Harakat: U+064B–U+065F + U+0610–U+061A + U+0670 superscript alef
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670]/g;

// Alef variants: أ إ آ ٱ ٲ ٳ ٵ → ا
const ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g;

// Alef maqsura ى → yaa ي
const ALEF_MAQSURA = /\u0649/g;

// Taa marbuta ة → haa ه (Saudi colloquial)
const TAA_MARBUTA = /\u0629/g;

// Arabic-Indic digits ٠١٢٣٤٥٦٧٨٩ (U+0660–U+0669)
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;

// Multiple whitespace
const MULTI_SPACE = /\s+/g;

/**
 * Normalizes Arabic text for consistent NLP processing.
 *
 * When FF_ARABIC_NLP_ENABLED is OFF, returns lowercased + trimmed text only (passthrough).
 * Pure function. Idempotent.
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';

  if (!isEnabled('FF_ARABIC_NLP_ENABLED')) {
    return text.toLowerCase().trim();
  }

  return text
    .replace(TATWEEL, '')
    .replace(DIACRITICS, '')
    .replace(ALEF_VARIANTS, '\u0627')   // → ا
    .replace(ALEF_MAQSURA, '\u064A')   // → ي
    .replace(TAA_MARBUTA, '\u0647')    // → ه
    .replace(ARABIC_INDIC_DIGITS, (ch) =>
      String.fromCharCode(ch.codePointAt(0)! - 0x0660 + 48)
    )
    .replace(MULTI_SPACE, ' ')
    .trim();
}
