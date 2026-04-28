import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Saudi National ID Validator ───────────────────────────────────── */

export function validateNationalId(id: string): { valid: boolean; type?: 'CITIZEN' | 'RESIDENT'; error?: string } {
  if (!id || id.length !== 10) return { valid: false, error: 'Must be 10 digits' };
  if (!/^\d{10}$/.test(id)) return { valid: false, error: 'Must contain only numbers' };
  if (!['1', '2'].includes(id[0])) return { valid: false, error: 'Must start with 1 (citizen) or 2 (resident)' };

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = parseInt(id[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  if (sum % 10 !== 0) return { valid: false, error: 'Invalid ID number (checksum failed)' };

  return { valid: true, type: id[0] === '1' ? 'CITIZEN' : 'RESIDENT' };
}

/* ── Saudi Phone Validator ─────────────────────────────────────────── */

export function validateSaudiPhone(phone: string): { valid: boolean; formatted?: string; error?: string } {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  let normalized: string;
  if (cleaned.startsWith('+966')) normalized = cleaned.substring(4);
  else if (cleaned.startsWith('966')) normalized = cleaned.substring(3);
  else if (cleaned.startsWith('0')) normalized = cleaned.substring(1);
  else normalized = cleaned;

  if (normalized.length !== 9) return { valid: false, error: 'Phone must be 9 digits after country code' };
  if (!normalized.startsWith('5')) return { valid: false, error: 'Mobile must start with 5' };
  if (!/^\d{9}$/.test(normalized)) return { valid: false, error: 'Must contain only numbers' };

  return { valid: true, formatted: `+966${normalized}` };
}

/* ── Saudi IBAN Validator ──────────────────────────────────────────── */

export function validateSaudiIBAN(iban: string): { valid: boolean; bankName?: string; error?: string } {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (!cleaned.startsWith('SA')) return { valid: false, error: 'Saudi IBAN must start with SA' };
  if (cleaned.length !== 24) return { valid: false, error: 'Saudi IBAN must be 24 characters' };

  const bankCode = cleaned.substring(4, 6);
  const banks: Record<string, string> = {
    '80': 'Al Rajhi Bank', '10': 'National Commercial Bank', '20': 'Riyad Bank',
    '45': 'Saudi British Bank (SABB)', '40': 'Saudi American Bank (SAMBA)',
    '55': 'Banque Saudi Fransi', '60': 'Bank AlJazira', '65': 'Saudi Investment Bank',
    '30': 'Arab National Bank', '76': 'Bank Albilad', '71': 'Alinma Bank',
  };

  const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
  const numeric = rearranged.split('').map(c => {
    const code = c.charCodeAt(0);
    return code >= 65 ? (code - 55).toString() : c;
  }).join('');

  let remainder = BigInt(numeric) % 97n;
  if (remainder !== 1n) return { valid: false, error: 'Invalid IBAN checksum' };

  return { valid: true, bankName: banks[bankCode] || 'Unknown Bank' };
}

/* ── Email Validator ───────────────────────────────────────────────── */

export function validateEmail(email: string): { valid: boolean; error?: string } {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!regex.test(email)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}

/* ── Date Validators ───────────────────────────────────────────────── */

export function validateDateRange(startDate: Date, endDate: Date): { valid: boolean; error?: string } {
  if (endDate <= startDate) return { valid: false, error: 'End date must be after start date' };
  return { valid: true };
}

export function validateNotFutureBirthdate(dob: Date): { valid: boolean; error?: string } {
  if (dob > new Date()) return { valid: false, error: 'Birthdate cannot be in the future' };
  const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age > 120) return { valid: false, error: 'Invalid birthdate' };
  if (age < 15) return { valid: false, error: 'Employee must be at least 15 years old' };
  return { valid: true };
}

/* ── Salary Range Validator ────────────────────────────────────────── */

export async function validateSalaryInBand(
  db: Db, tenantId: string, salary: number, gradeId: string,
): Promise<{ valid: boolean; warning?: string; error?: string }> {
  const grade = await db.collection('cvision_salary_structure').findOne({ gradeId, tenantId });
  if (!grade) return { valid: true };
  if (salary < grade.range?.minimum) return { valid: false, error: `Below minimum for grade (${grade.range.minimum} SAR)` };
  if (salary > grade.range?.maximum) return { valid: false, warning: `Above maximum for grade (${grade.range.maximum} SAR) — requires approval` };
  return { valid: true };
}

/* ── Duplicate Detection ───────────────────────────────────────────── */

export async function checkDuplicate(
  db: Db, tenantId: string,
  data: { name?: string; email?: string; phone?: string; nationalId?: string },
): Promise<{ isDuplicate: boolean; matches: any[] }> {
  const conditions: any[] = [];
  if (data.nationalId) conditions.push({ nationalId: data.nationalId });
  if (data.email) conditions.push({ email: data.email });
  if (data.phone) conditions.push({ phone: data.phone });

  if (conditions.length === 0) return { isDuplicate: false, matches: [] };

  const matches = await db.collection('cvision_employees').find({
    tenantId, $or: conditions,
  }).toArray();

  return { isDuplicate: matches.length > 0, matches };
}

/* ── Universal Employee Validator ──────────────────────────────────── */

export async function validateEmployeeData(
  db: Db, tenantId: string, data: any,
): Promise<{ valid: boolean; errors: { field: string; message: string }[] }> {
  const errors: { field: string; message: string }[] = [];

  if (data.nationalId) {
    const r = validateNationalId(data.nationalId);
    if (!r.valid) errors.push({ field: 'nationalId', message: r.error! });
  }
  if (data.phone) {
    const r = validateSaudiPhone(data.phone);
    if (!r.valid) errors.push({ field: 'phone', message: r.error! });
  }
  if (data.email) {
    const r = validateEmail(data.email);
    if (!r.valid) errors.push({ field: 'email', message: r.error! });
  }
  if (data.bankIBAN) {
    const r = validateSaudiIBAN(data.bankIBAN);
    if (!r.valid) errors.push({ field: 'bankIBAN', message: r.error! });
  }
  if (data.dateOfBirth) {
    const r = validateNotFutureBirthdate(new Date(data.dateOfBirth));
    if (!r.valid) errors.push({ field: 'dateOfBirth', message: r.error! });
  }

  const dup = await checkDuplicate(db, tenantId, data);
  if (dup.isDuplicate) {
    errors.push({ field: '_duplicate', message: `Possible duplicate: ${dup.matches.map(m => m.name).join(', ')}` });
  }

  return { valid: errors.length === 0, errors };
}
