// =============================================================================
// Radiation Therapy Definitions & Constants
// =============================================================================
// Bilingual (Arabic/English) constants for the Radiation Therapy module.

export interface BilingualOption {
  value: string;
  labelEn: string;
  labelAr: string;
  description?: string;
}

export interface FractionationScheme {
  name: string;
  site: string;
  totalDoseGy: number;
  fractions: number;
  dosePerFraction: number;
  technique: string;
}

export interface OARConstraint {
  organ: string;
  constraint: string;
  limit: string;
}

// ---------------------------------------------------------------------------
// RT Techniques
// ---------------------------------------------------------------------------
export const RT_TECHNIQUES: BilingualOption[] = [
  { value: 'IMRT', labelEn: 'IMRT', labelAr: 'IMRT - معدلة الشدة', description: 'Intensity-Modulated Radiation Therapy' },
  { value: 'VMAT', labelEn: 'VMAT', labelAr: 'VMAT - القوس الحجمي', description: 'Volumetric Modulated Arc Therapy' },
  { value: '3DCRT', labelEn: '3D-CRT', labelAr: '3D-CRT - ثلاثية الأبعاد', description: '3D Conformal Radiation Therapy' },
  { value: 'SRS', labelEn: 'SRS', labelAr: 'SRS - الجراحة الإشعاعية', description: 'Stereotactic Radiosurgery' },
  { value: 'SBRT', labelEn: 'SBRT', labelAr: 'SBRT - الجسم التجسيمي', description: 'Stereotactic Body Radiation Therapy' },
  { value: 'PROTON', labelEn: 'Proton Therapy', labelAr: 'العلاج بالبروتون', description: 'Proton Beam Therapy' },
  { value: 'ELECTRON', labelEn: 'Electron Beam', labelAr: 'شعاع الإلكترون', description: 'Electron Beam Therapy' },
  { value: 'BRACHY', labelEn: 'Brachytherapy', labelAr: 'المعالجة الكثبية', description: 'Internal Radiation Therapy' },
];

// ---------------------------------------------------------------------------
// RT Intents
// ---------------------------------------------------------------------------
export const RT_INTENTS: BilingualOption[] = [
  { value: 'CURATIVE', labelEn: 'Curative', labelAr: 'علاجي' },
  { value: 'PALLIATIVE', labelEn: 'Palliative', labelAr: 'تلطيفي' },
  { value: 'ADJUVANT', labelEn: 'Adjuvant', labelAr: 'مساعد' },
  { value: 'NEOADJUVANT', labelEn: 'Neoadjuvant', labelAr: 'مساعد قبل الجراحة' },
];

// ---------------------------------------------------------------------------
// RT Frequencies
// ---------------------------------------------------------------------------
export const RT_FREQUENCIES: BilingualOption[] = [
  { value: 'DAILY_5', labelEn: 'Daily (Mon-Fri)', labelAr: 'يومي (الإثنين-الجمعة)', description: '5 fractions per week' },
  { value: 'BID', labelEn: 'Twice Daily', labelAr: 'مرتين يومياً', description: '2 fractions per day' },
  { value: 'WEEKLY', labelEn: 'Weekly', labelAr: 'أسبوعي', description: '1 fraction per week' },
  { value: 'HYPO', labelEn: 'Hypofractionated', labelAr: 'ناقص التجزئة', description: 'Every other day or custom schedule' },
];

// ---------------------------------------------------------------------------
// Setup Verification Methods
// ---------------------------------------------------------------------------
export const SETUP_VERIFICATIONS: BilingualOption[] = [
  { value: 'CBCT', labelEn: 'CBCT', labelAr: 'CBCT - التصوير المقطعي المخروطي' },
  { value: 'KV', labelEn: 'kV Imaging', labelAr: 'تصوير kV' },
  { value: 'PORTAL', labelEn: 'Portal Imaging', labelAr: 'تصوير البوابة' },
  { value: 'NONE', labelEn: 'None', labelAr: 'لا يوجد' },
];

// ---------------------------------------------------------------------------
// Skin Reactions (CTCAE Grading)
// ---------------------------------------------------------------------------
export const SKIN_REACTIONS: BilingualOption[] = [
  { value: 'NONE', labelEn: 'None', labelAr: 'لا يوجد', description: 'No skin reaction' },
  { value: 'GRADE1', labelEn: 'Grade 1 - Faint erythema', labelAr: 'الدرجة 1 - حمامى خفيفة', description: 'Faint erythema or dry desquamation' },
  { value: 'GRADE2', labelEn: 'Grade 2 - Moderate erythema', labelAr: 'الدرجة 2 - حمامى متوسطة', description: 'Moderate to brisk erythema; patchy moist desquamation' },
  { value: 'GRADE3', labelEn: 'Grade 3 - Moist desquamation', labelAr: 'الدرجة 3 - تقشر رطب', description: 'Moist desquamation in areas other than skin folds; bleeding induced by minor trauma' },
  { value: 'GRADE4', labelEn: 'Grade 4 - Necrosis/ulceration', labelAr: 'الدرجة 4 - نخر/تقرح', description: 'Life-threatening; skin necrosis or ulceration of full thickness dermis' },
];

// ---------------------------------------------------------------------------
// Patient Tolerance
// ---------------------------------------------------------------------------
export const PATIENT_TOLERANCE: BilingualOption[] = [
  { value: 'GOOD', labelEn: 'Good', labelAr: 'جيد' },
  { value: 'FAIR', labelEn: 'Fair', labelAr: 'مقبول' },
  { value: 'POOR', labelEn: 'Poor', labelAr: 'ضعيف' },
];

// ---------------------------------------------------------------------------
// Session Status
// ---------------------------------------------------------------------------
export const SESSION_STATUS: BilingualOption[] = [
  { value: 'COMPLETED', labelEn: 'Completed', labelAr: 'مكتمل' },
  { value: 'MISSED', labelEn: 'Missed', labelAr: 'فائت' },
  { value: 'CANCELLED', labelEn: 'Cancelled', labelAr: 'ملغي' },
];

// ---------------------------------------------------------------------------
// Plan Status
// ---------------------------------------------------------------------------
export const PLAN_STATUS: BilingualOption[] = [
  { value: 'PLANNED', labelEn: 'Planned', labelAr: 'مخطط' },
  { value: 'IN_PROGRESS', labelEn: 'In Progress', labelAr: 'قيد التنفيذ' },
  { value: 'COMPLETED', labelEn: 'Completed', labelAr: 'مكتمل' },
  { value: 'SUSPENDED', labelEn: 'Suspended', labelAr: 'معلق' },
  { value: 'CANCELLED', labelEn: 'Cancelled', labelAr: 'ملغي' },
];

// ---------------------------------------------------------------------------
// Standard Fractionation Schemes
// ---------------------------------------------------------------------------
export const STANDARD_SCHEMES: FractionationScheme[] = [
  { name: 'Breast Standard', site: 'Breast', totalDoseGy: 50, fractions: 25, dosePerFraction: 2.0, technique: 'IMRT' },
  { name: 'Breast Hypo', site: 'Breast', totalDoseGy: 40, fractions: 15, dosePerFraction: 2.67, technique: 'IMRT' },
  { name: 'Prostate Standard', site: 'Prostate', totalDoseGy: 78, fractions: 39, dosePerFraction: 2.0, technique: 'VMAT' },
  { name: 'Prostate SBRT', site: 'Prostate', totalDoseGy: 36.25, fractions: 5, dosePerFraction: 7.25, technique: 'SBRT' },
  { name: 'Brain Whole', site: 'Brain', totalDoseGy: 30, fractions: 10, dosePerFraction: 3.0, technique: '3DCRT' },
  { name: 'Brain SRS', site: 'Brain', totalDoseGy: 24, fractions: 1, dosePerFraction: 24.0, technique: 'SRS' },
  { name: 'H&N Definitive', site: 'Head & Neck', totalDoseGy: 70, fractions: 35, dosePerFraction: 2.0, technique: 'IMRT' },
  { name: 'Lung SBRT', site: 'Lung', totalDoseGy: 54, fractions: 3, dosePerFraction: 18.0, technique: 'SBRT' },
  { name: 'Palliative Bone', site: 'Bone', totalDoseGy: 30, fractions: 10, dosePerFraction: 3.0, technique: '3DCRT' },
  { name: 'Palliative Bone Single', site: 'Bone', totalDoseGy: 8, fractions: 1, dosePerFraction: 8.0, technique: '3DCRT' },
  { name: 'Rectal Neoadjuvant', site: 'Rectum', totalDoseGy: 50.4, fractions: 28, dosePerFraction: 1.8, technique: 'IMRT' },
  { name: 'Cervix Definitive', site: 'Cervix', totalDoseGy: 50, fractions: 25, dosePerFraction: 2.0, technique: 'IMRT' },
];

// ---------------------------------------------------------------------------
// OAR Constraints by Target Site
// ---------------------------------------------------------------------------
export const OAR_CONSTRAINTS: Record<string, OARConstraint[]> = {
  'Breast': [
    { organ: 'Heart', constraint: 'Mean dose', limit: '<4 Gy' },
    { organ: 'Lung ipsilateral', constraint: 'V20', limit: '<30%' },
    { organ: 'Contralateral breast', constraint: 'Mean dose', limit: '<3 Gy' },
  ],
  'Prostate': [
    { organ: 'Rectum', constraint: 'V70', limit: '<15%' },
    { organ: 'Bladder', constraint: 'V65', limit: '<25%' },
    { organ: 'Femoral heads', constraint: 'V50', limit: '<5%' },
  ],
  'Brain': [
    { organ: 'Brainstem', constraint: 'Max dose', limit: '<54 Gy' },
    { organ: 'Optic chiasm', constraint: 'Max dose', limit: '<55 Gy' },
    { organ: 'Eyes', constraint: 'Mean dose', limit: '<35 Gy' },
    { organ: 'Cochlea', constraint: 'Mean dose', limit: '<45 Gy' },
  ],
  'Head & Neck': [
    { organ: 'Parotid (contralateral)', constraint: 'Mean dose', limit: '<26 Gy' },
    { organ: 'Spinal cord', constraint: 'Max dose', limit: '<45 Gy' },
    { organ: 'Brainstem', constraint: 'Max dose', limit: '<54 Gy' },
    { organ: 'Mandible', constraint: 'Max dose', limit: '<70 Gy' },
  ],
  'Lung': [
    { organ: 'Lung (total)', constraint: 'V20', limit: '<35%' },
    { organ: 'Lung (total)', constraint: 'Mean dose', limit: '<20 Gy' },
    { organ: 'Spinal cord', constraint: 'Max dose', limit: '<45 Gy' },
    { organ: 'Heart', constraint: 'Mean dose', limit: '<26 Gy' },
    { organ: 'Esophagus', constraint: 'Mean dose', limit: '<34 Gy' },
  ],
  'Bone': [
    { organ: 'Spinal cord', constraint: 'Max dose', limit: '<45 Gy' },
  ],
  'Rectum': [
    { organ: 'Small bowel', constraint: 'V45', limit: '<195 cc' },
    { organ: 'Bladder', constraint: 'V50', limit: '<50%' },
    { organ: 'Femoral heads', constraint: 'V50', limit: '<5%' },
  ],
  'Cervix': [
    { organ: 'Small bowel', constraint: 'V45', limit: '<195 cc' },
    { organ: 'Rectum', constraint: 'V50', limit: '<50%' },
    { organ: 'Bladder', constraint: 'V50', limit: '<50%' },
    { organ: 'Femoral heads', constraint: 'V50', limit: '<5%' },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calculate estimated end date based on start date, fractions, and frequency */
export function calculateEstimatedEndDate(
  startDate: Date,
  totalFractions: number,
  frequency: string,
): Date {
  const d = new Date(startDate);
  switch (frequency) {
    case 'DAILY_5': {
      // 5 fractions per week (Mon-Fri)
      const weeks = Math.floor(totalFractions / 5);
      const remaining = totalFractions % 5;
      d.setDate(d.getDate() + weeks * 7 + remaining - 1);
      return d;
    }
    case 'BID': {
      // 2 fractions per day, 5 days per week
      const days = Math.ceil(totalFractions / 2);
      const weeks = Math.floor(days / 5);
      const remaining = days % 5;
      d.setDate(d.getDate() + weeks * 7 + remaining - 1);
      return d;
    }
    case 'WEEKLY': {
      d.setDate(d.getDate() + (totalFractions - 1) * 7);
      return d;
    }
    case 'HYPO': {
      // Every other day (assumes ~3 per week)
      d.setDate(d.getDate() + (totalFractions - 1) * 2);
      return d;
    }
    default: {
      // Default: assume daily weekday
      const weeks = Math.floor(totalFractions / 5);
      const remaining = totalFractions % 5;
      d.setDate(d.getDate() + weeks * 7 + remaining - 1);
      return d;
    }
  }
}

/** Get bilingual label for a value from a list of options */
export function getOptionLabel(
  options: BilingualOption[],
  value: string,
  language: 'ar' | 'en',
): string {
  const opt = options.find((o) => o.value === value);
  if (!opt) return value;
  return language === 'ar' ? opt.labelAr : opt.labelEn;
}
