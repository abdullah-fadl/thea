/**
 * OB/GYN Doctor Actor — Labor admission, partogram, delivery, postpartum.
 */

import { BaseActor, type ActorOptions } from './base';
import type { ObstetricData } from '../data/obstetric';

export class ObgynDoctor extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'doctor', label: 'OB/GYN Doctor' });
  }

  /** Admit patient to labor */
  async admitToLabor(patientId: string, obsData: ObstetricData): Promise<Record<string, unknown>> {
    const res = await this.post<Record<string, unknown>>(`/api/obgyn/labor/${patientId}/admit`, {
      gravida: obsData.gravida,
      para: obsData.para,
      edd: obsData.edd,
      gestationalAge: obsData.gestationalAge,
      membranesStatus: obsData.membranesStatus,
      presentationType: obsData.presentationType,
    });
    return this.assertOk(res, 'Admit to labor');
  }

  /** Update partogram */
  async updatePartogram(patientId: string, data: {
    cervixDilation: number;
    contractionFreq: number;
    fetalHeartRate: number;
    descentLevel?: number;
  }): Promise<void> {
    const res = await this.post(`/api/obgyn/forms/${patientId}`, {
      type: 'partogram',
      data: {
        cervixDilation: data.cervixDilation,
        contractionFrequency: data.contractionFreq,
        fetalHeartRate: data.fetalHeartRate,
        descentLevel: data.descentLevel || 0,
        timestamp: new Date().toISOString(),
      },
    });
    this.assertOk(res, 'Update partogram');
  }

  /** Record delivery (discharge with delivery info) */
  async recordDelivery(patientId: string, delivery: {
    mode: 'SVD' | 'CESAREAN' | 'ASSISTED';
    time: string;
    outcome: 'LIVE_BIRTH' | 'STILLBIRTH';
    episodeId?: string;
  }): Promise<void> {
    const res = await this.post(`/api/obgyn/labor/${patientId}/admit`, {
      action: 'discharge',
      episodeId: delivery.episodeId,
      deliveryMode: delivery.mode,
      deliveryTime: delivery.time,
    });
    this.assertOk(res, 'Record delivery');
  }

  /** Get labor worklist */
  async getLaborStatus(patientId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>('/api/obgyn/labor/worklist');
    return this.assertOk(res, 'Get labor worklist');
  }

  /** Get patient forms */
  async getForms(patientId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>(`/api/obgyn/forms/${patientId}`);
    return this.assertOk(res, 'Get OB/GYN forms');
  }
}
