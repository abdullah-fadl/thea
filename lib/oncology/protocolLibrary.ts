/**
 * Chemo Protocol Template Library
 *
 * Standard chemotherapy regimens with bilingual labels, drug details,
 * premedications, supportive care, and dose calculation helpers.
 */

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------

export interface ProtocolDrug {
  name: string;
  nameAr: string;
  dose: number;       // mg/m2 (or mg/kg where noted)
  unit: 'mg/m2' | 'mg/kg' | 'mg' | 'AUC' | 'units/m2';
  route: 'IV' | 'PO' | 'SC' | 'IM' | 'IT';
  days: number[];     // e.g. [1], [1,8], [1,2,3,4,5]
  infusionTimeMin: number | null; // null = bolus or oral
}

export interface ProtocolPremedication {
  name: string;
  nameAr: string;
  dose: string;
  route: 'IV' | 'PO' | 'SC' | 'IM';
  timing: string;     // e.g. "30 min before chemo"
  timingAr: string;
}

export interface ProtocolSupportiveCare {
  medication: string;
  medicationAr: string;
  indication: string;
  indicationAr: string;
}

export interface ProtocolReference {
  title: string;
  url?: string;
  year?: number;
}

export interface ProtocolHydration {
  fluid: string;
  fluidAr: string;
  volume: string;
  rate: string;
  timing: string;
  timingAr: string;
}

export interface ProtocolDoseModification {
  condition: string;
  conditionAr: string;
  adjustment: string;
  adjustmentAr: string;
  notes?: string;
  notesAr?: string;
}

export interface StandardProtocol {
  id: string;
  name: string;
  nameAr: string;
  cancerType: string;
  cancerTypeAr: string;
  intent: string;
  emetogenicRisk: 'HIGH' | 'MODERATE' | 'LOW' | 'MINIMAL';
  cycleLengthDays: number;
  totalCyclesDefault: number;
  drugs: ProtocolDrug[];
  premedications: ProtocolPremedication[];
  supportiveCare: ProtocolSupportiveCare[];
  hydration: ProtocolHydration[];
  doseModifications: ProtocolDoseModification[];
  references: ProtocolReference[];
}

// ---------------------------------------------------------------------------
// Cancer Types (bilingual)
// ---------------------------------------------------------------------------

export const CANCER_TYPES: { value: string; labelAr: string; labelEn: string }[] = [
  { value: 'COLORECTAL', labelAr: 'القولون والمستقيم', labelEn: 'Colorectal' },
  { value: 'BREAST', labelAr: 'الثدي', labelEn: 'Breast' },
  { value: 'LYMPHOMA', labelAr: 'الأورام اللمفاوية', labelEn: 'Lymphoma' },
  { value: 'LUNG', labelAr: 'الرئة', labelEn: 'Lung' },
  { value: 'STOMACH', labelAr: 'المعدة', labelEn: 'Stomach' },
  { value: 'OVARIAN', labelAr: 'المبيض', labelEn: 'Ovarian' },
  { value: 'HEAD_NECK', labelAr: 'الرأس والعنق', labelEn: 'Head & Neck' },
  { value: 'PANCREATIC', labelAr: 'البنكرياس', labelEn: 'Pancreatic' },
  { value: 'BLADDER', labelAr: 'المثانة', labelEn: 'Bladder' },
  { value: 'PROSTATE', labelAr: 'البروستاتا', labelEn: 'Prostate' },
  { value: 'LEUKEMIA', labelAr: 'اللوكيميا', labelEn: 'Leukemia' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];

// ---------------------------------------------------------------------------
// Emetogenic Risk Levels
// ---------------------------------------------------------------------------

export const EMETOGENIC_RISKS: { value: string; labelAr: string; labelEn: string; color: string }[] = [
  { value: 'HIGH', labelAr: 'عالي', labelEn: 'High', color: 'bg-red-100 text-red-800' },
  { value: 'MODERATE', labelAr: 'متوسط', labelEn: 'Moderate', color: 'bg-orange-100 text-orange-800' },
  { value: 'LOW', labelAr: 'منخفض', labelEn: 'Low', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'MINIMAL', labelAr: 'طفيف', labelEn: 'Minimal', color: 'bg-green-100 text-green-800' },
];

// ---------------------------------------------------------------------------
// Treatment Intents
// ---------------------------------------------------------------------------

export const INTENTS: { value: string; labelAr: string; labelEn: string }[] = [
  { value: 'CURATIVE', labelAr: 'علاجي', labelEn: 'Curative' },
  { value: 'NEOADJUVANT', labelAr: 'مساعد قبل الجراحة', labelEn: 'Neoadjuvant' },
  { value: 'ADJUVANT', labelAr: 'مساعد بعد الجراحة', labelEn: 'Adjuvant' },
  { value: 'PALLIATIVE', labelAr: 'تلطيفي', labelEn: 'Palliative' },
  { value: 'MAINTENANCE', labelAr: 'صيانة', labelEn: 'Maintenance' },
];

// ---------------------------------------------------------------------------
// Drug Routes
// ---------------------------------------------------------------------------

export const DRUG_ROUTES: { value: string; labelAr: string; labelEn: string }[] = [
  { value: 'IV', labelAr: 'وريدي', labelEn: 'IV' },
  { value: 'PO', labelAr: 'فموي', labelEn: 'PO (Oral)' },
  { value: 'SC', labelAr: 'تحت الجلد', labelEn: 'SC' },
  { value: 'IM', labelAr: 'عضلي', labelEn: 'IM' },
  { value: 'IT', labelAr: 'داخل القراب', labelEn: 'IT (Intrathecal)' },
];

// ---------------------------------------------------------------------------
// Dose Calculation Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate BSA using the Mosteller formula:
 *   BSA (m2) = sqrt( (height_cm x weight_kg) / 3600 )
 */
export function calculateBSA(heightCm: number, weightKg: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  return Math.sqrt((heightCm * weightKg) / 3600);
}

/**
 * Calculate actual dose for a protocol drug given BSA.
 * Supports optional BSA capping (commonly at 2.0 m2).
 */
export function calculateDose(
  drug: ProtocolDrug,
  bsa: number,
  options?: { capBSA?: number; weightKg?: number },
): number {
  const effectiveBSA = options?.capBSA ? Math.min(bsa, options.capBSA) : bsa;

  switch (drug.unit) {
    case 'mg/m2':
    case 'units/m2':
      return Math.round(drug.dose * effectiveBSA * 100) / 100;
    case 'mg/kg':
      return options?.weightKg ? Math.round(drug.dose * options.weightKg * 100) / 100 : 0;
    case 'AUC':
      // AUC-based dosing (Calvert formula) requires GFR; return the AUC value as-is.
      // Actual calculation: Dose = AUC x (GFR + 25)
      return drug.dose;
    case 'mg':
      return drug.dose; // flat dose
    default:
      return drug.dose;
  }
}

/**
 * Format dose with unit string for display.
 */
export function formatDoseDisplay(drug: ProtocolDrug, bsa: number, opts?: { capBSA?: number; weightKg?: number }): string {
  const dose = calculateDose(drug, bsa, opts);
  if (drug.unit === 'AUC') return `AUC ${dose}`;
  return `${dose} mg`;
}

// ---------------------------------------------------------------------------
// Standard Protocol Library (15+ regimens)
// ---------------------------------------------------------------------------

const STANDARD_ANTIEMETICS_HIGH: ProtocolPremedication[] = [
  { name: 'Ondansetron', nameAr: 'أوندانسيترون', dose: '8 mg', route: 'IV', timing: '30 min before chemo', timingAr: '30 دقيقة قبل العلاج' },
  { name: 'Dexamethasone', nameAr: 'ديكساميثازون', dose: '12 mg', route: 'IV', timing: '30 min before chemo', timingAr: '30 دقيقة قبل العلاج' },
  { name: 'Aprepitant', nameAr: 'أبريبيتانت', dose: '125 mg D1, 80 mg D2-3', route: 'PO', timing: '1 hour before chemo on D1', timingAr: 'ساعة قبل العلاج في اليوم الأول' },
];

const STANDARD_ANTIEMETICS_MODERATE: ProtocolPremedication[] = [
  { name: 'Ondansetron', nameAr: 'أوندانسيترون', dose: '8 mg', route: 'IV', timing: '30 min before chemo', timingAr: '30 دقيقة قبل العلاج' },
  { name: 'Dexamethasone', nameAr: 'ديكساميثازون', dose: '8 mg', route: 'IV', timing: '30 min before chemo', timingAr: '30 دقيقة قبل العلاج' },
];

export const STANDARD_PROTOCOLS: StandardProtocol[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COLORECTAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'FOLFOX',
    name: 'FOLFOX (mFOLFOX6)',
    nameAr: 'فولفوكس (mFOLFOX6)',
    cancerType: 'COLORECTAL',
    cancerTypeAr: 'القولون والمستقيم',
    intent: 'ADJUVANT',
    emetogenicRisk: 'MODERATE',
    cycleLengthDays: 14,
    totalCyclesDefault: 12,
    drugs: [
      { name: 'Oxaliplatin', nameAr: 'أوكساليبلاتين', dose: 85, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 120 },
      { name: 'Leucovorin', nameAr: 'ليوكوفورين', dose: 400, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 120 },
      { name: '5-FU bolus', nameAr: '5-فلورويوراسيل بولس', dose: 400, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 5 },
      { name: '5-FU infusion', nameAr: '5-فلورويوراسيل تسريب', dose: 2400, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 2880 },
    ],
    premedications: [...STANDARD_ANTIEMETICS_MODERATE],
    supportiveCare: [
      { medication: 'Calcium/Magnesium infusion', medicationAr: 'تسريب كالسيوم/مغنيسيوم', indication: 'Oxaliplatin neuropathy prevention', indicationAr: 'الوقاية من اعتلال الأعصاب' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '500 mL', rate: '250 mL/hr', timing: 'Before oxaliplatin', timingAr: 'قبل أوكساليبلاتين' },
    ],
    doseModifications: [
      { condition: 'Grade 2+ neuropathy', conditionAr: 'اعتلال عصبي درجة 2+', adjustment: 'Reduce oxaliplatin by 25%', adjustmentAr: 'تقليل أوكساليبلاتين بنسبة 25%' },
      { condition: 'ANC < 1500 or PLT < 75,000', conditionAr: 'العدلات < 1500 أو الصفائح < 75,000', adjustment: 'Delay 1 week', adjustmentAr: 'تأجيل أسبوع' },
    ],
    references: [{ title: 'MOSAIC Trial - Andre et al. NEJM 2004', year: 2004 }],
  },
  {
    id: 'FOLFIRI',
    name: 'FOLFIRI',
    nameAr: 'فولفيري',
    cancerType: 'COLORECTAL',
    cancerTypeAr: 'القولون والمستقيم',
    intent: 'PALLIATIVE',
    emetogenicRisk: 'MODERATE',
    cycleLengthDays: 14,
    totalCyclesDefault: 12,
    drugs: [
      { name: 'Irinotecan', nameAr: 'إرينوتيكان', dose: 180, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 90 },
      { name: 'Leucovorin', nameAr: 'ليوكوفورين', dose: 400, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 120 },
      { name: '5-FU bolus', nameAr: '5-فلورويوراسيل بولس', dose: 400, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 5 },
      { name: '5-FU infusion', nameAr: '5-فلورويوراسيل تسريب', dose: 2400, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 2880 },
    ],
    premedications: [
      ...STANDARD_ANTIEMETICS_MODERATE,
      { name: 'Atropine', nameAr: 'أتروبين', dose: '0.25 mg', route: 'IV', timing: 'PRN for cholinergic syndrome', timingAr: 'عند الحاجة للمتلازمة الكولينية' },
    ],
    supportiveCare: [
      { medication: 'Loperamide', medicationAr: 'لوبيراميد', indication: 'Delayed diarrhea management', indicationAr: 'علاج الإسهال المتأخر' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '500 mL', rate: '250 mL/hr', timing: 'Pre-hydration', timingAr: 'ترطيب مسبق' },
    ],
    doseModifications: [
      { condition: 'Grade 3-4 diarrhea', conditionAr: 'إسهال درجة 3-4', adjustment: 'Reduce irinotecan by 25%', adjustmentAr: 'تقليل إرينوتيكان بنسبة 25%' },
    ],
    references: [{ title: 'Tournigand et al. JCO 2004', year: 2004 }],
  },
  {
    id: 'CAPOX',
    name: 'CAPOX (XELOX)',
    nameAr: 'كابوكس (زيلوكس)',
    cancerType: 'COLORECTAL',
    cancerTypeAr: 'القولون والمستقيم',
    intent: 'ADJUVANT',
    emetogenicRisk: 'MODERATE',
    cycleLengthDays: 21,
    totalCyclesDefault: 8,
    drugs: [
      { name: 'Oxaliplatin', nameAr: 'أوكساليبلاتين', dose: 130, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 120 },
      { name: 'Capecitabine', nameAr: 'كابسيتابين', dose: 1000, unit: 'mg/m2', route: 'PO', days: [1,2,3,4,5,6,7,8,9,10,11,12,13,14], infusionTimeMin: null },
    ],
    premedications: [...STANDARD_ANTIEMETICS_MODERATE],
    supportiveCare: [
      { medication: 'Calcium/Magnesium infusion', medicationAr: 'تسريب كالسيوم/مغنيسيوم', indication: 'Neuropathy prevention', indicationAr: 'الوقاية من اعتلال الأعصاب' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '500 mL', rate: '250 mL/hr', timing: 'Before oxaliplatin', timingAr: 'قبل أوكساليبلاتين' },
    ],
    doseModifications: [
      { condition: 'Hand-foot syndrome grade 2+', conditionAr: 'متلازمة اليد والقدم درجة 2+', adjustment: 'Reduce capecitabine by 25%', adjustmentAr: 'تقليل كابسيتابين بنسبة 25%' },
      { condition: 'Grade 2+ neuropathy', conditionAr: 'اعتلال عصبي درجة 2+', adjustment: 'Reduce oxaliplatin by 25%', adjustmentAr: 'تقليل أوكساليبلاتين بنسبة 25%' },
    ],
    references: [{ title: 'NO16966 Trial - Cassidy et al. JCO 2008', year: 2008 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BREAST
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'AC',
    name: 'AC (Adriamycin + Cyclophosphamide)',
    nameAr: 'AC (أدرياميسين + سيكلوفوسفاميد)',
    cancerType: 'BREAST',
    cancerTypeAr: 'الثدي',
    intent: 'ADJUVANT',
    emetogenicRisk: 'HIGH',
    cycleLengthDays: 21,
    totalCyclesDefault: 4,
    drugs: [
      { name: 'Doxorubicin', nameAr: 'دوكسوروبيسين', dose: 60, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 15 },
      { name: 'Cyclophosphamide', nameAr: 'سيكلوفوسفاميد', dose: 600, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 30 },
    ],
    premedications: [...STANDARD_ANTIEMETICS_HIGH],
    supportiveCare: [
      { medication: 'Pegfilgrastim', medicationAr: 'بيجفيلجراستيم', indication: 'Neutropenia prophylaxis', indicationAr: 'الوقاية من نقص العدلات' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '250 mL', rate: '250 mL/hr', timing: 'Before chemo', timingAr: 'قبل العلاج' },
    ],
    doseModifications: [
      { condition: 'LVEF < 50%', conditionAr: 'كسر القذف < 50%', adjustment: 'Hold doxorubicin, cardiology consult', adjustmentAr: 'إيقاف دوكسوروبيسين، استشارة قلب' },
      { condition: 'Febrile neutropenia', conditionAr: 'حمى مع نقص العدلات', adjustment: 'Dose reduce by 25%', adjustmentAr: 'تقليل الجرعة بنسبة 25%' },
    ],
    references: [{ title: 'Fisher et al. JCO 1990', year: 1990 }],
  },
  {
    id: 'AC-T',
    name: 'AC-T Dose-Dense',
    nameAr: 'AC-T مكثف الجرعة',
    cancerType: 'BREAST',
    cancerTypeAr: 'الثدي',
    intent: 'ADJUVANT',
    emetogenicRisk: 'HIGH',
    cycleLengthDays: 14,
    totalCyclesDefault: 8,
    drugs: [
      { name: 'Doxorubicin (cycles 1-4)', nameAr: 'دوكسوروبيسين (دورات 1-4)', dose: 60, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 15 },
      { name: 'Cyclophosphamide (cycles 1-4)', nameAr: 'سيكلوفوسفاميد (دورات 1-4)', dose: 600, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 30 },
      { name: 'Paclitaxel (cycles 5-8)', nameAr: 'باكليتاكسيل (دورات 5-8)', dose: 175, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 180 },
    ],
    premedications: [
      ...STANDARD_ANTIEMETICS_HIGH,
      { name: 'Diphenhydramine', nameAr: 'ديفينهيدرامين', dose: '50 mg', route: 'IV', timing: '30 min before paclitaxel', timingAr: '30 دقيقة قبل باكليتاكسيل' },
    ],
    supportiveCare: [
      { medication: 'Pegfilgrastim', medicationAr: 'بيجفيلجراستيم', indication: 'Mandatory G-CSF support (dose-dense)', indicationAr: 'دعم G-CSF إلزامي (مكثف الجرعة)' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '500 mL', rate: '250 mL/hr', timing: 'Pre-hydration', timingAr: 'ترطيب مسبق' },
    ],
    doseModifications: [
      { condition: 'Grade 3+ neuropathy', conditionAr: 'اعتلال عصبي درجة 3+', adjustment: 'Reduce paclitaxel by 20%', adjustmentAr: 'تقليل باكليتاكسيل بنسبة 20%' },
    ],
    references: [{ title: 'Citron et al. JCO 2003 (CALGB 9741)', year: 2003 }],
  },
  {
    id: 'TC',
    name: 'TC (Docetaxel + Cyclophosphamide)',
    nameAr: 'TC (دوسيتاكسيل + سيكلوفوسفاميد)',
    cancerType: 'BREAST',
    cancerTypeAr: 'الثدي',
    intent: 'ADJUVANT',
    emetogenicRisk: 'MODERATE',
    cycleLengthDays: 21,
    totalCyclesDefault: 4,
    drugs: [
      { name: 'Docetaxel', nameAr: 'دوسيتاكسيل', dose: 75, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 60 },
      { name: 'Cyclophosphamide', nameAr: 'سيكلوفوسفاميد', dose: 600, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 30 },
    ],
    premedications: [
      ...STANDARD_ANTIEMETICS_MODERATE,
      { name: 'Dexamethasone', nameAr: 'ديكساميثازون', dose: '8 mg BID x 3 days', route: 'PO', timing: 'Starting day before docetaxel', timingAr: 'يبدأ في اليوم السابق للدوسيتاكسيل' },
    ],
    supportiveCare: [
      { medication: 'Pegfilgrastim', medicationAr: 'بيجفيلجراستيم', indication: 'Neutropenia prophylaxis', indicationAr: 'الوقاية من نقص العدلات' },
    ],
    hydration: [],
    doseModifications: [
      { condition: 'Febrile neutropenia', conditionAr: 'حمى مع نقص العدلات', adjustment: 'Reduce docetaxel to 60 mg/m2', adjustmentAr: 'تقليل دوسيتاكسيل إلى 60 ملجم/م2' },
    ],
    references: [{ title: 'Jones et al. JCO 2006 (US Oncology 9735)', year: 2006 }],
  },
  {
    id: 'CMF',
    name: 'CMF (Classical)',
    nameAr: 'CMF (كلاسيكي)',
    cancerType: 'BREAST',
    cancerTypeAr: 'الثدي',
    intent: 'ADJUVANT',
    emetogenicRisk: 'MODERATE',
    cycleLengthDays: 28,
    totalCyclesDefault: 6,
    drugs: [
      { name: 'Cyclophosphamide', nameAr: 'سيكلوفوسفاميد', dose: 100, unit: 'mg/m2', route: 'PO', days: [1,2,3,4,5,6,7,8,9,10,11,12,13,14], infusionTimeMin: null },
      { name: 'Methotrexate', nameAr: 'ميثوتريكسيت', dose: 40, unit: 'mg/m2', route: 'IV', days: [1,8], infusionTimeMin: 5 },
      { name: '5-FU', nameAr: '5-فلورويوراسيل', dose: 600, unit: 'mg/m2', route: 'IV', days: [1,8], infusionTimeMin: 15 },
    ],
    premedications: [...STANDARD_ANTIEMETICS_MODERATE],
    supportiveCare: [
      { medication: 'Leucovorin rescue', medicationAr: 'إنقاذ بالليوكوفورين', indication: 'If methotrexate toxicity', indicationAr: 'في حال سمية ميثوتريكسيت' },
    ],
    hydration: [],
    doseModifications: [
      { condition: 'Mucositis grade 2+', conditionAr: 'التهاب الغشاء المخاطي درجة 2+', adjustment: 'Reduce 5-FU and methotrexate by 25%', adjustmentAr: 'تقليل 5-FU وميثوتريكسيت بنسبة 25%' },
    ],
    references: [{ title: 'Bonadonna et al. NEJM 1976', year: 1976 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LYMPHOMA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CHOP',
    name: 'CHOP',
    nameAr: 'تشوب',
    cancerType: 'LYMPHOMA',
    cancerTypeAr: 'الأورام اللمفاوية',
    intent: 'CURATIVE',
    emetogenicRisk: 'HIGH',
    cycleLengthDays: 21,
    totalCyclesDefault: 6,
    drugs: [
      { name: 'Cyclophosphamide', nameAr: 'سيكلوفوسفاميد', dose: 750, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 60 },
      { name: 'Doxorubicin', nameAr: 'دوكسوروبيسين', dose: 50, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 15 },
      { name: 'Vincristine', nameAr: 'فينكريستين', dose: 1.4, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 5 },
      { name: 'Prednisone', nameAr: 'بريدنيزون', dose: 100, unit: 'mg', route: 'PO', days: [1,2,3,4,5], infusionTimeMin: null },
    ],
    premedications: [...STANDARD_ANTIEMETICS_HIGH],
    supportiveCare: [
      { medication: 'Pegfilgrastim', medicationAr: 'بيجفيلجراستيم', indication: 'G-CSF prophylaxis', indicationAr: 'وقاية G-CSF' },
      { medication: 'Allopurinol', medicationAr: 'ألوبيورينول', indication: 'Tumor lysis prophylaxis (cycle 1)', indicationAr: 'الوقاية من متلازمة تحلل الورم (الدورة 1)' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '1000 mL', rate: '250 mL/hr', timing: 'Pre-hydration', timingAr: 'ترطيب مسبق' },
    ],
    doseModifications: [
      { condition: 'Vincristine max cap 2 mg total', conditionAr: 'الحد الأقصى للفينكريستين 2 ملجم', adjustment: 'Cap vincristine at 2 mg', adjustmentAr: 'تحديد فينكريستين عند 2 ملجم' },
    ],
    references: [{ title: 'McKelvey et al. Cancer 1976', year: 1976 }],
  },
  {
    id: 'R-CHOP',
    name: 'R-CHOP',
    nameAr: 'R-تشوب',
    cancerType: 'LYMPHOMA',
    cancerTypeAr: 'الأورام اللمفاوية',
    intent: 'CURATIVE',
    emetogenicRisk: 'HIGH',
    cycleLengthDays: 21,
    totalCyclesDefault: 6,
    drugs: [
      { name: 'Rituximab', nameAr: 'ريتوكسيماب', dose: 375, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 270 },
      { name: 'Cyclophosphamide', nameAr: 'سيكلوفوسفاميد', dose: 750, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 60 },
      { name: 'Doxorubicin', nameAr: 'دوكسوروبيسين', dose: 50, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 15 },
      { name: 'Vincristine', nameAr: 'فينكريستين', dose: 1.4, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 5 },
      { name: 'Prednisone', nameAr: 'بريدنيزون', dose: 100, unit: 'mg', route: 'PO', days: [1,2,3,4,5], infusionTimeMin: null },
    ],
    premedications: [
      ...STANDARD_ANTIEMETICS_HIGH,
      { name: 'Acetaminophen', nameAr: 'أسيتامينوفين', dose: '650 mg', route: 'PO', timing: '30 min before rituximab', timingAr: '30 دقيقة قبل ريتوكسيماب' },
      { name: 'Diphenhydramine', nameAr: 'ديفينهيدرامين', dose: '50 mg', route: 'IV', timing: '30 min before rituximab', timingAr: '30 دقيقة قبل ريتوكسيماب' },
    ],
    supportiveCare: [
      { medication: 'Pegfilgrastim', medicationAr: 'بيجفيلجراستيم', indication: 'G-CSF prophylaxis', indicationAr: 'وقاية G-CSF' },
      { medication: 'Allopurinol', medicationAr: 'ألوبيورينول', indication: 'Tumor lysis prophylaxis', indicationAr: 'الوقاية من متلازمة تحلل الورم' },
      { medication: 'TMP-SMX', medicationAr: 'TMP-SMX', indication: 'PJP prophylaxis', indicationAr: 'الوقاية من PJP' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '1000 mL', rate: '250 mL/hr', timing: 'Pre-hydration', timingAr: 'ترطيب مسبق' },
    ],
    doseModifications: [
      { condition: 'Rituximab infusion reaction', conditionAr: 'تفاعل تسريب ريتوكسيماب', adjustment: 'Slow rate by 50%, may resume at 50% rate', adjustmentAr: 'إبطاء المعدل بنسبة 50%' },
      { condition: 'Vincristine max cap 2 mg', conditionAr: 'الحد الأقصى للفينكريستين 2 ملجم', adjustment: 'Cap vincristine at 2 mg', adjustmentAr: 'تحديد فينكريستين عند 2 ملجم' },
    ],
    references: [{ title: 'Coiffier et al. NEJM 2002 (GELA study)', year: 2002 }],
  },
  {
    id: 'ABVD',
    name: 'ABVD',
    nameAr: 'ABVD',
    cancerType: 'LYMPHOMA',
    cancerTypeAr: 'الأورام اللمفاوية',
    intent: 'CURATIVE',
    emetogenicRisk: 'MODERATE',
    cycleLengthDays: 28,
    totalCyclesDefault: 6,
    drugs: [
      { name: 'Doxorubicin', nameAr: 'دوكسوروبيسين', dose: 25, unit: 'mg/m2', route: 'IV', days: [1,15], infusionTimeMin: 15 },
      { name: 'Bleomycin', nameAr: 'بليوميسين', dose: 10, unit: 'units/m2', route: 'IV', days: [1,15], infusionTimeMin: 15 },
      { name: 'Vinblastine', nameAr: 'فينبلاستين', dose: 6, unit: 'mg/m2', route: 'IV', days: [1,15], infusionTimeMin: 5 },
      { name: 'Dacarbazine', nameAr: 'داكاربازين', dose: 375, unit: 'mg/m2', route: 'IV', days: [1,15], infusionTimeMin: 60 },
    ],
    premedications: [...STANDARD_ANTIEMETICS_MODERATE],
    supportiveCare: [
      { medication: 'Pulmonary function monitoring', medicationAr: 'مراقبة وظائف الرئة', indication: 'Bleomycin pulmonary toxicity', indicationAr: 'سمية بليوميسين الرئوية' },
    ],
    hydration: [],
    doseModifications: [
      { condition: 'DLCO < 60% predicted', conditionAr: 'DLCO < 60% من المتوقع', adjustment: 'Discontinue bleomycin', adjustmentAr: 'إيقاف بليوميسين' },
    ],
    references: [{ title: 'Bonadonna et al. Ann Intern Med 1975', year: 1975 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LUNG
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CARBO-PEMETREXED',
    name: 'Carboplatin + Pemetrexed',
    nameAr: 'كاربوبلاتين + بيميتريكسيد',
    cancerType: 'LUNG',
    cancerTypeAr: 'الرئة',
    intent: 'CURATIVE',
    emetogenicRisk: 'MODERATE',
    cycleLengthDays: 21,
    totalCyclesDefault: 4,
    drugs: [
      { name: 'Carboplatin', nameAr: 'كاربوبلاتين', dose: 5, unit: 'AUC', route: 'IV', days: [1], infusionTimeMin: 30 },
      { name: 'Pemetrexed', nameAr: 'بيميتريكسيد', dose: 500, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 10 },
    ],
    premedications: [
      ...STANDARD_ANTIEMETICS_MODERATE,
      { name: 'Folic acid', nameAr: 'حمض الفوليك', dose: '400 mcg daily', route: 'PO', timing: 'Start 1 week before, continue during treatment', timingAr: 'يبدأ قبل أسبوع، يستمر خلال العلاج' },
      { name: 'Vitamin B12', nameAr: 'فيتامين ب12', dose: '1000 mcg', route: 'IM', timing: 'Every 9 weeks', timingAr: 'كل 9 أسابيع' },
    ],
    supportiveCare: [
      { medication: 'Dexamethasone', medicationAr: 'ديكساميثازون', indication: 'Skin rash prevention (4 mg BID D-1 to D+1)', indicationAr: 'الوقاية من الطفح الجلدي' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '500 mL', rate: '250 mL/hr', timing: 'Pre-hydration', timingAr: 'ترطيب مسبق' },
    ],
    doseModifications: [
      { condition: 'CrCl < 45 mL/min', conditionAr: 'تصفية الكرياتينين < 45', adjustment: 'Hold pemetrexed', adjustmentAr: 'إيقاف بيميتريكسيد' },
    ],
    references: [{ title: 'Scagliotti et al. JCO 2008', year: 2008 }],
  },
  {
    id: 'CISPLATIN-ETOPOSIDE',
    name: 'Cisplatin + Etoposide (EP)',
    nameAr: 'سيسبلاتين + إيتوبوسيد (EP)',
    cancerType: 'LUNG',
    cancerTypeAr: 'الرئة',
    intent: 'CURATIVE',
    emetogenicRisk: 'HIGH',
    cycleLengthDays: 21,
    totalCyclesDefault: 4,
    drugs: [
      { name: 'Cisplatin', nameAr: 'سيسبلاتين', dose: 80, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 60 },
      { name: 'Etoposide', nameAr: 'إيتوبوسيد', dose: 100, unit: 'mg/m2', route: 'IV', days: [1,2,3], infusionTimeMin: 60 },
    ],
    premedications: [...STANDARD_ANTIEMETICS_HIGH],
    supportiveCare: [
      { medication: 'Aggressive IV hydration', medicationAr: 'ترطيب وريدي مكثف', indication: 'Cisplatin nephrotoxicity prevention', indicationAr: 'الوقاية من سمية الكلى' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '1000 mL', rate: '250 mL/hr', timing: 'Pre-cisplatin', timingAr: 'قبل سيسبلاتين' },
      { fluid: 'Normal Saline 0.9% + KCl + MgSO4', fluidAr: 'محلول ملحي مع بوتاسيوم ومغنيسيوم', volume: '1000 mL', rate: '250 mL/hr', timing: 'Post-cisplatin', timingAr: 'بعد سيسبلاتين' },
    ],
    doseModifications: [
      { condition: 'CrCl < 60 mL/min', conditionAr: 'تصفية الكرياتينين < 60', adjustment: 'Replace cisplatin with carboplatin AUC 5', adjustmentAr: 'استبدال سيسبلاتين بكاربوبلاتين AUC 5' },
      { condition: 'Grade 4 neutropenia > 7 days', conditionAr: 'نقص العدلات درجة 4 أكثر من 7 أيام', adjustment: 'Reduce etoposide by 25%', adjustmentAr: 'تقليل إيتوبوسيد بنسبة 25%' },
    ],
    references: [{ title: 'Sundstrom et al. JCO 2002', year: 2002 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STOMACH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'FLOT',
    name: 'FLOT',
    nameAr: 'فلوت',
    cancerType: 'STOMACH',
    cancerTypeAr: 'المعدة',
    intent: 'NEOADJUVANT',
    emetogenicRisk: 'HIGH',
    cycleLengthDays: 14,
    totalCyclesDefault: 8,
    drugs: [
      { name: 'Docetaxel', nameAr: 'دوسيتاكسيل', dose: 50, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 60 },
      { name: 'Oxaliplatin', nameAr: 'أوكساليبلاتين', dose: 85, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 120 },
      { name: 'Leucovorin', nameAr: 'ليوكوفورين', dose: 200, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 120 },
      { name: '5-FU infusion', nameAr: '5-فلورويوراسيل تسريب', dose: 2600, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 1440 },
    ],
    premedications: [...STANDARD_ANTIEMETICS_HIGH],
    supportiveCare: [
      { medication: 'G-CSF', medicationAr: 'G-CSF', indication: 'Neutropenia prophylaxis', indicationAr: 'الوقاية من نقص العدلات' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '1000 mL', rate: '250 mL/hr', timing: 'Pre-hydration', timingAr: 'ترطيب مسبق' },
    ],
    doseModifications: [
      { condition: 'Grade 3+ diarrhea', conditionAr: 'إسهال درجة 3+', adjustment: 'Reduce 5-FU by 25%', adjustmentAr: 'تقليل 5-FU بنسبة 25%' },
      { condition: 'Grade 2+ neuropathy', conditionAr: 'اعتلال عصبي درجة 2+', adjustment: 'Omit oxaliplatin', adjustmentAr: 'حذف أوكساليبلاتين' },
    ],
    references: [{ title: 'Al-Batran et al. Lancet 2019 (FLOT4-AIO)', year: 2019 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OVARIAN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CARBO-PACLITAXEL',
    name: 'Carboplatin + Paclitaxel',
    nameAr: 'كاربوبلاتين + باكليتاكسيل',
    cancerType: 'OVARIAN',
    cancerTypeAr: 'المبيض',
    intent: 'ADJUVANT',
    emetogenicRisk: 'HIGH',
    cycleLengthDays: 21,
    totalCyclesDefault: 6,
    drugs: [
      { name: 'Paclitaxel', nameAr: 'باكليتاكسيل', dose: 175, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 180 },
      { name: 'Carboplatin', nameAr: 'كاربوبلاتين', dose: 6, unit: 'AUC', route: 'IV', days: [1], infusionTimeMin: 60 },
    ],
    premedications: [
      ...STANDARD_ANTIEMETICS_HIGH,
      { name: 'Dexamethasone', nameAr: 'ديكساميثازون', dose: '20 mg', route: 'IV', timing: '30 min before paclitaxel', timingAr: '30 دقيقة قبل باكليتاكسيل' },
      { name: 'Diphenhydramine', nameAr: 'ديفينهيدرامين', dose: '50 mg', route: 'IV', timing: '30 min before paclitaxel', timingAr: '30 دقيقة قبل باكليتاكسيل' },
      { name: 'Ranitidine', nameAr: 'رانيتيدين', dose: '50 mg', route: 'IV', timing: '30 min before paclitaxel', timingAr: '30 دقيقة قبل باكليتاكسيل' },
    ],
    supportiveCare: [
      { medication: 'G-CSF (if needed)', medicationAr: 'G-CSF (عند الحاجة)', indication: 'Neutropenia prophylaxis', indicationAr: 'الوقاية من نقص العدلات' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '500 mL', rate: '250 mL/hr', timing: 'Pre-hydration', timingAr: 'ترطيب مسبق' },
    ],
    doseModifications: [
      { condition: 'PLT < 100,000', conditionAr: 'الصفائح < 100,000', adjustment: 'Reduce carboplatin to AUC 5', adjustmentAr: 'تقليل كاربوبلاتين إلى AUC 5' },
      { condition: 'Grade 3+ neuropathy', conditionAr: 'اعتلال عصبي درجة 3+', adjustment: 'Reduce paclitaxel by 20%', adjustmentAr: 'تقليل باكليتاكسيل بنسبة 20%' },
    ],
    references: [{ title: 'GOG-111 / OV-10 Trials, McGuire et al. NEJM 1996', year: 1996 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HEAD & NECK
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CISPLATIN-WEEKLY-HN',
    name: 'Cisplatin Weekly (Head & Neck)',
    nameAr: 'سيسبلاتين أسبوعي (رأس وعنق)',
    cancerType: 'HEAD_NECK',
    cancerTypeAr: 'الرأس والعنق',
    intent: 'CURATIVE',
    emetogenicRisk: 'HIGH',
    cycleLengthDays: 7,
    totalCyclesDefault: 7,
    drugs: [
      { name: 'Cisplatin', nameAr: 'سيسبلاتين', dose: 40, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 60 },
    ],
    premedications: [...STANDARD_ANTIEMETICS_HIGH],
    supportiveCare: [
      { medication: 'Aggressive hydration', medicationAr: 'ترطيب مكثف', indication: 'Nephrotoxicity prevention', indicationAr: 'الوقاية من سمية الكلى' },
      { medication: 'Audiometry monitoring', medicationAr: 'مراقبة السمع', indication: 'Ototoxicity monitoring', indicationAr: 'مراقبة سمية السمع' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '1000 mL', rate: '500 mL/hr', timing: 'Pre-cisplatin', timingAr: 'قبل سيسبلاتين' },
      { fluid: 'Normal Saline 0.9% + KCl + MgSO4', fluidAr: 'محلول ملحي مع بوتاسيوم ومغنيسيوم', volume: '1000 mL', rate: '250 mL/hr', timing: 'Post-cisplatin', timingAr: 'بعد سيسبلاتين' },
    ],
    doseModifications: [
      { condition: 'CrCl < 50 mL/min', conditionAr: 'تصفية الكرياتينين < 50', adjustment: 'Hold cisplatin, switch to carboplatin', adjustmentAr: 'إيقاف سيسبلاتين، التحويل لكاربوبلاتين' },
      { condition: 'Hearing loss CTCAE grade 2+', conditionAr: 'فقدان سمع درجة 2+', adjustment: 'Discontinue cisplatin', adjustmentAr: 'إيقاف سيسبلاتين' },
    ],
    references: [{ title: 'Bernier et al. NEJM 2004', year: 2004 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PANCREATIC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'FOLFIRINOX',
    name: 'FOLFIRINOX',
    nameAr: 'فولفيرينوكس',
    cancerType: 'PANCREATIC',
    cancerTypeAr: 'البنكرياس',
    intent: 'NEOADJUVANT',
    emetogenicRisk: 'HIGH',
    cycleLengthDays: 14,
    totalCyclesDefault: 12,
    drugs: [
      { name: 'Oxaliplatin', nameAr: 'أوكساليبلاتين', dose: 85, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 120 },
      { name: 'Irinotecan', nameAr: 'إرينوتيكان', dose: 180, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 90 },
      { name: 'Leucovorin', nameAr: 'ليوكوفورين', dose: 400, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 120 },
      { name: '5-FU bolus', nameAr: '5-فلورويوراسيل بولس', dose: 400, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 5 },
      { name: '5-FU infusion', nameAr: '5-فلورويوراسيل تسريب', dose: 2400, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: 2880 },
    ],
    premedications: [
      ...STANDARD_ANTIEMETICS_HIGH,
      { name: 'Atropine', nameAr: 'أتروبين', dose: '0.25 mg', route: 'SC', timing: 'PRN for cholinergic syndrome with irinotecan', timingAr: 'عند الحاجة للمتلازمة الكولينية' },
    ],
    supportiveCare: [
      { medication: 'G-CSF', medicationAr: 'G-CSF', indication: 'Neutropenia prophylaxis', indicationAr: 'الوقاية من نقص العدلات' },
      { medication: 'Loperamide', medicationAr: 'لوبيراميد', indication: 'Delayed diarrhea', indicationAr: 'الإسهال المتأخر' },
    ],
    hydration: [
      { fluid: 'Normal Saline 0.9%', fluidAr: 'محلول ملحي 0.9%', volume: '1000 mL', rate: '250 mL/hr', timing: 'Pre-hydration', timingAr: 'ترطيب مسبق' },
    ],
    doseModifications: [
      { condition: 'Age > 75 or ECOG 2', conditionAr: 'العمر > 75 أو ECOG 2', adjustment: 'Use modified FOLFIRINOX (reduce irinotecan to 150)', adjustmentAr: 'استخدام فولفيرينوكس المعدل (تقليل إرينوتيكان إلى 150)' },
    ],
    references: [{ title: 'Conroy et al. NEJM 2011 (PRODIGE 4/ACCORD 11)', year: 2011 }],
  },
];
