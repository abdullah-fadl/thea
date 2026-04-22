function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number): number {
  return Number((min + Math.random() * (max - min)).toFixed(decimals));
}

export interface LabTest {
  code: string;
  name: string;
  nameAr: string;
  parameters: LabParameter[];
}

export interface LabParameter {
  key: string;
  value: string;
  unit: string;
  normalRange: string;
}

const LAB_TESTS: Array<{ code: string; name: string; nameAr: string; genParams: () => LabParameter[] }> = [
  {
    code: 'CBC', name: 'Complete Blood Count', nameAr: 'تحليل دم شامل',
    genParams: () => [
      { key: 'WBC', value: String(randomFloat(4.0, 11.0, 1)), unit: '×10³/µL', normalRange: '4.0-11.0' },
      { key: 'RBC', value: String(randomFloat(4.0, 5.5, 2)), unit: '×10⁶/µL', normalRange: '4.0-5.5' },
      { key: 'Hgb', value: String(randomFloat(12.0, 17.0, 1)), unit: 'g/dL', normalRange: '12.0-17.0' },
      { key: 'Hct', value: String(randomFloat(36, 50, 1)), unit: '%', normalRange: '36-50' },
      { key: 'Plt', value: String(randomBetween(150, 400)), unit: '×10³/µL', normalRange: '150-400' },
    ],
  },
  {
    code: 'BMP', name: 'Basic Metabolic Panel', nameAr: 'لوحة أيض أساسية',
    genParams: () => [
      { key: 'Glucose', value: String(randomBetween(70, 110)), unit: 'mg/dL', normalRange: '70-110' },
      { key: 'BUN', value: String(randomBetween(7, 20)), unit: 'mg/dL', normalRange: '7-20' },
      { key: 'Creatinine', value: String(randomFloat(0.6, 1.2, 1)), unit: 'mg/dL', normalRange: '0.6-1.2' },
      { key: 'Na', value: String(randomBetween(136, 145)), unit: 'mEq/L', normalRange: '136-145' },
      { key: 'K', value: String(randomFloat(3.5, 5.0, 1)), unit: 'mEq/L', normalRange: '3.5-5.0' },
    ],
  },
  {
    code: 'LFT', name: 'Liver Function Tests', nameAr: 'وظائف الكبد',
    genParams: () => [
      { key: 'ALT', value: String(randomBetween(7, 56)), unit: 'U/L', normalRange: '7-56' },
      { key: 'AST', value: String(randomBetween(10, 40)), unit: 'U/L', normalRange: '10-40' },
      { key: 'ALP', value: String(randomBetween(44, 147)), unit: 'U/L', normalRange: '44-147' },
      { key: 'TBil', value: String(randomFloat(0.1, 1.2, 1)), unit: 'mg/dL', normalRange: '0.1-1.2' },
      { key: 'Albumin', value: String(randomFloat(3.5, 5.0, 1)), unit: 'g/dL', normalRange: '3.5-5.0' },
    ],
  },
  {
    code: 'TSH', name: 'Thyroid Stimulating Hormone', nameAr: 'هرمون الغدة الدرقية',
    genParams: () => [
      { key: 'TSH', value: String(randomFloat(0.4, 4.0, 2)), unit: 'mIU/L', normalRange: '0.4-4.0' },
    ],
  },
  {
    code: 'HBA1C', name: 'Hemoglobin A1c', nameAr: 'السكر التراكمي',
    genParams: () => [
      { key: 'HbA1c', value: String(randomFloat(4.0, 6.5, 1)), unit: '%', normalRange: '4.0-5.6' },
    ],
  },
  {
    code: 'LIPID', name: 'Lipid Panel', nameAr: 'لوحة الدهون',
    genParams: () => [
      { key: 'TChol', value: String(randomBetween(130, 200)), unit: 'mg/dL', normalRange: '<200' },
      { key: 'LDL', value: String(randomBetween(50, 130)), unit: 'mg/dL', normalRange: '<130' },
      { key: 'HDL', value: String(randomBetween(40, 80)), unit: 'mg/dL', normalRange: '>40' },
      { key: 'TG', value: String(randomBetween(50, 150)), unit: 'mg/dL', normalRange: '<150' },
    ],
  },
  {
    code: 'CRP', name: 'C-Reactive Protein', nameAr: 'بروتين سي التفاعلي',
    genParams: () => [
      { key: 'CRP', value: String(randomFloat(0.1, 5.0, 1)), unit: 'mg/L', normalRange: '<5.0' },
    ],
  },
  {
    code: 'URINE', name: 'Urinalysis', nameAr: 'تحليل بول',
    genParams: () => [
      { key: 'pH', value: String(randomFloat(5.0, 7.5, 1)), unit: '', normalRange: '5.0-7.5' },
      { key: 'Protein', value: 'Negative', unit: '', normalRange: 'Negative' },
      { key: 'Glucose', value: 'Negative', unit: '', normalRange: 'Negative' },
      { key: 'WBC', value: String(randomBetween(0, 5)), unit: '/HPF', normalRange: '0-5' },
    ],
  },
];

export class LabTestGenerator {
  random(): LabTest {
    const t = pick(LAB_TESTS);
    return { code: t.code, name: t.name, nameAr: t.nameAr, parameters: t.genParams() };
  }

  byCode(code: string): LabTest | undefined {
    const t = LAB_TESTS.find((l) => l.code === code);
    if (!t) return undefined;
    return { code: t.code, name: t.name, nameAr: t.nameAr, parameters: t.genParams() };
  }

  /** Generate a critical CBC with WBC=45000 */
  criticalCBC(): LabTest {
    return {
      code: 'CBC', name: 'Complete Blood Count', nameAr: 'تحليل دم شامل',
      parameters: [
        { key: 'WBC', value: '45.0', unit: '×10³/µL', normalRange: '4.0-11.0' },
        { key: 'RBC', value: '3.2', unit: '×10⁶/µL', normalRange: '4.0-5.5' },
        { key: 'Hgb', value: '8.5', unit: 'g/dL', normalRange: '12.0-17.0' },
        { key: 'Hct', value: '28.0', unit: '%', normalRange: '36-50' },
        { key: 'Plt', value: '45', unit: '×10³/µL', normalRange: '150-400' },
      ],
    };
  }
}
