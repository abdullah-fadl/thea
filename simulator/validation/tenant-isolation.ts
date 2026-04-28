/**
 * Tenant Isolation — Cross-tenant data leakage checks.
 */

import { BaseActor } from '../actors/base';

export interface IsolationCheckResult {
  check: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  details?: string;
}

export class TenantIsolationValidator {
  private actorA: BaseActor;
  private actorB: BaseActor;

  constructor(actorA: BaseActor, actorB: BaseActor) {
    this.actorA = actorA;
    this.actorB = actorB;
  }

  /** Check patient isolation — Tenant A should not see Tenant B's patients */
  async checkPatientIsolation(
    tenantAPatientId: string,
    tenantBPatientId: string,
  ): Promise<IsolationCheckResult[]> {
    const results: IsolationCheckResult[] = [];

    // Actor A tries to access B's patient
    const crossRes = await this.actorA.get(`/api/patients/${tenantBPatientId}`);
    results.push({
      check: 'Tenant A cannot access Tenant B patient by ID',
      passed: !crossRes.ok || crossRes.status === 404,
      severity: crossRes.ok ? 'critical' : 'info',
      details: crossRes.ok ? 'LEAK: Cross-tenant patient access succeeded!' : 'Properly isolated',
    });

    // Actor B tries to access A's patient
    const crossRes2 = await this.actorB.get(`/api/patients/${tenantAPatientId}`);
    results.push({
      check: 'Tenant B cannot access Tenant A patient by ID',
      passed: !crossRes2.ok || crossRes2.status === 404,
      severity: crossRes2.ok ? 'critical' : 'info',
      details: crossRes2.ok ? 'LEAK: Cross-tenant patient access succeeded!' : 'Properly isolated',
    });

    return results;
  }

  /** Check search isolation */
  async checkSearchIsolation(
    tenantASearchTerm: string,
    tenantBSearchTerm: string,
  ): Promise<IsolationCheckResult[]> {
    const results: IsolationCheckResult[] = [];

    // Actor A searches for B's term
    const searchRes = await this.actorA.get<{ patients: unknown[] }>('/api/patients/search', {
      q: tenantBSearchTerm,
    });
    if (searchRes.ok) {
      const patients = (searchRes.data as { patients: unknown[] }).patients || [];
      results.push({
        check: `Tenant A search for "${tenantBSearchTerm}" returns 0 results`,
        passed: patients.length === 0,
        severity: patients.length > 0 ? 'critical' : 'info',
        details: patients.length > 0 ? `LEAK: Found ${patients.length} cross-tenant results!` : 'Properly isolated',
      });
    }

    return results;
  }

  /** Run full isolation check */
  async fullCheck(data: {
    tenantAPatientId: string;
    tenantBPatientId: string;
    tenantAName: string;
    tenantBName: string;
  }): Promise<IsolationCheckResult[]> {
    const results: IsolationCheckResult[] = [];
    results.push(...await this.checkPatientIsolation(data.tenantAPatientId, data.tenantBPatientId));
    results.push(...await this.checkSearchIsolation(data.tenantAName, data.tenantBName));
    return results;
  }
}
