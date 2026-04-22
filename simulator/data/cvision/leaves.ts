/**
 * CVision Leave Data Generator
 * Saudi labor law compliant leave types and entitlements.
 */

const LEAVE_TYPES = [
  { type: 'ANNUAL', weight: 50 },
  { type: 'SICK', weight: 20 },
  { type: 'MARRIAGE', weight: 5 },
  { type: 'PATERNITY', weight: 5 },
  { type: 'BEREAVEMENT', weight: 5 },
  { type: 'HAJJ', weight: 3 },
  { type: 'MATERNITY', weight: 5 },
  { type: 'COMPASSIONATE', weight: 4 },
  { type: 'UNPAID', weight: 3 },
] as const;

/** Saudi labor law entitlements (days per year) */
export const SAUDI_LEAVE_DAYS: Record<string, number> = {
  ANNUAL: 21,       // 30 days after 5 years
  SICK: 30,         // First 30 days full pay, next 60 at 75%, next 30 unpaid
  MARRIAGE: 5,
  PATERNITY: 3,
  BEREAVEMENT: 5,
  HAJJ: 15,         // Once during employment
  MATERNITY: 70,    // 10 weeks
  COMPASSIONATE: 5,
  UNPAID: 0,
};

const REASONS_AR: Record<string, string[]> = {
  ANNUAL: ['إجازة سنوية', 'راحة', 'سفر عائلي', 'مناسبة عائلية'],
  SICK: ['مرض', 'موعد طبي', 'عملية جراحية', 'فحوصات طبية'],
  MARRIAGE: ['زواج'],
  PATERNITY: ['ولادة مولود جديد'],
  BEREAVEMENT: ['وفاة قريب', 'عزاء'],
  HAJJ: ['أداء فريضة الحج'],
  MATERNITY: ['إجازة أمومة'],
  COMPASSIONATE: ['ظروف عائلية'],
  UNPAID: ['إجازة بدون راتب'],
};

const REASONS_EN: Record<string, string[]> = {
  ANNUAL: ['Annual vacation', 'Rest', 'Family travel', 'Family event'],
  SICK: ['Illness', 'Medical appointment', 'Surgery', 'Medical checkup'],
  MARRIAGE: ['Wedding'],
  PATERNITY: ['New baby born'],
  BEREAVEMENT: ['Death of relative', 'Condolences'],
  HAJJ: ['Hajj pilgrimage'],
  MATERNITY: ['Maternity leave'],
  COMPASSIONATE: ['Family circumstances'],
  UNPAID: ['Unpaid leave'],
};

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export interface LeaveRequestData {
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  reasonAr: string;
  days: number;
}

export class CVisionLeaveGenerator {
  /** Generate a weighted-random leave request */
  generate(): LeaveRequestData {
    const type = this.pickWeightedType();
    const days = this.getDaysForType(type);
    const now = new Date();
    const futureOffset = 7 + Math.floor(Math.random() * 30);
    const startDate = addDays(now.toISOString().split('T')[0], futureOffset);
    const endDate = addDays(startDate, days - 1);

    return {
      type,
      startDate,
      endDate,
      reason: pick(REASONS_EN[type] || ['Leave']),
      reasonAr: pick(REASONS_AR[type] || ['إجازة']),
      days,
    };
  }

  generateN(n: number): LeaveRequestData[] {
    return Array.from({ length: n }, () => this.generate());
  }

  private pickWeightedType(): string {
    const totalWeight = LEAVE_TYPES.reduce((s, t) => s + t.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const entry of LEAVE_TYPES) {
      rand -= entry.weight;
      if (rand <= 0) return entry.type;
    }
    return 'ANNUAL';
  }

  private getDaysForType(type: string): number {
    switch (type) {
      case 'ANNUAL': return 1 + Math.floor(Math.random() * 21);
      case 'SICK': return 1 + Math.floor(Math.random() * 10);
      case 'MARRIAGE': return 5;
      case 'PATERNITY': return 3;
      case 'BEREAVEMENT': return 3 + Math.floor(Math.random() * 3);
      case 'HAJJ': return 15;
      case 'MATERNITY': return 70;
      case 'COMPASSIONATE': return 1 + Math.floor(Math.random() * 5);
      case 'UNPAID': return 1 + Math.floor(Math.random() * 14);
      default: return 1;
    }
  }
}
