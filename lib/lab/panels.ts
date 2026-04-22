/**
 * Lab Panel / Profile Grouping
 *
 * Pre-built panels for ordering groups of related tests. Each panel defines:
 *  - Test codes included
 *  - Tube type/color
 *  - Sample volume
 *  - Expected TAT
 *  - Department
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TubeColor = 'lavender' | 'green' | 'gold' | 'blue' | 'gray' | 'yellow' | 'red';

export interface PanelTest {
  testCode: string;
  testName: { ar: string; en: string };
  unit: string;
  required: boolean;
}

export interface LabPanel {
  id: string;
  code: string;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  department: string;
  tubeType: TubeColor;
  tubeLabel: { ar: string; en: string };
  sampleVolume: string;
  expectedTatMinutes: number;
  tests: PanelTest[];
}

// ---------------------------------------------------------------------------
// 10 Pre-built Panels
// ---------------------------------------------------------------------------

export const LAB_PANELS: LabPanel[] = [
  // 1. CBC
  {
    id: 'panel_cbc',
    code: 'CBC',
    name: { ar: 'تعداد الدم الكامل', en: 'Complete Blood Count (CBC)' },
    description: { ar: 'فحص شامل لخلايا الدم', en: 'Comprehensive blood cell analysis' },
    department: 'Hematology',
    tubeType: 'lavender',
    tubeLabel: { ar: 'أنبوب بنفسجي (EDTA)', en: 'Lavender (EDTA)' },
    sampleVolume: '3 mL',
    expectedTatMinutes: 60,
    tests: [
      { testCode: 'WBC', testName: { ar: 'كريات الدم البيضاء', en: 'WBC' }, unit: '10^3/uL', required: true },
      { testCode: 'RBC', testName: { ar: 'كريات الدم الحمراء', en: 'RBC' }, unit: '10^6/uL', required: true },
      { testCode: 'HGB', testName: { ar: 'الهيموجلوبين', en: 'Hemoglobin' }, unit: 'g/dL', required: true },
      { testCode: 'HCT', testName: { ar: 'الهيماتوكريت', en: 'Hematocrit' }, unit: '%', required: true },
      { testCode: 'PLT', testName: { ar: 'الصفائح الدموية', en: 'Platelets' }, unit: '10^3/uL', required: true },
      { testCode: 'MCV', testName: { ar: 'متوسط حجم الكرية', en: 'MCV' }, unit: 'fL', required: true },
      { testCode: 'MCH', testName: { ar: 'متوسط هيموجلوبين الكرية', en: 'MCH' }, unit: 'pg', required: true },
      { testCode: 'MCHC', testName: { ar: 'تركيز هيموجلوبين الكرية', en: 'MCHC' }, unit: 'g/dL', required: true },
    ],
  },

  // 2. BMP
  {
    id: 'panel_bmp',
    code: 'BMP',
    name: { ar: 'لوحة الأيض الأساسية', en: 'Basic Metabolic Panel (BMP)' },
    description: { ar: 'فحص السكر والكلى والأملاح', en: 'Glucose, kidney function, electrolytes' },
    department: 'Chemistry',
    tubeType: 'gold',
    tubeLabel: { ar: 'أنبوب ذهبي (SST)', en: 'Gold (SST)' },
    sampleVolume: '5 mL',
    expectedTatMinutes: 90,
    tests: [
      { testCode: 'GLU', testName: { ar: 'الجلوكوز', en: 'Glucose' }, unit: 'mg/dL', required: true },
      { testCode: 'BUN', testName: { ar: 'نيتروجين يوريا الدم', en: 'BUN' }, unit: 'mg/dL', required: true },
      { testCode: 'CREA', testName: { ar: 'الكرياتينين', en: 'Creatinine' }, unit: 'mg/dL', required: true },
      { testCode: 'NA', testName: { ar: 'الصوديوم', en: 'Sodium' }, unit: 'mEq/L', required: true },
      { testCode: 'K', testName: { ar: 'البوتاسيوم', en: 'Potassium' }, unit: 'mEq/L', required: true },
      { testCode: 'CA', testName: { ar: 'الكالسيوم', en: 'Calcium' }, unit: 'mg/dL', required: true },
      { testCode: 'CO2', testName: { ar: 'ثاني أكسيد الكربون', en: 'CO2' }, unit: 'mEq/L', required: true },
      { testCode: 'CL', testName: { ar: 'الكلورايد', en: 'Chloride' }, unit: 'mEq/L', required: true },
    ],
  },

  // 3. CMP (BMP + LFT + protein)
  {
    id: 'panel_cmp',
    code: 'CMP',
    name: { ar: 'لوحة الأيض الشاملة', en: 'Comprehensive Metabolic Panel (CMP)' },
    description: { ar: 'لوحة أيض أساسية + وظائف كبد + بروتين', en: 'BMP + liver function + protein' },
    department: 'Chemistry',
    tubeType: 'gold',
    tubeLabel: { ar: 'أنبوب ذهبي (SST)', en: 'Gold (SST)' },
    sampleVolume: '5 mL',
    expectedTatMinutes: 120,
    tests: [
      { testCode: 'GLU', testName: { ar: 'الجلوكوز', en: 'Glucose' }, unit: 'mg/dL', required: true },
      { testCode: 'BUN', testName: { ar: 'نيتروجين يوريا الدم', en: 'BUN' }, unit: 'mg/dL', required: true },
      { testCode: 'CREA', testName: { ar: 'الكرياتينين', en: 'Creatinine' }, unit: 'mg/dL', required: true },
      { testCode: 'NA', testName: { ar: 'الصوديوم', en: 'Sodium' }, unit: 'mEq/L', required: true },
      { testCode: 'K', testName: { ar: 'البوتاسيوم', en: 'Potassium' }, unit: 'mEq/L', required: true },
      { testCode: 'CA', testName: { ar: 'الكالسيوم', en: 'Calcium' }, unit: 'mg/dL', required: true },
      { testCode: 'CO2', testName: { ar: 'ثاني أكسيد الكربون', en: 'CO2' }, unit: 'mEq/L', required: true },
      { testCode: 'CL', testName: { ar: 'الكلورايد', en: 'Chloride' }, unit: 'mEq/L', required: true },
      { testCode: 'ALT', testName: { ar: 'إنزيم ALT', en: 'ALT' }, unit: 'U/L', required: true },
      { testCode: 'AST', testName: { ar: 'إنزيم AST', en: 'AST' }, unit: 'U/L', required: true },
      { testCode: 'ALP', testName: { ar: 'الفوسفاتاز القلوي', en: 'ALP' }, unit: 'U/L', required: true },
      { testCode: 'TBIL', testName: { ar: 'البيليروبين الكلي', en: 'Total Bilirubin' }, unit: 'mg/dL', required: true },
      { testCode: 'ALB', testName: { ar: 'الألبومين', en: 'Albumin' }, unit: 'g/dL', required: true },
    ],
  },

  // 4. LFT
  {
    id: 'panel_lft',
    code: 'LFT',
    name: { ar: 'وظائف الكبد', en: 'Liver Function Tests (LFT)' },
    description: { ar: 'إنزيمات الكبد والبيليروبين', en: 'Liver enzymes and bilirubin' },
    department: 'Chemistry',
    tubeType: 'gold',
    tubeLabel: { ar: 'أنبوب ذهبي (SST)', en: 'Gold (SST)' },
    sampleVolume: '5 mL',
    expectedTatMinutes: 90,
    tests: [
      { testCode: 'ALT', testName: { ar: 'إنزيم ALT', en: 'ALT' }, unit: 'U/L', required: true },
      { testCode: 'AST', testName: { ar: 'إنزيم AST', en: 'AST' }, unit: 'U/L', required: true },
      { testCode: 'ALP', testName: { ar: 'الفوسفاتاز القلوي', en: 'ALP' }, unit: 'U/L', required: true },
      { testCode: 'TBIL', testName: { ar: 'البيليروبين الكلي', en: 'Total Bilirubin' }, unit: 'mg/dL', required: true },
      { testCode: 'ALB', testName: { ar: 'الألبومين', en: 'Albumin' }, unit: 'g/dL', required: true },
    ],
  },

  // 5. Lipid Panel
  {
    id: 'panel_lipid',
    code: 'LIPID',
    name: { ar: 'لوحة الدهون', en: 'Lipid Panel' },
    description: { ar: 'الكوليسترول والدهون الثلاثية', en: 'Cholesterol and triglycerides' },
    department: 'Chemistry',
    tubeType: 'gold',
    tubeLabel: { ar: 'أنبوب ذهبي (SST)', en: 'Gold (SST)' },
    sampleVolume: '5 mL',
    expectedTatMinutes: 90,
    tests: [
      { testCode: 'CHOL', testName: { ar: 'الكوليسترول الكلي', en: 'Total Cholesterol' }, unit: 'mg/dL', required: true },
      { testCode: 'HDL', testName: { ar: 'الكوليسترول الجيد', en: 'HDL' }, unit: 'mg/dL', required: true },
      { testCode: 'LDL', testName: { ar: 'الكوليسترول الضار', en: 'LDL' }, unit: 'mg/dL', required: true },
      { testCode: 'TG', testName: { ar: 'الدهون الثلاثية', en: 'Triglycerides' }, unit: 'mg/dL', required: true },
    ],
  },

  // 6. Thyroid Panel
  {
    id: 'panel_thyroid',
    code: 'THYROID',
    name: { ar: 'وظائف الغدة الدرقية', en: 'Thyroid Panel' },
    description: { ar: 'TSH وهرمونات الغدة الدرقية', en: 'TSH and thyroid hormones' },
    department: 'Chemistry',
    tubeType: 'gold',
    tubeLabel: { ar: 'أنبوب ذهبي (SST)', en: 'Gold (SST)' },
    sampleVolume: '5 mL',
    expectedTatMinutes: 180,
    tests: [
      { testCode: 'TSH', testName: { ar: 'هرمون TSH', en: 'TSH' }, unit: 'mIU/L', required: true },
      { testCode: 'FT4', testName: { ar: 'هرمون T4 الحر', en: 'Free T4' }, unit: 'ng/dL', required: true },
      { testCode: 'FT3', testName: { ar: 'هرمون T3 الحر', en: 'Free T3' }, unit: 'pg/mL', required: false },
    ],
  },

  // 7. Coagulation Panel
  {
    id: 'panel_coag',
    code: 'COAG',
    name: { ar: 'لوحة التخثر', en: 'Coagulation Panel' },
    description: { ar: 'زمن التخثر و INR', en: 'PT, aPTT, INR' },
    department: 'Hematology',
    tubeType: 'blue',
    tubeLabel: { ar: 'أنبوب أزرق (سيترات)', en: 'Blue (Citrate)' },
    sampleVolume: '2.7 mL',
    expectedTatMinutes: 60,
    tests: [
      { testCode: 'PT', testName: { ar: 'زمن البروثرومبين', en: 'PT' }, unit: 'seconds', required: true },
      { testCode: 'INR', testName: { ar: 'نسبة INR', en: 'INR' }, unit: '', required: true },
      { testCode: 'APTT', testName: { ar: 'زمن aPTT', en: 'aPTT' }, unit: 'seconds', required: true },
    ],
  },

  // 8. Urinalysis Panel
  {
    id: 'panel_ua',
    code: 'UA',
    name: { ar: 'تحليل بول شامل', en: 'Urinalysis' },
    description: { ar: 'فحص كيميائي ومجهري للبول', en: 'Chemical and microscopic urine analysis' },
    department: 'Urinalysis',
    tubeType: 'yellow',
    tubeLabel: { ar: 'كأس بول', en: 'Urine Cup' },
    sampleVolume: '30 mL',
    expectedTatMinutes: 60,
    tests: [
      { testCode: 'URINE_PH', testName: { ar: 'حموضة البول', en: 'pH' }, unit: '', required: true },
      { testCode: 'URINE_SG', testName: { ar: 'الكثافة النوعية', en: 'Specific Gravity' }, unit: '', required: true },
      { testCode: 'URINE_GLU', testName: { ar: 'جلوكوز البول', en: 'Glucose' }, unit: 'mg/dL', required: true },
      { testCode: 'URINE_PROT', testName: { ar: 'بروتين البول', en: 'Protein' }, unit: 'mg/dL', required: true },
    ],
  },

  // 9. Cardiac Markers
  {
    id: 'panel_cardiac',
    code: 'CARDIAC',
    name: { ar: 'دلالات القلب', en: 'Cardiac Markers' },
    description: { ar: 'تروبونين و BNP', en: 'Troponin I, BNP' },
    department: 'Chemistry',
    tubeType: 'green',
    tubeLabel: { ar: 'أنبوب أخضر (هيبارين)', en: 'Green (Heparin)' },
    sampleVolume: '4 mL',
    expectedTatMinutes: 45,
    tests: [
      { testCode: 'TROP', testName: { ar: 'التروبونين', en: 'Troponin I' }, unit: 'ng/mL', required: true },
      { testCode: 'BNP', testName: { ar: 'ببتيد BNP', en: 'BNP' }, unit: 'pg/mL', required: true },
    ],
  },

  // 10. HbA1c
  {
    id: 'panel_hba1c',
    code: 'HBA1C',
    name: { ar: 'السكر التراكمي', en: 'HbA1c' },
    description: { ar: 'نسبة الهيموجلوبين السكري', en: 'Glycated hemoglobin percentage' },
    department: 'Chemistry',
    tubeType: 'lavender',
    tubeLabel: { ar: 'أنبوب بنفسجي (EDTA)', en: 'Lavender (EDTA)' },
    sampleVolume: '3 mL',
    expectedTatMinutes: 120,
    tests: [
      { testCode: 'HBA1C', testName: { ar: 'السكر التراكمي', en: 'HbA1c' }, unit: '%', required: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const panelByCode = new Map<string, LabPanel>();
const panelById = new Map<string, LabPanel>();
for (const panel of LAB_PANELS) {
  panelByCode.set(panel.code.toUpperCase(), panel);
  panelById.set(panel.id, panel);
}

export function getPanelByCode(code: string): LabPanel | undefined {
  return panelByCode.get(code.toUpperCase());
}

export function getPanelById(id: string): LabPanel | undefined {
  return panelById.get(id);
}

export function getAllPanels(): LabPanel[] {
  return LAB_PANELS;
}

export function getPanelsByDepartment(department: string): LabPanel[] {
  return LAB_PANELS.filter((p) => p.department === department);
}

export function getDepartments(): string[] {
  return [...new Set(LAB_PANELS.map((p) => p.department))];
}

/**
 * Map from tube color to CSS classes for rendering tube indicators.
 */
export const TUBE_COLORS: Record<TubeColor, { bg: string; text: string; label: string }> = {
  lavender: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'EDTA' },
  green: { bg: 'bg-green-100', text: 'text-green-700', label: 'Heparin' },
  gold: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'SST' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Citrate' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Fluoride' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'ACD' },
  red: { bg: 'bg-red-100', text: 'text-red-700', label: 'Plain' },
};

/**
 * Given a list of panels, determine the unique tubes needed for collection.
 * Merges panels that share the same tube type.
 */
export function getRequiredTubes(panelCodes: string[]): {
  tubeType: TubeColor;
  tubeLabel: { ar: string; en: string };
  totalVolume: string;
  panels: string[];
}[] {
  const tubeMap = new Map<TubeColor, { panels: string[]; volumeMl: number; label: { ar: string; en: string } }>();

  for (const code of panelCodes) {
    const panel = getPanelByCode(code);
    if (!panel) continue;

    const existing = tubeMap.get(panel.tubeType);
    const vol = parseFloat(panel.sampleVolume) || 0;

    if (existing) {
      existing.panels.push(panel.code);
      existing.volumeMl += vol;
    } else {
      tubeMap.set(panel.tubeType, {
        panels: [panel.code],
        volumeMl: vol,
        label: panel.tubeLabel,
      });
    }
  }

  return Array.from(tubeMap.entries()).map(([tubeType, data]) => ({
    tubeType,
    tubeLabel: data.label,
    totalVolume: `${data.volumeMl} mL`,
    panels: data.panels,
  }));
}
