/**
 * CVision Integrations — Yaqeen Client (Elm)
 *
 * National identity verification for Saudi Arabia:
 *   - Saudi ID verification (IDs starting with "1")
 *   - Iqama verification (IDs starting with "2")
 *   - Commercial Registration (CR) verification
 *
 * In SIMULATION mode returns realistic mock data seeded from
 * known Saudi naming patterns and region-appropriate values.
 */

import { IntegrationClient, type IntegrationClientConfig } from '../shared/api-client';
import { formatHijriDate } from '../shared/helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YaqeenPersonInfo {
  firstNameAr: string;
  fatherNameAr: string;
  grandFatherNameAr: string;
  familyNameAr: string;
  firstNameEn: string;
  lastNameEn: string;
  dateOfBirth: string;
  dateOfBirthH: string;
  gender: 'M' | 'F';
  nationality: string;
  nationalityAr: string;
  idExpiryDate: string;
  idExpiryDateH: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
}

export interface YaqeenIdentityResult {
  verified: boolean;
  personInfo?: YaqeenPersonInfo;
  error?: string;
  simulated: boolean;
}

export interface YaqeenIqamaInfo {
  nameAr: string;
  nameEn: string;
  iqamaNumber: string;
  issueDate: string;
  expiryDate: string;
  occupation: string;
  occupationAr: string;
  sponsorName: string;
  sponsorId: string;
  nationality: string;
  nationalityAr: string;
  status: 'VALID' | 'EXPIRED' | 'CANCELLED';
}

export interface YaqeenIqamaResult {
  verified: boolean;
  iqamaInfo?: YaqeenIqamaInfo;
  error?: string;
  simulated: boolean;
}

export interface YaqeenCRInfo {
  crNumber: string;
  companyName: string;
  companyNameAr: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  type: string;
  city: string;
  activities: string[];
}

export interface YaqeenCRResult {
  verified: boolean;
  crInfo?: YaqeenCRInfo;
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class YaqeenClient extends IntegrationClient {
  constructor(config: Omit<IntegrationClientConfig, 'integrationId'>) {
    super({ ...config, integrationId: 'yaqeen' });
  }

  async verifyIdentity(params: {
    idNumber: string;
    dateOfBirth?: string;
  }): Promise<YaqeenIdentityResult> {
    const res = await this.request<YaqeenIdentityResult>(
      'POST',
      '/api/v1/identity/verify',
      params,
    );
    return res.data;
  }

  async verifyIqama(params: {
    iqamaNumber: string;
    dateOfBirth: string;
  }): Promise<YaqeenIqamaResult> {
    const res = await this.request<YaqeenIqamaResult>(
      'POST',
      '/api/v1/iqama/verify',
      params,
    );
    return res.data;
  }

  async verifyCR(crNumber: string): Promise<YaqeenCRResult> {
    const res = await this.request<YaqeenCRResult>(
      'GET',
      `/api/v1/cr/${crNumber}`,
    );
    return res.data;
  }

  // ── Simulation ────────────────────────────────────────────────────

  protected async simulateResponse(method: string, path: string, data?: any): Promise<any> {
    await randomDelay();

    // ── Identity verify ────────────────────────────────────────────
    if (path.includes('/identity/verify')) {
      const idNumber: string = data?.idNumber || '';
      if (idNumber.length !== 10) {
        return { verified: false, error: 'ID number must be 10 digits', simulated: true };
      }

      const isSaudi = idNumber.startsWith('1');
      const expiry = futureDate(isSaudi ? 10 : 2);
      const dob = data?.dateOfBirth || '1990-01-15';

      if (isSaudi) {
        const m = pickSaudiMock(idNumber);
        return {
          verified: true,
          personInfo: {
            firstNameAr: m.firstAr, fatherNameAr: m.fatherAr,
            grandFatherNameAr: m.grandAr, familyNameAr: m.familyAr,
            firstNameEn: m.firstEn, lastNameEn: m.lastEn,
            dateOfBirth: dob, dateOfBirthH: formatHijriDate(new Date(1990, 0, 15)),
            gender: m.gender,
            nationality: 'Saudi Arabian', nationalityAr: 'سعودي',
            idExpiryDate: expiry.toISOString().slice(0, 10),
            idExpiryDateH: formatHijriDate(expiry),
            status: 'ACTIVE' as const,
          },
          simulated: true,
        } satisfies YaqeenIdentityResult;
      }

      const m = pickNonSaudiIdentityMock(idNumber);
      return {
        verified: true,
        personInfo: {
          firstNameAr: m.firstAr, fatherNameAr: m.fatherAr,
          grandFatherNameAr: m.grandAr, familyNameAr: m.familyAr,
          firstNameEn: m.firstEn, lastNameEn: m.lastEn,
          dateOfBirth: dob, dateOfBirthH: formatHijriDate(new Date(1990, 0, 15)),
          gender: m.gender,
          nationality: m.nationality, nationalityAr: m.nationalityAr,
          idExpiryDate: expiry.toISOString().slice(0, 10),
          idExpiryDateH: formatHijriDate(expiry),
          status: 'ACTIVE' as const,
        },
        simulated: true,
      } satisfies YaqeenIdentityResult;
    }

    // ── Iqama verify ──────────────────────────────────────────────
    if (path.includes('/iqama/verify')) {
      const iqama: string = data?.iqamaNumber || '';
      if (!iqama.startsWith('2') || iqama.length !== 10) {
        return { verified: false, error: 'Invalid Iqama number', simulated: true };
      }

      const mock = pickNonSaudiIdentityMock(iqama);
      const issue = pastDate(2);
      const expiry = futureDate(1);

      return {
        verified: true,
        iqamaInfo: {
          nameAr: `${mock.firstAr} ${mock.familyAr}`,
          nameEn: `${mock.firstEn} ${mock.lastEn}`,
          iqamaNumber: iqama,
          issueDate: issue.toISOString().slice(0, 10),
          expiryDate: expiry.toISOString().slice(0, 10),
          occupation: mock.occupation,
          occupationAr: mock.occupationAr,
          sponsorName: 'Thea Health',
          sponsorId: '7001234567',
          nationality: mock.nationality,
          nationalityAr: mock.nationalityAr,
          status: 'VALID' as const,
        },
        simulated: true,
      } satisfies YaqeenIqamaResult;
    }

    // ── CR verify ─────────────────────────────────────────────────
    if (path.includes('/cr/')) {
      const crNum = path.split('/').pop() || '1010000000';
      return {
        verified: true,
        crInfo: {
          crNumber: crNum,
          companyName: 'Thea Health Co.',
          companyNameAr: 'شركة سيرا الصحية',
          issueDate: '2018-03-15',
          expiryDate: '2028-03-14',
          status: 'ACTIVE',
          type: 'LLC',
          city: 'Riyadh',
          activities: ['Healthcare services', 'Hospital management', 'Medical staffing'],
        },
        simulated: true,
      } satisfies YaqeenCRResult;
    }

    return { verified: false, error: 'Unknown endpoint', simulated: true };
  }
}

// ---------------------------------------------------------------------------
// Mock data generators (deterministic based on ID hash)
// ---------------------------------------------------------------------------

const SAUDI_MALE_NAMES = [
  { firstAr: 'خالد', fatherAr: 'إبراهيم', grandAr: 'محمد', familyAr: 'الراشد', firstEn: 'Khalid', lastEn: 'Al-Rashid' },
  { firstAr: 'عمر', fatherAr: 'علي', grandAr: 'أحمد', familyAr: 'العلي', firstEn: 'Omar', lastEn: 'Al-Ali' },
  { firstAr: 'عبدالعزيز', fatherAr: 'سعد', grandAr: 'عبدالله', familyAr: 'القحطاني', firstEn: 'Abdulaziz', lastEn: 'Al-Qahtani' },
  { firstAr: 'سلطان', fatherAr: 'فهد', grandAr: 'سلمان', familyAr: 'الدوسري', firstEn: 'Sultan', lastEn: 'Al-Dosari' },
  { firstAr: 'فيصل', fatherAr: 'نايف', grandAr: 'تركي', familyAr: 'العتيبي', firstEn: 'Faisal', lastEn: 'Al-Otaibi' },
];

const SAUDI_FEMALE_NAMES = [
  { firstAr: 'سارة', fatherAr: 'محمد', grandAr: 'عبدالرحمن', familyAr: 'الشمري', firstEn: 'Sara', lastEn: 'Al-Shammari' },
  { firstAr: 'نورة', fatherAr: 'خالد', grandAr: 'سعود', familyAr: 'الحربي', firstEn: 'Noura', lastEn: 'Al-Harbi' },
];

const NON_SAUDI_NAMES = [
  { firstAr: 'يوسف', familyAr: 'حسن', firstEn: 'Yousef', lastEn: 'Hassan', nationality: 'Egyptian', nationalityAr: 'مصري', occupation: 'Registered Nurse', occupationAr: 'ممرض مسجل' },
  { firstAr: 'فاطمة', familyAr: 'أحمد', firstEn: 'Fatima', lastEn: 'Ahmad', nationality: 'Jordanian', nationalityAr: 'أردنية', occupation: 'Accountant', occupationAr: 'محاسبة' },
  { firstAr: 'محمد', familyAr: 'رضا', firstEn: 'Mohammed', lastEn: 'Reza', nationality: 'Pakistani', nationalityAr: 'باكستاني', occupation: 'IT Technician', occupationAr: 'فني تقنية معلومات' },
  { firstAr: 'راجيش', familyAr: 'كومار', firstEn: 'Rajesh', lastEn: 'Kumar', nationality: 'Indian', nationalityAr: 'هندي', occupation: 'Software Engineer', occupationAr: 'مهندس برمجيات' },
  { firstAr: 'عائشة', familyAr: 'محمود', firstEn: 'Aisha', lastEn: 'Mahmoud', nationality: 'Sudanese', nationalityAr: 'سودانية', occupation: 'Nurse', occupationAr: 'ممرضة' },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickSaudiMock(id: string) {
  const h = hashId(id);
  const isFemale = h % 7 === 0;
  const pool = isFemale ? SAUDI_FEMALE_NAMES : SAUDI_MALE_NAMES;
  const m = pool[h % pool.length];
  return { ...m, gender: (isFemale ? 'F' : 'M') as 'M' | 'F' };
}

function pickNonSaudiIdentityMock(id: string) {
  const h = hashId(id);
  const m = NON_SAUDI_NAMES[h % NON_SAUDI_NAMES.length];
  const isFemale = m.firstEn === 'Fatima' || m.firstEn === 'Aisha';
  return {
    firstAr: m.firstAr,
    fatherAr: '',
    grandAr: '',
    familyAr: m.familyAr,
    firstEn: m.firstEn,
    lastEn: m.lastEn,
    gender: (isFemale ? 'F' : 'M') as 'M' | 'F',
    nationality: m.nationality,
    nationalityAr: m.nationalityAr,
    occupation: m.occupation,
    occupationAr: m.occupationAr,
  };
}

function futureDate(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function pastDate(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function randomDelay(): Promise<void> {
  return new Promise(r => setTimeout(r, 100 + Math.random() * 200));
}
