/**
 * CVision Integrations — Muqeem API Client (MOI)
 *
 * Enhances the existing Muqeem module with an integration-layer wrapper
 * for iqama management:
 *   - Single iqama data sync
 *   - Bulk employee sync
 *   - Iqama renewal submission
 *
 * In SIMULATION mode returns realistic data; when live, proxies to
 * the Muqeem API (muqeem.com.sa).
 */

import { IntegrationClient, type IntegrationClientConfig } from '../shared/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MuqeemIqamaInfo {
  number: string;
  name: string;
  issueDate: string;
  expiryDate: string;
  occupation: string;
  sponsor: string;
  status: 'VALID' | 'EXPIRED' | 'CANCELLED' | 'PENDING_RENEWAL';
}

export interface MuqeemSyncResult {
  iqamaInfo: MuqeemIqamaInfo;
  synced: boolean;
  simulated: boolean;
}

export interface MuqeemBulkSyncResult {
  synced: number;
  failed: number;
  errors: string[];
  simulated: boolean;
}

export interface MuqeemRenewalResult {
  requestId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  estimatedCompletion: string;
  cost: number;
  simulated: boolean;
}

export interface MuqeemDependentInfo {
  name: string;
  relationship: string;
  iqamaNumber: string;
  dateOfBirth: string;
  status: string;
}

export interface MuqeemDependentsResult {
  dependents: MuqeemDependentInfo[];
  total: number;
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class MuqeemAPIClient extends IntegrationClient {
  constructor(config: Omit<IntegrationClientConfig, 'integrationId'>) {
    super({ ...config, integrationId: 'muqeem' });
  }

  async syncIqamaData(iqamaNumber: string): Promise<MuqeemSyncResult> {
    const res = await this.request<MuqeemSyncResult>(
      'GET',
      `/api/v1/iqama/${iqamaNumber}/sync`,
    );
    return res.data;
  }

  async syncAllEmployees(employeeIqamas: string[]): Promise<MuqeemBulkSyncResult> {
    const res = await this.request<MuqeemBulkSyncResult>(
      'POST',
      '/api/v1/iqama/bulk-sync',
      { iqamas: employeeIqamas },
    );
    return res.data;
  }

  async submitRenewal(iqamaNumber: string): Promise<MuqeemRenewalResult> {
    const res = await this.request<MuqeemRenewalResult>(
      'POST',
      '/api/v1/iqama/renew',
      { iqamaNumber },
    );
    return res.data;
  }

  async getDependents(iqamaNumber: string): Promise<MuqeemDependentsResult> {
    const res = await this.request<MuqeemDependentsResult>(
      'GET',
      `/api/v1/iqama/${iqamaNumber}/dependents`,
    );
    return res.data;
  }

  // ── Simulation ────────────────────────────────────────────────────

  protected async simulateResponse(method: string, path: string, data?: any): Promise<any> {
    await delay();

    // ── Single sync ──────────────────────────────────────────────
    if (path.includes('/sync')) {
      const iqama = extractIqama(path);
      const h = simpleHash(iqama);
      const mockName = MOCK_NAMES[h % MOCK_NAMES.length];
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + ((h % 18) + 3));
      const issue = new Date();
      issue.setFullYear(issue.getFullYear() - 2);

      return {
        iqamaInfo: {
          number: iqama,
          name: mockName.en,
          issueDate: issue.toISOString().slice(0, 10),
          expiryDate: expiry.toISOString().slice(0, 10),
          occupation: mockName.occupation,
          sponsor: 'Thea Health',
          status: 'VALID' as const,
        },
        synced: true,
        simulated: true,
      } satisfies MuqeemSyncResult;
    }

    // ── Bulk sync ────────────────────────────────────────────────
    if (path.includes('/bulk-sync')) {
      const iqamas: string[] = data?.iqamas || [];
      const failCount = Math.floor(iqamas.length * 0.05);
      return {
        synced: iqamas.length - failCount,
        failed: failCount,
        errors: failCount > 0
          ? [`Iqama ${iqamas[0]?.slice(0, 4)}*****: Connection timeout`]
          : [],
        simulated: true,
      } satisfies MuqeemBulkSyncResult;
    }

    // ── Renewal ──────────────────────────────────────────────────
    if (path.includes('/renew')) {
      const est = new Date();
      est.setDate(est.getDate() + 3);
      return {
        requestId: `MQ-R-${Date.now()}`,
        status: 'PROCESSING' as const,
        estimatedCompletion: est.toISOString().slice(0, 10),
        cost: 650,
        simulated: true,
      } satisfies MuqeemRenewalResult;
    }

    // ── Dependents ───────────────────────────────────────────────
    if (path.includes('/dependents')) {
      const iqama = extractIqama(path);
      const h = simpleHash(iqama);
      const hasKids = h % 3 !== 0;
      const dependents: MuqeemDependentInfo[] = hasKids
        ? [{
            name: 'Dependent Child',
            relationship: 'SON',
            iqamaNumber: `2${iqama.slice(1, 4)}999${String(h % 1000).padStart(3, '0')}`,
            dateOfBirth: '2018-05-10',
            status: 'VALID',
          }]
        : [];
      return { dependents, total: dependents.length, simulated: true } satisfies MuqeemDependentsResult;
    }

    return { success: true, simulated: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(): Promise<void> {
  return new Promise(r => setTimeout(r, 100 + Math.random() * 200));
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function extractIqama(path: string): string {
  const parts = path.split('/');
  const iqIdx = parts.indexOf('iqama');
  return iqIdx >= 0 && parts[iqIdx + 1] ? parts[iqIdx + 1] : '2000000000';
}

const MOCK_NAMES = [
  { en: 'Yousef Hassan', occupation: 'Registered Nurse' },
  { en: 'Fatima Ahmad', occupation: 'Accountant' },
  { en: 'Mohammed Reza', occupation: 'IT Technician' },
  { en: 'Rajesh Kumar', occupation: 'Software Engineer' },
  { en: 'Aisha Mahmoud', occupation: 'Staff Nurse' },
];
