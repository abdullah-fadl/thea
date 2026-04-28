/**
 * ER Nurse Actor — Triage, bed assignment, nursing tasks.
 */

import { BaseActor, type ActorOptions } from './base';
import type { ErTriageVitals } from '../data/vitals';

export class ErNurse extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'nurse', label: 'ER Nurse' });
  }

  /** Save triage assessment */
  async saveTriage(encounterId: string, data: {
    vitals: ErTriageVitals;
    triageLevel: number;
    chiefComplaint: string;
  }): Promise<void> {
    const res = await this.post('/api/er/triage/save', {
      encounterId,
      vitals: data.vitals,
      triageLevel: data.triageLevel,
      chiefComplaint: data.chiefComplaint,
      painLevel: 5,
      acuity: data.triageLevel <= 2 ? 'EMERGENT' : 'URGENT',
    });
    this.assertOk(res, 'Save triage');
  }

  /** Finish triage (lock it) — vitals + chiefComplaint are required by the API */
  async finishTriage(encounterId: string, data: {
    vitals: ErTriageVitals;
    chiefComplaint: string;
    painScore?: number;
  }): Promise<void> {
    const res = await this.post('/api/er/triage/finish', {
      encounterId,
      vitals: {
        systolic: data.vitals.systolic,
        diastolic: data.vitals.diastolic,
        HR: data.vitals.HR,
        RR: data.vitals.RR,
        TEMP: data.vitals.TEMP,
        SPO2: data.vitals.SPO2,
      },
      chiefComplaint: data.chiefComplaint,
      painScore: data.painScore ?? 5,
    });
    this.assertOk(res, 'Finish triage');
  }

  /** Assign bed */
  async assignBed(encounterId: string, bedId?: string): Promise<void> {
    // First get available beds if no bedId given
    let candidateBeds: Array<{ id: string; state?: string; encounterId?: string | null }> = [];
    if (!bedId) {
      const bedsRes = await this.get<{ beds: Array<{ id: string; state?: string; encounterId?: string | null }> }>('/api/er/beds');
      const beds = this.assertOk(bedsRes, 'Get ER beds');
      // Filter for vacant/available beds only
      candidateBeds = (beds.beds || []).filter(
        (b) => !b.encounterId && (!b.state || b.state === 'VACANT' || b.state === 'available'),
      );
      if (candidateBeds.length > 0) {
        bedId = candidateBeds[0].id;
      }
    }
    if (!bedId) return; // No beds available

    // Try assigning, retry with next bed if already taken by concurrent scenario
    for (let i = 0; i < candidateBeds.length; i++) {
      const tryBedId = i === 0 ? bedId : candidateBeds[i].id;
      const res = await this.post('/api/er/beds/assign', { encounterId, bedId: tryBedId });
      if (res.status === 409 && i < candidateBeds.length - 1) {
        continue; // Try next bed
      }
      this.assertOk(res, 'Assign ER bed');
      return;
    }
  }

  /** Get ER board */
  async getBoard(): Promise<{ encounters: unknown[] }> {
    const res = await this.get<{ encounters: unknown[] }>('/api/er/board');
    return this.assertOk(res, 'Get ER board');
  }

  /** Record nursing observation */
  async recordObservation(encounterId: string, observation: Record<string, unknown>): Promise<void> {
    const res = await this.post(`/api/er/nursing/encounters/${encounterId}/observations`, observation);
    this.assertOk(res, 'Record nursing observation');
  }

  /** Get encounter details */
  async getEncounter(encounterId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>(`/api/er/encounters/${encounterId}`);
    return this.assertOk(res, 'Get ER encounter');
  }
}
