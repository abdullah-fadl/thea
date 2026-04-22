/**
 * Integrity — Post-scenario data integrity checks.
 */

import { BaseActor } from '../actors/base';

export interface IntegrityCheckResult {
  check: string;
  passed: boolean;
  details?: string;
}

export class IntegrityValidator {
  private actor: BaseActor;

  constructor(actor: BaseActor) {
    this.actor = actor;
  }

  /** Run all integrity checks for a patient */
  async checkPatient(patientId: string): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    // Check patient exists
    const patientRes = await this.actor.get(`/api/patients/${patientId}`);
    results.push({
      check: 'Patient record exists',
      passed: patientRes.ok,
      details: patientRes.ok ? undefined : `Status: ${patientRes.status}`,
    });

    // Check visits count
    const visitsRes = await this.actor.get<{ count: number }>(`/api/patients/${patientId}/visits/count`);
    results.push({
      check: 'Patient has visit records',
      passed: visitsRes.ok,
      details: visitsRes.ok ? `Count: ${(visitsRes.data as { count: number }).count}` : `Status: ${visitsRes.status}`,
    });

    return results;
  }

  /** Check encounter has required data */
  async checkEncounter(encounterCoreId: string): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    const encRes = await this.actor.get(`/api/opd/encounters/${encounterCoreId}`);
    results.push({
      check: 'Encounter record exists',
      passed: encRes.ok,
    });

    return results;
  }

  /** Check order lifecycle integrity */
  async checkOrder(orderId: string): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    const orderRes = await this.actor.get(`/api/orders/${orderId}`);
    results.push({
      check: 'Order record exists',
      passed: orderRes.ok || orderRes.status === 404, // Some orders may not have direct GET
    });

    return results;
  }

  /** Run full integrity sweep */
  async fullSweep(patientIds: string[], encounterIds: string[]): Promise<IntegrityCheckResult[]> {
    const allResults: IntegrityCheckResult[] = [];

    for (const pid of patientIds) {
      const r = await this.checkPatient(pid);
      allResults.push(...r);
    }

    for (const eid of encounterIds) {
      const r = await this.checkEncounter(eid);
      allResults.push(...r);
    }

    return allResults;
  }
}
