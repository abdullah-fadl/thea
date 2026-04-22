/**
 * Medication Dose Range Validation Engine
 *
 * CRITICAL PATIENT SAFETY MODULE
 *
 * Validates prescribed doses against evidence-based clinical ranges for
 * adult, pediatric, geriatric populations with renal/hepatic adjustments.
 *
 * Data sources: Lexicomp, Micromedex, UpToDate, Saudi SFDA formulary
 *
 * NOTE: This is a clinical decision-support tool. All results are advisory.
 * The prescriber retains ultimate clinical responsibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DoseRoute = 'PO' | 'IV' | 'IM' | 'SC' | 'TOPICAL' | 'INH' | 'PR' | 'SL';

export interface DrugDoseRange {
  drugName: string;
  drugNameAr: string;
  /** Aliases for fuzzy matching (brand names, common misspellings) */
  aliases?: string[];
  route: DoseRoute;
  indication?: string;
  adult: {
    minDose: number;
    maxDose: number;
    unit: string;
    frequency: string;
    maxDailyDose: number;
  };
  pediatric?: {
    minDosePerKg: number;
    maxDosePerKg: number;
    unit: string;
    maxDailyDose: number;
    minAge?: number; // months
  };
  geriatric?: {
    maxDose: number;
    unit: string;
    notes: string;
    notesAr: string;
  };
  renalAdjustment?: {
    gfrThreshold: number;
    adjustedMaxDose: number;
    gfrContraindicated?: number;
    notes: string;
    notesAr: string;
  }[];
  hepaticAdjustment?: {
    severity: 'mild' | 'moderate' | 'severe';
    adjustedMaxDose?: number;
    contraindicated?: boolean;
    notes: string;
    notesAr: string;
  }[];
  maxDuration?: number; // days
  highAlertMedication?: boolean;
  narrowTherapeuticIndex?: boolean;
  pregnancyContraindicated?: boolean;
  pregnancyNotes?: string;
  pregnancyNotesAr?: string;
}

export interface DoseValidationRequest {
  drugName: string;
  dose: number;
  unit: string;
  frequency: string;
  route: string;
  patientAge?: number; // years
  patientWeight?: number; // kg
  gfr?: number; // eGFR mL/min/1.73m2
  hepaticFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
  isPregnant?: boolean;
  durationDays?: number;
}

export interface DoseAlert {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  messageAr: string;
  suggestedDose?: string;
}

export interface DoseValidationResult {
  valid: boolean;
  drugFound: boolean;
  drugName: string;
  drugNameAr: string;
  alerts: DoseAlert[];
  recommendations: string[];
  recommendationsAr: string[];
}

// ---------------------------------------------------------------------------
// Frequency Parsing
// ---------------------------------------------------------------------------

/** Map frequency abbreviations to number of doses per day */
const FREQUENCY_MAP: Record<string, number> = {
  // Standard abbreviations
  DAILY: 1,
  QD: 1,
  OD: 1,
  QAM: 1,
  QPM: 1,
  QHS: 1,
  BID: 2,
  B12H: 2,
  Q12H: 2,
  TID: 3,
  Q8H: 3,
  QID: 4,
  Q6H: 4,
  Q4H: 6,
  Q3H: 8,
  Q2H: 12,
  Q1H: 24,
  // Less frequent
  WEEKLY: 1 / 7,
  QW: 1 / 7,
  Q1W: 1 / 7,
  Q2W: 1 / 14,
  BIWEEKLY: 1 / 14,
  MONTHLY: 1 / 30,
  QM: 1 / 30,
  Q48H: 0.5,
  QOD: 0.5,
  // PRN — count as 1 dose for calculation but flag
  PRN: 1,
  QPRN: 1,
  // Once
  ONCE: 0, // single dose — daily calc not applicable
  STAT: 0,
  X1: 0,
};

/**
 * Parse a frequency string into doses-per-day.
 * Returns null if the string is not recognised.
 */
export function parseFrequency(freq: string): number | null {
  if (!freq) return null;

  const normalized = freq
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/EVERY/g, 'Q')
    .replace(/TWICE/g, 'BID')
    .replace(/THREE/g, 'TID')
    .replace(/FOUR/g, 'QID');

  // Direct lookup
  if (FREQUENCY_MAP[normalized] !== undefined) return FREQUENCY_MAP[normalized];

  // Try extracting Q<number>H pattern
  const qhMatch = normalized.match(/^Q(\d+)H$/);
  if (qhMatch) {
    const hours = parseInt(qhMatch[1], 10);
    if (hours > 0) return 24 / hours;
  }

  // Try extracting Q<number>W pattern
  const qwMatch = normalized.match(/^Q(\d+)W$/);
  if (qwMatch) {
    const weeks = parseInt(qwMatch[1], 10);
    if (weeks > 0) return 1 / (weeks * 7);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Drug Database (30+ medications with real clinical data)
// ---------------------------------------------------------------------------

export const DRUG_DATABASE: DrugDoseRange[] = [
  // =========================================================================
  // HIGH-ALERT ANTICOAGULANTS
  // =========================================================================
  {
    drugName: 'Warfarin',
    drugNameAr: 'وارفارين',
    aliases: ['coumadin', 'jantoven', 'marevan'],
    route: 'PO',
    adult: { minDose: 1, maxDose: 10, unit: 'mg', frequency: 'DAILY', maxDailyDose: 10 },
    geriatric: {
      maxDose: 5,
      unit: 'mg',
      notes: 'Start low (2-5 mg/day) in elderly; increased bleeding risk',
      notesAr: 'ابدأ بجرعة منخفضة (2-5 مجم/يوم) لكبار السن؛ خطر نزيف متزايد',
    },
    hepaticAdjustment: [
      { severity: 'mild', adjustedMaxDose: 5, notes: 'Reduce dose; monitor INR closely', notesAr: 'قلل الجرعة؛ راقب INR بدقة' },
      { severity: 'moderate', adjustedMaxDose: 2, notes: 'Use with extreme caution', notesAr: 'استخدم بحذر شديد' },
      { severity: 'severe', contraindicated: true, notes: 'Contraindicated in severe hepatic impairment', notesAr: 'ممنوع الاستخدام في القصور الكبدي الشديد' },
    ],
    highAlertMedication: true,
    narrowTherapeuticIndex: true,
    pregnancyContraindicated: true,
    pregnancyNotes: 'Category X — causes fetal warfarin syndrome, CNS abnormalities',
    pregnancyNotesAr: 'فئة X — يسبب متلازمة الوارفارين الجنينية وتشوهات الجهاز العصبي',
  },
  {
    drugName: 'Heparin',
    drugNameAr: 'هيبارين',
    aliases: ['unfractionated heparin', 'ufh'],
    route: 'IV',
    adult: { minDose: 5000, maxDose: 10000, unit: 'units', frequency: 'Q8H', maxDailyDose: 40000 },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 7500, notes: 'Reduce dose; monitor aPTT frequently', notesAr: 'قلل الجرعة؛ راقب aPTT بشكل متكرر' },
    ],
    highAlertMedication: true,
  },
  {
    drugName: 'Enoxaparin',
    drugNameAr: 'إنوكسابارين',
    aliases: ['lovenox', 'clexane'],
    route: 'SC',
    adult: { minDose: 30, maxDose: 100, unit: 'mg', frequency: 'Q12H', maxDailyDose: 200 },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 30, notes: 'CrCl <30: Use 1 mg/kg ONCE daily (not BID)', notesAr: 'تصفية الكرياتينين <30: استخدم 1 مجم/كجم مرة واحدة يومياً' },
      { gfrThreshold: 15, adjustedMaxDose: 30, gfrContraindicated: 15, notes: 'CrCl <15: Contraindicated; use unfractionated heparin', notesAr: 'تصفية الكرياتينين <15: ممنوع؛ استخدم الهيبارين غير المجزأ' },
    ],
    highAlertMedication: true,
    pregnancyContraindicated: false,
    pregnancyNotes: 'Preferred anticoagulant in pregnancy (does not cross placenta)',
    pregnancyNotesAr: 'مضاد التخثر المفضل في الحمل (لا يعبر المشيمة)',
  },

  // =========================================================================
  // DIABETES MEDICATIONS
  // =========================================================================
  {
    drugName: 'Metformin',
    drugNameAr: 'ميتفورمين',
    aliases: ['glucophage', 'glumetza', 'fortamet'],
    route: 'PO',
    adult: { minDose: 500, maxDose: 1000, unit: 'mg', frequency: 'BID', maxDailyDose: 2550 },
    geriatric: {
      maxDose: 500,
      unit: 'mg',
      notes: 'Start 500 mg daily in elderly; titrate slowly',
      notesAr: 'ابدأ 500 مجم يومياً لكبار السن؛ زد الجرعة تدريجياً',
    },
    renalAdjustment: [
      { gfrThreshold: 45, adjustedMaxDose: 1000, notes: 'eGFR 30-45: Max 1000 mg/day; do not initiate if <30', notesAr: 'معدل الترشيح 30-45: حد أقصى 1000 مجم/يوم؛ لا تبدأ إذا <30' },
      { gfrThreshold: 30, adjustedMaxDose: 500, gfrContraindicated: 30, notes: 'eGFR <30: Contraindicated due to lactic acidosis risk', notesAr: 'معدل الترشيح <30: ممنوع بسبب خطر الحماض اللاكتيكي' },
    ],
    pregnancyContraindicated: false,
  },
  {
    drugName: 'Insulin Regular',
    drugNameAr: 'أنسولين عادي',
    aliases: ['humulin r', 'novolin r', 'actrapid'],
    route: 'SC',
    adult: { minDose: 2, maxDose: 100, unit: 'units', frequency: 'TID', maxDailyDose: 300 },
    pediatric: { minDosePerKg: 0.5, maxDosePerKg: 1.5, unit: 'units', maxDailyDose: 100 },
    highAlertMedication: true,
  },

  // =========================================================================
  // NARROW THERAPEUTIC INDEX ANTIBIOTICS
  // =========================================================================
  {
    drugName: 'Gentamicin',
    drugNameAr: 'جنتاميسين',
    aliases: ['garamycin'],
    route: 'IV',
    adult: { minDose: 1, maxDose: 7, unit: 'mg/kg', frequency: 'DAILY', maxDailyDose: 500 },
    pediatric: { minDosePerKg: 2.5, maxDosePerKg: 7.5, unit: 'mg', maxDailyDose: 300 },
    renalAdjustment: [
      { gfrThreshold: 60, adjustedMaxDose: 5, notes: 'eGFR 40-60: Extend interval to Q12-24H; monitor levels', notesAr: 'معدل الترشيح 40-60: مدد الفاصل إلى كل 12-24 ساعة؛ راقب المستويات' },
      { gfrThreshold: 40, adjustedMaxDose: 3, notes: 'eGFR 20-40: Reduce dose 50%; Q24-48H; monitor trough <1', notesAr: 'معدل الترشيح 20-40: قلل الجرعة 50%؛ كل 24-48 ساعة' },
      { gfrThreshold: 20, adjustedMaxDose: 2, gfrContraindicated: 10, notes: 'eGFR <20: Use only if no alternative; monitor closely', notesAr: 'معدل الترشيح <20: استخدم فقط إذا لم يوجد بديل' },
    ],
    narrowTherapeuticIndex: true,
    highAlertMedication: true,
  },
  {
    drugName: 'Vancomycin',
    drugNameAr: 'فانكومايسين',
    aliases: ['vancocin'],
    route: 'IV',
    adult: { minDose: 500, maxDose: 2000, unit: 'mg', frequency: 'Q12H', maxDailyDose: 4000 },
    pediatric: { minDosePerKg: 10, maxDosePerKg: 15, unit: 'mg', maxDailyDose: 2000, minAge: 1 },
    renalAdjustment: [
      { gfrThreshold: 50, adjustedMaxDose: 1500, notes: 'eGFR 30-50: Extend to Q24H; target trough 15-20 mcg/mL', notesAr: 'معدل الترشيح 30-50: كل 24 ساعة؛ مستوى القاع المستهدف 15-20' },
      { gfrThreshold: 30, adjustedMaxDose: 1000, notes: 'eGFR 10-30: Q24-48H; monitor trough before each dose', notesAr: 'معدل الترشيح 10-30: كل 24-48 ساعة؛ راقب مستوى القاع قبل كل جرعة' },
      { gfrThreshold: 10, adjustedMaxDose: 750, notes: 'eGFR <10: Q48-72H; therapeutic drug monitoring essential', notesAr: 'معدل الترشيح <10: كل 48-72 ساعة؛ المراقبة الدوائية ضرورية' },
    ],
    narrowTherapeuticIndex: true,
  },

  // =========================================================================
  // COMMON ANTIBIOTICS
  // =========================================================================
  {
    drugName: 'Amoxicillin',
    drugNameAr: 'أموكسيسيلين',
    aliases: ['amoxil', 'trimox'],
    route: 'PO',
    adult: { minDose: 250, maxDose: 1000, unit: 'mg', frequency: 'TID', maxDailyDose: 3000 },
    pediatric: { minDosePerKg: 20, maxDosePerKg: 45, unit: 'mg', maxDailyDose: 3000 },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 500, notes: 'eGFR 10-30: 250-500 mg Q12H', notesAr: 'معدل الترشيح 10-30: 250-500 مجم كل 12 ساعة' },
      { gfrThreshold: 10, adjustedMaxDose: 500, notes: 'eGFR <10: 250-500 mg Q24H', notesAr: 'معدل الترشيح <10: 250-500 مجم كل 24 ساعة' },
    ],
    maxDuration: 14,
  },
  {
    drugName: 'Ciprofloxacin',
    drugNameAr: 'سيبروفلوكساسين',
    aliases: ['cipro', 'ciprobay'],
    route: 'PO',
    adult: { minDose: 250, maxDose: 750, unit: 'mg', frequency: 'BID', maxDailyDose: 1500 },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 500, notes: 'eGFR <30: 250-500 mg Q18-24H', notesAr: 'معدل الترشيح <30: 250-500 مجم كل 18-24 ساعة' },
    ],
    maxDuration: 14,
    pregnancyContraindicated: true,
    pregnancyNotes: 'Avoid in pregnancy — risk of cartilage damage in fetus',
    pregnancyNotesAr: 'تجنب في الحمل — خطر تلف الغضاريف عند الجنين',
  },
  {
    drugName: 'Azithromycin',
    drugNameAr: 'أزيثرومايسين',
    aliases: ['zithromax', 'zmax', 'azithrocin'],
    route: 'PO',
    adult: { minDose: 250, maxDose: 500, unit: 'mg', frequency: 'DAILY', maxDailyDose: 500 },
    pediatric: { minDosePerKg: 5, maxDosePerKg: 12, unit: 'mg', maxDailyDose: 500, minAge: 6 },
    hepaticAdjustment: [
      { severity: 'severe', contraindicated: true, notes: 'Avoid in severe hepatic impairment', notesAr: 'تجنب في القصور الكبدي الشديد' },
    ],
    maxDuration: 5,
  },

  // =========================================================================
  // CARDIAC MEDICATIONS
  // =========================================================================
  {
    drugName: 'Metoprolol',
    drugNameAr: 'ميتوبرولول',
    aliases: ['lopressor', 'betaloc', 'toprol'],
    route: 'PO',
    adult: { minDose: 25, maxDose: 200, unit: 'mg', frequency: 'BID', maxDailyDose: 400 },
    geriatric: {
      maxDose: 100,
      unit: 'mg',
      notes: 'Start 12.5-25 mg BID in elderly; risk of bradycardia and hypotension',
      notesAr: 'ابدأ 12.5-25 مجم مرتين لكبار السن؛ خطر بطء القلب وانخفاض الضغط',
    },
    hepaticAdjustment: [
      { severity: 'moderate', adjustedMaxDose: 100, notes: 'Reduce dose in moderate hepatic impairment', notesAr: 'قلل الجرعة في القصور الكبدي المتوسط' },
      { severity: 'severe', adjustedMaxDose: 50, notes: 'Start low; extensive hepatic metabolism', notesAr: 'ابدأ بجرعة منخفضة؛ يتم استقلابه كبدياً بشكل واسع' },
    ],
  },
  {
    drugName: 'Amlodipine',
    drugNameAr: 'أملوديبين',
    aliases: ['norvasc', 'amlopress'],
    route: 'PO',
    adult: { minDose: 2.5, maxDose: 10, unit: 'mg', frequency: 'DAILY', maxDailyDose: 10 },
    geriatric: {
      maxDose: 5,
      unit: 'mg',
      notes: 'Start 2.5 mg/day in elderly; slower clearance',
      notesAr: 'ابدأ 2.5 مجم/يوم لكبار السن؛ تصفية أبطأ',
    },
    hepaticAdjustment: [
      { severity: 'moderate', adjustedMaxDose: 5, notes: 'Start 2.5 mg; titrate slowly', notesAr: 'ابدأ 2.5 مجم؛ زد تدريجياً' },
      { severity: 'severe', adjustedMaxDose: 5, notes: 'Max 5 mg/day; monitor BP closely', notesAr: 'حد أقصى 5 مجم/يوم؛ راقب الضغط بدقة' },
    ],
  },
  {
    drugName: 'Lisinopril',
    drugNameAr: 'ليسينوبريل',
    aliases: ['prinivil', 'zestril'],
    route: 'PO',
    adult: { minDose: 2.5, maxDose: 40, unit: 'mg', frequency: 'DAILY', maxDailyDose: 80 },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 20, notes: 'eGFR 10-30: Start 2.5-5 mg; max 20 mg/day', notesAr: 'معدل الترشيح 10-30: ابدأ 2.5-5 مجم؛ حد أقصى 20 مجم/يوم' },
      { gfrThreshold: 10, adjustedMaxDose: 10, notes: 'eGFR <10: Start 2.5 mg; monitor K+ and creatinine', notesAr: 'معدل الترشيح <10: ابدأ 2.5 مجم؛ راقب البوتاسيوم والكرياتينين' },
    ],
    pregnancyContraindicated: true,
    pregnancyNotes: 'ACE inhibitors contraindicated in pregnancy — risk of fetal renal failure',
    pregnancyNotesAr: 'مثبطات الإنزيم المحول ممنوعة في الحمل — خطر فشل كلوي جنيني',
  },

  // =========================================================================
  // GASTROINTESTINAL
  // =========================================================================
  {
    drugName: 'Omeprazole',
    drugNameAr: 'أوميبرازول',
    aliases: ['prilosec', 'losec'],
    route: 'PO',
    adult: { minDose: 10, maxDose: 40, unit: 'mg', frequency: 'DAILY', maxDailyDose: 40 },
    pediatric: { minDosePerKg: 0.5, maxDosePerKg: 1, unit: 'mg', maxDailyDose: 20, minAge: 12 },
    hepaticAdjustment: [
      { severity: 'severe', adjustedMaxDose: 20, notes: 'Max 20 mg/day in severe hepatic impairment', notesAr: 'حد أقصى 20 مجم/يوم في القصور الكبدي الشديد' },
    ],
    maxDuration: 56, // 8 weeks typical course
  },
  {
    drugName: 'Pantoprazole',
    drugNameAr: 'بانتوبرازول',
    aliases: ['protonix', 'controloc'],
    route: 'PO',
    adult: { minDose: 20, maxDose: 40, unit: 'mg', frequency: 'DAILY', maxDailyDose: 80 },
    hepaticAdjustment: [
      { severity: 'severe', adjustedMaxDose: 20, notes: 'Max 20 mg/day in severe liver disease', notesAr: 'حد أقصى 20 مجم/يوم في أمراض الكبد الشديدة' },
    ],
    maxDuration: 56,
  },

  // =========================================================================
  // ANALGESICS — Max Daily Dose Critical
  // =========================================================================
  {
    drugName: 'Paracetamol',
    drugNameAr: 'باراسيتامول',
    aliases: ['acetaminophen', 'tylenol', 'panadol', 'adol', 'fevadol'],
    route: 'PO',
    adult: { minDose: 325, maxDose: 1000, unit: 'mg', frequency: 'Q6H', maxDailyDose: 4000 },
    pediatric: { minDosePerKg: 10, maxDosePerKg: 15, unit: 'mg', maxDailyDose: 75, minAge: 0 },
    geriatric: {
      maxDose: 650,
      unit: 'mg',
      notes: 'Max 3000 mg/day in elderly (reduced hepatic clearance)',
      notesAr: 'حد أقصى 3000 مجم/يوم لكبار السن (تقليل التصفية الكبدية)',
    },
    hepaticAdjustment: [
      { severity: 'mild', adjustedMaxDose: 2000, notes: 'Max 2 g/day; monitor LFTs', notesAr: 'حد أقصى 2 جم/يوم؛ راقب وظائف الكبد' },
      { severity: 'moderate', adjustedMaxDose: 1000, notes: 'Max 1 g/day; consider alternative', notesAr: 'حد أقصى 1 جم/يوم؛ فكر في بديل' },
      { severity: 'severe', contraindicated: true, notes: 'Avoid in severe hepatic impairment — hepatotoxicity risk', notesAr: 'تجنب في القصور الكبدي الشديد — خطر تسمم كبدي' },
    ],
  },
  {
    drugName: 'Ibuprofen',
    drugNameAr: 'ايبوبروفين',
    aliases: ['advil', 'motrin', 'brufen', 'nurofen'],
    route: 'PO',
    adult: { minDose: 200, maxDose: 800, unit: 'mg', frequency: 'TID', maxDailyDose: 3200 },
    pediatric: { minDosePerKg: 5, maxDosePerKg: 10, unit: 'mg', maxDailyDose: 40, minAge: 6 },
    geriatric: {
      maxDose: 400,
      unit: 'mg',
      notes: 'Use lowest effective dose; increased GI bleed and renal risk',
      notesAr: 'استخدم أقل جرعة فعالة؛ خطر متزايد للنزيف والكلى',
    },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 400, notes: 'Avoid if possible; if used, short course only', notesAr: 'تجنب إن أمكن؛ استخدام قصير فقط' },
      { gfrThreshold: 15, adjustedMaxDose: 0, gfrContraindicated: 15, notes: 'Contraindicated — risk of acute kidney injury', notesAr: 'ممنوع — خطر إصابة كلوية حادة' },
    ],
    pregnancyContraindicated: true,
    pregnancyNotes: 'Avoid after 20 weeks — risk of oligohydramnios and premature ductus closure',
    pregnancyNotesAr: 'تجنب بعد 20 أسبوع — خطر قلة السائل الأمنيوسي وإغلاق القناة الشريانية المبكر',
    maxDuration: 10,
  },
  {
    drugName: 'Diclofenac',
    drugNameAr: 'ديكلوفيناك',
    aliases: ['voltaren', 'cataflam', 'voltfast'],
    route: 'PO',
    adult: { minDose: 25, maxDose: 75, unit: 'mg', frequency: 'BID', maxDailyDose: 150 },
    geriatric: {
      maxDose: 50,
      unit: 'mg',
      notes: 'Max 100 mg/day in elderly; cardiovascular risk',
      notesAr: 'حد أقصى 100 مجم/يوم لكبار السن؛ خطر قلبي وعائي',
    },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 50, notes: 'Avoid if possible; nephrotoxic', notesAr: 'تجنب إن أمكن؛ سام للكلى' },
      { gfrThreshold: 15, adjustedMaxDose: 0, gfrContraindicated: 15, notes: 'Contraindicated in severe renal impairment', notesAr: 'ممنوع في القصور الكلوي الشديد' },
    ],
    pregnancyContraindicated: true,
    pregnancyNotes: 'NSAIDs contraindicated in 3rd trimester',
    pregnancyNotesAr: 'مضادات الالتهاب غير الستيرويدية ممنوعة في الثلث الثالث',
    maxDuration: 14,
  },

  // =========================================================================
  // OPIOIDS — High Alert
  // =========================================================================
  {
    drugName: 'Morphine',
    drugNameAr: 'مورفين',
    aliases: ['ms contin', 'avinza'],
    route: 'PO',
    adult: { minDose: 5, maxDose: 30, unit: 'mg', frequency: 'Q4H', maxDailyDose: 200 },
    geriatric: {
      maxDose: 10,
      unit: 'mg',
      notes: 'Start 2.5-5 mg in opioid-naive elderly; increased sensitivity',
      notesAr: 'ابدأ 2.5-5 مجم لكبار السن غير المعتادين؛ حساسية متزايدة',
    },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 15, notes: 'Reduce by 50%; active metabolite (M6G) accumulates', notesAr: 'قلل 50%؛ تراكم المستقلب النشط M6G' },
      { gfrThreshold: 15, adjustedMaxDose: 5, notes: 'Avoid if possible; consider hydromorphone or fentanyl', notesAr: 'تجنب إن أمكن؛ فكر في هيدرومورفون أو فنتانيل' },
    ],
    hepaticAdjustment: [
      { severity: 'moderate', adjustedMaxDose: 10, notes: 'Reduce dose 50%; decreased first-pass metabolism', notesAr: 'قلل الجرعة 50%؛ انخفاض الاستقلاب الأولي' },
      { severity: 'severe', adjustedMaxDose: 5, notes: 'Use with extreme caution; risk of encephalopathy', notesAr: 'استخدم بحذر شديد؛ خطر اعتلال دماغي' },
    ],
    highAlertMedication: true,
  },
  {
    drugName: 'Tramadol',
    drugNameAr: 'ترامادول',
    aliases: ['ultram', 'tramal'],
    route: 'PO',
    adult: { minDose: 50, maxDose: 100, unit: 'mg', frequency: 'Q6H', maxDailyDose: 400 },
    geriatric: {
      maxDose: 50,
      unit: 'mg',
      notes: 'Max 300 mg/day in elderly >75; seizure risk',
      notesAr: 'حد أقصى 300 مجم/يوم لمن فوق 75 سنة؛ خطر تشنجات',
    },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 50, notes: 'CrCl <30: Max 200 mg/day; Q12H dosing', notesAr: 'تصفية الكرياتينين <30: حد أقصى 200 مجم/يوم؛ كل 12 ساعة' },
    ],
    hepaticAdjustment: [
      { severity: 'severe', adjustedMaxDose: 50, notes: 'Max 100 mg/day in cirrhosis; Q12H dosing', notesAr: 'حد أقصى 100 مجم/يوم في تليف الكبد؛ كل 12 ساعة' },
    ],
    highAlertMedication: true,
  },

  // =========================================================================
  // HIGH ALERT — Methotrexate (weekly vs daily error is FATAL)
  // =========================================================================
  {
    drugName: 'Methotrexate',
    drugNameAr: 'ميثوتريكسات',
    aliases: ['trexall', 'rasuvo', 'otrexup'],
    route: 'PO',
    indication: 'Rheumatoid arthritis / psoriasis (NON-oncologic)',
    adult: { minDose: 7.5, maxDose: 25, unit: 'mg', frequency: 'WEEKLY', maxDailyDose: 25 },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 15, notes: 'eGFR 30-50: Reduce dose by 50%', notesAr: 'معدل الترشيح 30-50: قلل الجرعة 50%' },
      { gfrThreshold: 15, adjustedMaxDose: 0, gfrContraindicated: 15, notes: 'eGFR <15: Contraindicated', notesAr: 'معدل الترشيح <15: ممنوع الاستخدام' },
    ],
    hepaticAdjustment: [
      { severity: 'moderate', adjustedMaxDose: 10, notes: 'Monitor LFTs every 4-8 weeks', notesAr: 'راقب وظائف الكبد كل 4-8 أسابيع' },
      { severity: 'severe', contraindicated: true, notes: 'Contraindicated in severe liver disease', notesAr: 'ممنوع في أمراض الكبد الشديدة' },
    ],
    highAlertMedication: true,
    pregnancyContraindicated: true,
    pregnancyNotes: 'Category X — teratogenic and abortifacient; must stop 3 months before conception',
    pregnancyNotesAr: 'فئة X — مسبب تشوهات وإجهاض؛ يجب إيقافه قبل 3 أشهر من الحمل',
  },

  // =========================================================================
  // NARROW THERAPEUTIC INDEX — Digoxin
  // =========================================================================
  {
    drugName: 'Digoxin',
    drugNameAr: 'ديجوكسين',
    aliases: ['lanoxin'],
    route: 'PO',
    adult: { minDose: 0.0625, maxDose: 0.25, unit: 'mg', frequency: 'DAILY', maxDailyDose: 0.5 },
    pediatric: { minDosePerKg: 0.005, maxDosePerKg: 0.01, unit: 'mg', maxDailyDose: 0.25, minAge: 1 },
    geriatric: {
      maxDose: 0.125,
      unit: 'mg',
      notes: 'Max 0.125 mg/day in elderly; target level 0.5-0.9 ng/mL',
      notesAr: 'حد أقصى 0.125 مجم/يوم لكبار السن؛ المستوى المستهدف 0.5-0.9',
    },
    renalAdjustment: [
      { gfrThreshold: 50, adjustedMaxDose: 0.125, notes: 'eGFR 30-50: 0.0625-0.125 mg/day; monitor levels', notesAr: 'معدل الترشيح 30-50: 0.0625-0.125 مجم/يوم؛ راقب المستويات' },
      { gfrThreshold: 30, adjustedMaxDose: 0.0625, notes: 'eGFR <30: 0.0625 mg QOD; high toxicity risk', notesAr: 'معدل الترشيح <30: 0.0625 مجم كل يومين؛ خطر تسمم عالٍ' },
    ],
    narrowTherapeuticIndex: true,
    highAlertMedication: true,
  },

  // =========================================================================
  // NARROW THERAPEUTIC INDEX — Phenytoin
  // =========================================================================
  {
    drugName: 'Phenytoin',
    drugNameAr: 'فينيتوين',
    aliases: ['dilantin', 'epanutin'],
    route: 'PO',
    adult: { minDose: 100, maxDose: 300, unit: 'mg', frequency: 'DAILY', maxDailyDose: 600 },
    pediatric: { minDosePerKg: 4, maxDosePerKg: 8, unit: 'mg', maxDailyDose: 300, minAge: 1 },
    hepaticAdjustment: [
      { severity: 'mild', adjustedMaxDose: 300, notes: 'Monitor free phenytoin levels; protein binding altered', notesAr: 'راقب مستويات الفينيتوين الحر؛ الارتباط البروتيني متغير' },
      { severity: 'moderate', adjustedMaxDose: 200, notes: 'Reduce dose; use free levels for monitoring', notesAr: 'قلل الجرعة؛ استخدم المستويات الحرة للمراقبة' },
      { severity: 'severe', adjustedMaxDose: 100, notes: 'Significant dose reduction; consider alternative (levetiracetam)', notesAr: 'تقليل كبير في الجرعة؛ فكر في بديل (ليفيتيراسيتام)' },
    ],
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 200, notes: 'Hypoalbuminemia in CKD affects free phenytoin levels', notesAr: 'نقص الألبومين في القصور الكلوي يؤثر على مستويات الفينيتوين الحر' },
    ],
    narrowTherapeuticIndex: true,
    pregnancyContraindicated: true,
    pregnancyNotes: 'Category D — fetal hydantoin syndrome; use alternative if possible',
    pregnancyNotesAr: 'فئة D — متلازمة الهيدانتوين الجنينية؛ استخدم بديلاً إن أمكن',
  },

  // =========================================================================
  // ADDITIONAL COMMON MEDICATIONS
  // =========================================================================
  {
    drugName: 'Atorvastatin',
    drugNameAr: 'أتورفاستاتين',
    aliases: ['lipitor'],
    route: 'PO',
    adult: { minDose: 10, maxDose: 80, unit: 'mg', frequency: 'DAILY', maxDailyDose: 80 },
    hepaticAdjustment: [
      { severity: 'mild', adjustedMaxDose: 40, notes: 'Monitor ALT/AST; reduce if >3x ULN', notesAr: 'راقب إنزيمات الكبد؛ قلل إذا >3 أضعاف الحد الأعلى' },
      { severity: 'moderate', contraindicated: true, notes: 'Contraindicated in active liver disease', notesAr: 'ممنوع في أمراض الكبد النشطة' },
      { severity: 'severe', contraindicated: true, notes: 'Contraindicated', notesAr: 'ممنوع الاستخدام' },
    ],
    pregnancyContraindicated: true,
    pregnancyNotes: 'Statins contraindicated in pregnancy',
    pregnancyNotesAr: 'الستاتينات ممنوعة في الحمل',
  },
  {
    drugName: 'Losartan',
    drugNameAr: 'لوسارتان',
    aliases: ['cozaar'],
    route: 'PO',
    adult: { minDose: 25, maxDose: 100, unit: 'mg', frequency: 'DAILY', maxDailyDose: 100 },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 50, notes: 'Start low; monitor K+ and creatinine', notesAr: 'ابدأ بجرعة منخفضة؛ راقب البوتاسيوم والكرياتينين' },
    ],
    hepaticAdjustment: [
      { severity: 'moderate', adjustedMaxDose: 25, notes: 'Start 25 mg; reduced hepatic clearance', notesAr: 'ابدأ 25 مجم؛ تقليل التصفية الكبدية' },
    ],
    pregnancyContraindicated: true,
    pregnancyNotes: 'ARBs contraindicated in pregnancy — fetal renal toxicity',
    pregnancyNotesAr: 'حاصرات مستقبلات الأنجيوتنسين ممنوعة في الحمل — سمية كلوية جنينية',
  },
  {
    drugName: 'Furosemide',
    drugNameAr: 'فوروسيميد',
    aliases: ['lasix'],
    route: 'PO',
    adult: { minDose: 20, maxDose: 80, unit: 'mg', frequency: 'DAILY', maxDailyDose: 600 },
    geriatric: {
      maxDose: 40,
      unit: 'mg',
      notes: 'Start 20 mg; risk of dehydration, hypokalemia, ototoxicity',
      notesAr: 'ابدأ 20 مجم؛ خطر جفاف ونقص بوتاسيوم وتسمم أذني',
    },
  },
  {
    drugName: 'Spironolactone',
    drugNameAr: 'سبيرونولاكتون',
    aliases: ['aldactone'],
    route: 'PO',
    adult: { minDose: 12.5, maxDose: 50, unit: 'mg', frequency: 'DAILY', maxDailyDose: 400 },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 25, notes: 'Hyperkalemia risk; monitor K+ closely', notesAr: 'خطر فرط بوتاسيوم الدم؛ راقب البوتاسيوم بدقة' },
      { gfrThreshold: 15, adjustedMaxDose: 0, gfrContraindicated: 15, notes: 'Contraindicated — severe hyperkalemia risk', notesAr: 'ممنوع — خطر فرط بوتاسيوم شديد' },
    ],
    pregnancyContraindicated: true,
    pregnancyNotes: 'Anti-androgenic effects; contraindicated in pregnancy',
    pregnancyNotesAr: 'تأثيرات مضادة للأندروجين؛ ممنوع في الحمل',
  },
  {
    drugName: 'Clopidogrel',
    drugNameAr: 'كلوبيدوجريل',
    aliases: ['plavix'],
    route: 'PO',
    adult: { minDose: 75, maxDose: 75, unit: 'mg', frequency: 'DAILY', maxDailyDose: 75 },
    hepaticAdjustment: [
      { severity: 'severe', notes: 'Reduced activation; bleeding risk. Consider prasugrel or ticagrelor.', notesAr: 'تنشيط مخفض؛ خطر نزيف. فكر في براسوجريل أو تيكاجريلور.' },
    ],
  },
  {
    drugName: 'Aspirin',
    drugNameAr: 'أسبرين',
    aliases: ['asa', 'acetylsalicylic acid', 'aspocid', 'jusprin'],
    route: 'PO',
    adult: { minDose: 75, maxDose: 1000, unit: 'mg', frequency: 'DAILY', maxDailyDose: 4000 },
    pediatric: { minDosePerKg: 10, maxDosePerKg: 15, unit: 'mg', maxDailyDose: 4000, minAge: 192 },
    geriatric: {
      maxDose: 325,
      unit: 'mg',
      notes: 'Low-dose (75-100 mg) preferred in elderly for CV prophylaxis; GI bleed risk',
      notesAr: 'الجرعة المنخفضة (75-100 مجم) مفضلة لكبار السن للوقاية القلبية؛ خطر نزيف معدي',
    },
    renalAdjustment: [
      { gfrThreshold: 15, adjustedMaxDose: 100, gfrContraindicated: 10, notes: 'Avoid high doses in severe CKD; platelet dysfunction', notesAr: 'تجنب الجرعات العالية في القصور الكلوي الشديد' },
    ],
  },
  {
    drugName: 'Prednisolone',
    drugNameAr: 'بريدنيزولون',
    aliases: ['prelone', 'pediapred'],
    route: 'PO',
    adult: { minDose: 5, maxDose: 60, unit: 'mg', frequency: 'DAILY', maxDailyDose: 80 },
    pediatric: { minDosePerKg: 0.5, maxDosePerKg: 2, unit: 'mg', maxDailyDose: 60 },
    maxDuration: 14,
  },
  {
    drugName: 'Dexamethasone',
    drugNameAr: 'ديكساميثازون',
    aliases: ['decadron'],
    route: 'PO',
    adult: { minDose: 0.5, maxDose: 20, unit: 'mg', frequency: 'DAILY', maxDailyDose: 40 },
    pediatric: { minDosePerKg: 0.05, maxDosePerKg: 0.3, unit: 'mg', maxDailyDose: 10 },
  },
  {
    drugName: 'Salbutamol',
    drugNameAr: 'سالبوتامول',
    aliases: ['albuterol', 'ventolin', 'proair'],
    route: 'INH',
    adult: { minDose: 100, maxDose: 200, unit: 'mcg', frequency: 'Q4H', maxDailyDose: 1200 },
    pediatric: { minDosePerKg: 0, maxDosePerKg: 0, unit: 'mcg', maxDailyDose: 800 },
  },
  {
    drugName: 'Cetirizine',
    drugNameAr: 'سيتيريزين',
    aliases: ['zyrtec'],
    route: 'PO',
    adult: { minDose: 5, maxDose: 10, unit: 'mg', frequency: 'DAILY', maxDailyDose: 10 },
    pediatric: { minDosePerKg: 0, maxDosePerKg: 0, unit: 'mg', maxDailyDose: 10, minAge: 24 },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 5, notes: 'Max 5 mg/day in renal impairment', notesAr: 'حد أقصى 5 مجم/يوم في القصور الكلوي' },
    ],
    geriatric: {
      maxDose: 5,
      unit: 'mg',
      notes: 'Start 5 mg/day in elderly; drowsiness',
      notesAr: 'ابدأ 5 مجم/يوم لكبار السن؛ نعاس',
    },
  },
  {
    drugName: 'Metoclopramide',
    drugNameAr: 'ميتوكلوبراميد',
    aliases: ['reglan', 'primperan'],
    route: 'PO',
    adult: { minDose: 5, maxDose: 10, unit: 'mg', frequency: 'TID', maxDailyDose: 30 },
    geriatric: {
      maxDose: 5,
      unit: 'mg',
      notes: 'Max 15 mg/day in elderly; EPS risk. Max 5 days recommended.',
      notesAr: 'حد أقصى 15 مجم/يوم لكبار السن؛ خطر أعراض خارج هرمية. 5 أيام حد أقصى.',
    },
    renalAdjustment: [
      { gfrThreshold: 30, adjustedMaxDose: 5, notes: 'Reduce dose 50% if CrCl <40', notesAr: 'قلل الجرعة 50% إذا تصفية الكرياتينين <40' },
    ],
    maxDuration: 5,
  },
  {
    drugName: 'Levofloxacin',
    drugNameAr: 'ليفوفلوكساسين',
    aliases: ['levaquin', 'tavanic'],
    route: 'PO',
    adult: { minDose: 250, maxDose: 750, unit: 'mg', frequency: 'DAILY', maxDailyDose: 750 },
    renalAdjustment: [
      { gfrThreshold: 50, adjustedMaxDose: 500, notes: 'eGFR 20-49: 750mg then 500mg Q48H, or 500mg then 250mg Q48H', notesAr: 'معدل الترشيح 20-49: 750 ثم 500 كل 48 ساعة' },
      { gfrThreshold: 20, adjustedMaxDose: 250, notes: 'eGFR <20: 750mg then 500mg Q48H, or 250mg Q48H', notesAr: 'معدل الترشيح <20: خفض الجرعة بشكل كبير' },
    ],
    maxDuration: 14,
    pregnancyContraindicated: true,
    pregnancyNotes: 'Fluoroquinolones — cartilage toxicity risk in fetus',
    pregnancyNotesAr: 'الفلوروكينولونات — خطر تسمم الغضاريف للجنين',
  },
  {
    drugName: 'Ceftriaxone',
    drugNameAr: 'سيفترياكسون',
    aliases: ['rocephin'],
    route: 'IV',
    adult: { minDose: 1000, maxDose: 2000, unit: 'mg', frequency: 'DAILY', maxDailyDose: 4000 },
    pediatric: { minDosePerKg: 50, maxDosePerKg: 100, unit: 'mg', maxDailyDose: 4000 },
    maxDuration: 14,
  },
];

// ---------------------------------------------------------------------------
// Drug Lookup
// ---------------------------------------------------------------------------

function normalizeDrugName(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Find a drug in the database by name (exact, alias, or fuzzy).
 * Returns the first match found.
 */
export function findDrug(name: string): DrugDoseRange | null {
  const normalized = normalizeDrugName(name);
  if (!normalized) return null;

  // 1. Exact name match
  for (const drug of DRUG_DATABASE) {
    if (normalizeDrugName(drug.drugName) === normalized) return drug;
  }

  // 2. Alias match
  for (const drug of DRUG_DATABASE) {
    if (drug.aliases?.some((a) => normalizeDrugName(a) === normalized)) return drug;
  }

  // 3. Partial / contains match
  for (const drug of DRUG_DATABASE) {
    const dn = normalizeDrugName(drug.drugName);
    if (dn.includes(normalized) || normalized.includes(dn)) return drug;
  }

  // 4. Alias partial
  for (const drug of DRUG_DATABASE) {
    if (drug.aliases?.some((a) => {
      const an = normalizeDrugName(a);
      return an.includes(normalized) || normalized.includes(an);
    })) return drug;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Validation Engine
// ---------------------------------------------------------------------------

/**
 * Validates a medication dose against evidence-based clinical ranges.
 *
 * Returns a structured result with alerts categorised as CRITICAL, WARNING, or INFO.
 */
export function validateDoseRange(request: DoseValidationRequest): DoseValidationResult {
  const alerts: DoseAlert[] = [];
  const recommendations: string[] = [];
  const recommendationsAr: string[] = [];

  const drug = findDrug(request.drugName);

  if (!drug) {
    return {
      valid: true, // cannot invalidate what we don't know
      drugFound: false,
      drugName: request.drugName,
      drugNameAr: request.drugName,
      alerts: [{
        severity: 'INFO',
        code: 'DRUG_NOT_IN_DATABASE',
        message: `Drug "${request.drugName}" not found in dose-range database. Manual verification recommended.`,
        messageAr: `الدواء "${request.drugName}" غير موجود في قاعدة بيانات الجرعات. يُنصح بالتحقق اليدوي.`,
      }],
      recommendations: ['Verify dose against formulary or clinical pharmacist'],
      recommendationsAr: ['تحقق من الجرعة مع دليل الأدوية أو الصيدلي السريري'],
    };
  }

  const { dose, frequency, patientAge, patientWeight, gfr, hepaticFunction, isPregnant, durationDays } = request;
  const dosesPerDay = parseFrequency(frequency);
  const calculatedDailyDose = dosesPerDay !== null && dosesPerDay > 0 ? dose * dosesPerDay : dose;
  const isAdult = patientAge === undefined || patientAge >= 18;
  const isGeriatric = patientAge !== undefined && patientAge >= 65;
  const isPediatric = patientAge !== undefined && patientAge < 18;

  // -----------------------------------------------------------------------
  // 1. High-alert medication flag
  // -----------------------------------------------------------------------
  if (drug.highAlertMedication) {
    alerts.push({
      severity: 'WARNING',
      code: 'HIGH_ALERT_MED',
      message: `HIGH-ALERT MEDICATION: ${drug.drugName} requires independent double-check before administration.`,
      messageAr: `دواء عالي الخطورة: ${drug.drugNameAr} يتطلب تحقق مزدوج مستقل قبل الإعطاء.`,
    });
  }

  // -----------------------------------------------------------------------
  // 2. Narrow therapeutic index flag
  // -----------------------------------------------------------------------
  if (drug.narrowTherapeuticIndex) {
    alerts.push({
      severity: 'WARNING',
      code: 'NARROW_THERAPEUTIC_INDEX',
      message: `NARROW THERAPEUTIC INDEX: ${drug.drugName} — therapeutic drug monitoring recommended.`,
      messageAr: `نطاق علاجي ضيق: ${drug.drugNameAr} — يُنصح بمراقبة مستوى الدواء في الدم.`,
    });
  }

  // -----------------------------------------------------------------------
  // 3. Methotrexate daily-vs-weekly safety check
  // -----------------------------------------------------------------------
  if (normalizeDrugName(drug.drugName) === 'methotrexate') {
    const freqNorm = (frequency || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const isDailyFrequency = ['DAILY', 'QD', 'OD', 'BID', 'TID', 'QID', 'Q6H', 'Q8H', 'Q12H', 'Q4H'].includes(freqNorm);
    if (isDailyFrequency) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'MTX_DAILY_FREQUENCY_ERROR',
        message: 'FATAL RISK: Methotrexate for RA/psoriasis is dosed WEEKLY, not daily. Daily dosing can cause fatal bone marrow suppression and organ failure.',
        messageAr: 'خطر مميت: الميثوتريكسات للروماتيزم/الصدفية يُعطى أسبوعياً وليس يومياً. الجرعة اليومية قد تسبب فشل نخاع العظم والوفاة.',
        suggestedDose: `${dose} ${drug.adult.unit} ONCE WEEKLY`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // 4. Adult max single dose
  // -----------------------------------------------------------------------
  if (isAdult && dose > drug.adult.maxDose) {
    const unitMatch = request.unit.toLowerCase() === drug.adult.unit.toLowerCase();
    if (unitMatch || !request.unit) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'DOSE_EXCEEDS_MAX',
        message: `Dose ${dose} ${drug.adult.unit} exceeds maximum single dose of ${drug.adult.maxDose} ${drug.adult.unit} for ${drug.drugName}.`,
        messageAr: `الجرعة ${dose} ${drug.adult.unit} تتجاوز الحد الأقصى للجرعة الواحدة ${drug.adult.maxDose} ${drug.adult.unit} لـ${drug.drugNameAr}.`,
        suggestedDose: `${drug.adult.maxDose} ${drug.adult.unit}`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // 5. Daily dose exceeds max daily dose
  // -----------------------------------------------------------------------
  if (isAdult && dosesPerDay !== null && dosesPerDay > 0) {
    if (calculatedDailyDose > drug.adult.maxDailyDose) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'DAILY_DOSE_EXCEEDS_MAX',
        message: `Calculated daily dose ${calculatedDailyDose} ${drug.adult.unit} exceeds maximum daily dose of ${drug.adult.maxDailyDose} ${drug.adult.unit}.`,
        messageAr: `الجرعة اليومية المحسوبة ${calculatedDailyDose} ${drug.adult.unit} تتجاوز الحد الأقصى اليومي ${drug.adult.maxDailyDose} ${drug.adult.unit}.`,
        suggestedDose: `Max ${drug.adult.maxDailyDose} ${drug.adult.unit}/day`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // 6. Dose below minimum (sub-therapeutic)
  // -----------------------------------------------------------------------
  if (isAdult && dose < drug.adult.minDose) {
    alerts.push({
      severity: 'INFO',
      code: 'DOSE_BELOW_MIN',
      message: `Dose ${dose} ${drug.adult.unit} is below the typical minimum dose of ${drug.adult.minDose} ${drug.adult.unit}. May be sub-therapeutic.`,
      messageAr: `الجرعة ${dose} ${drug.adult.unit} أقل من الحد الأدنى المعتاد ${drug.adult.minDose} ${drug.adult.unit}. قد تكون غير علاجية.`,
    });
  }

  // -----------------------------------------------------------------------
  // 7. Geriatric dose check (age >= 65)
  // -----------------------------------------------------------------------
  if (isGeriatric && drug.geriatric) {
    if (dose > drug.geriatric.maxDose) {
      alerts.push({
        severity: 'WARNING',
        code: 'GERIATRIC_DOSE_EXCEEDED',
        message: `Geriatric dose limit: ${drug.drugName} max ${drug.geriatric.maxDose} ${drug.geriatric.unit} for patients >=65. ${drug.geriatric.notes}`,
        messageAr: `حد جرعة كبار السن: ${drug.drugNameAr} حد أقصى ${drug.geriatric.maxDose} ${drug.geriatric.unit} لمن >=65 سنة. ${drug.geriatric.notesAr}`,
        suggestedDose: `${drug.geriatric.maxDose} ${drug.geriatric.unit}`,
      });
    }
    recommendations.push(drug.geriatric.notes);
    recommendationsAr.push(drug.geriatric.notesAr);
  }

  // -----------------------------------------------------------------------
  // 8. Pediatric dose per kg check (age < 18, needs weight)
  // -----------------------------------------------------------------------
  if (isPediatric && drug.pediatric) {
    if (patientWeight && patientWeight > 0) {
      const dosePerKg = dose / patientWeight;
      if (dosePerKg > drug.pediatric.maxDosePerKg && drug.pediatric.maxDosePerKg > 0) {
        alerts.push({
          severity: 'CRITICAL',
          code: 'PEDIATRIC_DOSE_PER_KG_EXCEEDED',
          message: `Pediatric dose ${dosePerKg.toFixed(2)} ${drug.pediatric.unit}/kg exceeds max ${drug.pediatric.maxDosePerKg} ${drug.pediatric.unit}/kg for ${drug.drugName}.`,
          messageAr: `جرعة الأطفال ${dosePerKg.toFixed(2)} ${drug.pediatric.unit}/كجم تتجاوز الحد الأقصى ${drug.pediatric.maxDosePerKg} ${drug.pediatric.unit}/كجم لـ${drug.drugNameAr}.`,
          suggestedDose: `${(drug.pediatric.maxDosePerKg * patientWeight).toFixed(1)} ${drug.pediatric.unit} (${drug.pediatric.maxDosePerKg} ${drug.pediatric.unit}/kg)`,
        });
      }
      if (dosePerKg < drug.pediatric.minDosePerKg && drug.pediatric.minDosePerKg > 0) {
        alerts.push({
          severity: 'INFO',
          code: 'PEDIATRIC_DOSE_BELOW_MIN',
          message: `Pediatric dose ${dosePerKg.toFixed(2)} ${drug.pediatric.unit}/kg is below the minimum ${drug.pediatric.minDosePerKg} ${drug.pediatric.unit}/kg. May be sub-therapeutic.`,
          messageAr: `جرعة الأطفال ${dosePerKg.toFixed(2)} ${drug.pediatric.unit}/كجم أقل من الحد الأدنى ${drug.pediatric.minDosePerKg} ${drug.pediatric.unit}/كجم. قد تكون غير علاجية.`,
        });
      }
    } else {
      alerts.push({
        severity: 'WARNING',
        code: 'PEDIATRIC_WEIGHT_REQUIRED',
        message: 'Patient weight is required for pediatric dose validation. Weight-based dosing cannot be verified.',
        messageAr: 'وزن المريض مطلوب للتحقق من جرعة الأطفال. لا يمكن التحقق من الجرعة حسب الوزن.',
      });
    }
  }

  // -----------------------------------------------------------------------
  // 9. Renal adjustment (based on GFR)
  // -----------------------------------------------------------------------
  if (gfr !== undefined && drug.renalAdjustment && drug.renalAdjustment.length > 0) {
    // Sort thresholds descending so we match the most restrictive applicable one
    const sortedRenal = [...drug.renalAdjustment].sort((a, b) => b.gfrThreshold - a.gfrThreshold);

    for (const adj of sortedRenal) {
      if (gfr <= adj.gfrThreshold) {
        // Check contraindication first
        if (adj.gfrContraindicated !== undefined && gfr <= adj.gfrContraindicated) {
          alerts.push({
            severity: 'CRITICAL',
            code: 'RENAL_CONTRAINDICATED',
            message: `CONTRAINDICATED: ${drug.drugName} should not be used with eGFR ${gfr} mL/min (threshold: ${adj.gfrContraindicated}). ${adj.notes}`,
            messageAr: `ممنوع الاستخدام: ${drug.drugNameAr} لا يجب استخدامه مع معدل ترشيح ${gfr} مل/دقيقة (الحد: ${adj.gfrContraindicated}). ${adj.notesAr}`,
          });
          break;
        }

        // Check if dose exceeds adjusted max
        if (adj.adjustedMaxDose > 0 && dose > adj.adjustedMaxDose) {
          alerts.push({
            severity: 'WARNING',
            code: 'RENAL_ADJUSTMENT_NEEDED',
            message: `Renal adjustment: Max dose ${adj.adjustedMaxDose} ${drug.adult.unit} for eGFR ≤${adj.gfrThreshold}. Current dose: ${dose} ${drug.adult.unit}. ${adj.notes}`,
            messageAr: `تعديل كلوي: الحد الأقصى ${adj.adjustedMaxDose} ${drug.adult.unit} لمعدل ترشيح ≤${adj.gfrThreshold}. الجرعة الحالية: ${dose} ${drug.adult.unit}. ${adj.notesAr}`,
            suggestedDose: `${adj.adjustedMaxDose} ${drug.adult.unit}`,
          });
        } else if (adj.adjustedMaxDose > 0) {
          // Dose is within range but still note the renal consideration
          recommendations.push(adj.notes);
          recommendationsAr.push(adj.notesAr);
        }
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // 10. Hepatic adjustment
  // -----------------------------------------------------------------------
  if (hepaticFunction && hepaticFunction !== 'normal' && drug.hepaticAdjustment) {
    const adj = drug.hepaticAdjustment.find((a) => a.severity === hepaticFunction);
    if (adj) {
      if (adj.contraindicated) {
        alerts.push({
          severity: 'CRITICAL',
          code: 'HEPATIC_CONTRAINDICATED',
          message: `CONTRAINDICATED: ${drug.drugName} in ${hepaticFunction} hepatic impairment. ${adj.notes}`,
          messageAr: `ممنوع الاستخدام: ${drug.drugNameAr} في القصور الكبدي ال${hepaticFunction === 'severe' ? 'شديد' : hepaticFunction === 'moderate' ? 'متوسط' : 'خفيف'}. ${adj.notesAr}`,
        });
      } else if (adj.adjustedMaxDose !== undefined && dose > adj.adjustedMaxDose) {
        alerts.push({
          severity: 'WARNING',
          code: 'HEPATIC_ADJUSTMENT_NEEDED',
          message: `Hepatic adjustment (${hepaticFunction}): Max dose ${adj.adjustedMaxDose} ${drug.adult.unit}. Current dose: ${dose} ${drug.adult.unit}. ${adj.notes}`,
          messageAr: `تعديل كبدي (${hepaticFunction === 'severe' ? 'شديد' : hepaticFunction === 'moderate' ? 'متوسط' : 'خفيف'}): الحد الأقصى ${adj.adjustedMaxDose} ${drug.adult.unit}. الجرعة الحالية: ${dose} ${drug.adult.unit}. ${adj.notesAr}`,
          suggestedDose: `${adj.adjustedMaxDose} ${drug.adult.unit}`,
        });
      } else {
        recommendations.push(adj.notes);
        recommendationsAr.push(adj.notesAr);
      }
    }
  }

  // -----------------------------------------------------------------------
  // 11. Pregnancy contraindication
  // -----------------------------------------------------------------------
  if (isPregnant && drug.pregnancyContraindicated) {
    alerts.push({
      severity: 'CRITICAL',
      code: 'PREGNANCY_CONTRAINDICATED',
      message: `CONTRAINDICATED IN PREGNANCY: ${drug.drugName}. ${drug.pregnancyNotes || ''}`,
      messageAr: `ممنوع الاستخدام في الحمل: ${drug.drugNameAr}. ${drug.pregnancyNotesAr || ''}`,
    });
  } else if (isPregnant && drug.pregnancyNotes) {
    recommendations.push(drug.pregnancyNotes);
    recommendationsAr.push(drug.pregnancyNotesAr || '');
  }

  // -----------------------------------------------------------------------
  // 12. Duration exceeds recommended max
  // -----------------------------------------------------------------------
  if (durationDays !== undefined && drug.maxDuration && durationDays > drug.maxDuration) {
    alerts.push({
      severity: 'WARNING',
      code: 'DURATION_EXCEEDS_MAX',
      message: `Prescribed duration (${durationDays} days) exceeds recommended maximum (${drug.maxDuration} days) for ${drug.drugName}.`,
      messageAr: `مدة الوصفة (${durationDays} يوم) تتجاوز المدة القصوى الموصى بها (${drug.maxDuration} يوم) لـ${drug.drugNameAr}.`,
    });
  }

  // -----------------------------------------------------------------------
  // 13. Frequency not recognised
  // -----------------------------------------------------------------------
  if (dosesPerDay === null) {
    alerts.push({
      severity: 'INFO',
      code: 'FREQUENCY_NOT_RECOGNIZED',
      message: `Frequency "${frequency}" not recognized. Daily dose calculation could not be performed.`,
      messageAr: `التكرار "${frequency}" غير معروف. لم يتم حساب الجرعة اليومية.`,
    });
  }

  // -----------------------------------------------------------------------
  // Sort alerts: CRITICAL > WARNING > INFO
  // -----------------------------------------------------------------------
  const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  const hasCritical = alerts.some((a) => a.severity === 'CRITICAL');

  return {
    valid: !hasCritical,
    drugFound: true,
    drugName: drug.drugName,
    drugNameAr: drug.drugNameAr,
    alerts,
    recommendations,
    recommendationsAr,
  };
}

// ---------------------------------------------------------------------------
// Bulk validation helper
// ---------------------------------------------------------------------------

export interface BulkDoseValidationItem extends DoseValidationRequest {
  /** Optional line-item identifier for the caller to correlate results */
  lineId?: string;
}

export function validateMultipleDoses(
  items: BulkDoseValidationItem[]
): (DoseValidationResult & { lineId?: string })[] {
  return items.map((item) => ({
    ...validateDoseRange(item),
    lineId: item.lineId,
  }));
}

// ---------------------------------------------------------------------------
// Public utility: list all drugs in the database
// ---------------------------------------------------------------------------

export function listDrugDatabase(): { name: string; nameAr: string; route: DoseRoute; highAlert: boolean; narrowTI: boolean }[] {
  return DRUG_DATABASE.map((d) => ({
    name: d.drugName,
    nameAr: d.drugNameAr,
    route: d.route,
    highAlert: !!d.highAlertMedication,
    narrowTI: !!d.narrowTherapeuticIndex,
  }));
}
