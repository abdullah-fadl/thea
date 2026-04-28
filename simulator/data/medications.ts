function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface Medication {
  code: string;
  name: string;
  nameAr: string;
  dosage: string;
  frequency: string;
  route: string;
}

export const COMMON_MEDICATIONS: Medication[] = [
  { code: 'AMOX-500', name: 'Amoxicillin 500mg', nameAr: 'أموكسيسيلين ٥٠٠ ملغ', dosage: '500mg', frequency: 'TDS', route: 'PO' },
  { code: 'PARA-500', name: 'Paracetamol 500mg', nameAr: 'باراسيتامول ٥٠٠ ملغ', dosage: '500mg', frequency: 'QID PRN', route: 'PO' },
  { code: 'IBUP-400', name: 'Ibuprofen 400mg', nameAr: 'ايبوبروفين ٤٠٠ ملغ', dosage: '400mg', frequency: 'TDS', route: 'PO' },
  { code: 'OMEP-20', name: 'Omeprazole 20mg', nameAr: 'أوميبرازول ٢٠ ملغ', dosage: '20mg', frequency: 'OD', route: 'PO' },
  { code: 'METF-500', name: 'Metformin 500mg', nameAr: 'ميتفورمين ٥٠٠ ملغ', dosage: '500mg', frequency: 'BD', route: 'PO' },
  { code: 'AMLO-5', name: 'Amlodipine 5mg', nameAr: 'أملوديبين ٥ ملغ', dosage: '5mg', frequency: 'OD', route: 'PO' },
  { code: 'CIPR-500', name: 'Ciprofloxacin 500mg', nameAr: 'سيبروفلوكساسين ٥٠٠ ملغ', dosage: '500mg', frequency: 'BD', route: 'PO' },
  { code: 'SALB-INH', name: 'Salbutamol Inhaler', nameAr: 'سالبيوتامول بخاخ', dosage: '2 puffs', frequency: 'PRN', route: 'INH' },
  { code: 'ATOR-20', name: 'Atorvastatin 20mg', nameAr: 'أتورفاستاتين ٢٠ ملغ', dosage: '20mg', frequency: 'OD', route: 'PO' },
  { code: 'CEFT-1G', name: 'Ceftriaxone 1g', nameAr: 'سيفترياكسون ١ غ', dosage: '1g', frequency: 'OD', route: 'IV' },
  { code: 'NS-1L', name: 'Normal Saline 0.9% 1L', nameAr: 'محلول ملحي ٠.٩٪ ١ لتر', dosage: '1L', frequency: 'Over 8h', route: 'IV' },
  { code: 'MORP-5', name: 'Morphine 5mg', nameAr: 'مورفين ٥ ملغ', dosage: '5mg', frequency: 'Q4H PRN', route: 'IV' },
];

export class MedicationGenerator {
  random(): Medication {
    return pick(COMMON_MEDICATIONS);
  }

  randomN(n: number): Medication[] {
    const shuffled = [...COMMON_MEDICATIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  randomOral(): Medication {
    const oral = COMMON_MEDICATIONS.filter((m) => m.route === 'PO');
    return pick(oral);
  }
}
