/**
 * CVision Integrations — Qiwa Client
 *
 * Simulates interaction with the Qiwa platform (qiwa.sa) by MHRSD.
 * Services: contracts, Nitaqat status, work permits, transfers,
 *           Saudization certificates.
 *
 * In SIMULATION mode all calls return realistic mock data.
 * The Nitaqat calculation can optionally be driven from real
 * employee data in the CVision database.
 */

import { IntegrationClient, type IntegrationClientConfig } from '../shared/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NitaqatBand = 'PLATINUM' | 'GREEN_HIGH' | 'GREEN_MID' | 'GREEN_LOW' | 'YELLOW' | 'RED';

export const NITAQAT_BAND_LABELS: Record<NitaqatBand, { label: string; color: string }> = {
  PLATINUM:   { label: 'Platinum',   color: '#94a3b8' },
  GREEN_HIGH: { label: 'High Green', color: '#059669' },
  GREEN_MID:  { label: 'Mid Green',  color: '#10b981' },
  GREEN_LOW:  { label: 'Low Green',  color: '#34d399' },
  YELLOW:     { label: 'Yellow',     color: '#f59e0b' },
  RED:        { label: 'Red',        color: '#ef4444' },
};

/** Healthcare sector thresholds for companies with 50-499 employees */
const NITAQAT_THRESHOLDS: { band: NitaqatBand; minRate: number }[] = [
  { band: 'PLATINUM',   minRate: 40 },
  { band: 'GREEN_HIGH', minRate: 27 },
  { band: 'GREEN_MID',  minRate: 23 },
  { band: 'GREEN_LOW',  minRate: 17 },
  { band: 'YELLOW',     minRate: 10 },
  { band: 'RED',        minRate: 0 },
];

export function determineNitaqatBand(saudizationRate: number): NitaqatBand {
  for (const t of NITAQAT_THRESHOLDS) {
    if (saudizationRate >= t.minRate) return t.band;
  }
  return 'RED';
}

function nextBandThreshold(currentBand: NitaqatBand): { band: NitaqatBand; rate: number } | null {
  const idx = NITAQAT_THRESHOLDS.findIndex(t => t.band === currentBand);
  if (idx <= 0) return null;
  return { band: NITAQAT_THRESHOLDS[idx - 1].band, rate: NITAQAT_THRESHOLDS[idx - 1].minRate };
}

export interface SimulatedContract {
  contractId: string;
  employeeName: string;
  nationalId: string;
  jobTitle: string;
  contractType: 'DEFINITE' | 'INDEFINITE';
  startDate: string;
  endDate?: string;
  salary: number;
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'PENDING';
}

export interface SimulatedPermit {
  permitId: string;
  employeeName: string;
  nationalId: string;
  permitType: 'WORK' | 'EXIT_REENTRY' | 'FINAL_EXIT';
  issueDate: string;
  expiryDate: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
}

export interface NitaqatStatusResult {
  band: NitaqatBand;
  bandColor: string;
  saudizationRate: number;
  totalEmployees: number;
  saudiEmployees: number;
  nonSaudiEmployees: number;
  requiredRate: number;
  nextBand: NitaqatBand | null;
  nextBandRate: number;
  saudisNeededForNextBand: number;
  availableVisas: number;
  simulated: boolean;
}

export interface QiwaContractCreateResult {
  success: boolean;
  contractId: string;
  status: string;
  simulated: boolean;
}

export interface QiwaTransferResult {
  success: boolean;
  transferId: string;
  status: string;
  simulated: boolean;
}

export interface SaudizationCertificateResult {
  certificateNumber: string;
  issueDate: string;
  expiryDate: string;
  band: string;
  rate: number;
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class QiwaClient extends IntegrationClient {
  constructor(config: Omit<IntegrationClientConfig, 'integrationId'>) {
    super({ ...config, integrationId: 'qiwa' });
  }

  // ── Contracts ─────────────────────────────────────────────────────

  async getContracts(filters?: any): Promise<{ contracts: SimulatedContract[]; total: number; simulated: boolean }> {
    const res = await this.request<any>('GET', '/api/v1/contracts', filters);
    return res.data;
  }

  async createContract(data: {
    employeeId: string; employeeName: string; nationalId: string;
    jobTitle: string; startDate: string; endDate?: string;
    contractType: 'DEFINITE' | 'INDEFINITE'; salary: number; workLocation: string;
  }): Promise<QiwaContractCreateResult> {
    const res = await this.request<QiwaContractCreateResult>('POST', '/api/v1/contracts', data);
    return res.data;
  }

  // ── Nitaqat ───────────────────────────────────────────────────────

  async getNitaqatStatus(): Promise<NitaqatStatusResult> {
    const res = await this.request<NitaqatStatusResult>('GET', '/api/v1/nitaqat/status');
    return res.data;
  }

  // ── Work Permits ──────────────────────────────────────────────────

  async getWorkPermits(): Promise<{ permits: SimulatedPermit[]; total: number; expiringSoon: number; simulated: boolean }> {
    const res = await this.request<any>('GET', '/api/v1/permits');
    return res.data;
  }

  // ── Employee Transfers ────────────────────────────────────────────

  async initiateTransfer(data: {
    employeeId: string; fromEstablishment: string; toEstablishment: string; reason: string;
  }): Promise<QiwaTransferResult> {
    const res = await this.request<QiwaTransferResult>('POST', '/api/v1/transfers', data);
    return res.data;
  }

  // ── Saudization Certificate ───────────────────────────────────────

  async requestSaudizationCertificate(): Promise<SaudizationCertificateResult> {
    const res = await this.request<SaudizationCertificateResult>('POST', '/api/v1/certificates/saudization');
    return res.data;
  }

  // ── Nitaqat from real DB data ─────────────────────────────────────

  static calculateNitaqatFromCounts(saudiCount: number, totalCount: number): NitaqatStatusResult {
    const nonSaudi = totalCount - saudiCount;
    const rate = totalCount > 0 ? (saudiCount / totalCount) * 100 : 0;
    const rateRounded = Math.round(rate * 10) / 10;
    const band = determineNitaqatBand(rateRounded);
    const next = nextBandThreshold(band);

    let saudisNeeded = 0;
    if (next && totalCount > 0) {
      const targetSaudis = Math.ceil((next.rate / 100) * totalCount);
      saudisNeeded = Math.max(0, targetSaudis - saudiCount);
    }

    const availableVisas = band === 'RED' || band === 'YELLOW' ? 0
      : band === 'GREEN_LOW' ? 2
      : band === 'GREEN_MID' ? 5
      : band === 'GREEN_HIGH' ? 10 : 15;

    return {
      band,
      bandColor: NITAQAT_BAND_LABELS[band].color,
      saudizationRate: rateRounded,
      totalEmployees: totalCount,
      saudiEmployees: saudiCount,
      nonSaudiEmployees: nonSaudi,
      requiredRate: 17,
      nextBand: next?.band || null,
      nextBandRate: next?.rate || 0,
      saudisNeededForNextBand: saudisNeeded,
      availableVisas,
      simulated: false,
    };
  }

  // ── Simulation ────────────────────────────────────────────────────

  protected async simulateResponse(method: string, path: string, data?: any): Promise<any> {
    await new Promise(r => setTimeout(r, 150 + Math.random() * 300));

    if (path.includes('/contracts') && method === 'GET') {
      return {
        contracts: MOCK_CONTRACTS,
        total: MOCK_CONTRACTS.length,
        simulated: true,
      };
    }

    if (path.includes('/contracts') && method === 'POST') {
      return {
        success: true,
        contractId: `QC-${Date.now()}`,
        status: 'PENDING_APPROVAL',
        simulated: true,
      } satisfies QiwaContractCreateResult;
    }

    if (path.includes('/nitaqat/status')) {
      return {
        band: 'GREEN_HIGH' as NitaqatBand,
        bandColor: '#059669',
        saudizationRate: 55.6,
        totalEmployees: 9,
        saudiEmployees: 5,
        nonSaudiEmployees: 4,
        requiredRate: 17,
        nextBand: 'PLATINUM' as NitaqatBand,
        nextBandRate: 40,
        saudisNeededForNextBand: 0,
        availableVisas: 10,
        simulated: true,
      } satisfies NitaqatStatusResult;
    }

    if (path.includes('/permits')) {
      return {
        permits: MOCK_PERMITS,
        total: MOCK_PERMITS.length,
        expiringSoon: 1,
        simulated: true,
      };
    }

    if (path.includes('/transfers')) {
      return {
        success: true,
        transferId: `QT-${Date.now()}`,
        status: 'PENDING_EMPLOYEE_APPROVAL',
        simulated: true,
      } satisfies QiwaTransferResult;
    }

    if (path.includes('/certificates/saudization')) {
      const now = new Date();
      const exp = new Date(now);
      exp.setFullYear(exp.getFullYear() + 1);
      return {
        certificateNumber: `SC-${now.getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
        issueDate: now.toISOString().slice(0, 10),
        expiryDate: exp.toISOString().slice(0, 10),
        band: 'GREEN_HIGH',
        rate: 55.6,
        simulated: true,
      } satisfies SaudizationCertificateResult;
    }

    return { success: true, simulated: true };
  }
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CONTRACTS: SimulatedContract[] = [
  { contractId: 'QC-001', employeeName: 'Khalid Ibrahim', nationalId: '1098765432', jobTitle: 'IT Manager', contractType: 'INDEFINITE', startDate: '2023-03-01', salary: 22000, status: 'ACTIVE' },
  { contractId: 'QC-002', employeeName: 'Omar Ali', nationalId: '1087654321', jobTitle: 'Data Analyst', contractType: 'DEFINITE', startDate: '2024-01-15', endDate: '2026-01-14', salary: 8000, status: 'ACTIVE' },
  { contractId: 'QC-003', employeeName: 'Yousef Alhasan', nationalId: '2098765432', jobTitle: 'Registered Nurse', contractType: 'DEFINITE', startDate: '2024-06-01', endDate: '2026-05-31', salary: 7500, status: 'ACTIVE' },
];

const MOCK_PERMITS: SimulatedPermit[] = [
  { permitId: 'WP-001', employeeName: 'Yousef Alhasan', nationalId: '2098765432', permitType: 'WORK', issueDate: '2024-06-01', expiryDate: '2026-05-31', status: 'ACTIVE' },
  { permitId: 'ER-001', employeeName: 'Fatima Hassan', nationalId: '2087654321', permitType: 'EXIT_REENTRY', issueDate: '2025-12-01', expiryDate: '2026-03-01', status: 'ACTIVE' },
];
