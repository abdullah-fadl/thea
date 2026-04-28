/**
 * ICU Doctor Actor — ICU admission, SOFA scoring, ventilator checks, transfer.
 */

import { BaseActor, type ActorOptions } from './base';

export class IcuDoctor extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'doctor', label: 'ICU Doctor' });
  }

  /** Admit patient to ICU */
  async admit(episodeId: string, data: {
    reason: string;
    sourceUnit?: string;
  }): Promise<void> {
    const res = await this.post(`/api/icu/episodes/${episodeId}/admit`, {
      source: data.sourceUnit || 'ER',
      note: data.reason,
    });
    this.assertOk(res, 'ICU admit');
  }

  /** Record SOFA score */
  async recordSOFA(episodeId: string, scores: {
    respiratory: number;
    cardiovascular: number;
    cns: number;
    renal: number;
    liver: number;
    coagulation: number;
  }): Promise<void> {
    const res = await this.post(`/api/icu/episodes/${episodeId}/events`, {
      type: 'SOFA_SCORE',
      data: scores,
    });
    this.assertOk(res, 'Record SOFA score');
  }

  /** Record ventilator check */
  async ventilatorCheck(episodeId: string, data: {
    mode: string;
    fiO2: number;
    peep: number;
    tidalVolume?: number;
    respiratoryRate?: number;
  }): Promise<void> {
    const res = await this.post(`/api/icu/episodes/${episodeId}/events`, {
      type: 'VENTILATOR_CHECK',
      data,
    });
    this.assertOk(res, 'Ventilator check');
  }

  /** Transfer out of ICU */
  async transfer(episodeId: string, destination: string): Promise<void> {
    const res = await this.post(`/api/icu/episodes/${episodeId}/transfer`, {
      destination,
      note: 'Clinical improvement',
    });
    this.assertOk(res, 'ICU transfer');
  }

  /** Create clinical handover (required before ICU transfer) */
  async createHandover(opts: {
    encounterCoreId?: string;
    episodeId?: string;
    toRole: string;
    summary: string;
  }): Promise<{ handoverId: string }> {
    const res = await this.post<{ handover: { id: string } }>('/api/handover/create', opts);
    const raw = this.assertOk(res, 'Create handover');
    return { handoverId: raw.handover?.id || (raw as Record<string, unknown>).handoverId as string || (raw as Record<string, unknown>).id as string };
  }

  /** Finalize clinical handover */
  async finalizeHandover(handoverId: string): Promise<void> {
    const res = await this.post('/api/handover/finalize', { handoverId });
    this.assertOk(res, 'Finalize handover');
  }

  /** Get ICU episode summary */
  async getSummary(episodeId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>(`/api/icu/episodes/${episodeId}/summary`);
    return this.assertOk(res, 'Get ICU summary');
  }

  /** Get ICU events — API returns { items: [...] } */
  async getEvents(episodeId: string): Promise<{ items: unknown[] }> {
    const res = await this.get<{ items: unknown[] }>(`/api/icu/episodes/${episodeId}/events`);
    return this.assertOk(res, 'Get ICU events');
  }
}
