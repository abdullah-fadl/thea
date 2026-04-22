/**
 * CVision Integrations — Absher Business Client (MOI)
 *
 * Ministry of Interior services for employers:
 *   - Visa status checks (iqama validity, active visas)
 *   - Iqama renewal requests
 *   - Exit/re-entry visa issuance
 *   - Establishment violation checks
 *
 * All calls run in SIMULATION mode with realistic Saudi-style responses.
 */

import { IntegrationClient, type IntegrationClientConfig } from '../shared/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AbsherVisaStatusResult {
  iqamaStatus: 'VALID' | 'EXPIRED' | 'ABOUT_TO_EXPIRE';
  expiryDate: string;
  daysRemaining: number;
  activeVisa?: {
    type: string;
    number: string;
    issueDate: string;
    expiryDate: string;
    status: string;
  };
  violations: AbsherViolation[];
  simulated: boolean;
}

export interface AbsherViolation {
  code: string;
  description: string;
  fine: number;
}

export interface AbsherRenewalResult {
  success: boolean;
  renewalId: string;
  newExpiryDate: string;
  cost: number;
  status: 'PENDING' | 'APPROVED' | 'PROCESSING';
  simulated: boolean;
}

export interface AbsherExitReentryResult {
  success: boolean;
  visaNumber: string;
  issueDate: string;
  expiryDate: string;
  cost: number;
  simulated: boolean;
}

export interface AbsherEstablishmentViolation {
  employeeName: string;
  iqamaNumber: string;
  violationType: string;
  description: string;
  fine: number;
  date: string;
}

export interface AbsherEstablishmentViolationsResult {
  violations: AbsherEstablishmentViolation[];
  totalFines: number;
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// Cost tables (SAR) — approximate MOI fees
// ---------------------------------------------------------------------------

const IQAMA_RENEWAL_COST: Record<number, number> = {
  1: 650,   // 1 year
  2: 1300,  // 2 years
};

const EXIT_REENTRY_COST: Record<string, Record<number, number>> = {
  SINGLE: { 30: 200, 60: 200, 90: 200, 180: 200 },
  MULTIPLE: { 30: 500, 60: 500, 90: 500, 180: 500 },
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class AbsherClient extends IntegrationClient {
  constructor(config: Omit<IntegrationClientConfig, 'integrationId'>) {
    super({ ...config, integrationId: 'absher' });
  }

  async checkVisaStatus(iqamaNumber: string): Promise<AbsherVisaStatusResult> {
    const res = await this.request<AbsherVisaStatusResult>(
      'GET',
      `/api/v1/visa/status/${iqamaNumber}`,
    );
    return res.data;
  }

  async requestIqamaRenewal(params: {
    iqamaNumber: string;
    duration: 1 | 2;
    insuranceNumber: string;
  }): Promise<AbsherRenewalResult> {
    const res = await this.request<AbsherRenewalResult>(
      'POST',
      '/api/v1/iqama/renew',
      params,
    );
    return res.data;
  }

  async issueExitReentry(params: {
    iqamaNumber: string;
    type: 'SINGLE' | 'MULTIPLE';
    duration: 30 | 60 | 90 | 180;
  }): Promise<AbsherExitReentryResult> {
    const res = await this.request<AbsherExitReentryResult>(
      'POST',
      '/api/v1/visa/exit-reentry',
      params,
    );
    return res.data;
  }

  async checkEstablishmentViolations(molNumber: string): Promise<AbsherEstablishmentViolationsResult> {
    const res = await this.request<AbsherEstablishmentViolationsResult>(
      'GET',
      `/api/v1/establishment/${molNumber}/violations`,
    );
    return res.data;
  }

  // ── Simulation ────────────────────────────────────────────────────

  protected async simulateResponse(method: string, path: string, data?: any): Promise<any> {
    await delay();

    // ── Visa status ──────────────────────────────────────────────
    if (path.includes('/visa/status/')) {
      const iqama = path.split('/').pop() || '';
      const h = simpleHash(iqama);
      const monthsLeft = (h % 18) + 1;
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + monthsLeft);
      const daysRemaining = Math.round(monthsLeft * 30.4);

      let iqamaStatus: 'VALID' | 'EXPIRED' | 'ABOUT_TO_EXPIRE' = 'VALID';
      if (daysRemaining < 0) iqamaStatus = 'EXPIRED';
      else if (daysRemaining < 90) iqamaStatus = 'ABOUT_TO_EXPIRE';

      const hasVisa = h % 3 === 0;
      const hasViolation = h % 7 === 0;

      return {
        iqamaStatus,
        expiryDate: expiry.toISOString().slice(0, 10),
        daysRemaining,
        activeVisa: hasVisa ? {
          type: h % 2 === 0 ? 'EXIT_REENTRY_SINGLE' : 'EXIT_REENTRY_MULTIPLE',
          number: `V${Date.now().toString().slice(-8)}`,
          issueDate: pastDate(1).toISOString().slice(0, 10),
          expiryDate: futureDate(3).toISOString().slice(0, 10),
          status: 'ACTIVE',
        } : undefined,
        violations: hasViolation ? [{
          code: 'V-201',
          description: 'Late iqama renewal',
          fine: 500,
        }] : [],
        simulated: true,
      } satisfies AbsherVisaStatusResult;
    }

    // ── Iqama renewal ────────────────────────────────────────────
    if (path.includes('/iqama/renew')) {
      const duration: number = data?.duration || 1;
      const cost = IQAMA_RENEWAL_COST[duration] || 650;
      const newExpiry = new Date();
      newExpiry.setFullYear(newExpiry.getFullYear() + duration);

      return {
        success: true,
        renewalId: `IR-${Date.now()}`,
        newExpiryDate: newExpiry.toISOString().slice(0, 10),
        cost,
        status: 'PROCESSING' as const,
        simulated: true,
      } satisfies AbsherRenewalResult;
    }

    // ── Exit/re-entry visa ───────────────────────────────────────
    if (path.includes('/exit-reentry')) {
      const type: string = data?.type || 'SINGLE';
      const duration: number = data?.duration || 90;
      const cost = EXIT_REENTRY_COST[type]?.[duration] || 200;
      const now = new Date();
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + duration);

      return {
        success: true,
        visaNumber: `ER-${Date.now()}`,
        issueDate: now.toISOString().slice(0, 10),
        expiryDate: expiry.toISOString().slice(0, 10),
        cost,
        simulated: true,
      } satisfies AbsherExitReentryResult;
    }

    // ── Establishment violations ─────────────────────────────────
    if (path.includes('/violations')) {
      const h = simpleHash(path);
      const hasViolations = h % 4 === 0;

      const violations: AbsherEstablishmentViolation[] = hasViolations
        ? MOCK_VIOLATIONS.slice(0, (h % 3) + 1)
        : [];

      return {
        violations,
        totalFines: violations.reduce((s, v) => s + v.fine, 0),
        simulated: true,
      } satisfies AbsherEstablishmentViolationsResult;
    }

    return { success: true, simulated: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(): Promise<void> {
  return new Promise(r => setTimeout(r, 100 + Math.random() * 250));
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function futureDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

function pastDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

// ---------------------------------------------------------------------------
// Mock violations
// ---------------------------------------------------------------------------

const MOCK_VIOLATIONS: AbsherEstablishmentViolation[] = [
  {
    employeeName: 'Mohammed Reza',
    iqamaNumber: '2098765432',
    violationType: 'LATE_RENEWAL',
    description: 'Iqama renewal overdue by 15 days',
    fine: 500,
    date: pastDate(1).toISOString().slice(0, 10),
  },
  {
    employeeName: 'Rajesh Kumar',
    iqamaNumber: '2087654321',
    violationType: 'WORK_PERMIT_EXPIRED',
    description: 'Work permit expired — employee still active',
    fine: 1000,
    date: pastDate(2).toISOString().slice(0, 10),
  },
  {
    employeeName: 'Aisha Mahmoud',
    iqamaNumber: '2076543210',
    violationType: 'ABSCONDING_REPORT',
    description: 'Employee reported as absconding',
    fine: 2000,
    date: pastDate(3).toISOString().slice(0, 10),
  },
];
