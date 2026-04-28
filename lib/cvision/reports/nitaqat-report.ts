// lib/cvision/reports/nitaqat-report.ts
// Nitaqat (Saudization) compliance report

import { calculateNitaqat } from '../gosi';

/**
 * Nitaqat band definitions and their benefits/restrictions
 */
export const NITAQAT_BANDS = {
  PLATINUM: {
    color: '#E5E4E2',
    nameAr: 'Platinum',
    nameEn: 'Platinum',
    benefits: [
      'Unlimited visa issuance',
      'Transfer services from all bands',
      'Unrestricted work permit renewals',
      'Open new branch files',
    ],
  },
  GREEN_HIGH: {
    color: '#006400',
    nameAr: 'High Green',
    nameEn: 'High Green',
    benefits: [
      'Visa issuance per activity type',
      'Transfer services from Yellow and Red',
      'Work permit renewals',
    ],
  },
  GREEN_MID: {
    color: '#228B22',
    nameAr: 'Mid Green',
    nameEn: 'Mid Green',
    benefits: [
      'Limited visa issuance',
      'Transfer services from Red only',
      'Work permit renewals',
    ],
  },
  GREEN_LOW: {
    color: '#90EE90',
    nameAr: 'Low Green',
    nameEn: 'Low Green',
    benefits: [
      'Very limited visa issuance',
      'Work permit renewals',
    ],
  },
  YELLOW: {
    color: '#FFD700',
    nameAr: 'Yellow',
    nameEn: 'Yellow',
    benefits: [],
    restrictions: [
      'Cannot issue new visas',
      'Cannot transfer services',
      '6-month grace period for correction',
    ],
  },
  RED: {
    color: '#DC143C',
    nameAr: 'Red',
    nameEn: 'Red',
    benefits: [],
    restrictions: [
      'All services suspended',
      'Cannot renew work permits',
      'Fines and penalties apply',
      '3-month grace period for correction',
    ],
  },
} as const;

/**
 * Required Saudization percentages by company size and sector
 */
export const NITAQAT_REQUIREMENTS: Record<string, Record<string, number>> = {
  RETAIL: {
    SMALL: 12,    // 10-49 employees
    MEDIUM: 15,   // 50-499 employees
    LARGE: 18,    // 500-2999 employees
    GIANT: 20,    // 3000+ employees
  },
  CONSTRUCTION: {
    SMALL: 8,
    MEDIUM: 10,
    LARGE: 12,
    GIANT: 15,
  },
  MANUFACTURING: {
    SMALL: 10,
    MEDIUM: 12,
    LARGE: 15,
    GIANT: 18,
  },
  SERVICES: {
    SMALL: 15,
    MEDIUM: 18,
    LARGE: 22,
    GIANT: 25,
  },
  TECHNOLOGY: {
    SMALL: 25,
    MEDIUM: 30,
    LARGE: 35,
    GIANT: 40,
  },
  GENERAL: {
    SMALL: 10,
    MEDIUM: 12,
    LARGE: 15,
    GIANT: 18,
  },
};

/**
 * Nitaqat employee record
 */
export interface NitaqatEmployeeRecord {
  employeeId: string;
  employeeName: string;
  nationalId: string;
  isSaudi: boolean;
  jobTitle: string;
  department: string;
  joinDate: Date;
  salary: number;
  isFullTime: boolean;
  weight: number; // Saudization weight (1 normal, 0.5 part-time, 4 disabled)
}

/**
 * Full Nitaqat report
 */
export interface NitaqatReport {
  company: {
    name: string;
    molId: string;
    activityType: string;
    size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT';
  };

  reportDate: Date;

  statistics: {
    totalEmployees: number;
    saudiEmployees: number;
    nonSaudiEmployees: number;
    saudiMales: number;
    saudiFemales: number;
    saudiDisabled: number;
    saudiStudents: number;
  };

  saudization: {
    rawPercentage: number;
    weightedPercentage: number;
    requiredPercentage: number;
    currentBand: keyof typeof NITAQAT_BANDS;
    bandInfo: typeof NITAQAT_BANDS[keyof typeof NITAQAT_BANDS];
  };

  gapAnalysis: {
    deficit: number;
    surplus: number;
    toReachGreenLow: number;
    toReachGreenMid: number;
    toReachGreenHigh: number;
    toReachPlatinum: number;
  };

  recommendations: string[];

  employees: {
    saudi: NitaqatEmployeeRecord[];
    nonSaudi: NitaqatEmployeeRecord[];
  };

  metadata: {
    generatedAt: Date;
    generatedBy: string;
  };
}

/**
 * Determine company size tier based on employee count
 */
export function determineCompanySize(employeeCount: number): 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT' {
  if (employeeCount < 10) return 'SMALL'; // Under 10 usually exempt
  if (employeeCount < 50) return 'SMALL';
  if (employeeCount < 500) return 'MEDIUM';
  if (employeeCount < 3000) return 'LARGE';
  return 'GIANT';
}

/**
 * Calculate Saudization weight for a Saudi employee.
 * Part-time = 0.5, disabled = 4, full-time = 1
 */
export function calculateSaudiWeight(employee: {
  isFullTime: boolean;
  isDisabled: boolean;
  isStudent: boolean;
  isFemale: boolean;
  salary: number;
}): number {
  let weight = 1;

  if (!employee.isFullTime) {
    weight = 0.5;
  }

  // Disabled employees count as 4x per Nitaqat rules
  if (employee.isDisabled) {
    weight = 4;
  }

  if (employee.isFemale) {
    weight *= 1; // Can be adjusted per policy
  }

  return weight;
}

/**
 * Generate a full Nitaqat compliance report
 */
export function generateNitaqatReport(
  employees: {
    id: string;
    name: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    nationalId: string;
    isSaudi: boolean;
    isMale: boolean;
    isDisabled: boolean;
    isStudent: boolean;
    isFullTime: boolean;
    jobTitle: string;
    department: string;
    hiredAt?: Date;
    joinDate: Date;
    salary: number;
  }[],
  companyInfo: {
    name: string;
    molId: string;
    activityType: string;
  },
  generatedBy: string
): NitaqatReport {
  const recommendations: string[] = [];

  const saudiEmployees: NitaqatEmployeeRecord[] = [];
  const nonSaudiEmployees: NitaqatEmployeeRecord[] = [];

  let saudiMales = 0;
  let saudiFemales = 0;
  let saudiDisabled = 0;
  let saudiStudents = 0;
  let totalSaudiWeight = 0;

  for (const emp of employees) {
    const record: NitaqatEmployeeRecord = {
      employeeId: emp.id,
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      nationalId: emp.nationalId,
      isSaudi: emp.isSaudi,
      jobTitle: emp.jobTitle,
      department: emp.department,
      joinDate: emp.hiredAt || emp.joinDate,
      salary: emp.salary,
      isFullTime: emp.isFullTime,
      weight: 1,
    };

    if (emp.isSaudi) {
      record.weight = calculateSaudiWeight({
        isFullTime: emp.isFullTime,
        isDisabled: emp.isDisabled,
        isStudent: emp.isStudent,
        isFemale: !emp.isMale,
        salary: emp.salary,
      });

      totalSaudiWeight += record.weight;
      saudiEmployees.push(record);

      if (emp.isMale) saudiMales++;
      else saudiFemales++;
      if (emp.isDisabled) saudiDisabled++;
      if (emp.isStudent) saudiStudents++;
    } else {
      nonSaudiEmployees.push(record);
    }
  }

  const totalEmployees = employees.length;
  const companySize = determineCompanySize(totalEmployees);

  const activityRequirements = NITAQAT_REQUIREMENTS[companyInfo.activityType] || NITAQAT_REQUIREMENTS.GENERAL;
  const requiredPercentage = activityRequirements[companySize];

  const rawPercentage = totalEmployees > 0
    ? (saudiEmployees.length / totalEmployees) * 100
    : 0;

  const weightedPercentage = totalEmployees > 0
    ? (totalSaudiWeight / totalEmployees) * 100
    : 0;

  let currentBand: keyof typeof NITAQAT_BANDS;
  if (weightedPercentage >= requiredPercentage + 25) {
    currentBand = 'PLATINUM';
  } else if (weightedPercentage >= requiredPercentage + 15) {
    currentBand = 'GREEN_HIGH';
  } else if (weightedPercentage >= requiredPercentage + 5) {
    currentBand = 'GREEN_MID';
  } else if (weightedPercentage >= requiredPercentage) {
    currentBand = 'GREEN_LOW';
  } else if (weightedPercentage >= requiredPercentage - 5) {
    currentBand = 'YELLOW';
  } else {
    currentBand = 'RED';
  }

  const calculateRequired = (targetPercentage: number): number => {
    const required = Math.ceil((targetPercentage / 100) * totalEmployees);
    return Math.max(0, required - saudiEmployees.length);
  };

  const deficit = calculateRequired(requiredPercentage);
  const surplus = deficit === 0 ? saudiEmployees.length - Math.ceil((requiredPercentage / 100) * totalEmployees) : 0;

  if (currentBand === 'RED') {
    recommendations.push('Warning: Company is in RED band — must correct within 3 months');
    recommendations.push(`Hire at least ${deficit} Saudi employee(s) to exit the Red band`);
    recommendations.push('Consider reducing non-Saudi workforce');
  } else if (currentBand === 'YELLOW') {
    recommendations.push('Warning: Company is in YELLOW band — 6-month grace period to correct');
    recommendations.push(`Hire ${deficit} Saudi employee(s) to reach Green band`);
  } else if (currentBand === 'GREEN_LOW') {
    recommendations.push('Company is in Low Green band');
    const toMid = calculateRequired(requiredPercentage + 5);
    if (toMid > 0) {
      recommendations.push(`Hire ${toMid} Saudi employee(s) to reach Mid Green`);
    }
  } else if (currentBand === 'GREEN_MID') {
    recommendations.push('Company is in Mid Green band');
    const toHigh = calculateRequired(requiredPercentage + 15);
    if (toHigh > 0) {
      recommendations.push(`Hire ${toHigh} Saudi employee(s) to reach High Green`);
    }
  } else if (currentBand === 'GREEN_HIGH') {
    recommendations.push('Company is in High Green band');
    const toPlatinum = calculateRequired(requiredPercentage + 25);
    if (toPlatinum > 0) {
      recommendations.push(`Hire ${toPlatinum} Saudi employee(s) to reach Platinum`);
    }
  } else {
    recommendations.push('Company is in Platinum band — highest classification!');
    recommendations.push('Maintain the current Saudization rate');
  }

  if (saudiDisabled === 0 && totalEmployees >= 25) {
    recommendations.push('Tip: Hiring employees with disabilities counts as 4x in Saudization calculation');
  }

  if (saudiFemales < saudiMales * 0.2) {
    recommendations.push('Tip: Increasing Saudi female hires may help improve the Saudization rate');
  }

  return {
    company: {
      name: companyInfo.name,
      molId: companyInfo.molId,
      activityType: companyInfo.activityType,
      size: companySize,
    },
    reportDate: new Date(),
    statistics: {
      totalEmployees,
      saudiEmployees: saudiEmployees.length,
      nonSaudiEmployees: nonSaudiEmployees.length,
      saudiMales,
      saudiFemales,
      saudiDisabled,
      saudiStudents,
    },
    saudization: {
      rawPercentage: Math.round(rawPercentage * 100) / 100,
      weightedPercentage: Math.round(weightedPercentage * 100) / 100,
      requiredPercentage,
      currentBand,
      bandInfo: NITAQAT_BANDS[currentBand],
    },
    gapAnalysis: {
      deficit,
      surplus,
      toReachGreenLow: calculateRequired(requiredPercentage),
      toReachGreenMid: calculateRequired(requiredPercentage + 5),
      toReachGreenHigh: calculateRequired(requiredPercentage + 15),
      toReachPlatinum: calculateRequired(requiredPercentage + 25),
    },
    recommendations,
    employees: {
      saudi: saudiEmployees,
      nonSaudi: nonSaudiEmployees,
    },
    metadata: {
      generatedAt: new Date(),
      generatedBy,
    },
  };
}

/**
 * Generate a printable Nitaqat report summary
 */
export function generateNitaqatReportSummary(report: NitaqatReport): string {
  const bandInfo = report.saudization.bandInfo;

  const lines: string[] = [
    '===============================================================',
    '              Nitaqat (Saudization) Report                      ',
    '===============================================================',
    '',
    `Company Name:            ${report.company.name}`,
    `MOL Number:              ${report.company.molId}`,
    `Activity Type:           ${report.company.activityType}`,
    `Company Size:            ${report.company.size}`,
    `Report Date:             ${report.reportDate.toLocaleDateString('en-US')}`,
    '',
    '---------------------------------------------------------------',
    '                   Workforce Statistics                         ',
    '---------------------------------------------------------------',
    '',
    `Total Employees:         ${report.statistics.totalEmployees}`,
    '',
    '  Saudi:',
    `    - Total:             ${report.statistics.saudiEmployees}`,
    `    - Male:              ${report.statistics.saudiMales}`,
    `    - Female:            ${report.statistics.saudiFemales}`,
    `    - Disabled:          ${report.statistics.saudiDisabled}`,
    '',
    `  Non-Saudi:             ${report.statistics.nonSaudiEmployees}`,
    '',
    '---------------------------------------------------------------',
    '                  Saudization Rate                              ',
    '---------------------------------------------------------------',
    '',
    `Current Rate:            ${report.saudization.weightedPercentage}%`,
    `Required Rate:           ${report.saudization.requiredPercentage}%`,
    '',
    '===============================================================',
    `Current Band:            ${bandInfo.nameEn}`,
    '===============================================================',
    '',
  ];

  if ('benefits' in bandInfo && bandInfo.benefits.length > 0) {
    lines.push('Available Benefits:');
    bandInfo.benefits.forEach(b => lines.push(`  + ${b}`));
    lines.push('');
  }

  if ('restrictions' in bandInfo && bandInfo.restrictions && bandInfo.restrictions.length > 0) {
    lines.push('Restrictions:');
    bandInfo.restrictions.forEach(r => lines.push(`  - ${r}`));
    lines.push('');
  }

  if (report.gapAnalysis.deficit > 0) {
    lines.push('---------------------------------------------------------------');
    lines.push('                      Gap Analysis                             ');
    lines.push('---------------------------------------------------------------');
    lines.push('');
    lines.push(`Current Deficit:         ${report.gapAnalysis.deficit} Saudi employee(s)`);
    lines.push('');
    lines.push('Required to reach:');
    if (report.gapAnalysis.toReachGreenLow > 0) {
      lines.push(`  - Low Green:           +${report.gapAnalysis.toReachGreenLow} Saudi`);
    }
    if (report.gapAnalysis.toReachGreenMid > 0) {
      lines.push(`  - Mid Green:           +${report.gapAnalysis.toReachGreenMid} Saudi`);
    }
    if (report.gapAnalysis.toReachGreenHigh > 0) {
      lines.push(`  - High Green:          +${report.gapAnalysis.toReachGreenHigh} Saudi`);
    }
    if (report.gapAnalysis.toReachPlatinum > 0) {
      lines.push(`  - Platinum:            +${report.gapAnalysis.toReachPlatinum} Saudi`);
    }
    lines.push('');
  }

  lines.push('---------------------------------------------------------------');
  lines.push('                    Recommendations                            ');
  lines.push('---------------------------------------------------------------');
  lines.push('');
  report.recommendations.forEach(r => lines.push(`  ${r}`));

  return lines.join('\n');
}
