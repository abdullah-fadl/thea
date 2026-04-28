function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface Procedure {
  code: string;
  name: string;
  nameAr: string;
  duration: number; // estimated minutes
}

export const COMMON_PROCEDURES: Procedure[] = [
  { code: 'APPY', name: 'Appendectomy', nameAr: 'استئصال الزائدة', duration: 60 },
  { code: 'CHOLE', name: 'Cholecystectomy', nameAr: 'استئصال المرارة', duration: 90 },
  { code: 'HERNIA', name: 'Hernia Repair', nameAr: 'إصلاح الفتق', duration: 75 },
  { code: 'CSECT', name: 'Cesarean Section', nameAr: 'عملية قيصرية', duration: 60 },
  { code: 'ORIF', name: 'Open Reduction Internal Fixation', nameAr: 'تثبيت كسر داخلي', duration: 120 },
  { code: 'KNEE-ARTH', name: 'Knee Arthroscopy', nameAr: 'منظار ركبة', duration: 45 },
  { code: 'TONSIL', name: 'Tonsillectomy', nameAr: 'استئصال اللوزتين', duration: 30 },
  { code: 'CATARACT', name: 'Cataract Extraction', nameAr: 'إزالة الساد', duration: 30 },
];

export class ProcedureGenerator {
  random(): Procedure {
    return pick(COMMON_PROCEDURES);
  }
}
