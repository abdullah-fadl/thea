/**
 * IPD Nurse Actor — Admission, nursing notes, MAR, bed management.
 */

import { BaseActor, type ActorOptions } from './base';
import type { Vitals } from '../data/vitals';

export class IpdNurse extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'nurse', label: 'IPD Nurse' });
  }

  /** Create IPD episode from handoff */
  async admitFromHandoff(handoffId: string): Promise<{ episodeId: string }> {
    const res = await this.post<{ episodeId: string }>('/api/ipd/admission-intake/from-handoff', {
      handoffId,
    });
    return this.assertOk(res, 'IPD admit from handoff');
  }

  /** Create IPD episode from encounter */
  async createFromEncounter(
    encounterCoreId: string,
    opts: {
      serviceUnit: string;
      admittingDoctorUserId: string;
      bedClass?: string;
      notes?: string;
    },
  ): Promise<{ episodeId: string }> {
    const res = await this.post<{ episodeId: string }>('/api/ipd/episodes/create-from-encounter', {
      encounterCoreId,
      serviceUnit: opts.serviceUnit,
      admittingDoctorUserId: opts.admittingDoctorUserId,
      bedClass: opts.bedClass,
      notes: opts.notes,
    });
    return this.assertOk(res, 'Create IPD episode');
  }

  /** Record nursing progress note */
  async nursingProgress(episodeId: string, note: string): Promise<void> {
    const res = await this.post(`/api/ipd/episodes/${episodeId}/nursing-progress`, {
      responseToCarePlan: note,
      vitalsSummary: 'Vitals within normal limits',
      issues: '',
      escalations: '',
    });
    this.assertOk(res, 'Record nursing progress');
  }

  /** Record nursing assessment */
  async nursingAssessment(episodeId: string, assessment: Record<string, unknown>): Promise<void> {
    const res = await this.post(`/api/ipd/episodes/${episodeId}/nursing-assessments`, assessment);
    this.assertOk(res, 'Record nursing assessment');
  }

  /** Record vitals — sends flat fields matching ipdVitalsSchema */
  async recordVitals(episodeId: string, vitals: Vitals | Record<string, unknown>): Promise<void> {
    // The IPD vitals API expects flat body: systolic, diastolic, hr, rr, temp, spo2, painScore, avpu.
    // The Vitals type from data/vitals.ts uses "bp" as "120/80" string, so parse it out.
    const v = vitals as Record<string, unknown>;
    let flat: Record<string, unknown>;
    if ('bp' in v && typeof v.bp === 'string') {
      const parts = String(v.bp).split('/');
      flat = {
        systolic: Number(parts[0]) || 120,
        diastolic: Number(parts[1]) || 80,
        hr: v.hr,
        rr: v.rr,
        temp: v.temp,
        spo2: v.spo2,
        painScore: v.painScore ?? 0,
        avpu: v.avpu ?? 'A',
      };
    } else {
      // Already flat (e.g. Record<string, unknown> with explicit fields)
      flat = {
        systolic: v.systolic,
        diastolic: v.diastolic,
        hr: v.hr,
        rr: v.rr,
        temp: v.temp,
        spo2: v.spo2,
        painScore: v.painScore ?? 0,
        avpu: v.avpu ?? 'A',
      };
    }
    const res = await this.post(`/api/ipd/episodes/${episodeId}/vitals`, flat);
    this.assertOk(res, 'Record IPD vitals');
  }

  /** Get MAR (Medication Administration Record) */
  async getMAR(episodeId: string): Promise<{ records: unknown[] }> {
    const res = await this.get<{ records: unknown[] }>(`/api/ipd/episodes/${episodeId}/mar`);
    return this.assertOk(res, 'Get MAR');
  }

  /** Record MAR event (med administration) */
  async recordMAREvent(orderId: string, event: {
    action: 'GIVEN' | 'HELD' | 'REFUSED' | 'OMITTED';
    notes?: string;
  }): Promise<void> {
    const res = await this.post(`/api/ipd/mar/${orderId}/event`, event);
    this.assertOk(res, 'Record MAR event');
  }

  /** Assign bed */
  async assignBed(episodeId: string, bedId: string): Promise<void> {
    const res = await this.post(`/api/ipd/episodes/${episodeId}/bed/assign`, { bedId });
    this.assertOk(res, 'Assign IPD bed');
  }

  /** Transfer bed */
  async transferBed(episodeId: string, newBedId: string, reason: string): Promise<void> {
    const res = await this.post(`/api/ipd/episodes/${episodeId}/bed/transfer`, {
      newBedId,
      reason,
    });
    this.assertOk(res, 'Transfer IPD bed');
  }

  /** Get available beds */
  async getAvailableBeds(): Promise<{ beds: Array<{ id: string; label: string }> }> {
    const res = await this.get<{ beds: Array<{ id: string; label: string }> }>('/api/ipd/beds/available');
    return this.assertOk(res, 'Get available IPD beds');
  }

  /** Set episode ownership (primary nurse, attending physician) */
  async setOwnership(episodeId: string, ownership: {
    primaryInpatientNurseUserId?: string;
    attendingPhysicianUserId?: string;
  }): Promise<void> {
    const res = await this.post(`/api/ipd/episodes/${episodeId}/ownership`, ownership);
    this.assertOk(res, 'Set IPD episode ownership');
  }

  /** Get episode details */
  async getEpisode(episodeId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>(`/api/ipd/episodes/${episodeId}`);
    return this.assertOk(res, 'Get IPD episode');
  }

  /** Create clinical handover */
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
}
