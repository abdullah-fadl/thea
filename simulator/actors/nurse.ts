/**
 * Nurse Actor — OPD vitals, nursing assessment, flow state transitions.
 */

import { BaseActor, type ActorOptions } from './base';
import type { Vitals } from '../data/vitals';

export class Nurse extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'nurse', label: 'Nurse' });
  }

  /** Record nursing vitals for OPD encounter */
  async recordVitals(encounterCoreId: string, vitals: Vitals): Promise<void> {
    const res = await this.post(`/api/opd/encounters/${encounterCoreId}/nursing`, {
      vitals: {
        bp: vitals.bp,
        hr: vitals.hr,
        rr: vitals.rr,
        temp: vitals.temp,
        spo2: vitals.spo2,
        weight: vitals.weight,
        height: vitals.height,
      },
    });
    this.assertOk(res, 'Record vitals');
  }

  /** Update OPD encounter flow state */
  async updateFlowState(encounterCoreId: string, state: string): Promise<void> {
    const body: Record<string, unknown> = { opdFlowState: state };
    // When completing, acknowledge open orders and set completion reason
    if (state === 'COMPLETED') {
      body.completionReason = 'NORMAL';
      body.acknowledgeOpenOrders = true;
    }
    const res = await this.post(`/api/opd/encounters/${encounterCoreId}/flow-state`, body);
    this.assertOk(res, `Update flow state → ${state}`);
  }

  /** Get encounter details */
  async getEncounter(encounterCoreId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>(`/api/opd/encounters/${encounterCoreId}`);
    return this.assertOk(res, 'Get encounter');
  }

  /** Get OPD queue */
  async getQueue(): Promise<{ encounters: unknown[] }> {
    const res = await this.get<{ encounters: unknown[] }>('/api/opd/queue');
    return this.assertOk(res, 'Get OPD queue');
  }
}
