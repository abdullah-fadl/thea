import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Integrations — File Export API
 *
 * GET  ?action=sif&bank=RAJHI&month=2&year=2026   → download bank SIF file
 * GET  ?action=wps&month=2&year=2026               → download Mudad WPS CSV
 * GET  ?action=validate-wps&month=2&year=2026      → validate without generating
 * GET  ?action=deadline&month=2&year=2026           → check WPS deadline status
 *
 * POST action=submit-wps (simulation)              → mock Mudad submission
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSessionAndTenant, middlewareError } from '@/lib/cvision/middleware';
import { getCVisionDb } from '@/lib/cvision/db';
import { isSaudiEmployee } from '@/lib/cvision/saudi-utils';
import { SAUDI_BANKS } from '@/lib/cvision/iban-validator';
import {
  generateSIFFile,
  BANK_LABELS,
  type SIFBankCode,
  type SIFEmployee,
} from '@/lib/cvision/integrations/banks/sif-generator';
import {
  validateWPSData,
  generateMudadWPSFile,
  getWPSDeadlineStatus,
  MudadClient,
  type MudadEmployeeData,
} from '@/lib/cvision/integrations/mudad/mudad-client';
import {
  generateGOSIMonthlyReport,
  getGOSIDeadline,
  GOSIClient,
  type GOSIEmployeeInput,
} from '@/lib/cvision/integrations/gosi/gosi-client';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface EmployeeRow {
  _id: any;
  id?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  nameEn?: string;
  nationalId?: string;
  nationality?: string;
  iban?: string;
  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  foodAllowance?: number;
  phoneAllowance?: number;
  otherAllowances?: number;
  status?: string;
  departmentId?: string;
  _payrollProfile?: {
    baseSalary?: number;
    allowancesJson?: Record<string, number>;
    deductionsJson?: Record<string, number>;
    bankIban?: string;
  };
}

function getNameEn(emp: EmployeeRow): string {
  return emp.nameEn || emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Unknown';
}

function getName(emp: EmployeeRow): string {
  return emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Unknown';
}

function getBankCode(iban: string): string {
  const cleaned = (iban || '').replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length >= 6 && cleaned.startsWith('SA')) return cleaned.slice(4, 6);
  return '';
}

async function fetchActiveEmployees(db: any, tenantId: string): Promise<EmployeeRow[]> {
  const employees: EmployeeRow[] = await db
    .collection('cvision_employees')
    .find({ tenantId, status: 'ACTIVE' })
    .limit(5000)
    .toArray();

  const empIds = employees.map((e) => e._id?.toString() || e.id);
  const profiles = await db
    .collection('cvision_payroll_profiles')
    .find({ tenantId, employeeId: { $in: empIds }, isActive: true })
    .limit(5000)
    .toArray();
  const profileMap = new Map(profiles.map((p: any) => [p.employeeId, p]));

  for (const emp of employees) {
    const empId = emp._id?.toString() || emp.id;
    const profile: any = profileMap.get(empId);
    if (profile) {
      emp._payrollProfile = profile;
      if (!emp.basicSalary && profile.baseSalary) emp.basicSalary = profile.baseSalary;
      if (!emp.iban && profile.bankIban) emp.iban = profile.bankIban;
      if (profile.allowancesJson) {
        if (!emp.housingAllowance) emp.housingAllowance = profile.allowancesJson.housing || 0;
        if (!emp.transportAllowance) emp.transportAllowance = profile.allowancesJson.transport || 0;
        if (!emp.foodAllowance) emp.foodAllowance = profile.allowancesJson.food || 0;
        if (!emp.phoneAllowance) emp.phoneAllowance = profile.allowancesJson.phone || 0;
      }
    }
  }

  return employees;
}

function toSIFEmployee(emp: EmployeeRow): SIFEmployee {
  const basic = emp.basicSalary || 0;
  const housing = emp.housingAllowance || 0;
  const transport = emp.transportAllowance || 0;
  const food = emp.foodAllowance || 0;
  const phone = emp.phoneAllowance || 0;
  const other = emp.otherAllowances || 0;
  return {
    employeeId: emp._id?.toString() || emp.id || '',
    name: getName(emp),
    iban: emp.iban || '',
    netSalary: basic + housing + transport + food + phone + other,
    nationality: emp.nationality || (isSaudiEmployee(emp) ? 'SA' : 'XX'),
  };
}

function toMudadEmployee(emp: EmployeeRow): MudadEmployeeData {
  const basic = emp.basicSalary || 0;
  const housing = emp.housingAllowance || 0;
  const transport = emp.transportAllowance || 0;
  const food = emp.foodAllowance || 0;
  const phone = emp.phoneAllowance || 0;
  const other = (emp.otherAllowances || 0) + transport + food + phone;
  return {
    nationalId: emp.nationalId || '',
    nameEn: getNameEn(emp),
    bankCode: getBankCode(emp.iban || ''),
    iban: emp.iban || '',
    basicSalary: basic,
    housingAllowance: housing,
    otherAllowances: other,
    deductions: 0,
    netSalary: basic + housing + other,
  };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId } = authResult.data;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const db = await getCVisionDb(tenantId);

    // ── DEADLINE ─────────────────────────────────────────────────────
    if (action === 'deadline') {
      const status = getWPSDeadlineStatus(month, year);
      return NextResponse.json({ success: true, data: status });
    }

    // ── BANK LIST ────────────────────────────────────────────────────
    if (action === 'banks') {
      const banks = Object.entries(BANK_LABELS).map(([code, info]) => ({
        code,
        ...info,
      }));
      return NextResponse.json({ success: true, data: banks });
    }

    // Fetch employees for SIF / WPS actions
    const employees = await fetchActiveEmployees(db, tenantId);
    const withSalary = employees.filter(e => (e.basicSalary || 0) > 0);

    // ── VALIDATE WPS ─────────────────────────────────────────────────
    if (action === 'validate-wps') {
      const mudadData = withSalary.map(toMudadEmployee);
      const validation = validateWPSData(mudadData);
      const deadlineStatus = getWPSDeadlineStatus(month, year);

      return NextResponse.json({
        success: true,
        data: {
          validation,
          deadline: deadlineStatus,
          totalEmployees: employees.length,
          employeesWithSalary: withSalary.length,
          employeesWithoutSalary: employees.length - withSalary.length,
          employeesWithoutIban: withSalary.filter(e => !e.iban).length,
        },
      });
    }

    // ── SIF ──────────────────────────────────────────────────────────
    if (action === 'sif') {
      const bank = (searchParams.get('bank') || 'GENERIC').toUpperCase() as SIFBankCode;
      const company = await db.collection('tenants').findOne({ id: tenantId });

      const sifResult = generateSIFFile({
        bank,
        companyMOLNumber: company?.molId || tenantId.slice(0, 10),
        companyName: company?.name || 'Company',
        paymentDate: new Date(year, month - 1, 25),
        employees: withSalary.map(toSIFEmployee),
      });

      return NextResponse.json({
        success: true,
        data: {
          content: sifResult.content,
          filename: sifResult.filename,
          recordCount: sifResult.recordCount,
          totalAmount: sifResult.totalAmount,
          bankCode: sifResult.bankCode,
          bankName: BANK_LABELS[bank]?.nameEn || bank,
          skippedEmployees: sifResult.skippedEmployees,
          mimeType: sifResult.mimeType,
        },
      });
    }

    // ── GOSI REPORT ──────────────────────────────────────────────────
    if (action === 'gosi') {
      const company = await db.collection('tenants').findOne({ id: tenantId });
      const gosiEmployees: GOSIEmployeeInput[] = employees.map(emp => ({
        nationalId: emp.nationalId || '',
        name: getName(emp),
        isSaudi: isSaudiEmployee(emp as unknown as Parameters<typeof isSaudiEmployee>[0]),
        basicSalary: emp.basicSalary || 0,
        housingAllowance: emp.housingAllowance || 0,
      }));

      const report = generateGOSIMonthlyReport({
        establishmentNumber: company?.gosiNumber || company?.molId || tenantId.slice(0, 10),
        month,
        year,
        employees: gosiEmployees,
      });

      return NextResponse.json({ success: true, data: report });
    }

    // ── GOSI DEADLINE ───────────────────────────────────────────────
    if (action === 'gosi-deadline') {
      const deadline = getGOSIDeadline(month, year);
      return NextResponse.json({ success: true, data: deadline });
    }

    // ── GOSI VERIFY REGISTRATION (simulation) ───────────────────────
    if (action === 'gosi-verify') {
      const nationalId = searchParams.get('nationalId');
      if (!nationalId) return NextResponse.json({ success: false, error: 'nationalId required' }, { status: 400 });
      const client = new GOSIClient({ tenantId, baseUrl: 'https://api.gosi.gov.sa', mode: 'SIMULATION' });
      const result = await client.verifyRegistration(nationalId);
      return NextResponse.json({ success: true, data: result });
    }

    // ── WPS ──────────────────────────────────────────────────────────
    if (action === 'wps') {
      const company = await db.collection('tenants').findOne({ id: tenantId });
      const mudadData = withSalary.map(toMudadEmployee);
      const validation = validateWPSData(mudadData);

      const file = generateMudadWPSFile({
        establishmentMOLNumber: company?.molId || tenantId.slice(0, 10),
        month,
        year,
        employeeData: mudadData,
      });

      const deadlineStatus = getWPSDeadlineStatus(month, year);

      return NextResponse.json({
        success: true,
        data: {
          content: file.content,
          filename: file.filename,
          recordCount: file.recordCount,
          mimeType: file.mimeType,
          validation,
          deadline: deadlineStatus,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    logger.error('Integration export error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId } = authResult.data;
    const body = await request.json();
    const { action } = body;

    if (action === 'submit-wps') {
      const { month, year } = body;
      const db = await getCVisionDb(tenantId);
      const company = await db.collection('tenants').findOne({ id: tenantId });
      const employees = await fetchActiveEmployees(db, tenantId);
      const withSalary = employees.filter(e => (e.basicSalary || 0) > 0);
      const mudadData = withSalary.map(toMudadEmployee);

      const file = generateMudadWPSFile({
        establishmentMOLNumber: company?.molId || tenantId.slice(0, 10),
        month: month || new Date().getMonth() + 1,
        year: year || new Date().getFullYear(),
        employeeData: mudadData,
      });

      const client = new MudadClient({
        tenantId,
        baseUrl: 'https://api.mudad.mlsd.gov.sa',
        mode: 'SIMULATION',
      });

      const result = await client.submitWPS(file);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'submit-gosi') {
      const { month: gosiMonth, year: gosiYear } = body;
      const db = await getCVisionDb(tenantId);
      const company = await db.collection('tenants').findOne({ id: tenantId });
      const employees = await fetchActiveEmployees(db, tenantId);
      const gosiEmployees: GOSIEmployeeInput[] = employees.map(emp => ({
        nationalId: emp.nationalId || '',
        name: getName(emp),
        isSaudi: isSaudiEmployee(emp as unknown as Parameters<typeof isSaudiEmployee>[0]),
        basicSalary: emp.basicSalary || 0,
        housingAllowance: emp.housingAllowance || 0,
      }));

      const report = generateGOSIMonthlyReport({
        establishmentNumber: company?.gosiNumber || company?.molId || tenantId.slice(0, 10),
        month: gosiMonth || new Date().getMonth() + 1,
        year: gosiYear || new Date().getFullYear(),
        employees: gosiEmployees,
      });

      const client = new GOSIClient({ tenantId, baseUrl: 'https://api.gosi.gov.sa', mode: 'SIMULATION' });
      const result = await client.submitContributions(report);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'check-wps-status') {
      const { referenceNumber } = body;
      if (!referenceNumber) return NextResponse.json({ success: false, error: 'referenceNumber required' }, { status: 400 });

      const client = new MudadClient({
        tenantId,
        baseUrl: 'https://api.mudad.mlsd.gov.sa',
        mode: 'SIMULATION',
      });

      const result = await client.checkWPSStatus(referenceNumber);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    logger.error('Integration export POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
