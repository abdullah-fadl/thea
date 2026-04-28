const SAUDI_MALE_FIRST = [
  { ar: 'أحمد', en: 'Ahmed' }, { ar: 'محمد', en: 'Mohammed' },
  { ar: 'عبدالله', en: 'Abdullah' }, { ar: 'خالد', en: 'Khalid' },
  { ar: 'سلطان', en: 'Sultan' }, { ar: 'فهد', en: 'Fahd' },
  { ar: 'عمر', en: 'Omar' }, { ar: 'سعود', en: 'Saud' },
  { ar: 'ياسر', en: 'Yasser' }, { ar: 'ماجد', en: 'Majed' },
  { ar: 'ناصر', en: 'Nasser' }, { ar: 'بندر', en: 'Bandar' },
  { ar: 'فيصل', en: 'Faisal' }, { ar: 'طارق', en: 'Tariq' },
  { ar: 'وليد', en: 'Waleed' },
];

const SAUDI_FEMALE_FIRST = [
  { ar: 'نورة', en: 'Noura' }, { ar: 'فاطمة', en: 'Fatima' },
  { ar: 'سارة', en: 'Sarah' }, { ar: 'مريم', en: 'Maryam' },
  { ar: 'لطيفة', en: 'Latifa' }, { ar: 'هند', en: 'Hind' },
  { ar: 'أمل', en: 'Amal' }, { ar: 'دلال', en: 'Dalal' },
  { ar: 'منيرة', en: 'Munira' }, { ar: 'ريم', en: 'Reem' },
  { ar: 'هيا', en: 'Haya' }, { ar: 'غادة', en: 'Ghada' },
];

const SAUDI_LAST = [
  { ar: 'العتيبي', en: 'Al-Otaibi' }, { ar: 'الغامدي', en: 'Al-Ghamdi' },
  { ar: 'القحطاني', en: 'Al-Qahtani' }, { ar: 'الدوسري', en: 'Al-Dosari' },
  { ar: 'الشهراني', en: 'Al-Shahrani' }, { ar: 'المطيري', en: 'Al-Mutairi' },
  { ar: 'الحربي', en: 'Al-Harbi' }, { ar: 'الزهراني', en: 'Al-Zahrani' },
  { ar: 'السبيعي', en: 'Al-Subaie' }, { ar: 'الشمري', en: 'Al-Shammari' },
  { ar: 'العنزي', en: 'Al-Anazi' }, { ar: 'البلوي', en: 'Al-Balawi' },
  { ar: 'الرشيدي', en: 'Al-Rashidi' }, { ar: 'الحازمي', en: 'Al-Hazmi' },
  { ar: 'المالكي', en: 'Al-Malki' },
];

const CITIES = ['Riyadh', 'Jeddah', 'Dammam', 'Makkah', 'Madinah', 'Abha', 'Tabuk', 'Hail'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function saudiNationalId(): string {
  const prefix = Math.random() > 0.5 ? '1' : '2';
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  return prefix + digits;
}

function saudiPhone(): string {
  const prefix = pick(['50', '53', '54', '55', '56', '57', '58', '59']);
  const num = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
  return `+966${prefix}${num}`;
}

function randomDob(minAge: number, maxAge: number): string {
  const age = randomBetween(minAge, maxAge);
  const year = new Date().getFullYear() - age;
  const month = String(randomBetween(1, 12)).padStart(2, '0');
  const day = String(randomBetween(1, 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface PatientData {
  firstName: string;
  lastName: string;
  firstNameAr: string;
  lastNameAr: string;
  dob: string;
  gender: 'MALE' | 'FEMALE';
  nationalId: string;
  mobile: string;
  nationality: string;
  city: string;
}

export class PatientGenerator {
  private counter = 0;

  generate(): PatientData {
    this.counter++;
    const gender = Math.random() > 0.5 ? 'MALE' : 'FEMALE';
    const first = pick(gender === 'MALE' ? SAUDI_MALE_FIRST : SAUDI_FEMALE_FIRST);
    const last = pick(SAUDI_LAST);
    return {
      firstName: first.en,
      lastName: last.en,
      firstNameAr: first.ar,
      lastNameAr: last.ar,
      dob: randomDob(1, 85),
      gender: gender as 'MALE' | 'FEMALE',
      nationalId: saudiNationalId(),
      mobile: saudiPhone(),
      nationality: 'SA',
      city: pick(CITIES),
    };
  }

  generatePregnant(): PatientData {
    const p = this.generate();
    p.gender = 'FEMALE';
    const first = pick(SAUDI_FEMALE_FIRST);
    p.firstName = first.en;
    p.firstNameAr = first.ar;
    p.dob = randomDob(18, 42);
    return p;
  }

  generateChild(): PatientData {
    const p = this.generate();
    p.dob = randomDob(0, 14);
    return p;
  }
}
