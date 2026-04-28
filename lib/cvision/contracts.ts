// lib/cvision/contracts.ts
// Contract management per Saudi Labor Law

export const SAUDI_CONTRACT_RULES = {
  PROBATION_MAX_DAYS: 90,           // Probation period: 90 days
  PROBATION_EXTENSION_DAYS: 90,     // Probation extension: 90 additional days
  NOTICE_PERIOD_UNLIMITED: 60,      // Notice for unlimited contract: 60 days
  NOTICE_PERIOD_LIMITED: 30,        // Notice for fixed-term contract: 30 days
  MAX_FIXED_TERM_YEARS: 3,          // Max fixed-term contract duration
  AUTO_RENEWAL_TO_UNLIMITED: 3,     // Converts to unlimited after 3 renewals
  MIN_VACATION_DAYS: 21,            // Minimum annual vacation days
  MAX_WORKING_HOURS_DAY: 8,         // Max daily working hours
  MAX_WORKING_HOURS_WEEK: 48,       // Max weekly working hours
} as const;

export interface ContractDetails {
  type: 'PERMANENT' | 'FIXED_TERM' | 'PART_TIME' | 'PROBATION';
  startDate: Date;
  endDate?: Date;
  probationEndDate?: Date;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  workingHoursPerWeek: number;
  vacationDaysPerYear: number;
  noticePeriodDays: number;
}

/**
 * Calculate remaining contract duration
 */
export interface ContractDuration {
  totalDays: number;
  totalMonths: number;
  totalYears: number;
  remainingDays: number;
  remainingMonths: number;
  isExpired: boolean;
  isExpiringSoon: boolean; // within 30 days
  expiryDate: Date | null;
}

export function calculateContractDuration(
  startDate: Date,
  endDate: Date | null,
  today: Date = new Date()
): ContractDuration {
  const start = new Date(startDate);
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);

  // Calculate total duration from start to now
  const totalDays = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const totalMonths = Math.floor(totalDays / 30);
  const totalYears = Math.floor(totalDays / 365);

  // If unlimited contract
  if (!endDate) {
    return {
      totalDays,
      totalMonths,
      totalYears,
      remainingDays: -1, // unlimited
      remainingMonths: -1,
      isExpired: false,
      isExpiringSoon: false,
      expiryDate: null,
    };
  }

  const end = new Date(endDate);
  const remainingDays = Math.floor((end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  const remainingMonths = Math.floor(remainingDays / 30);

  return {
    totalDays,
    totalMonths,
    totalYears,
    remainingDays: Math.max(0, remainingDays),
    remainingMonths: Math.max(0, remainingMonths),
    isExpired: remainingDays < 0,
    isExpiringSoon: remainingDays >= 0 && remainingDays <= 30,
    expiryDate: end,
  };
}

/**
 * Calculate probation period status
 */
export interface ProbationStatus {
  isInProbation: boolean;
  probationStartDate: Date;
  probationEndDate: Date;
  daysRemaining: number;
  daysCompleted: number;
  canExtend: boolean;
  isExtended: boolean;
}

export function calculateProbationStatus(
  startDate: Date,
  probationEndDate: Date | null,
  today: Date = new Date()
): ProbationStatus {
  const start = new Date(startDate);
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);

  // If probation end not specified, assume 90 days
  const defaultProbationEnd = new Date(start);
  defaultProbationEnd.setDate(defaultProbationEnd.getDate() + SAUDI_CONTRACT_RULES.PROBATION_MAX_DAYS);

  const probEnd = probationEndDate ? new Date(probationEndDate) : defaultProbationEnd;

  const daysCompleted = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.floor((probEnd.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));

  // Was probation extended?
  const isExtended = probationEndDate
    ? (probEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) > SAUDI_CONTRACT_RULES.PROBATION_MAX_DAYS
    : false;

  // Can probation be extended?
  const maxProbationDays = SAUDI_CONTRACT_RULES.PROBATION_MAX_DAYS + SAUDI_CONTRACT_RULES.PROBATION_EXTENSION_DAYS;
  const currentProbationDays = Math.floor((probEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const canExtend = currentProbationDays < maxProbationDays;

  return {
    isInProbation: daysRemaining > 0,
    probationStartDate: start,
    probationEndDate: probEnd,
    daysRemaining: Math.max(0, daysRemaining),
    daysCompleted,
    canExtend,
    isExtended,
  };
}

/**
 * Calculate required notice period
 */
export interface NoticePeriod {
  requiredDays: number;
  lastWorkingDay: Date;
  canTerminateImmediately: boolean;
  compensationRequired: number; // Notice period compensation
}

export function calculateNoticePeriod(
  contractType: 'PERMANENT' | 'FIXED_TERM' | 'PART_TIME' | 'PROBATION',
  resignationDate: Date,
  dailySalary: number,
  isInProbation: boolean = false
): NoticePeriod {
  let requiredDays: number;

  // No notice required during probation
  if (isInProbation) {
    return {
      requiredDays: 0,
      lastWorkingDay: resignationDate,
      canTerminateImmediately: true,
      compensationRequired: 0,
    };
  }

  // Determine notice period by contract type
  switch (contractType) {
    case 'PERMANENT':
      requiredDays = SAUDI_CONTRACT_RULES.NOTICE_PERIOD_UNLIMITED;
      break;
    case 'FIXED_TERM':
      requiredDays = SAUDI_CONTRACT_RULES.NOTICE_PERIOD_LIMITED;
      break;
    default:
      requiredDays = 30;
  }

  const lastWorkingDay = new Date(resignationDate);
  lastWorkingDay.setDate(lastWorkingDay.getDate() + requiredDays);

  const compensationRequired = Math.round(dailySalary * requiredDays * 100) / 100;

  return {
    requiredDays,
    lastWorkingDay,
    canTerminateImmediately: false,
    compensationRequired,
  };
}

/**
 * Validate contract details
 */
export interface ContractValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateContract(contract: ContractDetails): ContractValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate salary
  if (contract.basicSalary <= 0) {
    errors.push('Basic salary must be greater than zero');
  }

  // Validate working hours
  if (contract.workingHoursPerWeek > SAUDI_CONTRACT_RULES.MAX_WORKING_HOURS_WEEK) {
    errors.push(`Weekly working hours (${contract.workingHoursPerWeek}) exceed maximum (${SAUDI_CONTRACT_RULES.MAX_WORKING_HOURS_WEEK})`);
  }

  // Validate annual vacation
  if (contract.vacationDaysPerYear < SAUDI_CONTRACT_RULES.MIN_VACATION_DAYS) {
    errors.push(`Annual vacation days (${contract.vacationDaysPerYear}) below minimum (${SAUDI_CONTRACT_RULES.MIN_VACATION_DAYS})`);
  }

  // Validate notice period
  if (contract.noticePeriodDays < 30) {
    warnings.push('Notice period is less than 30 days');
  }

  // Validate fixed-term contract duration
  if (contract.type === 'FIXED_TERM' && contract.endDate) {
    const durationYears = (contract.endDate.getTime() - contract.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (durationYears > SAUDI_CONTRACT_RULES.MAX_FIXED_TERM_YEARS) {
      warnings.push(`Contract duration (${durationYears.toFixed(1)} years) exceeds ${SAUDI_CONTRACT_RULES.MAX_FIXED_TERM_YEARS} years`);
    }
  }

  // Validate dates
  if (contract.endDate && contract.endDate <= contract.startDate) {
    errors.push('Contract end date must be after start date');
  }

  if (contract.probationEndDate && contract.probationEndDate <= contract.startDate) {
    errors.push('Probation end date must be after start date');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate total salary from contract
 */
export interface ContractSalary {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  totalSalary: number;
  dailyRate: number;
  hourlyRate: number;
}

export function calculateContractSalary(contract: ContractDetails): ContractSalary {
  const totalSalary =
    contract.basicSalary +
    contract.housingAllowance +
    contract.transportAllowance +
    contract.otherAllowances;

  const dailyRate = totalSalary / 30;
  const hourlyRate = dailyRate / 8;

  return {
    basicSalary: contract.basicSalary,
    housingAllowance: contract.housingAllowance,
    transportAllowance: contract.transportAllowance,
    otherAllowances: contract.otherAllowances,
    totalSalary: Math.round(totalSalary * 100) / 100,
    dailyRate: Math.round(dailyRate * 100) / 100,
    hourlyRate: Math.round(hourlyRate * 100) / 100,
  };
}

/**
 * Check contract renewal eligibility
 */
export interface RenewalEligibility {
  canRenew: boolean;
  renewalCount: number;
  willConvertToUnlimited: boolean;
  suggestedEndDate: Date;
  reason: string;
}

export function checkRenewalEligibility(
  contractType: 'PERMANENT' | 'FIXED_TERM' | 'PART_TIME' | 'PROBATION',
  currentEndDate: Date | null,
  renewalCount: number = 0
): RenewalEligibility {
  // Unlimited contracts do not need renewal
  if (contractType === 'PERMANENT' || !currentEndDate) {
    return {
      canRenew: false,
      renewalCount,
      willConvertToUnlimited: false,
      suggestedEndDate: new Date(),
      reason: 'Unlimited contract does not require renewal',
    };
  }

  // After 3 renewals, converts to unlimited
  const willConvertToUnlimited = renewalCount >= SAUDI_CONTRACT_RULES.AUTO_RENEWAL_TO_UNLIMITED - 1;

  // Suggest new end date (one year from current end)
  const suggestedEndDate = new Date(currentEndDate);
  suggestedEndDate.setFullYear(suggestedEndDate.getFullYear() + 1);

  return {
    canRenew: true,
    renewalCount: renewalCount + 1,
    willConvertToUnlimited,
    suggestedEndDate,
    reason: willConvertToUnlimited
      ? 'This renewal will convert the contract to unlimited'
      : `Renewal number ${renewalCount + 1}`,
  };
}

/**
 * Generate contract summary
 */
export interface ContractSummary {
  employeeId: string;
  contractType: string;
  status: string;
  duration: ContractDuration;
  probation: ProbationStatus | null;
  salary: ContractSalary;
  validation: ContractValidation;
}

export function generateContractSummary(
  employeeId: string,
  contract: ContractDetails,
  today: Date = new Date()
): ContractSummary {
  return {
    employeeId,
    contractType: contract.type,
    status: contract.endDate && new Date(contract.endDate) < today ? 'EXPIRED' : 'ACTIVE',
    duration: calculateContractDuration(contract.startDate, contract.endDate || null, today),
    probation: contract.probationEndDate
      ? calculateProbationStatus(contract.startDate, contract.probationEndDate, today)
      : null,
    salary: calculateContractSalary(contract),
    validation: validateContract(contract),
  };
}
