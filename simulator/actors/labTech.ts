/**
 * Lab Tech Actor — Specimen collection, result entry, worklist.
 */

import { BaseActor, type ActorOptions } from './base';
import type { LabTest } from '../data/lab-tests';

export class LabTech extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'staff', label: 'Lab Tech' });
  }

  /** Collect specimen — returns specimen with id */
  async collectSpecimen(orderId: string): Promise<{ specimenId: string; specimen: { id: string; specimenId: string } }> {
    const res = await this.post<{ specimen: { id: string; specimenId: string } }>('/api/lab/specimens/collect', {
      orderId,
      collectedAt: new Date().toISOString(),
      collectionSite: 'LEFT_ARM',
      specimenType: 'BLOOD',
    });
    const raw = this.assertOk(res, 'Collect specimen');
    const specimen: any = raw.specimen || (raw as Record<string, unknown>);
    return {
      specimenId: specimen.specimenId || specimen.id,
      specimen,
    };
  }

  /** Save lab result */
  async saveResult(orderId: string, testId: string, result: LabTest): Promise<void> {
    // Convert LabTest parameters to the results array format expected by the API
    const results = result.parameters.map((p) => ({
      parameterName: p.key,
      value: p.value,
      unit: p.unit,
      referenceRange: p.normalRange,
      flag: 'NORMAL',
    }));

    const res = await this.post('/api/lab/results/save', {
      orderId,
      testId,
      results,
      status: 'FINAL',
    });
    this.assertOk(res, 'Save lab result');
  }

  /** Get lab worklist */
  async getWorklist(): Promise<{ orders: unknown[] }> {
    const res = await this.get<{ orders: unknown[] }>('/api/lab/worklist');
    return this.assertOk(res, 'Get lab worklist');
  }

  /** Get specimens */
  async getSpecimens(): Promise<{ specimens: unknown[] }> {
    const res = await this.get<{ specimens: unknown[] }>('/api/lab/specimens');
    return this.assertOk(res, 'Get specimens');
  }

  /** Get results */
  async getResults(params?: Record<string, string>): Promise<{ results: unknown[] }> {
    const res = await this.get<{ results: unknown[] }>('/api/lab/results', params);
    return this.assertOk(res, 'Get lab results');
  }

  /** Get critical alerts */
  async getCriticalAlerts(): Promise<{ alerts: unknown[] }> {
    const res = await this.get<{ alerts: unknown[] }>('/api/lab/critical-alerts');
    return this.assertOk(res, 'Get critical alerts');
  }
}
