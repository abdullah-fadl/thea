/**
 * Language detection utility for Patient Experience module
 * Detects if text is Arabic or English using Unicode range detection
 */

/**
 * Detects the language of a text string
 * @param text - The text to detect language for
 * @returns 'ar' if Arabic characters are found, 'en' otherwise
 */
export function detectLang(text: string): 'ar' | 'en' {
  if (!text || typeof text !== 'string') {
    return 'en'; // Default to English for empty/invalid input
  }

  // Arabic Unicode range: \u0600-\u06FF
  // This includes Arabic, Persian, Urdu, and other languages using Arabic script
  const arabicRegex = /[\u0600-\u06FF]/;
  
  // Check if text contains Arabic characters
  if (arabicRegex.test(text)) {
    return 'ar';
  }
  
  return 'en';
}
