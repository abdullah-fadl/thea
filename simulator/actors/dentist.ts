/**
 * Dentist Actor — Dental chart, treatment plans, procedures.
 */

import { BaseActor, type ActorOptions } from './base';

export class Dentist extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'doctor', label: 'Dentist' });
  }

  /** Get dental chart */
  async getChart(patientId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>(`/api/dental/chart/${patientId}`);
    return this.assertOk(res, 'Get dental chart');
  }

  /** Update dental chart (record conditions) */
  async updateChart(patientId: string, conditions: Record<string, {
    condition: string;
    surface?: string;
  }>): Promise<void> {
    const res = await this.post(`/api/dental/chart/${patientId}`, { conditions });
    this.assertOk(res, 'Update dental chart');
  }

  /** Get treatment plan */
  async getTreatment(patientId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>(`/api/dental/treatment/${patientId}`);
    return this.assertOk(res, 'Get dental treatment');
  }

  /** Update treatment plan — posts one item at a time */
  async updateTreatment(patientId: string, treatments: Array<{
    tooth: string;
    procedure: string;
    code: string;
    fee: number;
    status?: string;
  }>): Promise<void> {
    for (const t of treatments) {
      const res = await this.post(`/api/dental/treatment/${patientId}`, {
        item: {
          toothNumber: t.tooth,
          procedureCode: t.code,
          procedureName: t.procedure,
          procedureNameAr: t.procedure,
          fee: t.fee,
          status: t.status || 'PLANNED',
        },
      });
      this.assertOk(res, 'Update dental treatment');
    }
  }
}
