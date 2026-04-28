// lib/cvision/reports/gosi-report.ts
// GOSI (General Organization for Social Insurance) monthly report

import { calculateGOSI, GOSI_RATES } from '../gosi';

/**
 * GOSI employee record
 */
export interface GOSIEmployeeRecord {
  employeeId: string;
  employeeName: string;
  nationalId: string;
  idType: 'SAUDI_ID' | 'IQAMA';
  isSaudi: boolean;

  basicSalary: number;
  housingAllowance: number;
  totalInsurableSalary: number;

  employeeContribution: number;
  employerContribution: number;
  hazardContribution: number;
  totalContribution: number;

  gosiNumber?: string;
  registrationDate?: Date;
  status: 'ACTIVE' | 'NEW' | 'TERMINATED' | 'ON_LEAVE';
}

/**
 * GOSI monthly report
 */
export interface GOSIMonthlyReport {
  company: {
    name: string;
    gosiNumber: string;
    molId: string;
  };

  period: {
    month: number;
    year: number;
  };

  records: GOSIEmployeeRecord[];

  summary: {
    totalEmployees: number;
    saudiEmployees: number;
    nonSaudiEmployees: number;

    totalInsurableSalaries: number;
    totalEmployeeContributions: number;
    totalEmployerContributions: number;
    totalHazardContributions: number;
    grandTotalContributions: number;

    saudiContributions: {
      employee: number;
      employer: number;
      total: number;
    };
    nonSaudiContributions: {
      employee: number;
      employer: number;
      total: number;
    };
  };

  metadata: {
    generatedAt: Date;
    generatedBy: string;
    notes: string[];
  };
}

/**
 * Generate monthly GOSI contribution report
 */
export function generateGOSIReport(
  employees: {
    id: string;
    name: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    nationalId: string;
    isSaudi: boolean;
    basicSalary: number;
    housingAllowance: number;
    gosiNumber?: string;
    registrationDate?: Date;
    status: 'ACTIVE' | 'NEW' | 'TERMINATED' | 'ON_LEAVE';
  }[],
  companyInfo: {
    name: string;
    gosiNumber: string;
    molId: string;
  },
  month: number,
  year: number,
  generatedBy: string,
  includeHazard: boolean = false
): GOSIMonthlyReport {
  const records: GOSIEmployeeRecord[] = [];
  const notes: string[] = [];

  let totalInsurableSalaries = 0;
  let totalEmployeeContributions = 0;
  let totalEmployerContributions = 0;
  let totalHazardContributions = 0;

  let saudiCount = 0;
  let nonSaudiCount = 0;

  let saudiEmployeeContrib = 0;
  let saudiEmployerContrib = 0;
  let nonSaudiEmployeeContrib = 0;
  let nonSaudiEmployerContrib = 0;

  for (const emp of employees) {
    if (emp.status === 'TERMINATED') {
      continue;
    }

    const gosiCalc = calculateGOSI(
      emp.basicSalary,
      emp.housingAllowance,
      includeHazard
    );

    // ---- Apply correct Saudi / Non-Saudi contribution rules ----
    // Saudi: employer 9% + employee 9% (annuities + hazard)
    // Non-Saudi: employer 2% only (occupational hazard), employee 0%
    let employeeContrib: number;
    let employerContrib: number;
    let hazardContrib: number;
    let totalContrib: number;

    if (emp.isSaudi) {
      // Saudi: full contributions from both sides
      employeeContrib = gosiCalc.employeeContribution;
      employerContrib = gosiCalc.employerContribution;
      hazardContrib = gosiCalc.hazardContribution;
      totalContrib = employeeContrib + employerContrib + hazardContrib;
    } else {
      // Non-Saudi: employer pays 2% occupational hazard only, employee pays nothing
      employeeContrib = 0;
      employerContrib = Math.round(gosiCalc.totalInsurableSalary * GOSI_RATES.HAZARD_RATE * 100) / 100;
      hazardContrib = employerContrib; // The 2% IS the hazard contribution
      totalContrib = employerContrib;
    }

    const record: GOSIEmployeeRecord = {
      employeeId: emp.id,
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      nationalId: emp.nationalId,
      idType: emp.isSaudi ? 'SAUDI_ID' : 'IQAMA',
      isSaudi: emp.isSaudi,
      basicSalary: emp.basicSalary,
      housingAllowance: emp.housingAllowance,
      totalInsurableSalary: gosiCalc.totalInsurableSalary,
      employeeContribution: employeeContrib,
      employerContribution: employerContrib,
      hazardContribution: hazardContrib,
      totalContribution: totalContrib,
      gosiNumber: emp.gosiNumber,
      registrationDate: emp.registrationDate,
      status: emp.status,
    };

    records.push(record);

    totalInsurableSalaries += gosiCalc.totalInsurableSalary;
    totalEmployeeContributions += employeeContrib;
    totalEmployerContributions += employerContrib;
    totalHazardContributions += hazardContrib;

    if (emp.isSaudi) {
      saudiCount++;
      saudiEmployeeContrib += employeeContrib;
      saudiEmployerContrib += employerContrib;
    } else {
      nonSaudiCount++;
      nonSaudiEmployeeContrib += employeeContrib;  // Should be 0
      nonSaudiEmployerContrib += employerContrib;   // 2% hazard only
    }

    if (gosiCalc.isAboveMax) {
      notes.push(`${emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee'}: Salary exceeds maximum cap (SAR ${GOSI_RATES.MAX_SALARY})`);
    }

    if (emp.status === 'NEW') {
      notes.push(`${emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee'}: New employee — requires GOSI registration`);
    }
  }

  return {
    company: companyInfo,
    period: { month, year },
    records,
    summary: {
      totalEmployees: records.length,
      saudiEmployees: saudiCount,
      nonSaudiEmployees: nonSaudiCount,
      totalInsurableSalaries: Math.round(totalInsurableSalaries * 100) / 100,
      totalEmployeeContributions: Math.round(totalEmployeeContributions * 100) / 100,
      totalEmployerContributions: Math.round(totalEmployerContributions * 100) / 100,
      totalHazardContributions: Math.round(totalHazardContributions * 100) / 100,
      grandTotalContributions: Math.round((totalEmployeeContributions + totalEmployerContributions + totalHazardContributions) * 100) / 100,
      saudiContributions: {
        employee: Math.round(saudiEmployeeContrib * 100) / 100,
        employer: Math.round(saudiEmployerContrib * 100) / 100,
        total: Math.round((saudiEmployeeContrib + saudiEmployerContrib) * 100) / 100,
      },
      nonSaudiContributions: {
        employee: Math.round(nonSaudiEmployeeContrib * 100) / 100,
        employer: Math.round(nonSaudiEmployerContrib * 100) / 100,
        total: Math.round((nonSaudiEmployeeContrib + nonSaudiEmployerContrib) * 100) / 100,
      },
    },
    metadata: {
      generatedAt: new Date(),
      generatedBy,
      notes,
    },
  };
}

/**
 * Convert GOSI report to CSV format
 */
export function gosiReportToCSV(report: GOSIMonthlyReport): string {
  const lines: string[] = [];

  lines.push([
    'Employee ID',
    'Employee Name',
    'National ID',
    'Nationality',
    'Basic Salary',
    'Housing Allowance',
    'Insurable Salary',
    'Employee Contribution',
    'Employer Contribution',
    'Hazard Contribution',
    'Total Contribution',
    'GOSI Number',
  ].join(','));

  for (const record of report.records) {
    lines.push([
      record.employeeId,
      `"${record.employeeName}"`,
      record.nationalId,
      record.isSaudi ? 'Saudi' : 'Non-Saudi',
      record.basicSalary.toFixed(2),
      record.housingAllowance.toFixed(2),
      record.totalInsurableSalary.toFixed(2),
      record.employeeContribution.toFixed(2),
      record.employerContribution.toFixed(2),
      record.hazardContribution.toFixed(2),
      record.totalContribution.toFixed(2),
      record.gosiNumber || '',
    ].join(','));
  }

  lines.push('');

  lines.push(`Total,${report.summary.totalEmployees} employees,,,,,${report.summary.totalInsurableSalaries.toFixed(2)},${report.summary.totalEmployeeContributions.toFixed(2)},${report.summary.totalEmployerContributions.toFixed(2)},${report.summary.totalHazardContributions.toFixed(2)},${report.summary.grandTotalContributions.toFixed(2)},`);

  return lines.join('\n');
}

/**
 * Generate a printable GOSI report summary
 */
export function generateGOSIReportSummary(report: GOSIMonthlyReport): string {
  const lines: string[] = [
    '===============================================================',
    '           GOSI Social Insurance Contribution Report            ',
    '===============================================================',
    '',
    `Company Name:            ${report.company.name}`,
    `GOSI Number:             ${report.company.gosiNumber}`,
    `MOL Number:              ${report.company.molId}`,
    `Period:                  ${report.period.month}/${report.period.year}`,
    '',
    '---------------------------------------------------------------',
    '                     Employee Statistics                        ',
    '---------------------------------------------------------------',
    '',
    `Total Employees:         ${report.summary.totalEmployees}`,
    `  - Saudi:               ${report.summary.saudiEmployees}`,
    `  - Non-Saudi:           ${report.summary.nonSaudiEmployees}`,
    '',
    '---------------------------------------------------------------',
    '                    Contribution Rates                          ',
    '---------------------------------------------------------------',
    '',
    `Employee Rate:           ${GOSI_RATES.EMPLOYEE_RATE * 100}%`,
    `Employer Rate:           ${GOSI_RATES.EMPLOYER_RATE * 100}%`,
    `Hazard Rate:             ${GOSI_RATES.HAZARD_RATE * 100}%`,
    `Maximum Salary Cap:      SAR ${GOSI_RATES.MAX_SALARY.toLocaleString()}`,
    '',
    '---------------------------------------------------------------',
    '                  Contribution Summary                          ',
    '---------------------------------------------------------------',
    '',
    `Total Insurable Salaries:    SAR ${report.summary.totalInsurableSalaries.toLocaleString()}`,
    '',
    '  Saudi:',
    `    - Employee Share:        SAR ${report.summary.saudiContributions.employee.toLocaleString()}`,
    `    - Employer Share:        SAR ${report.summary.saudiContributions.employer.toLocaleString()}`,
    `    - Subtotal:              SAR ${report.summary.saudiContributions.total.toLocaleString()}`,
    '',
    '  Non-Saudi:',
    `    - Employee Share:        SAR ${report.summary.nonSaudiContributions.employee.toLocaleString()}`,
    `    - Employer Share:        SAR ${report.summary.nonSaudiContributions.employer.toLocaleString()}`,
    `    - Subtotal:              SAR ${report.summary.nonSaudiContributions.total.toLocaleString()}`,
    '',
    '===============================================================',
    '                      Amounts Due                               ',
    '===============================================================',
    '',
    `Employee Contributions:      SAR ${report.summary.totalEmployeeContributions.toLocaleString()}`,
    `Employer Contributions:      SAR ${report.summary.totalEmployerContributions.toLocaleString()}`,
    `Hazard Contributions:        SAR ${report.summary.totalHazardContributions.toLocaleString()}`,
    '',
    '---------------------------------------------------------------',
    `Grand Total Due:             SAR ${report.summary.grandTotalContributions.toLocaleString()}`,
    '===============================================================',
  ];

  if (report.metadata.notes.length > 0) {
    lines.push('');
    lines.push('Notes:');
    report.metadata.notes.forEach(note => lines.push(`  * ${note}`));
  }

  lines.push('');
  lines.push(`Generated: ${report.metadata.generatedAt.toLocaleDateString('en-US')}`);

  return lines.join('\n');
}

/**
 * Generate GOSI report as XML for upload
 */
export function gosiReportToXML(report: GOSIMonthlyReport): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<GOSIContributionFile>',
    '  <Header>',
    `    <EstablishmentNumber>${report.company.gosiNumber}</EstablishmentNumber>`,
    `    <MOLNumber>${report.company.molId}</MOLNumber>`,
    `    <Period>`,
    `      <Month>${String(report.period.month).padStart(2, '0')}</Month>`,
    `      <Year>${report.period.year}</Year>`,
    `    </Period>`,
    `    <TotalEmployees>${report.summary.totalEmployees}</TotalEmployees>`,
    `    <TotalContributions>${report.summary.grandTotalContributions.toFixed(2)}</TotalContributions>`,
    '  </Header>',
    '  <Employees>',
  ];

  for (const record of report.records) {
    lines.push('    <Employee>');
    lines.push(`      <NationalID>${record.nationalId}</NationalID>`);
    lines.push(`      <IDType>${record.idType}</IDType>`);
    lines.push(`      <Name>${record.employeeName}</Name>`);
    lines.push(`      <BasicSalary>${record.basicSalary.toFixed(2)}</BasicSalary>`);
    lines.push(`      <HousingAllowance>${record.housingAllowance.toFixed(2)}</HousingAllowance>`);
    lines.push(`      <InsurableSalary>${record.totalInsurableSalary.toFixed(2)}</InsurableSalary>`);
    lines.push(`      <EmployeeContribution>${record.employeeContribution.toFixed(2)}</EmployeeContribution>`);
    lines.push(`      <EmployerContribution>${record.employerContribution.toFixed(2)}</EmployerContribution>`);
    lines.push(`      <HazardContribution>${record.hazardContribution.toFixed(2)}</HazardContribution>`);
    lines.push(`      <TotalContribution>${record.totalContribution.toFixed(2)}</TotalContribution>`);
    if (record.gosiNumber) {
      lines.push(`      <GOSINumber>${record.gosiNumber}</GOSINumber>`);
    }
    lines.push('    </Employee>');
  }

  lines.push('  </Employees>');
  lines.push('  <Summary>');
  lines.push(`    <TotalInsurableSalaries>${report.summary.totalInsurableSalaries.toFixed(2)}</TotalInsurableSalaries>`);
  lines.push(`    <TotalEmployeeContributions>${report.summary.totalEmployeeContributions.toFixed(2)}</TotalEmployeeContributions>`);
  lines.push(`    <TotalEmployerContributions>${report.summary.totalEmployerContributions.toFixed(2)}</TotalEmployerContributions>`);
  lines.push(`    <TotalHazardContributions>${report.summary.totalHazardContributions.toFixed(2)}</TotalHazardContributions>`);
  lines.push(`    <GrandTotal>${report.summary.grandTotalContributions.toFixed(2)}</GrandTotal>`);
  lines.push('  </Summary>');
  lines.push('</GOSIContributionFile>');

  return lines.join('\n');
}
