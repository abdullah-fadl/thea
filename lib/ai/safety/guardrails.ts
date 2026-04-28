/**
 * AI Safety Guardrails
 *
 * Ensures all AI output includes proper disclaimers, never diagnoses,
 * always shows confidence, and requires physician action.
 *
 * CRITICAL: These rules are non-negotiable for any clinical AI feature.
 */

import type { BilingualText } from '../providers/types';

// ---------------------------------------------------------------------------
// Safety Rules
// ---------------------------------------------------------------------------

export const SAFETY_RULES = {
  /** ALWAYS include a disclaimer on AI output */
  disclaimer: {
    ar: 'هذه اقتراحات مساعدة فقط — القرار الطبي النهائي يعود للطبيب المعالج',
    en: 'AI-assisted suggestions only — final clinical decisions rest with the treating physician',
  } as BilingualText,

  /** NEVER diagnose — AI suggests, physician decides */
  neverDiagnose: true,

  /** ALWAYS show confidence level */
  showConfidence: true,

  /** REQUIRE physician action to act on any suggestion */
  requirePhysicianAction: true,

  /** LOG all AI interactions for audit */
  auditLog: true,

  /** ALLOW physician to dismiss/override all suggestions */
  alwaysOverridable: true,
} as const;

// ---------------------------------------------------------------------------
// Content Validation
// ---------------------------------------------------------------------------

/**
 * Words and phrases that should NEVER appear in AI output
 * because they imply definitive diagnosis.
 */
const FORBIDDEN_PHRASES_EN = [
  'you have',
  'you are diagnosed with',
  'this confirms',
  'this is definitely',
  'the patient has',
  'definitive diagnosis',
  'confirmed diagnosis',
  'i diagnose',
  'the diagnosis is',
  'prescribe',
  'you should take',
  'start treatment',
  'begin medication',
];

const FORBIDDEN_PHRASES_AR = [
  'أنت مصاب بـ',
  'التشخيص النهائي',
  'تشخيص مؤكد',
  'يجب عليك تناول',
  'ابدأ العلاج',
];

/**
 * Sanitize AI output to ensure it doesn't contain diagnostic language.
 * Returns the original text if clean, or a sanitized version.
 */
export function sanitizeAIOutput(text: string): { text: string; sanitized: boolean } {
  let sanitized = false;
  let result = text;

  for (const phrase of FORBIDDEN_PHRASES_EN) {
    const regex = new RegExp(phrase, 'gi');
    if (regex.test(result)) {
      result = result.replace(regex, '[suggestion removed]');
      sanitized = true;
    }
  }

  for (const phrase of FORBIDDEN_PHRASES_AR) {
    if (result.includes(phrase)) {
      result = result.replace(new RegExp(phrase, 'g'), '[تمت إزالة الاقتراح]');
      sanitized = true;
    }
  }

  return { text: result, sanitized };
}

/**
 * Ensure response is framed as suggestion, never diagnosis.
 * Prepends softening language if the response sounds too definitive.
 */
export function ensureSuggestiveLanguage(text: string, lang: 'ar' | 'en' = 'en'): string {
  const definitivePrefixes = [
    /^the patient (has|is|shows|presents)/i,
    /^this (confirms|indicates|proves)/i,
    /^diagnosis:/i,
  ];

  for (const pattern of definitivePrefixes) {
    if (pattern.test(text.trim())) {
      const prefix = lang === 'ar'
        ? 'بناءً على البيانات المتاحة، قد يشير هذا إلى '
        : 'Based on available data, findings may be suggestive of ';
      return prefix + text.charAt(0).toLowerCase() + text.slice(1);
    }
  }

  return text;
}

// ---------------------------------------------------------------------------
// Output Wrapping
// ---------------------------------------------------------------------------

/**
 * Wrap any AI output with safety context.
 */
export function wrapWithSafety<T extends Record<string, unknown>>(
  output: T,
  lang: 'ar' | 'en' = 'en',
): T & { disclaimer: string; safetyApplied: true } {
  return {
    ...output,
    disclaimer: SAFETY_RULES.disclaimer[lang],
    safetyApplied: true as const,
  };
}

/**
 * Validate that AI output includes required safety fields.
 */
export function validateSafeOutput(output: Record<string, unknown>): boolean {
  return (
    typeof output.disclaimer === 'string' &&
    output.disclaimer.length > 0
  );
}
