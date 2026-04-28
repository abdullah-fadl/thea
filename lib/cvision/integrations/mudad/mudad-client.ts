/**
 * CVision Integrations — Mudad WPS Client
 *
 * Client for the Mudad Wage Protection System (WPS).
 * Extends IntegrationClient to support SIMULATION and FILE_EXPORT modes.
 *
 * In SIMULATION mode, API calls return realistic mock responses.
 * In FILE_EXPORT mode, generateWPSFile() creates the CSV for manual upload.
 * In LIVE mode, submits directly to Mudad API (when available).
 */

import { v4 as uuidv4 } from 'uuid';
import { IntegrationClient, type IntegrationClientConfig } from '../shared/api-client';
import type { FileExport, IntegrationMode } from '../shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MudadEmployeeData {
  nationalId: string;
  nameEn: string;
  bankCode: string;
  iban: string;
  basicSalary: number;
  housingAllowance: number;
  otherAllowances: number;
  deductions: number;
  netSalary: number;
}

export interface MudadWPSParams {
  establishmentMOLNumber: string;
  month: number;
  year: number;
  employeeData: MudadEmployeeData[];
}

export interface WPSValidationResult {
  valid: boolean;
  readyCount: number;
  errorCount: number;
  warningCount: number;
  errors: { index: number; employeeId: string; field: string; message: string }[];
  warnings: { index: number; employeeId: string; field: string; message: string }[];
}

export interface WPSSubmissionResult {
  success: boolean;
  referenceNumber: string;
  status: string;
  message: string;
  submittedAt: string;
}

export interface WPSStatusResult {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  processedRecords: number;
  rejectedRecords: number;
  errors: string[];
  checkedAt: string;
}

// WPS deadline: 10th of the following month
export function getWPSDeadline(month: number, year: number): Date {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(nextYear, nextMonth - 1, 10, 23, 59, 59);
}

export function getWPSDeadlineStatus(month: number, year: number): {
  deadline: Date;
  daysRemaining: number;
  isOverdue: boolean;
  label: string;
} {
  const deadline = getWPSDeadline(month, year);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0;

  let label: string;
  if (isOverdue) {
    label = `OVERDUE by ${Math.abs(daysRemaining)} day(s) — submit immediately to avoid violations`;
  } else if (daysRemaining <= 3) {
    label = `Due in ${daysRemaining} day(s) — urgent`;
  } else if (daysRemaining <= 7) {
    label = `Due in ${daysRemaining} day(s)`;
  } else {
    label = `Due in ${daysRemaining} day(s)`;
  }

  return { deadline, daysRemaining, isOverdue, label };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ARABIC_REGEX = /[\u0600-\u06FF]/;
const IBAN_REGEX = /^SA\d{22}$/;

/**
 * Validate WPS data before generating the file.
 * Returns errors (blocking) and warnings (non-blocking).
 */
export function validateWPSData(data: MudadEmployeeData[]): WPSValidationResult {
  const errors: WPSValidationResult['errors'] = [];
  const warnings: WPSValidationResult['warnings'] = [];

  data.forEach((emp, idx) => {
    // Name must be English (Mudad rejects Arabic)
    if (ARABIC_REGEX.test(emp.nameEn)) {
      errors.push({ index: idx, employeeId: emp.nationalId, field: 'nameEn', message: 'Name contains Arabic characters — Mudad requires English names' });
    }
    if (!emp.nameEn || emp.nameEn.trim().length < 2) {
      errors.push({ index: idx, employeeId: emp.nationalId, field: 'nameEn', message: 'Employee name is missing or too short' });
    }

    // National ID / Iqama validation
    const cleanId = (emp.nationalId || '').replace(/\s/g, '');
    if (cleanId.length !== 10 || !/^\d{10}$/.test(cleanId)) {
      errors.push({ index: idx, employeeId: emp.nationalId, field: 'nationalId', message: 'National ID / Iqama must be exactly 10 digits' });
    } else if (cleanId[0] !== '1' && cleanId[0] !== '2') {
      errors.push({ index: idx, employeeId: emp.nationalId, field: 'nationalId', message: 'ID must start with 1 (Saudi) or 2 (Iqama)' });
    }

    // IBAN validation
    const cleanIban = (emp.iban || '').replace(/[\s-]/g, '').toUpperCase();
    if (!IBAN_REGEX.test(cleanIban)) {
      errors.push({ index: idx, employeeId: emp.nationalId, field: 'iban', message: 'Invalid Saudi IBAN (must be SA + 22 digits)' });
    }

    // Salary consistency: net must equal basic + housing + other - deductions
    const expected = emp.basicSalary + emp.housingAllowance + emp.otherAllowances - emp.deductions;
    const diff = Math.abs(emp.netSalary - expected);
    if (diff > 0.02) {
      warnings.push({ index: idx, employeeId: emp.nationalId, field: 'netSalary', message: `Net salary (${emp.netSalary.toFixed(2)}) does not match components (${expected.toFixed(2)})` });
    }

    if (emp.basicSalary <= 0) {
      errors.push({ index: idx, employeeId: emp.nationalId, field: 'basicSalary', message: 'Basic salary must be greater than zero' });
    }

    if (emp.netSalary <= 0) {
      errors.push({ index: idx, employeeId: emp.nationalId, field: 'netSalary', message: 'Net salary must be greater than zero' });
    }

    // Bank code
    if (!emp.bankCode || emp.bankCode.trim().length === 0) {
      warnings.push({ index: idx, employeeId: emp.nationalId, field: 'bankCode', message: 'Bank code is missing — will be derived from IBAN' });
    }
  });

  const errorIds = new Set(errors.map(e => e.index));
  const readyCount = data.filter((_, i) => !errorIds.has(i)).length;

  return {
    valid: errors.length === 0,
    readyCount,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// WPS File Generation
// ---------------------------------------------------------------------------

/**
 * Generate a Mudad-compatible WPS CSV file.
 *
 * Column order per Mudad specification:
 * NationalID, EmployeeName, BankShortName, IBAN,
 * BasicSalary, HousingAllowance, OtherAllowances, Deductions, NetSalary
 */
export function generateMudadWPSFile(params: MudadWPSParams): FileExport {
  const { establishmentMOLNumber, month, year, employeeData } = params;
  const mm = String(month).padStart(2, '0');

  const headers = [
    'NationalID',
    'EmployeeName',
    'BankShortName',
    'IBAN',
    'BasicSalary',
    'HousingAllowance',
    'OtherAllowances',
    'Deductions',
    'NetSalary',
  ];

  const rows = employeeData.map((emp) => {
    const iban = emp.iban.replace(/[\s-]/g, '').toUpperCase();
    const bankCode = emp.bankCode || iban.slice(4, 6);
    return [
      emp.nationalId.replace(/\s/g, ''),
      csvEscape(emp.nameEn),
      bankCode,
      iban,
      emp.basicSalary.toFixed(2),
      emp.housingAllowance.toFixed(2),
      emp.otherAllowances.toFixed(2),
      emp.deductions.toFixed(2),
      emp.netSalary.toFixed(2),
    ].join(',');
  });

  const content = [headers.join(','), ...rows].join('\r\n');

  return {
    filename: `WPS_${establishmentMOLNumber}_${year}${mm}.csv`,
    format: 'CSV',
    content,
    mimeType: 'text/csv',
    recordCount: employeeData.length,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// MudadClient (extends IntegrationClient for API mode)
// ---------------------------------------------------------------------------

export class MudadClient extends IntegrationClient {
  constructor(config: Omit<IntegrationClientConfig, 'integrationId'>) {
    super({ ...config, integrationId: 'mudad' });
  }

  /**
   * Submit a WPS file to Mudad (SIMULATION or LIVE).
   */
  async submitWPS(file: FileExport): Promise<WPSSubmissionResult> {
    const result = await this.request<WPSSubmissionResult>('POST', '/api/v1/wps/submit', {
      fileName: file.filename,
      recordCount: file.recordCount,
      content: file.content,
    });
    return result.data;
  }

  /**
   * Check the status of a WPS submission.
   */
  async checkWPSStatus(referenceNumber: string): Promise<WPSStatusResult> {
    const result = await this.request<WPSStatusResult>('GET', `/api/v1/wps/status/${referenceNumber}`);
    return result.data;
  }

  // ── Simulation responses ────────────────────────────────────────────

  protected async simulateResponse(method: string, path: string, data?: any): Promise<any> {
    // Simulate slight network delay
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));

    if (path.includes('/wps/submit')) {
      const ref = `MDD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      return {
        success: true,
        referenceNumber: ref,
        status: 'PENDING',
        message: `WPS file accepted. ${data?.recordCount || 0} records queued for processing.`,
        submittedAt: new Date().toISOString(),
      } satisfies WPSSubmissionResult;
    }

    if (path.includes('/wps/status/')) {
      const statuses: WPSStatusResult['status'][] = ['PENDING', 'PROCESSING', 'COMPLETED'];
      const pick = statuses[Math.floor(Math.random() * statuses.length)];
      return {
        status: pick,
        processedRecords: pick === 'COMPLETED' ? 8 : Math.floor(Math.random() * 5),
        rejectedRecords: 0,
        errors: [],
        checkedAt: new Date().toISOString(),
      } satisfies WPSStatusResult;
    }

    return { success: true, simulated: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
