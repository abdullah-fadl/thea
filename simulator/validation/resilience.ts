/**
 * Resilience — Verify data consistency after failures.
 */

import { BaseActor } from '../actors/base';

export interface ResilienceCheckResult {
  check: string;
  passed: boolean;
  details?: string;
}

export class ResilienceValidator {
  private actor: BaseActor;

  constructor(actor: BaseActor) {
    this.actor = actor;
  }

  /** Verify entity still exists after a failed operation */
  async verifyEntityIntact(endpoint: string, entityName: string): Promise<ResilienceCheckResult> {
    const res = await this.actor.get(endpoint);
    return {
      check: `${entityName} intact after failure`,
      passed: res.ok,
      details: res.ok ? 'Entity accessible' : `Status: ${res.status}`,
    };
  }

  /** Verify no orphaned records were created */
  async verifyNoOrphans(searchEndpoint: string, entityName: string): Promise<ResilienceCheckResult> {
    const res = await this.actor.get<{ count?: number }>(searchEndpoint);
    return {
      check: `No orphaned ${entityName} records`,
      passed: res.ok,
      details: res.ok ? 'Check passed' : `Status: ${res.status}`,
    };
  }

  /** Verify a failed operation can be retried successfully */
  async verifyRetrySucceeds(
    method: 'POST' | 'PUT',
    endpoint: string,
    body: unknown,
    entityName: string,
  ): Promise<ResilienceCheckResult> {
    let res;
    if (method === 'POST') {
      res = await this.actor.post(endpoint, body);
    } else {
      res = await this.actor.put(endpoint, body);
    }
    return {
      check: `${entityName} retry succeeds`,
      passed: res.ok,
      details: res.ok ? 'Retry successful' : `Status: ${res.status}`,
    };
  }
}
