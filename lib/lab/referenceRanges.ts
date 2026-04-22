/**
 * Lab Reference Ranges for Thea EHR
 *
 * Provides normal and critical value ranges for common laboratory tests.
 * Includes bilingual names (Arabic + English) and gender/age-specific ranges.
 */

export interface ReferenceRange {
  testCode: string;
  testName: { ar: string; en: string };
  unit: string;
  normalRange: { min: number; max: number };
  criticalLow?: number;
  criticalHigh?: number;
  gender?: 'male' | 'female' | 'all';
  ageGroup?: 'adult' | 'pediatric' | 'neonate';
  category: string;
}

// ---------------------------------------------------------------------------
// Complete Blood Count (CBC)
// ---------------------------------------------------------------------------

const CBC: ReferenceRange[] = [
  {
    testCode: 'WBC',
    testName: { ar: 'كريات الدم البيضاء', en: 'White Blood Cells' },
    unit: '10^3/uL',
    normalRange: { min: 4.5, max: 11.0 },
    criticalLow: 1.0,
    criticalHigh: 30.0,
    gender: 'all',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'RBC_M',
    testName: { ar: 'كريات الدم الحمراء', en: 'Red Blood Cells' },
    unit: '10^6/uL',
    normalRange: { min: 4.7, max: 6.1 },
    gender: 'male',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'RBC_F',
    testName: { ar: 'كريات الدم الحمراء', en: 'Red Blood Cells' },
    unit: '10^6/uL',
    normalRange: { min: 4.2, max: 5.4 },
    gender: 'female',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'HGB_M',
    testName: { ar: 'الهيموجلوبين', en: 'Hemoglobin' },
    unit: 'g/dL',
    normalRange: { min: 14.0, max: 18.0 },
    criticalLow: 5.0,
    criticalHigh: 20.0,
    gender: 'male',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'HGB_F',
    testName: { ar: 'الهيموجلوبين', en: 'Hemoglobin' },
    unit: 'g/dL',
    normalRange: { min: 12.0, max: 16.0 },
    criticalLow: 5.0,
    criticalHigh: 20.0,
    gender: 'female',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'HCT_M',
    testName: { ar: 'الهيماتوكريت', en: 'Hematocrit' },
    unit: '%',
    normalRange: { min: 40, max: 54 },
    criticalLow: 20,
    criticalHigh: 60,
    gender: 'male',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'HCT_F',
    testName: { ar: 'الهيماتوكريت', en: 'Hematocrit' },
    unit: '%',
    normalRange: { min: 36, max: 48 },
    criticalLow: 20,
    criticalHigh: 60,
    gender: 'female',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'PLT',
    testName: { ar: 'الصفائح الدموية', en: 'Platelets' },
    unit: '10^3/uL',
    normalRange: { min: 150, max: 400 },
    criticalLow: 20,
    criticalHigh: 1000,
    gender: 'all',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'MCV',
    testName: { ar: 'متوسط حجم الكرية', en: 'Mean Corpuscular Volume' },
    unit: 'fL',
    normalRange: { min: 80, max: 100 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'MCH',
    testName: { ar: 'متوسط هيموجلوبين الكرية', en: 'Mean Corpuscular Hemoglobin' },
    unit: 'pg',
    normalRange: { min: 27, max: 33 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'CBC',
  },
  {
    testCode: 'MCHC',
    testName: { ar: 'تركيز هيموجلوبين الكرية', en: 'Mean Corpuscular Hemoglobin Concentration' },
    unit: 'g/dL',
    normalRange: { min: 32, max: 36 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'CBC',
  },
];

// ---------------------------------------------------------------------------
// Basic Metabolic Panel (BMP)
// ---------------------------------------------------------------------------

const BMP: ReferenceRange[] = [
  {
    testCode: 'GLU',
    testName: { ar: 'الجلوكوز (صائم)', en: 'Glucose (Fasting)' },
    unit: 'mg/dL',
    normalRange: { min: 70, max: 100 },
    criticalLow: 40,
    criticalHigh: 500,
    gender: 'all',
    ageGroup: 'adult',
    category: 'BMP',
  },
  {
    testCode: 'BUN',
    testName: { ar: 'نيتروجين يوريا الدم', en: 'Blood Urea Nitrogen' },
    unit: 'mg/dL',
    normalRange: { min: 7, max: 20 },
    criticalHigh: 100,
    gender: 'all',
    ageGroup: 'adult',
    category: 'BMP',
  },
  {
    testCode: 'CREA',
    testName: { ar: 'الكرياتينين', en: 'Creatinine' },
    unit: 'mg/dL',
    normalRange: { min: 0.7, max: 1.3 },
    criticalHigh: 10.0,
    gender: 'all',
    ageGroup: 'adult',
    category: 'BMP',
  },
  {
    testCode: 'NA',
    testName: { ar: 'الصوديوم', en: 'Sodium' },
    unit: 'mEq/L',
    normalRange: { min: 136, max: 145 },
    criticalLow: 120,
    criticalHigh: 160,
    gender: 'all',
    ageGroup: 'adult',
    category: 'BMP',
  },
  {
    testCode: 'K',
    testName: { ar: 'البوتاسيوم', en: 'Potassium' },
    unit: 'mEq/L',
    normalRange: { min: 3.5, max: 5.0 },
    criticalLow: 2.5,
    criticalHigh: 6.5,
    gender: 'all',
    ageGroup: 'adult',
    category: 'BMP',
  },
  {
    testCode: 'CA',
    testName: { ar: 'الكالسيوم', en: 'Calcium' },
    unit: 'mg/dL',
    normalRange: { min: 8.5, max: 10.5 },
    criticalLow: 6.0,
    criticalHigh: 13.0,
    gender: 'all',
    ageGroup: 'adult',
    category: 'BMP',
  },
  {
    testCode: 'CO2',
    testName: { ar: 'ثاني أكسيد الكربون', en: 'CO2 (Bicarbonate)' },
    unit: 'mEq/L',
    normalRange: { min: 23, max: 29 },
    criticalLow: 10,
    criticalHigh: 40,
    gender: 'all',
    ageGroup: 'adult',
    category: 'BMP',
  },
  {
    testCode: 'CL',
    testName: { ar: 'الكلورايد', en: 'Chloride' },
    unit: 'mEq/L',
    normalRange: { min: 98, max: 106 },
    criticalLow: 80,
    criticalHigh: 120,
    gender: 'all',
    ageGroup: 'adult',
    category: 'BMP',
  },
];

// ---------------------------------------------------------------------------
// Liver Function Tests (LFTs)
// ---------------------------------------------------------------------------

const LFT: ReferenceRange[] = [
  {
    testCode: 'ALT',
    testName: { ar: 'إنزيم الكبد ALT', en: 'Alanine Aminotransferase (ALT)' },
    unit: 'U/L',
    normalRange: { min: 7, max: 56 },
    criticalHigh: 1000,
    gender: 'all',
    ageGroup: 'adult',
    category: 'LFT',
  },
  {
    testCode: 'AST',
    testName: { ar: 'إنزيم الكبد AST', en: 'Aspartate Aminotransferase (AST)' },
    unit: 'U/L',
    normalRange: { min: 10, max: 40 },
    criticalHigh: 1000,
    gender: 'all',
    ageGroup: 'adult',
    category: 'LFT',
  },
  {
    testCode: 'ALP',
    testName: { ar: 'الفوسفاتاز القلوي', en: 'Alkaline Phosphatase (ALP)' },
    unit: 'U/L',
    normalRange: { min: 44, max: 147 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'LFT',
  },
  {
    testCode: 'TBIL',
    testName: { ar: 'البيليروبين الكلي', en: 'Total Bilirubin' },
    unit: 'mg/dL',
    normalRange: { min: 0.1, max: 1.2 },
    criticalHigh: 15.0,
    gender: 'all',
    ageGroup: 'adult',
    category: 'LFT',
  },
  {
    testCode: 'ALB',
    testName: { ar: 'الألبومين', en: 'Albumin' },
    unit: 'g/dL',
    normalRange: { min: 3.5, max: 5.5 },
    criticalLow: 1.5,
    gender: 'all',
    ageGroup: 'adult',
    category: 'LFT',
  },
];

// ---------------------------------------------------------------------------
// Lipid Panel
// ---------------------------------------------------------------------------

const LIPID: ReferenceRange[] = [
  {
    testCode: 'CHOL',
    testName: { ar: 'الكوليسترول الكلي', en: 'Total Cholesterol' },
    unit: 'mg/dL',
    normalRange: { min: 0, max: 200 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'LIPID',
  },
  {
    testCode: 'HDL',
    testName: { ar: 'الكوليسترول الجيد', en: 'HDL Cholesterol' },
    unit: 'mg/dL',
    normalRange: { min: 40, max: 60 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'LIPID',
  },
  {
    testCode: 'LDL',
    testName: { ar: 'الكوليسترول الضار', en: 'LDL Cholesterol' },
    unit: 'mg/dL',
    normalRange: { min: 0, max: 100 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'LIPID',
  },
  {
    testCode: 'TG',
    testName: { ar: 'الدهون الثلاثية', en: 'Triglycerides' },
    unit: 'mg/dL',
    normalRange: { min: 0, max: 150 },
    criticalHigh: 500,
    gender: 'all',
    ageGroup: 'adult',
    category: 'LIPID',
  },
];

// ---------------------------------------------------------------------------
// Special Tests
// ---------------------------------------------------------------------------

const SPECIAL: ReferenceRange[] = [
  {
    testCode: 'HBA1C',
    testName: { ar: 'السكر التراكمي', en: 'Hemoglobin A1c (HbA1c)' },
    unit: '%',
    normalRange: { min: 4.0, max: 5.6 },
    criticalHigh: 14.0,
    gender: 'all',
    ageGroup: 'adult',
    category: 'SPECIAL',
  },
  {
    testCode: 'TSH',
    testName: { ar: 'هرمون الغدة الدرقية', en: 'Thyroid Stimulating Hormone (TSH)' },
    unit: 'mIU/L',
    normalRange: { min: 0.4, max: 4.0 },
    criticalLow: 0.01,
    criticalHigh: 100.0,
    gender: 'all',
    ageGroup: 'adult',
    category: 'SPECIAL',
  },
  {
    testCode: 'INR',
    testName: { ar: 'نسبة التخثر الدولية', en: 'International Normalized Ratio (INR)' },
    unit: '',
    normalRange: { min: 0.8, max: 1.1 },
    criticalHigh: 5.0,
    gender: 'all',
    ageGroup: 'adult',
    category: 'COAGULATION',
  },
  {
    testCode: 'PT',
    testName: { ar: 'زمن البروثرومبين', en: 'Prothrombin Time (PT)' },
    unit: 'seconds',
    normalRange: { min: 11.0, max: 13.5 },
    criticalHigh: 30.0,
    gender: 'all',
    ageGroup: 'adult',
    category: 'COAGULATION',
  },
  {
    testCode: 'APTT',
    testName: { ar: 'زمن الثرومبوبلاستين الجزئي', en: 'Activated Partial Thromboplastin Time (aPTT)' },
    unit: 'seconds',
    normalRange: { min: 25, max: 35 },
    criticalHigh: 100,
    gender: 'all',
    ageGroup: 'adult',
    category: 'COAGULATION',
  },
  {
    testCode: 'TROP',
    testName: { ar: 'التروبونين', en: 'Troponin I' },
    unit: 'ng/mL',
    normalRange: { min: 0, max: 0.04 },
    criticalHigh: 0.4,
    gender: 'all',
    ageGroup: 'adult',
    category: 'CARDIAC',
  },
  {
    testCode: 'BNP',
    testName: { ar: 'الببتيد الدماغي المدر للصوديوم', en: 'B-type Natriuretic Peptide (BNP)' },
    unit: 'pg/mL',
    normalRange: { min: 0, max: 100 },
    criticalHigh: 900,
    gender: 'all',
    ageGroup: 'adult',
    category: 'CARDIAC',
  },
  {
    testCode: 'CRP',
    testName: { ar: 'البروتين التفاعلي C', en: 'C-Reactive Protein (CRP)' },
    unit: 'mg/L',
    normalRange: { min: 0, max: 10 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'INFLAMMATION',
  },
  {
    testCode: 'ESR_M',
    testName: { ar: 'سرعة ترسب الدم', en: 'Erythrocyte Sedimentation Rate (ESR)' },
    unit: 'mm/hr',
    normalRange: { min: 0, max: 15 },
    gender: 'male',
    ageGroup: 'adult',
    category: 'INFLAMMATION',
  },
  {
    testCode: 'ESR_F',
    testName: { ar: 'سرعة ترسب الدم', en: 'Erythrocyte Sedimentation Rate (ESR)' },
    unit: 'mm/hr',
    normalRange: { min: 0, max: 20 },
    gender: 'female',
    ageGroup: 'adult',
    category: 'INFLAMMATION',
  },
];

// ---------------------------------------------------------------------------
// Urinalysis
// ---------------------------------------------------------------------------

const URINALYSIS: ReferenceRange[] = [
  {
    testCode: 'URINE_PH',
    testName: { ar: 'حموضة البول', en: 'Urine pH' },
    unit: '',
    normalRange: { min: 4.5, max: 8.0 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'URINALYSIS',
  },
  {
    testCode: 'URINE_SG',
    testName: { ar: 'الكثافة النوعية للبول', en: 'Urine Specific Gravity' },
    unit: '',
    normalRange: { min: 1.005, max: 1.030 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'URINALYSIS',
  },
  {
    testCode: 'URINE_GLU',
    testName: { ar: 'جلوكوز البول', en: 'Urine Glucose' },
    unit: 'mg/dL',
    normalRange: { min: 0, max: 0 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'URINALYSIS',
  },
  {
    testCode: 'URINE_PROT',
    testName: { ar: 'بروتين البول', en: 'Urine Protein' },
    unit: 'mg/dL',
    normalRange: { min: 0, max: 0 },
    gender: 'all',
    ageGroup: 'adult',
    category: 'URINALYSIS',
  },
];

// ---------------------------------------------------------------------------
// Aggregated list
// ---------------------------------------------------------------------------

export const ALL_REFERENCE_RANGES: ReferenceRange[] = [
  ...CBC,
  ...BMP,
  ...LFT,
  ...LIPID,
  ...SPECIAL,
  ...URINALYSIS,
];

// ---------------------------------------------------------------------------
// Index by test code
// ---------------------------------------------------------------------------

const byCode = new Map<string, ReferenceRange[]>();
for (const range of ALL_REFERENCE_RANGES) {
  const baseCode = range.testCode.replace(/_[MF]$/, '').toUpperCase();
  if (!byCode.has(baseCode)) byCode.set(baseCode, []);
  byCode.get(baseCode)!.push(range);
  // Also index by exact code
  if (!byCode.has(range.testCode.toUpperCase())) byCode.set(range.testCode.toUpperCase(), []);
  byCode.get(range.testCode.toUpperCase())!.push(range);
}

/**
 * Get reference range(s) for a test code, optionally filtering by gender.
 */
export function getReferenceRange(
  testCode: string,
  gender?: 'male' | 'female'
): ReferenceRange | undefined {
  const code = String(testCode || '').toUpperCase();
  const ranges = byCode.get(code);
  if (!ranges || ranges.length === 0) return undefined;

  if (gender) {
    const gendered = ranges.find((r) => r.gender === gender);
    if (gendered) return gendered;
  }

  // Fallback to 'all' gender or first match
  return ranges.find((r) => r.gender === 'all') || ranges[0];
}

/**
 * Get all reference ranges for a given category.
 */
export function getRangesByCategory(category: string): ReferenceRange[] {
  return ALL_REFERENCE_RANGES.filter((r) => r.category === category);
}

/**
 * List all available test categories.
 */
export function getCategories(): string[] {
  return [...new Set(ALL_REFERENCE_RANGES.map((r) => r.category))];
}
