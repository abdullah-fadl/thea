// =============================================================================
// IPSG (International Patient Safety Goals) — Definitions & Checklist Items
// =============================================================================
// Based on JCI International Patient Safety Goals (IPSG 1-6).
// Each goal includes bilingual labels and measurable checklist items.

export interface IpsgChecklistItem {
  id: string;
  en: string;
  ar: string;
}

export interface IpsgGoalDefinition {
  id: string;
  number: number;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  color: string;
  checklistItems: IpsgChecklistItem[];
}

export const IPSG_GOALS: IpsgGoalDefinition[] = [
  {
    id: 'IPSG1',
    number: 1,
    titleEn: 'Identify Patients Correctly',
    titleAr: 'تحديد هوية المرضى بشكل صحيح',
    descriptionEn:
      'Use at least two identifiers when providing care, treatment, or services',
    descriptionAr:
      'استخدام معرّفين على الأقل عند تقديم الرعاية أو العلاج أو الخدمات',
    color: 'blue',
    checklistItems: [
      {
        id: 'ipsg1_1',
        en: 'Two patient identifiers used (name + MRN)',
        ar: 'استخدام معرّفين للمريض (الاسم + رقم الملف الطبي)',
      },
      {
        id: 'ipsg1_2',
        en: 'ID bands on all inpatients',
        ar: 'أساور التعريف على جميع المرضى المنومين',
      },
      {
        id: 'ipsg1_3',
        en: 'Verification before medication administration',
        ar: 'التحقق من الهوية قبل إعطاء الأدوية',
      },
      {
        id: 'ipsg1_4',
        en: 'Verification before blood/blood products transfusion',
        ar: 'التحقق من الهوية قبل نقل الدم ومشتقاته',
      },
      {
        id: 'ipsg1_5',
        en: 'Verification before laboratory specimen collection',
        ar: 'التحقق من الهوية قبل سحب العينات المخبرية',
      },
    ],
  },
  {
    id: 'IPSG2',
    number: 2,
    titleEn: 'Improve Effective Communication',
    titleAr: 'تحسين التواصل الفعّال',
    descriptionEn:
      'Implement procedures for verbal/telephone orders and critical test results reporting',
    descriptionAr:
      'تطبيق إجراءات الأوامر الشفهية والهاتفية والإبلاغ عن النتائج الحرجة',
    color: 'green',
    checklistItems: [
      {
        id: 'ipsg2_1',
        en: 'Read-back for verbal/telephone orders',
        ar: 'إعادة القراءة للأوامر الشفهية والهاتفية',
      },
      {
        id: 'ipsg2_2',
        en: 'SBAR communication tool in use',
        ar: 'استخدام أداة التواصل SBAR',
      },
      {
        id: 'ipsg2_3',
        en: 'Critical results reported within defined timeframe',
        ar: 'الإبلاغ عن النتائج الحرجة ضمن الإطار الزمني المحدد',
      },
      {
        id: 'ipsg2_4',
        en: 'Standardized handoff communication process',
        ar: 'عملية تسليم موحدة بين المناوبات',
      },
      {
        id: 'ipsg2_5',
        en: 'Abbreviation list (Do Not Use) enforced',
        ar: 'تطبيق قائمة الاختصارات الممنوعة',
      },
    ],
  },
  {
    id: 'IPSG3',
    number: 3,
    titleEn: 'Improve Safety of High-Alert Medications',
    titleAr: 'تحسين سلامة الأدوية عالية الخطورة',
    descriptionEn:
      'Develop procedures to manage look-alike/sound-alike medications and high-alert drugs',
    descriptionAr:
      'وضع إجراءات لإدارة الأدوية المتشابهة والأدوية عالية الخطورة',
    color: 'red',
    checklistItems: [
      {
        id: 'ipsg3_1',
        en: 'High-alert medications stored separately and labeled',
        ar: 'الأدوية عالية الخطورة مخزنة بشكل منفصل وموسومة',
      },
      {
        id: 'ipsg3_2',
        en: 'Concentrated electrolytes not on patient care units',
        ar: 'الإلكتروليتات المركزة غير متوفرة في وحدات رعاية المرضى',
      },
      {
        id: 'ipsg3_3',
        en: 'Double-check process for high-alert medications',
        ar: 'التحقق المزدوج للأدوية عالية الخطورة',
      },
      {
        id: 'ipsg3_4',
        en: 'Look-alike/sound-alike (LASA) list maintained and visible',
        ar: 'قائمة الأدوية المتشابهة محدّثة ومرئية',
      },
      {
        id: 'ipsg3_5',
        en: 'Staff awareness training on high-alert medications',
        ar: 'تدريب الموظفين على الأدوية عالية الخطورة',
      },
      {
        id: 'ipsg3_6',
        en: 'Independent verification for infusion pump settings',
        ar: 'التحقق المستقل لإعدادات مضخات التسريب',
      },
    ],
  },
  {
    id: 'IPSG4',
    number: 4,
    titleEn: 'Ensure Safe Surgery',
    titleAr: 'ضمان الجراحة الآمنة',
    descriptionEn:
      'Ensure correct-site, correct-procedure, correct-patient surgery through verification and time-out processes',
    descriptionAr:
      'ضمان صحة الموقع والإجراء والمريض من خلال عمليات التحقق والتوقف الزمني',
    color: 'purple',
    checklistItems: [
      {
        id: 'ipsg4_1',
        en: 'Surgical site marking by operating surgeon',
        ar: 'تحديد موقع الجراحة بواسطة الجراح المسؤول',
      },
      {
        id: 'ipsg4_2',
        en: 'Pre-operative verification process completed',
        ar: 'استكمال عملية التحقق قبل العملية',
      },
      {
        id: 'ipsg4_3',
        en: 'Time-out performed immediately before incision',
        ar: 'تنفيذ التوقف الزمني قبل الشق مباشرة',
      },
      {
        id: 'ipsg4_4',
        en: 'WHO Surgical Safety Checklist completed',
        ar: 'استكمال قائمة تحقق السلامة الجراحية (WHO)',
      },
      {
        id: 'ipsg4_5',
        en: 'Instrument and sponge count verification',
        ar: 'التحقق من عدد الأدوات والإسفنجات',
      },
    ],
  },
  {
    id: 'IPSG5',
    number: 5,
    titleEn: 'Reduce Risk of Healthcare-Associated Infections',
    titleAr: 'تقليل مخاطر العدوى المرتبطة بالرعاية الصحية',
    descriptionEn:
      'Adopt and implement evidence-based hand hygiene guidelines and infection prevention bundles',
    descriptionAr:
      'تبني وتطبيق إرشادات نظافة اليدين القائمة على الأدلة وحزم الوقاية من العدوى',
    color: 'orange',
    checklistItems: [
      {
        id: 'ipsg5_1',
        en: 'Hand hygiene compliance rate monitored (WHO 5 moments)',
        ar: 'مراقبة معدل الالتزام بنظافة اليدين (لحظات WHO الخمس)',
      },
      {
        id: 'ipsg5_2',
        en: 'Isolation precautions implemented correctly',
        ar: 'تطبيق احتياطات العزل بشكل صحيح',
      },
      {
        id: 'ipsg5_3',
        en: 'SSI (Surgical Site Infection) prevention bundle adherence',
        ar: 'الالتزام بحزمة الوقاية من عدوى الموقع الجراحي',
      },
      {
        id: 'ipsg5_4',
        en: 'CLABSI prevention bundle adherence',
        ar: 'الالتزام بحزمة الوقاية من عدوى مجرى الدم المرتبطة بالقسطرة',
      },
      {
        id: 'ipsg5_5',
        en: 'CAUTI prevention bundle adherence',
        ar: 'الالتزام بحزمة الوقاية من عدوى المسالك البولية المرتبطة بالقسطرة',
      },
      {
        id: 'ipsg5_6',
        en: 'VAP prevention bundle adherence',
        ar: 'الالتزام بحزمة الوقاية من الالتهاب الرئوي المرتبط بجهاز التنفس',
      },
    ],
  },
  {
    id: 'IPSG6',
    number: 6,
    titleEn: 'Reduce Risk of Patient Harm from Falls',
    titleAr: 'تقليل مخاطر سقوط المرضى',
    descriptionEn:
      'Implement fall risk assessment and preventive measures for all patients',
    descriptionAr:
      'تطبيق تقييم خطر السقوط والإجراءات الوقائية لجميع المرضى',
    color: 'amber',
    checklistItems: [
      {
        id: 'ipsg6_1',
        en: 'Fall risk assessment completed on admission',
        ar: 'استكمال تقييم خطر السقوط عند الدخول',
      },
      {
        id: 'ipsg6_2',
        en: 'Fall risk reassessment on clinical status change',
        ar: 'إعادة تقييم خطر السقوط عند تغير الحالة السريرية',
      },
      {
        id: 'ipsg6_3',
        en: 'Bed rails raised for high-risk patients',
        ar: 'رفع حواجز السرير للمرضى عالي الخطورة',
      },
      {
        id: 'ipsg6_4',
        en: 'Call bells within patient reach',
        ar: 'أجراس الاستدعاء في متناول المريض',
      },
      {
        id: 'ipsg6_5',
        en: 'Non-slip footwear provided',
        ar: 'توفير أحذية مانعة للانزلاق',
      },
      {
        id: 'ipsg6_6',
        en: 'Environmental safety measures (wet floor signs, adequate lighting)',
        ar: 'تدابير السلامة البيئية (لافتات الأرضية الرطبة، إضاءة كافية)',
      },
    ],
  },
];

/**
 * Get the IPSG goal definition by number (1-6).
 */
export function getIpsgGoal(num: number): IpsgGoalDefinition | undefined {
  return IPSG_GOALS.find((g) => g.number === num);
}

/**
 * Get all IPSG goal numbers.
 */
export function getIpsgNumbers(): number[] {
  return IPSG_GOALS.map((g) => g.number);
}

/**
 * Standard periods for IPSG assessments.
 */
export function generatePeriodOptions(): { value: string; labelEn: string; labelAr: string }[] {
  const now = new Date();
  const year = now.getFullYear();
  const options: { value: string; labelEn: string; labelAr: string }[] = [];

  // Current and previous 4 quarters
  for (let offset = 0; offset < 5; offset++) {
    const qYear = year - Math.floor(offset / 4);
    const q = 4 - (offset % 4);
    const adjustedQ = q > 4 ? q - 4 : q;
    const adjustedYear = adjustedQ === q ? qYear : qYear - 1;
    // Simple approach: just generate from current quarter backward
    const actualQuarter = Math.ceil((now.getMonth() + 1) / 3) - offset;
    let finalQ = actualQuarter;
    let finalYear = year;
    while (finalQ <= 0) {
      finalQ += 4;
      finalYear--;
    }
    const val = `${finalYear}-Q${finalQ}`;
    options.push({
      value: val,
      labelEn: `${finalYear} Q${finalQ}`,
      labelAr: `${finalYear} الربع ${finalQ}`,
    });
  }

  return options;
}

/**
 * Score color classification.
 */
export function getScoreColor(score: number | null | undefined): string {
  if (score == null) return 'gray';
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

/**
 * Score label (bilingual).
 */
export function getScoreLabel(
  score: number | null | undefined,
  lang: 'ar' | 'en'
): string {
  if (score == null) return lang === 'ar' ? 'غير مقيّم' : 'Not Assessed';
  if (score >= 80) return lang === 'ar' ? 'ممتاز' : 'Excellent';
  if (score >= 60) return lang === 'ar' ? 'يحتاج تحسين' : 'Needs Improvement';
  return lang === 'ar' ? 'غير مقبول' : 'Unacceptable';
}

/** Action item status types */
export const ACTION_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface ActionItem {
  ipsg: number;
  finding: string;
  action: string;
  responsible: string;
  dueDate: string;
  status: ActionStatus;
}

export interface IpsgFindingItem {
  item: string;
  itemId: string;
  compliant: boolean;
  notes: string;
}
