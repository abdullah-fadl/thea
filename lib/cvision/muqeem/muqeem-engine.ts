/**
 * CVision Muqeem — Iqama & Visa Management Engine
 *
 * Self-contained module with all interfaces, constants, and pure computation
 * functions for managing iqama/visa tracking of foreign employees in Saudi
 * Arabia.  No database or API dependencies — pure logic only.
 */

// =============================================================================
// Interfaces
// =============================================================================

export interface ExitReentryVisa {
  id: string;
  type: 'SINGLE' | 'MULTIPLE';
  visaNumber: string;
  issueDate: string;
  expiryDate: string;
  duration: number; // days
  departureDate?: string | null;
  returnDate?: string | null;
  destination?: string | null;
  status: 'ISSUED' | 'DEPARTED' | 'RETURNED' | 'EXPIRED' | 'CANCELLED';
}

export interface Dependent {
  id: string;
  name: string;
  relationship: 'SPOUSE' | 'SON' | 'DAUGHTER' | 'PARENT';
  iqamaNumber?: string | null;
  iqamaExpiryDate?: string | null;
  dateOfBirth?: string | null;
  passportNumber?: string | null;
}

export type IqamaStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'RENEWED' | 'CANCELLED';

export type VisaType =
  | 'WORK'
  | 'EXIT_REENTRY_SINGLE'
  | 'EXIT_REENTRY_MULTIPLE'
  | 'FINAL_EXIT'
  | 'TRANSIT'
  | 'VISIT';

export type AbsherStatus = 'VERIFIED' | 'PENDING' | 'MISMATCH' | 'NOT_CHECKED';

export interface IqamaRecord {
  _id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  nationality: string; // ISO 2-letter code

  // Iqama
  iqamaNumber: string; // 10 digits, starts with 2 for non-Saudi
  iqamaIssueDate: string;
  iqamaExpiryDate: string;
  iqamaStatus: IqamaStatus;

  // Passport
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportStatus: string;

  // Visa
  visaType: VisaType;
  visaNumber: string;
  visaIssueDate: string;
  visaExpiryDate: string;
  visaStatus: string;
  exitReentryVisas: ExitReentryVisa[];

  // Absher verification
  lastAbsherCheck?: string | null;
  absherStatus: AbsherStatus;
  absherNotes?: string | null;

  // Insurance
  insuranceProvider?: string | null;
  insuranceNumber?: string | null;
  insuranceExpiryDate?: string | null;

  // Costs (SAR)
  iqamaRenewalCost?: number | null;
  visaCost?: number | null;
  insuranceCost?: number | null;
  totalAnnualCost?: number | null;

  // Sponsor (company)
  sponsorName: string;
  sponsorId: string; // company CR number

  // Dependents
  dependents: Dependent[];

  createdAt: string;
  updatedAt: string;
}

export type MuqeemAlertType =
  | 'IQAMA_EXPIRY'
  | 'PASSPORT_EXPIRY'
  | 'VISA_EXPIRY'
  | 'INSURANCE_EXPIRY'
  | 'EXIT_REENTRY_EXPIRY';

export type AlertSeverity = 'INFO' | 'WARNING' | 'URGENT' | 'CRITICAL';

export interface MuqeemAlert {
  _id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  type: MuqeemAlertType;
  severity: AlertSeverity;
  daysRemaining: number;
  expiryDate: string;
  documentNumber: string;
  message: string;
  isRead: boolean;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
}

export interface RenewalRecommendation {
  action: string;
  urgency: AlertSeverity;
  estimatedCost: number;
}

export interface NitaqatImpact {
  currentRate: number;
  rateAfterExit: number;
  impact: string;
}

// =============================================================================
// Constants — Alert Thresholds (days before expiry)
// =============================================================================

export const ALERT_THRESHOLDS = {
  IQAMA: [90, 60, 30, 14, 7] as const,
  PASSPORT: [180, 90, 60, 30] as const,
  VISA: [30, 14, 7, 3] as const,
  INSURANCE: [60, 30, 14] as const,
} as const;

// =============================================================================
// Constants — Iqama Renewal Costs (SAR)
// =============================================================================

export const IQAMA_RENEWAL_COSTS = {
  EMPLOYEE: 650,
  DEPENDENT: 400,
  WORK_PERMIT: 100,
  EXIT_REENTRY_SINGLE: 200,
  EXIT_REENTRY_MULTIPLE: 500,
  FINAL_EXIT: 0,
} as const;

// =============================================================================
// Constants — Nationalities
// =============================================================================

export interface NationalityInfo {
  label: string;
  requiresIqama: boolean;
}

export const NATIONALITIES: Record<string, NationalityInfo> = {
  SA: { label: 'Saudi', requiresIqama: false },
  EG: { label: 'Egyptian', requiresIqama: true },
  PK: { label: 'Pakistani', requiresIqama: true },
  IN: { label: 'Indian', requiresIqama: true },
  PH: { label: 'Filipino', requiresIqama: true },
  BD: { label: 'Bangladeshi', requiresIqama: true },
  JO: { label: 'Jordanian', requiresIqama: true },
  SY: { label: 'Syrian', requiresIqama: true },
  YE: { label: 'Yemeni', requiresIqama: true },
  SD: { label: 'Sudanese', requiresIqama: true },
  LB: { label: 'Lebanese', requiresIqama: true },
  US: { label: 'American', requiresIqama: true },
  GB: { label: 'British', requiresIqama: true },
} as const;

// =============================================================================
// Constants — Status Labels & Badge Colors
// =============================================================================

export const IQAMA_STATUS_LABELS: Record<IqamaStatus, string> = {
  VALID: 'Valid',
  EXPIRING_SOON: 'Expiring Soon',
  EXPIRED: 'Expired',
  RENEWED: 'Renewed',
  CANCELLED: 'Cancelled',
};

export const VISA_TYPE_LABELS: Record<VisaType, string> = {
  WORK: 'Work Visa',
  EXIT_REENTRY_SINGLE: 'Exit/Re-entry (Single)',
  EXIT_REENTRY_MULTIPLE: 'Exit/Re-entry (Multiple)',
  FINAL_EXIT: 'Final Exit',
  TRANSIT: 'Transit',
  VISIT: 'Visit',
};

export const ALERT_TYPE_LABELS: Record<MuqeemAlertType, string> = {
  IQAMA_EXPIRY: 'Iqama Expiry',
  PASSPORT_EXPIRY: 'Passport Expiry',
  VISA_EXPIRY: 'Visa Expiry',
  INSURANCE_EXPIRY: 'Insurance Expiry',
  EXIT_REENTRY_EXPIRY: 'Exit/Re-entry Expiry',
};

export const SEVERITY_BADGE_COLORS: Record<AlertSeverity, string> = {
  INFO: 'bg-blue-100 text-blue-800',
  WARNING: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

// =============================================================================
// Pure Computation Functions
// =============================================================================

/**
 * Calculate the number of days between today and an expiry date.
 * Returns a negative number if the date is in the past.
 */
export function daysUntilExpiry(expiryDate: Date | string): number {
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const now = new Date();
  // Strip time component for consistent day-level comparison
  const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = expiryDay.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine document status from its expiry date.
 * EXPIRING_SOON = within 90 days, EXPIRED = past expiry.
 */
export function getDocumentStatus(
  expiryDate: Date | string
): 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' {
  const days = daysUntilExpiry(expiryDate);
  if (days < 0) return 'EXPIRED';
  if (days <= 90) return 'EXPIRING_SOON';
  return 'VALID';
}

/**
 * Map remaining days to an alert severity level.
 *   > 60 days  -> INFO
 *  30-60 days  -> WARNING
 *  14-29 days  -> URGENT
 *   < 14 days  -> CRITICAL
 */
export function getAlertSeverity(daysRemaining: number): AlertSeverity {
  if (daysRemaining > 60) return 'INFO';
  if (daysRemaining > 30) return 'WARNING';
  if (daysRemaining >= 14) return 'URGENT';
  return 'CRITICAL';
}

/**
 * Scan all iqama records and produce alerts for documents nearing expiry.
 * Checks: iqama, passport, visa, insurance, and active exit/re-entry visas.
 */
export function generateAlerts(records: IqamaRecord[]): MuqeemAlert[] {
  const alerts: MuqeemAlert[] = [];
  const now = new Date().toISOString();

  for (const rec of records) {
    // --- Iqama expiry ---
    if (rec.iqamaExpiryDate) {
      const days = daysUntilExpiry(rec.iqamaExpiryDate);
      const maxThreshold = ALERT_THRESHOLDS.IQAMA[0]; // 90
      if (days <= maxThreshold) {
        alerts.push({
          tenantId: rec.tenantId,
          employeeId: rec.employeeId,
          employeeName: rec.employeeName,
          type: 'IQAMA_EXPIRY',
          severity: getAlertSeverity(days),
          daysRemaining: Math.max(days, 0),
          expiryDate: rec.iqamaExpiryDate,
          documentNumber: rec.iqamaNumber,
          message: `Iqama ${rec.iqamaNumber} expires in ${days} days`,
          isRead: false,
          isResolved: false,
          createdAt: now,
        });
      }
    }

    // --- Passport expiry ---
    if (rec.passportExpiryDate) {
      const days = daysUntilExpiry(rec.passportExpiryDate);
      const maxThreshold = ALERT_THRESHOLDS.PASSPORT[0]; // 180
      if (days <= maxThreshold) {
        alerts.push({
          tenantId: rec.tenantId,
          employeeId: rec.employeeId,
          employeeName: rec.employeeName,
          type: 'PASSPORT_EXPIRY',
          severity: getAlertSeverity(days),
          daysRemaining: Math.max(days, 0),
          expiryDate: rec.passportExpiryDate,
          documentNumber: rec.passportNumber,
          message: `Passport ${rec.passportNumber} expires in ${days} days`,
          isRead: false,
          isResolved: false,
          createdAt: now,
        });
      }
    }

    // --- Visa expiry ---
    if (rec.visaExpiryDate) {
      const days = daysUntilExpiry(rec.visaExpiryDate);
      const maxThreshold = ALERT_THRESHOLDS.VISA[0]; // 30
      if (days <= maxThreshold) {
        alerts.push({
          tenantId: rec.tenantId,
          employeeId: rec.employeeId,
          employeeName: rec.employeeName,
          type: 'VISA_EXPIRY',
          severity: getAlertSeverity(days),
          daysRemaining: Math.max(days, 0),
          expiryDate: rec.visaExpiryDate,
          documentNumber: rec.visaNumber,
          message: `Visa ${rec.visaNumber} expires in ${days} days`,
          isRead: false,
          isResolved: false,
          createdAt: now,
        });
      }
    }

    // --- Insurance expiry ---
    if (rec.insuranceExpiryDate && rec.insuranceNumber) {
      const days = daysUntilExpiry(rec.insuranceExpiryDate);
      const maxThreshold = ALERT_THRESHOLDS.INSURANCE[0]; // 60
      if (days <= maxThreshold) {
        alerts.push({
          tenantId: rec.tenantId,
          employeeId: rec.employeeId,
          employeeName: rec.employeeName,
          type: 'INSURANCE_EXPIRY',
          severity: getAlertSeverity(days),
          daysRemaining: Math.max(days, 0),
          expiryDate: rec.insuranceExpiryDate,
          documentNumber: rec.insuranceNumber,
          message: `Insurance ${rec.insuranceNumber} expires in ${days} days`,
          isRead: false,
          isResolved: false,
          createdAt: now,
        });
      }
    }

    // --- Exit/Re-entry visa expiry ---
    for (const erv of rec.exitReentryVisas) {
      if (erv.status === 'ISSUED' || erv.status === 'DEPARTED') {
        const days = daysUntilExpiry(erv.expiryDate);
        const maxThreshold = ALERT_THRESHOLDS.VISA[0]; // 30
        if (days <= maxThreshold) {
          alerts.push({
            tenantId: rec.tenantId,
            employeeId: rec.employeeId,
            employeeName: rec.employeeName,
            type: 'EXIT_REENTRY_EXPIRY',
            severity: getAlertSeverity(days),
            daysRemaining: Math.max(days, 0),
            expiryDate: erv.expiryDate,
            documentNumber: erv.visaNumber,
            message: `Exit/re-entry visa ${erv.visaNumber} expires in ${days} days`,
            isRead: false,
            isResolved: false,
            createdAt: now,
          });
        }
      }
    }
  }

  // Sort: CRITICAL first, then by daysRemaining ascending
  const severityOrder: Record<AlertSeverity, number> = {
    CRITICAL: 0,
    URGENT: 1,
    WARNING: 2,
    INFO: 3,
  };
  alerts.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      a.daysRemaining - b.daysRemaining
  );

  return alerts;
}

/**
 * Calculate total annual cost for an iqama record.
 * Includes: employee renewal + work permit + dependent renewals.
 */
export function calculateAnnualCost(record: IqamaRecord): number {
  let cost = IQAMA_RENEWAL_COSTS.EMPLOYEE + IQAMA_RENEWAL_COSTS.WORK_PERMIT;
  cost += record.dependents.length * IQAMA_RENEWAL_COSTS.DEPENDENT;
  return cost;
}

/**
 * Validate an iqama number: must be exactly 10 digits and start with '2'
 * (non-Saudi residents).
 */
export function validateIqamaNumber(iqamaNumber: string): boolean {
  return /^2\d{9}$/.test(iqamaNumber);
}

/**
 * Calculate Nitaqat (nationalization) impact if an employee were to exit.
 *
 * @param employee  - the employee under consideration
 * @param allEmployees - full workforce list to derive Saudization rate
 */
export function getNitaqatImpact(
  employee: { nationality: string },
  allEmployees: { nationality: string }[]
): NitaqatImpact {
  const total = allEmployees.length;
  if (total === 0) {
    return { currentRate: 0, rateAfterExit: 0, impact: 'No employees' };
  }

  const saudiCount = allEmployees.filter((e) => e.nationality === 'SA').length;
  const currentRate = Math.round((saudiCount / total) * 10000) / 100;

  const isSaudi = employee.nationality === 'SA';
  const newTotal = total - 1;
  const newSaudi = isSaudi ? saudiCount - 1 : saudiCount;
  const rateAfterExit =
    newTotal > 0 ? Math.round((newSaudi / newTotal) * 10000) / 100 : 0;

  const diff = Math.round((rateAfterExit - currentRate) * 100) / 100;

  let impact: string;

  if (isSaudi) {
    impact = `Saudization drops by ${Math.abs(diff)}% — losing a Saudi employee`;
  } else if (diff > 0) {
    impact = `Saudization improves by ${diff}% — removing a non-Saudi employee`;
  } else {
    impact = 'No change in Saudization rate';
  }

  return { currentRate, rateAfterExit, impact };
}

/**
 * Generate a renewal recommendation with urgency and estimated cost.
 */
export function getRenewalRecommendation(record: IqamaRecord): RenewalRecommendation {
  const iqamaDays = daysUntilExpiry(record.iqamaExpiryDate);
  const passportDays = daysUntilExpiry(record.passportExpiryDate);

  // Passport must be valid to renew iqama
  if (passportDays < 0) {
    return {
      action: 'Renew passport before iqama renewal',
      urgency: 'CRITICAL',
      estimatedCost: 0,
    };
  }

  const baseCost = IQAMA_RENEWAL_COSTS.EMPLOYEE + IQAMA_RENEWAL_COSTS.WORK_PERMIT;
  const depCost = record.dependents.length * IQAMA_RENEWAL_COSTS.DEPENDENT;
  const totalCost = baseCost + depCost;

  if (iqamaDays < 0) {
    return {
      action: 'Iqama expired — renew immediately to avoid fines',
      urgency: 'CRITICAL',
      estimatedCost: totalCost,
    };
  }

  if (iqamaDays <= 14) {
    return {
      action: 'Renew iqama urgently within the next two weeks',
      urgency: 'CRITICAL',
      estimatedCost: totalCost,
    };
  }

  if (iqamaDays <= 30) {
    return {
      action: 'Schedule iqama renewal this month',
      urgency: 'URGENT',
      estimatedCost: totalCost,
    };
  }

  if (iqamaDays <= 60) {
    return {
      action: 'Plan iqama renewal — expiring within two months',
      urgency: 'WARNING',
      estimatedCost: totalCost,
    };
  }

  return {
    action: 'Iqama valid — no action required',
    urgency: 'INFO',
    estimatedCost: 0,
  };
}

/**
 * Return a Tailwind badge color class for a given status string.
 */
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    // Iqama statuses
    VALID: 'bg-green-100 text-green-800',
    EXPIRING_SOON: 'bg-amber-100 text-amber-800',
    EXPIRED: 'bg-red-100 text-red-800',
    RENEWED: 'bg-blue-100 text-blue-800',
    CANCELLED: 'bg-gray-100 text-gray-800',

    // Visa / Exit-reentry statuses
    ISSUED: 'bg-blue-100 text-blue-800',
    DEPARTED: 'bg-indigo-100 text-indigo-800',
    RETURNED: 'bg-green-100 text-green-800',

    // Absher statuses
    VERIFIED: 'bg-green-100 text-green-800',
    PENDING: 'bg-amber-100 text-amber-800',
    MISMATCH: 'bg-red-100 text-red-800',
    NOT_CHECKED: 'bg-gray-100 text-gray-800',

    // Alert severities
    INFO: 'bg-blue-100 text-blue-800',
    WARNING: 'bg-amber-100 text-amber-800',
    URGENT: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };

  return map[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Format a numeric amount as SAR currency: "SAR 1,250"
 */
export function formatCurrency(amount: number): string {
  return `SAR ${amount.toLocaleString('en-US')}`;
}
