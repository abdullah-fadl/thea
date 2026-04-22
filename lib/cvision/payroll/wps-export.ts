/**
 * CVision WPS Export Generator
 * 
 * Generates CSV file in WPS (Wage Protection System) format for Saudi Arabia.
 * Deterministic output: same inputs always produce same CSV content.
 */

import crypto from 'crypto';
import type {
  CVisionPayrollRun,
  CVisionPayslip,
  CVisionEmployee,
  CVisionPayrollProfile,
} from '@/lib/cvision/types';

export interface WpsExportRow {
  employeeId: string;
  nationalId?: string;
  employeeName: string;
  bankIban: string;
  netSalary: number;
  period: string; // YYYY-MM
  wpsId?: string;
}

export interface WpsExportResult {
  csvContent: string;
  rowCount: number;
  checksum: string; // MD5 hash of CSV content for deterministic verification
  fileName: string;
}

/**
 * Generate WPS CSV export
 * 
 * Format: CSV with headers
 * Columns: Employee ID, National ID, Employee Name, Bank IBAN, Net Salary, Period, WPS ID
 * 
 * @param run Payroll run
 * @param payslips Payslips for the run
 * @param employees Map of employeeId -> Employee
 * @param profiles Map of employeeId -> PayrollProfile
 * @returns CSV content, row count, and checksum
 */
export function generateWpsExport(
  run: CVisionPayrollRun,
  payslips: CVisionPayslip[],
  employees: Map<string, CVisionEmployee>,
  profiles: Map<string, CVisionPayrollProfile>
): WpsExportResult {
  // CSV Headers
  const headers = [
    'Employee ID',
    'National ID',
    'Employee Name',
    'Bank IBAN',
    'Net Salary',
    'Period',
    'WPS ID',
  ];

  // Generate rows
  const rows: WpsExportRow[] = [];

  for (const payslip of payslips) {
    const employee = employees.get(payslip.employeeId);
    const profile = profiles.get(payslip.employeeId);

    if (!employee) {
      continue; // Skip if employee not found
    }

    // Get IBAN from profile, fallback to empty string
    const bankIban = profile?.bankIban || '';

    // Skip if no IBAN (required for WPS)
    if (!bankIban) {
      continue;
    }

    const row: WpsExportRow = {
      employeeId: employee.employeeNo || employee.employeeNumber || employee.id,
      nationalId: employee.nationalId || undefined,
      employeeName: employee.fullName || `${employee.firstName} ${employee.lastName}`.trim(),
      bankIban: bankIban,
      netSalary: payslip.net,
      period: run.period,
      wpsId: profile?.wpsId || undefined,
    };

    rows.push(row);
  }

  // Sort rows by employee ID for deterministic output
  rows.sort((a, b) => a.employeeId.localeCompare(b.employeeId));

  // Generate CSV content
  const csvRows: string[] = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of rows) {
    const csvRow = [
      escapeCsvField(row.employeeId),
      escapeCsvField(row.nationalId || ''),
      escapeCsvField(row.employeeName),
      escapeCsvField(row.bankIban),
      row.netSalary.toFixed(2), // Format as decimal with 2 places
      escapeCsvField(row.period),
      escapeCsvField(row.wpsId || ''),
    ];
    csvRows.push(csvRow.join(','));
  }

  const csvContent = csvRows.join('\n');

  // Generate checksum (MD5) for deterministic verification
  const checksum = crypto.createHash('md5').update(csvContent).digest('hex');

  // Generate filename: WPS_YYYY-MM_TIMESTAMP.csv
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const fileName = `WPS_${run.period}_${timestamp}.csv`;

  return {
    csvContent,
    rowCount: rows.length,
    checksum,
    fileName,
  };
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCsvField(field: string | number | undefined): string {
  if (field === undefined || field === null) {
    return '';
  }

  const str = String(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Validate WPS export data
 */
export function validateWpsExport(
  payslips: CVisionPayslip[],
  employees: Map<string, CVisionEmployee>,
  profiles: Map<string, CVisionPayrollProfile>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const payslip of payslips) {
    const employee = employees.get(payslip.employeeId);
    const profile = profiles.get(payslip.employeeId);

    if (!employee) {
      errors.push(`Employee not found for payslip ${payslip.id}`);
      continue;
    }

    if (!profile?.bankIban) {
      errors.push(`Missing IBAN for employee ${employee.employeeNumber || employee.id}`);
    }

    if (payslip.net <= 0) {
      errors.push(`Invalid net salary (${payslip.net}) for employee ${employee.employeeNumber || employee.id}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
