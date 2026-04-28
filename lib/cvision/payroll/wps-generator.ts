// lib/cvision/payroll/wps-generator.ts
// WPS (Wage Protection System) file generator for Saudi Mudad compliance

import { PayrollCalculation } from './calculator';

/**
 * WPS record structure per Mudad specifications
 */
export interface WPSRecord {
  employeeId: string;
  employeeName: string;
  employeeNameEn: string;
  nationalId: string;
  idType: 'SAUDI_ID' | 'IQAMA';

  bankCode: string;
  iban: string;

  basicSalary: number;
  housingAllowance: number;
  otherAllowances: number;
  deductions: number;
  netSalary: number;

  workDays: number;
  leavesDays: number;
  absentDays: number;
}

/**
 * WPS file structure
 */
export interface WPSFile {
  header: {
    fileReference: string;
    employerMolId: string;
    employerBankCode: string;
    employerIban: string;
    paymentMonth: number;
    paymentYear: number;
    recordCount: number;
    totalAmount: number;
    createdAt: Date;
  };

  records: WPSRecord[];

  summary: {
    totalEmployees: number;
    totalBasicSalary: number;
    totalHousingAllowance: number;
    totalOtherAllowances: number;
    totalDeductions: number;
    totalNetSalary: number;
    saudiCount: number;
    nonSaudiCount: number;
  };
}

/**
 * Saudi bank codes
 */
export const SAUDI_BANK_CODES: Record<string, { code: string; nameAr: string; nameEn: string }> = {
  RJHI: { code: '080', nameAr: 'Al Rajhi Bank', nameEn: 'Al Rajhi Bank' },
  NCB: { code: '010', nameAr: 'Al Ahli Bank', nameEn: 'Al Ahli Bank' },
  SABB: { code: '045', nameAr: 'SABB', nameEn: 'SABB' },
  RIBL: { code: '020', nameAr: 'Riyad Bank', nameEn: 'Riyad Bank' },
  BSFR: { code: '055', nameAr: 'Banque Saudi Fransi', nameEn: 'Banque Saudi Fransi' },
  BJAZ: { code: '060', nameAr: 'Bank Aljazira', nameEn: 'Bank Aljazira' },
  SAIB: { code: '065', nameAr: 'SAIB', nameEn: 'SAIB' },
  ARNB: { code: '030', nameAr: 'Arab National Bank', nameEn: 'Arab National Bank' },
  AAAL: { code: '050', nameAr: 'Bank Albilad', nameEn: 'Bank Albilad' },
  INMA: { code: '090', nameAr: 'Alinma Bank', nameEn: 'Alinma Bank' },
};

/**
 * Validate a Saudi IBAN (must be 24 characters starting with SA)
 */
export function validateSaudiIBAN(iban: string): { isValid: boolean; error?: string; bankCode?: string } {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();

  if (cleanIban.length !== 24) {
    return { isValid: false, error: 'IBAN must be 24 characters' };
  }

  if (!cleanIban.startsWith('SA')) {
    return { isValid: false, error: 'Saudi IBAN must start with SA' };
  }

  if (!/^SA\d{22}$/.test(cleanIban)) {
    return { isValid: false, error: 'Invalid IBAN format' };
  }

  const bankCode = cleanIban.substring(4, 6);
  return { isValid: true, bankCode };
}

/**
 * Validate a Saudi National ID or Iqama number (10 digits, starts with 1 or 2)
 */
export function validateNationalId(id: string): { isValid: boolean; type?: 'SAUDI_ID' | 'IQAMA'; error?: string } {
  const cleanId = id.replace(/\s/g, '');

  if (cleanId.length !== 10) {
    return { isValid: false, error: 'National ID must be 10 digits' };
  }

  if (!/^\d{10}$/.test(cleanId)) {
    return { isValid: false, error: 'National ID must contain digits only' };
  }

  const firstDigit = cleanId.charAt(0);
  if (firstDigit === '1') {
    return { isValid: true, type: 'SAUDI_ID' };
  } else if (firstDigit === '2') {
    return { isValid: true, type: 'IQAMA' };
  }

  return { isValid: false, error: 'National ID must start with 1 (Saudi) or 2 (Iqama)' };
}

/**
 * Generate a WPS file from payroll calculations
 */
export function generateWPSFile(
  calculations: PayrollCalculation[],
  employees: {
    id: string;
    name: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    nameEn: string;
    nationalId: string;
    iban: string;
    isSaudi: boolean;
  }[],
  companyInfo: {
    molId: string;
    bankCode: string;
    iban: string;
  },
  month: number,
  year: number
): { wpsFile: WPSFile; errors: { employeeId: string; name: string; error: string }[] } {
  const errors: { employeeId: string; name: string; error: string }[] = [];
  const records: WPSRecord[] = [];

  let totalBasicSalary = 0;
  let totalHousingAllowance = 0;
  let totalOtherAllowances = 0;
  let totalDeductions = 0;
  let totalNetSalary = 0;
  let saudiCount = 0;
  let nonSaudiCount = 0;

  const employeeMap = new Map(employees.map(e => [e.id, e]));

  for (const calc of calculations) {
    const employee = employeeMap.get(calc.employeeId);

    if (!employee) {
      errors.push({
        employeeId: calc.employeeId,
        name: 'Unknown',
        error: 'Employee data not found',
      });
      continue;
    }

    const ibanValidation = validateSaudiIBAN(employee.iban);
    if (!ibanValidation.isValid) {
      errors.push({
        employeeId: calc.employeeId,
        name: employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'Employee',
        error: `IBAN error: ${ibanValidation.error}`,
      });
      continue;
    }

    const idValidation = validateNationalId(employee.nationalId);
    if (!idValidation.isValid) {
      errors.push({
        employeeId: calc.employeeId,
        name: employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'Employee',
        error: `National ID error: ${idValidation.error}`,
      });
      continue;
    }

    const otherAllowances =
      calc.earnings.transportAllowance +
      calc.earnings.foodAllowance +
      calc.earnings.phoneAllowance +
      calc.earnings.otherAllowances +
      calc.earnings.overtimePay;

    const record: WPSRecord = {
      employeeId: calc.employeeId,
      employeeName: employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'Employee',
      employeeNameEn: employee.nameEn || employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'Employee',
      nationalId: employee.nationalId.replace(/\s/g, ''),
      idType: idValidation.type!,
      bankCode: ibanValidation.bankCode!,
      iban: employee.iban.replace(/\s/g, '').toUpperCase(),
      basicSalary: calc.earnings.basicSalary,
      housingAllowance: calc.earnings.housingAllowance,
      otherAllowances,
      deductions: calc.deductions.totalDeductions,
      netSalary: calc.netSalary,
      workDays: calc.metadata.presentDays,
      leavesDays: 0,
      absentDays: 0,
    };

    records.push(record);

    totalBasicSalary += calc.earnings.basicSalary;
    totalHousingAllowance += calc.earnings.housingAllowance;
    totalOtherAllowances += otherAllowances;
    totalDeductions += calc.deductions.totalDeductions;
    totalNetSalary += calc.netSalary;

    if (employee.isSaudi) {
      saudiCount++;
    } else {
      nonSaudiCount++;
    }
  }

  const fileReference = `WPS-${year}${String(month).padStart(2, '0')}-${Date.now()}`;

  const wpsFile: WPSFile = {
    header: {
      fileReference,
      employerMolId: companyInfo.molId,
      employerBankCode: companyInfo.bankCode,
      employerIban: companyInfo.iban,
      paymentMonth: month,
      paymentYear: year,
      recordCount: records.length,
      totalAmount: Math.round(totalNetSalary * 100) / 100,
      createdAt: new Date(),
    },
    records,
    summary: {
      totalEmployees: records.length,
      totalBasicSalary: Math.round(totalBasicSalary * 100) / 100,
      totalHousingAllowance: Math.round(totalHousingAllowance * 100) / 100,
      totalOtherAllowances: Math.round(totalOtherAllowances * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalNetSalary: Math.round(totalNetSalary * 100) / 100,
      saudiCount,
      nonSaudiCount,
    },
  };

  return { wpsFile, errors };
}

/**
 * Convert WPS file to CSV format for bank upload
 */
export function wpsToCSV(wpsFile: WPSFile): string {
  const lines: string[] = [];

  lines.push([
    'Employee ID',
    'Employee Name',
    'National ID',
    'ID Type',
    'Bank Code',
    'IBAN',
    'Basic Salary',
    'Housing Allowance',
    'Other Allowances',
    'Deductions',
    'Net Salary',
  ].join(','));

  for (const record of wpsFile.records) {
    lines.push([
      record.employeeId,
      `"${record.employeeName}"`,
      record.nationalId,
      record.idType,
      record.bankCode,
      record.iban,
      record.basicSalary.toFixed(2),
      record.housingAllowance.toFixed(2),
      record.otherAllowances.toFixed(2),
      record.deductions.toFixed(2),
      record.netSalary.toFixed(2),
    ].join(','));
  }

  return lines.join('\n');
}

/**
 * Convert WPS file to SIF (Standard Interchange Format) for Mudad
 * Format: HDR|MOL_ID|BANK_CODE|IBAN|RECORD_COUNT|TOTAL_AMOUNT|MONTH|YEAR
 */
export function wpsToSIF(wpsFile: WPSFile): string {
  const lines: string[] = [];

  // Header record
  lines.push([
    'HDR',
    wpsFile.header.employerMolId,
    wpsFile.header.employerBankCode,
    wpsFile.header.employerIban,
    wpsFile.header.recordCount,
    wpsFile.header.totalAmount.toFixed(2),
    String(wpsFile.header.paymentMonth).padStart(2, '0'),
    wpsFile.header.paymentYear,
  ].join('|'));

  // Employee records: EMP|NATIONAL_ID|ID_TYPE|NAME|IBAN|BASIC|HOUSING|OTHER|DEDUCTIONS|NET
  for (const record of wpsFile.records) {
    lines.push([
      'EMP',
      record.nationalId,
      record.idType === 'SAUDI_ID' ? 'S' : 'I',
      record.employeeName,
      record.iban,
      record.basicSalary.toFixed(2),
      record.housingAllowance.toFixed(2),
      record.otherAllowances.toFixed(2),
      record.deductions.toFixed(2),
      record.netSalary.toFixed(2),
    ].join('|'));
  }

  // Footer record: FTR|RECORD_COUNT|TOTAL_AMOUNT
  lines.push([
    'FTR',
    wpsFile.header.recordCount,
    wpsFile.header.totalAmount.toFixed(2),
  ].join('|'));

  return lines.join('\n');
}

/**
 * Generate a printable WPS summary report
 */
export function generateWPSSummary(wpsFile: WPSFile): string {
  const lines: string[] = [
    '===============================================================',
    '              WPS (Wage Protection System) Summary              ',
    '===============================================================',
    '',
    `File Reference:          ${wpsFile.header.fileReference}`,
    `Establishment No:        ${wpsFile.header.employerMolId}`,
    `Period:                  ${wpsFile.header.paymentMonth}/${wpsFile.header.paymentYear}`,
    `Created:                 ${wpsFile.header.createdAt.toLocaleDateString('en-US')}`,
    '',
    '---------------------------------------------------------------',
    '                         Statistics                             ',
    '---------------------------------------------------------------',
    '',
    `Total Employees:         ${wpsFile.summary.totalEmployees}`,
    `  - Saudi:               ${wpsFile.summary.saudiCount}`,
    `  - Non-Saudi:           ${wpsFile.summary.nonSaudiCount}`,
    '',
    '---------------------------------------------------------------',
    '                          Amounts                               ',
    '---------------------------------------------------------------',
    '',
    `Total Basic Salary:      SAR ${wpsFile.summary.totalBasicSalary.toLocaleString()}`,
    `Total Housing Allow.:    SAR ${wpsFile.summary.totalHousingAllowance.toLocaleString()}`,
    `Total Other Allow.:      SAR ${wpsFile.summary.totalOtherAllowances.toLocaleString()}`,
    `Total Deductions:        SAR ${wpsFile.summary.totalDeductions.toLocaleString()}`,
    '',
    '===============================================================',
    `Total Net Salary:        SAR ${wpsFile.summary.totalNetSalary.toLocaleString()}`,
    '===============================================================',
  ];

  return lines.join('\n');
}
