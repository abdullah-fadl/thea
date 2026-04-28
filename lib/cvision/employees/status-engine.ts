/**
 * CVision Employee Status Engine
 *
 * Full employee lifecycle management with:
 * - 16 statuses across 5 categories
 * - Valid transition rules (state machine)
 * - Permission levels per status
 * - End-of-service calculation (Saudi Labor Law)
 * - Side-effect declarations
 */

// =============================================================================
// Status Definitions
// =============================================================================

export type StatusCategory = 'ACTIVE' | 'LEAVE' | 'SUSPENDED' | 'DEPARTING' | 'DEPARTED';
export type PermissionLevel = 'FULL' | 'READ_ONLY' | 'LIMITED' | 'NONE';

export interface StatusDefinition {
  label: string;
  color: string;
  icon: string;
  category: StatusCategory;
  description: string;
  permissions: PermissionLevel;
  excludeFromPayroll?: boolean;
  requiresEndOfService?: boolean;
  lastDayDate?: boolean;
}

export const EMPLOYEE_STATUSES: Record<string, StatusDefinition> = {
  // ── Active ──
  ACTIVE: {
    label: 'Active',
    color: 'green',
    icon: 'CheckCircle',
    category: 'ACTIVE',
    description: 'Currently working, full access',
    permissions: 'FULL',
  },
  PROBATION: {
    label: 'Probation',
    color: 'amber',
    icon: 'Clock',
    category: 'ACTIVE',
    description: 'New hire, under evaluation',
    permissions: 'FULL',
  },

  // ── Leave ──
  ON_ANNUAL_LEAVE: {
    label: 'Annual Leave',
    color: 'blue',
    icon: 'Palmtree',
    category: 'LEAVE',
    description: 'On approved annual leave',
    permissions: 'READ_ONLY',
  },
  ON_SICK_LEAVE: {
    label: 'Sick Leave',
    color: 'purple',
    icon: 'Heart',
    category: 'LEAVE',
    description: 'On approved sick leave',
    permissions: 'READ_ONLY',
  },
  ON_MATERNITY_LEAVE: {
    label: 'Maternity Leave',
    color: 'pink',
    icon: 'Baby',
    category: 'LEAVE',
    description: 'On maternity/paternity leave',
    permissions: 'READ_ONLY',
  },
  ON_UNPAID_LEAVE: {
    label: 'Unpaid Leave',
    color: 'gray',
    icon: 'PauseCircle',
    category: 'LEAVE',
    description: 'On unpaid leave — excluded from payroll',
    permissions: 'READ_ONLY',
    excludeFromPayroll: true,
  },

  // ── Suspension ──
  SUSPENDED: {
    label: 'Suspended',
    color: 'red',
    icon: 'Ban',
    category: 'SUSPENDED',
    description: 'Suspended pending investigation',
    permissions: 'NONE',
    excludeFromPayroll: false,
  },
  SUSPENDED_WITHOUT_PAY: {
    label: 'Suspended Without Pay',
    color: 'red',
    icon: 'ShieldOff',
    category: 'SUSPENDED',
    description: 'Suspended without pay — disciplinary action',
    permissions: 'NONE',
    excludeFromPayroll: true,
  },

  // ── Departing ──
  NOTICE_PERIOD: {
    label: 'Notice Period',
    color: 'orange',
    icon: 'AlertTriangle',
    category: 'DEPARTING',
    description: 'Serving notice period before departure',
    permissions: 'LIMITED',
    lastDayDate: true,
  },

  // ── Departed (terminal) ──
  RESIGNED: {
    label: 'Resigned',
    color: 'gray',
    icon: 'LogOut',
    category: 'DEPARTED',
    description: 'Voluntarily resigned',
    permissions: 'NONE',
    excludeFromPayroll: true,
    requiresEndOfService: true,
  },
  TERMINATED: {
    label: 'Terminated',
    color: 'red',
    icon: 'XCircle',
    category: 'DEPARTED',
    description: 'Employment terminated by employer',
    permissions: 'NONE',
    excludeFromPayroll: true,
    requiresEndOfService: true,
  },
  END_OF_CONTRACT: {
    label: 'End of Contract',
    color: 'gray',
    icon: 'FileX',
    category: 'DEPARTED',
    description: 'Contract ended and not renewed',
    permissions: 'NONE',
    excludeFromPayroll: true,
    requiresEndOfService: true,
  },
  RETIRED: {
    label: 'Retired',
    color: 'slate',
    icon: 'Award',
    category: 'DEPARTED',
    description: 'Retired from service',
    permissions: 'NONE',
    excludeFromPayroll: true,
    requiresEndOfService: true,
  },
  DECEASED: {
    label: 'Deceased',
    color: 'black',
    icon: 'Minus',
    category: 'DEPARTED',
    description: 'Employee deceased',
    permissions: 'NONE',
    excludeFromPayroll: true,
    requiresEndOfService: true,
  },
};

export const ALL_STATUS_KEYS = Object.keys(EMPLOYEE_STATUSES);

// =============================================================================
// Transition Rules
// =============================================================================

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: [
    'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE',
    'SUSPENDED', 'SUSPENDED_WITHOUT_PAY', 'NOTICE_PERIOD',
    'TERMINATED', 'DECEASED',
  ],
  PROBATION: ['ACTIVE', 'TERMINATED', 'SUSPENDED', 'ON_SICK_LEAVE'],
  ON_ANNUAL_LEAVE: ['ACTIVE'],
  ON_SICK_LEAVE: ['ACTIVE'],
  ON_MATERNITY_LEAVE: ['ACTIVE'],
  ON_UNPAID_LEAVE: ['ACTIVE', 'RESIGNED', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED', 'SUSPENDED_WITHOUT_PAY'],
  SUSPENDED_WITHOUT_PAY: ['ACTIVE', 'TERMINATED'],
  NOTICE_PERIOD: ['RESIGNED', 'ACTIVE'],
  RESIGNED: [],
  TERMINATED: [],
  END_OF_CONTRACT: [],
  RETIRED: [],
  DECEASED: [],
};

export function getAllowedTransitions(currentStatus: string): string[] {
  const upper = currentStatus.toUpperCase();
  return STATUS_TRANSITIONS[upper] || [];
}

export function isTransitionAllowed(from: string, to: string): boolean {
  return getAllowedTransitions(from).includes(to.toUpperCase());
}

export function isTerminalStatus(status: string): boolean {
  const upper = status.toUpperCase();
  const transitions = STATUS_TRANSITIONS[upper];
  return transitions !== undefined && transitions.length === 0;
}

export function isValidStatus(status: string): boolean {
  return status.toUpperCase() in EMPLOYEE_STATUSES;
}

// =============================================================================
// Permission Helpers
// =============================================================================

export function getAccessLevel(status: string): PermissionLevel {
  return EMPLOYEE_STATUSES[status.toUpperCase()]?.permissions || 'NONE';
}

export function isOnPayroll(status: string): boolean {
  const def = EMPLOYEE_STATUSES[status.toUpperCase()];
  if (!def) return false;
  return !def.excludeFromPayroll;
}

export function canAccessSystem(status: string): boolean {
  const level = getAccessLevel(status);
  return level !== 'NONE';
}

export function getStatusDefinition(status: string): StatusDefinition | null {
  return EMPLOYEE_STATUSES[status.toUpperCase()] || null;
}

// =============================================================================
// End of Service Calculation (Saudi Labor Law)
// =============================================================================

export type EOSReason = 'RESIGNATION' | 'TERMINATION' | 'END_OF_CONTRACT' | 'RETIREMENT' | 'DEATH';

export interface EOSBreakdownItem {
  period: string;
  rate: string;
  amount: number;
}

export interface EOSResult {
  totalAmount: number;
  grossAmount: number;
  deduction: number;
  yearsOfService: number;
  breakdown: EOSBreakdownItem[];
  formula: string;
}

export function calculateEndOfService(params: {
  monthlySalary: number;
  housingAllowance: number;
  yearsOfService: number;
  reason: EOSReason;
}): EOSResult {
  const { monthlySalary, housingAllowance, yearsOfService, reason } = params;
  const totalMonthly = monthlySalary + housingAllowance;
  const breakdown: EOSBreakdownItem[] = [];

  if (yearsOfService <= 0) {
    return {
      totalAmount: 0,
      grossAmount: 0,
      deduction: 0,
      yearsOfService: 0,
      breakdown: [{ period: 'Less than 1 year', rate: '0', amount: 0 }],
      formula: 'Not eligible — less than 1 year of service',
    };
  }

  const first5 = Math.min(yearsOfService, 5);
  const after5 = Math.max(yearsOfService - 5, 0);

  let first5Amount: number;
  let after5Amount: number;
  let first5Rate: string;
  let after5Rate: string;

  if (reason === 'RESIGNATION') {
    // Resignation: first 5 years = 1/3 monthly; after 5 = 2/3 monthly per year
    first5Rate = '1/3 monthly salary';
    after5Rate = '2/3 monthly salary';
    first5Amount = (totalMonthly / 3) * first5;
    after5Amount = (totalMonthly * 2 / 3) * after5;

    if (yearsOfService < 2) {
      return {
        totalAmount: 0,
        grossAmount: 0,
        deduction: 0,
        yearsOfService,
        breakdown: [{ period: `${yearsOfService.toFixed(1)} years`, rate: 'Not eligible', amount: 0 }],
        formula: 'Resignation before 2 years: no end-of-service benefit',
      };
    }
  } else {
    // Termination, End of Contract, Retirement, Death:
    // first 5 years = 1/2 monthly; after 5 = 1 × monthly per year
    first5Rate = '1/2 monthly salary';
    after5Rate = 'Full monthly salary';
    first5Amount = (totalMonthly / 2) * first5;
    after5Amount = totalMonthly * after5;
  }

  first5Amount = Math.round(first5Amount * 100) / 100;
  after5Amount = Math.round(after5Amount * 100) / 100;
  const grossAmount = first5Amount + after5Amount;

  breakdown.push({ period: `First ${first5.toFixed(1)} years`, rate: first5Rate, amount: first5Amount });
  if (after5 > 0) {
    breakdown.push({ period: `Next ${after5.toFixed(1)} years`, rate: after5Rate, amount: after5Amount });
  }

  let deduction = 0;
  if (reason === 'RESIGNATION') {
    if (yearsOfService >= 2 && yearsOfService < 5) {
      deduction = Math.round(grossAmount * (2 / 3) * 100) / 100;
    } else if (yearsOfService >= 5 && yearsOfService < 10) {
      deduction = Math.round(grossAmount * (1 / 3) * 100) / 100;
    }
    // 10+ years: full amount, no deduction
  }

  const totalAmount = Math.round((grossAmount - deduction) * 100) / 100;

  const formulaReason = reason === 'RESIGNATION' ? 'Resignation' : reason.charAt(0) + reason.slice(1).toLowerCase().replace(/_/g, ' ');
  const formula = `${formulaReason}: ${first5.toFixed(1)}y × ${first5Rate} + ${after5.toFixed(1)}y × ${after5Rate}${deduction > 0 ? ` − SAR ${deduction.toLocaleString()} deduction` : ''}`;

  return { totalAmount, grossAmount, deduction, yearsOfService, breakdown, formula };
}

// =============================================================================
// Status Change Impact Preview
// =============================================================================

export interface StatusChangeImpact {
  warnings: string[];
  actions: string[];
  endOfService: EOSResult | null;
}

function mapStatusToEOSReason(status: string): EOSReason | null {
  switch (status) {
    case 'RESIGNED': return 'RESIGNATION';
    case 'TERMINATED': return 'TERMINATION';
    case 'END_OF_CONTRACT': return 'END_OF_CONTRACT';
    case 'RETIRED': return 'RETIREMENT';
    case 'DECEASED': return 'DEATH';
    default: return null;
  }
}

export function previewStatusChange(params: {
  currentStatus: string;
  newStatus: string;
  monthlySalary?: number;
  housingAllowance?: number;
  yearsOfService?: number;
  isSaudi?: boolean;
}): StatusChangeImpact {
  const { currentStatus, newStatus, monthlySalary, housingAllowance, yearsOfService, isSaudi } = params;
  const def = EMPLOYEE_STATUSES[newStatus];
  if (!def) return { warnings: ['Unknown status'], actions: [], endOfService: null };

  const warnings: string[] = [];
  const actions: string[] = [];
  let endOfService: EOSResult | null = null;

  // Permission impact
  if (def.permissions === 'NONE') {
    warnings.push('Employee will lose all system access');
  } else if (def.permissions === 'READ_ONLY') {
    warnings.push('Employee access will be read-only');
  } else if (def.permissions === 'LIMITED') {
    warnings.push('Employee will have limited access (view & handover only)');
  }

  // Payroll impact
  if (def.excludeFromPayroll) {
    actions.push('Stop payroll processing for this employee');
  }

  // EOS calculation for departure statuses
  const eosReason = mapStatusToEOSReason(newStatus);
  if (eosReason && def.requiresEndOfService && monthlySalary && yearsOfService) {
    endOfService = calculateEndOfService({
      monthlySalary: monthlySalary || 0,
      housingAllowance: housingAllowance || 0,
      yearsOfService: yearsOfService || 0,
      reason: eosReason,
    });
    actions.push(`Calculate End of Service: SAR ${endOfService.totalAmount.toLocaleString()}`);
  }

  // Departure actions
  if (def.category === 'DEPARTED') {
    actions.push('Revoke system access');
    actions.push('Notify HR Manager');
    if (!isSaudi) {
      actions.push('Update Muqeem record (non-Saudi employee)');
    }
    actions.push('Submit GOSI termination notification');
    actions.push('Fire employee.status_changed webhook');
  }

  // Suspension actions
  if (def.category === 'SUSPENDED') {
    actions.push('Disable system access immediately');
    actions.push('Notify HR Manager');
    actions.push('Fire employee.status_changed webhook');
  }

  // Leave actions
  if (def.category === 'LEAVE') {
    actions.push('Auto-mark attendance as on leave');
    actions.push('Fire employee.status_changed webhook');
  }

  // Notice period
  if (newStatus === 'NOTICE_PERIOD') {
    actions.push('Alert HR Manager with countdown');
    actions.push('Fire employee.status_changed webhook');
  }

  // Returning to active
  if (newStatus === 'ACTIVE' && currentStatus !== 'PROBATION') {
    actions.push('Re-enable full system access');
    actions.push('Resume payroll processing');
    actions.push('Fire employee.status_changed webhook');
  }
  if (newStatus === 'ACTIVE' && currentStatus === 'PROBATION') {
    actions.push('Confirm full employee access');
    actions.push('Fire employee.status_changed webhook');
  }

  // Terminal warning
  if (isTerminalStatus(newStatus)) {
    warnings.push('This status is permanent and cannot be reversed');
  }

  return { warnings, actions, endOfService };
}

// =============================================================================
// Side Effect Descriptors
// =============================================================================

export interface StatusSideEffect {
  type: 'PAYROLL_STOP' | 'PAYROLL_RESUME' | 'ACCESS_REVOKE' | 'ACCESS_RESTORE' | 'GOSI_TERMINATE'
    | 'MUQEEM_EXIT' | 'ATTENDANCE_LEAVE' | 'RETENTION_REMOVE' | 'WEBHOOK' | 'ALERT_HR'
    | 'EOS_CALCULATE' | 'ACCESS_READONLY' | 'ACCESS_LIMITED';
  description: string;
  data?: Record<string, any>;
}

export function getSideEffects(params: {
  currentStatus: string;
  newStatus: string;
  employeeId: string;
  isSaudi?: boolean;
}): StatusSideEffect[] {
  const { currentStatus, newStatus, employeeId, isSaudi } = params;
  const def = EMPLOYEE_STATUSES[newStatus];
  if (!def) return [];

  const effects: StatusSideEffect[] = [];

  // Always fire webhook
  effects.push({
    type: 'WEBHOOK',
    description: 'Fire employee.status_changed event',
    data: { event: 'employee.status_changed', employeeId, from: currentStatus, to: newStatus },
  });

  // Payroll
  if (def.excludeFromPayroll && !EMPLOYEE_STATUSES[currentStatus]?.excludeFromPayroll) {
    effects.push({ type: 'PAYROLL_STOP', description: 'Exclude from next payroll run' });
  }
  if (!def.excludeFromPayroll && EMPLOYEE_STATUSES[currentStatus]?.excludeFromPayroll) {
    effects.push({ type: 'PAYROLL_RESUME', description: 'Resume payroll processing' });
  }

  // Access control
  if (def.permissions === 'NONE' && EMPLOYEE_STATUSES[currentStatus]?.permissions !== 'NONE') {
    effects.push({ type: 'ACCESS_REVOKE', description: 'Revoke all system access' });
  }
  if (def.permissions === 'READ_ONLY' && EMPLOYEE_STATUSES[currentStatus]?.permissions !== 'READ_ONLY') {
    effects.push({ type: 'ACCESS_READONLY', description: 'Set access to read-only' });
  }
  if (def.permissions === 'LIMITED') {
    effects.push({ type: 'ACCESS_LIMITED', description: 'Set access to limited (view & handover)' });
  }
  if (def.permissions === 'FULL' && EMPLOYEE_STATUSES[currentStatus]?.permissions !== 'FULL') {
    effects.push({ type: 'ACCESS_RESTORE', description: 'Restore full system access' });
  }

  // Departure: GOSI, Muqeem, retention, EOS
  if (def.category === 'DEPARTED') {
    effects.push({ type: 'GOSI_TERMINATE', description: 'Submit GOSI termination notification' });
    effects.push({ type: 'RETENTION_REMOVE', description: 'Remove from retention risk calculations' });
    effects.push({ type: 'ALERT_HR', description: 'Notify HR Manager of departure' });
    if (def.requiresEndOfService) {
      effects.push({ type: 'EOS_CALCULATE', description: 'Calculate end-of-service benefit' });
    }
    if (!isSaudi) {
      effects.push({ type: 'MUQEEM_EXIT', description: 'Trigger final exit visa process' });
    }
  }

  // Suspension: alert HR
  if (def.category === 'SUSPENDED') {
    effects.push({ type: 'ALERT_HR', description: 'Notify HR Manager of suspension' });
  }

  // Leave: attendance
  if (def.category === 'LEAVE') {
    effects.push({ type: 'ATTENDANCE_LEAVE', description: 'Auto-mark attendance as on leave' });
  }

  // Notice period: HR alert with countdown
  if (newStatus === 'NOTICE_PERIOD') {
    effects.push({ type: 'ALERT_HR', description: 'Alert HR Manager with notice countdown' });
  }

  return effects;
}
