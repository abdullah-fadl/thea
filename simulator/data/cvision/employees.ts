/**
 * CVision Employee Data Generator
 * Generates Saudi-compliant employee data for simulation.
 */

const SAUDI_MALE_FIRST = [
  'محمد', 'عبدالله', 'فهد', 'خالد', 'سعود', 'ناصر', 'عمر', 'أحمد',
  'سلطان', 'تركي', 'بندر', 'ماجد', 'وليد', 'سلمان', 'مشاري',
];

const SAUDI_FEMALE_FIRST = [
  'نورة', 'سارة', 'فاطمة', 'عائشة', 'مريم', 'ريم', 'هند', 'لمى',
  'دانة', 'غادة', 'منال', 'أمل', 'لينا', 'رنا', 'ديما',
];

const SAUDI_LAST = [
  'العتيبي', 'القحطاني', 'الغامدي', 'الشمري', 'الحربي', 'الدوسري',
  'المطيري', 'السبيعي', 'الزهراني', 'العنزي', 'الرشيدي', 'البلوي',
  'المالكي', 'الشهري', 'الأحمدي',
];

const ENGLISH_MALE_FIRST = [
  'Mohammed', 'Abdullah', 'Fahad', 'Khalid', 'Saud', 'Nasser', 'Omar', 'Ahmad',
  'Sultan', 'Turki', 'Bandar', 'Majed', 'Waleed', 'Salman', 'Mishari',
];

const ENGLISH_FEMALE_FIRST = [
  'Noura', 'Sarah', 'Fatimah', 'Aisha', 'Mariam', 'Reem', 'Hind', 'Lama',
  'Dana', 'Ghada', 'Manal', 'Amal', 'Lina', 'Rana', 'Dima',
];

const ENGLISH_LAST = [
  'Al-Otaibi', 'Al-Qahtani', 'Al-Ghamdi', 'Al-Shammari', 'Al-Harbi', 'Al-Dosari',
  'Al-Mutairi', 'Al-Subaie', 'Al-Zahrani', 'Al-Anazi', 'Al-Rashidi', 'Al-Balawi',
  'Al-Malki', 'Al-Shahri', 'Al-Ahmadi',
];

const NATIONALITIES = ['SA', 'SA', 'SA', 'SA', 'EG', 'PK', 'IN', 'PH', 'JO', 'SY'];

let counter = 0;
const runId = Date.now().toString(36); // unique per simulator run to avoid email collisions

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** Generate Saudi National ID (10 digits, starts with 1 for citizen, 2 for resident) */
function generateNationalId(nationality: string): string {
  const prefix = nationality === 'SA' ? '1' : '2';
  return prefix + randomDigits(9);
}

/** Generate Saudi phone number */
function generatePhone(): string {
  return `+9665${Math.floor(Math.random() * 10)}${randomDigits(7)}`;
}

/** Generate Saudi IBAN (SA + 2 check + 2 bank code + 18 account) */
function generateIBAN(): string {
  return `SA${randomDigits(2)}${randomDigits(2)}${randomDigits(18)}`;
}

/** Generate a random date of birth (age 22-60) */
function generateDateOfBirth(): string {
  const now = new Date();
  const age = 22 + Math.floor(Math.random() * 38);
  const year = now.getFullYear() - age;
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Generate a hire date (1-15 years ago) */
function generateHireDate(yearsAgo?: number): string {
  const now = new Date();
  const years = yearsAgo ?? (1 + Math.floor(Math.random() * 15));
  const year = now.getFullYear() - years;
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export interface EmployeeData {
  firstName: string;
  firstNameAr: string;
  lastName: string;
  lastNameAr: string;
  email: string;
  phone: string;
  nationalId: string;
  nationality: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  hireDate: string;
  iban?: string;
  baseSalary?: number;
}

export class CVisionEmployeeGenerator {
  generate(opts?: { yearsAgo?: number; salary?: number }): EmployeeData {
    counter++;
    const gender: 'male' | 'female' = Math.random() > 0.4 ? 'male' : 'female';
    const nationality = pick(NATIONALITIES);
    const idx = Math.floor(Math.random() * SAUDI_LAST.length);

    const firstNameAr = gender === 'male' ? pick(SAUDI_MALE_FIRST) : pick(SAUDI_FEMALE_FIRST);
    const firstName = gender === 'male' ? pick(ENGLISH_MALE_FIRST) : pick(ENGLISH_FEMALE_FIRST);
    const lastNameAr = SAUDI_LAST[idx];
    const lastName = ENGLISH_LAST[idx];

    return {
      firstName,
      firstNameAr,
      lastName,
      lastNameAr,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}.${runId}${counter}@sim.thea.com`,
      phone: generatePhone(),
      nationalId: generateNationalId(nationality),
      nationality,
      gender,
      dateOfBirth: generateDateOfBirth(),
      hireDate: generateHireDate(opts?.yearsAgo),
      iban: generateIBAN(),
      baseSalary: opts?.salary ?? (3000 + Math.floor(Math.random() * 47000)),
    };
  }

  /** Generate employee with specific tenure for EOS testing */
  generateWithTenure(years: number, salary: number): EmployeeData {
    return this.generate({ yearsAgo: years, salary });
  }

  generateN(n: number): EmployeeData[] {
    return Array.from({ length: n }, () => this.generate());
  }
}

export { generateIBAN, generateNationalId, generatePhone };
