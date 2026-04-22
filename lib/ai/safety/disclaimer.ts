/**
 * AI Disclaimer Management
 *
 * Auto-generates appropriate disclaimers for all AI-generated content.
 * Disclaimers are context-specific (lab, radiology, clinical, etc.).
 */

import type { BilingualText } from '../providers/types';

// ---------------------------------------------------------------------------
// Disclaimer Templates
// ---------------------------------------------------------------------------

export type DisclaimerContext =
  | 'lab'
  | 'radiology'
  | 'clinical'
  | 'drug'
  | 'summary'
  | 'general';

const DISCLAIMERS: Record<DisclaimerContext, BilingualText> = {
  lab: {
    ar: 'تفسير مساعد بالذكاء الاصطناعي — لا يُغني عن التقييم السريري من قبل الطبيب أو أخصائي المختبر. يجب التحقق من النتائج والربط مع الحالة السريرية.',
    en: 'AI-assisted interpretation — does not replace clinical assessment by a physician or lab specialist. Results must be verified and correlated with clinical context.',
  },
  radiology: {
    ar: 'مساعد تقرير أشعة بالذكاء الاصطناعي — الملاحظات اقتراحية فقط. التقرير النهائي والتفسير يعود لأخصائي الأشعة.',
    en: 'AI radiology report assistant — findings are suggestive only. Final report and interpretation rests with the radiologist.',
  },
  clinical: {
    ar: 'تنبيه دعم القرار السريري — اقتراح مبني على البيانات المتاحة. القرار الطبي النهائي يعود للطبيب المعالج.',
    en: 'Clinical decision support alert — suggestion based on available data. Final medical decisions rest with the treating physician.',
  },
  drug: {
    ar: 'فحص تفاعلات دوائية بالذكاء الاصطناعي — يجب مراجعة التفاعلات مع الصيدلي أو الطبيب المعالج قبل وصف الدواء.',
    en: 'AI drug interaction check — interactions must be reviewed with a pharmacist or treating physician before prescribing.',
  },
  summary: {
    ar: 'ملخص مريض مُنشأ بالذكاء الاصطناعي — قد لا يتضمن جميع المعلومات ذات الصلة. يرجى مراجعة الملف الطبي الكامل.',
    en: 'AI-generated patient summary — may not include all relevant information. Please review the complete medical record.',
  },
  general: {
    ar: 'هذه اقتراحات مساعدة بالذكاء الاصطناعي فقط — القرار الطبي النهائي يعود للطبيب المعالج.',
    en: 'AI-assisted suggestions only — final clinical decisions rest with the treating physician.',
  },
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Get the appropriate disclaimer for a given context.
 */
export function getDisclaimer(
  context: DisclaimerContext,
  lang: 'ar' | 'en' = 'en',
): string {
  return DISCLAIMERS[context]?.[lang] || DISCLAIMERS.general[lang];
}

/**
 * Get bilingual disclaimer.
 */
export function getBilingualDisclaimer(context: DisclaimerContext): BilingualText {
  return DISCLAIMERS[context] || DISCLAIMERS.general;
}

/**
 * Append disclaimer to any text content.
 */
export function appendDisclaimer(
  text: string,
  context: DisclaimerContext,
  lang: 'ar' | 'en' = 'en',
): string {
  const disclaimer = getDisclaimer(context, lang);
  const separator = lang === 'ar' ? '\n\n[MEDICAL] ' : '\n\n[MEDICAL] ';
  return text + separator + disclaimer;
}

/**
 * Build the standard footer for AI-generated reports.
 */
export function buildReportFooter(
  context: DisclaimerContext,
  lang: 'ar' | 'en' = 'en',
): string {
  const disclaimer = getDisclaimer(context, lang);
  const timestamp = new Date().toISOString();

  if (lang === 'ar') {
    return [
      '─'.repeat(50),
      `[MEDICAL] ${disclaimer}`,
      `[AI] تم الإنشاء بمساعدة الذكاء الاصطناعي — ${timestamp}`,
    ].join('\n');
  }

  return [
    '─'.repeat(50),
    `[MEDICAL] ${disclaimer}`,
    `[AI] AI-assisted generation — ${timestamp}`,
  ].join('\n');
}
