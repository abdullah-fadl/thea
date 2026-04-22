function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface DentalCondition {
  tooth: string;
  condition: string;
  surface?: string;
}

export interface DentalProcedure {
  code: string;
  name: string;
  nameAr: string;
  fee: number;
}

const TOOTH_NUMBERS = [
  '11','12','13','14','15','16','17','18',
  '21','22','23','24','25','26','27','28',
  '31','32','33','34','35','36','37','38',
  '41','42','43','44','45','46','47','48',
];

const CONDITIONS = ['CARIES', 'FRACTURE', 'MISSING', 'CROWN', 'FILLING', 'ROOT_CANAL'];
const SURFACES = ['MESIAL', 'DISTAL', 'OCCLUSAL', 'BUCCAL', 'LINGUAL'];

const PROCEDURES: DentalProcedure[] = [
  { code: 'D2140', name: 'Amalgam Filling - One Surface', nameAr: 'حشوة سطح واحد', fee: 150 },
  { code: 'D2150', name: 'Amalgam Filling - Two Surfaces', nameAr: 'حشوة سطحين', fee: 200 },
  { code: 'D2740', name: 'Porcelain Crown', nameAr: 'تاج خزف', fee: 1500 },
  { code: 'D3310', name: 'Root Canal - Anterior', nameAr: 'علاج عصب أمامي', fee: 800 },
  { code: 'D3320', name: 'Root Canal - Premolar', nameAr: 'علاج عصب ضاحك', fee: 1000 },
  { code: 'D7140', name: 'Extraction - Erupted Tooth', nameAr: 'خلع سن بارز', fee: 300 },
  { code: 'D1110', name: 'Prophylaxis - Adult', nameAr: 'تنظيف أسنان', fee: 200 },
  { code: 'D0220', name: 'Periapical X-Ray', nameAr: 'أشعة ذروية', fee: 50 },
];

export class DentalGenerator {
  randomConditions(count: number = 3): Record<string, { condition: string; surface?: string }> {
    const conditions: Record<string, { condition: string; surface?: string }> = {};
    const teeth = [...TOOTH_NUMBERS].sort(() => Math.random() - 0.5).slice(0, count);
    for (const tooth of teeth) {
      conditions[tooth] = {
        condition: pick(CONDITIONS),
        surface: Math.random() > 0.3 ? pick(SURFACES) : undefined,
      };
    }
    return conditions;
  }

  randomProcedure(): DentalProcedure {
    return pick(PROCEDURES);
  }

  randomTooth(): string {
    return pick(TOOTH_NUMBERS);
  }
}
