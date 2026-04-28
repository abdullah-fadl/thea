/**
 * OR Nurse Actor — OR case management, time-out, surgical events.
 */

import { BaseActor, type ActorOptions } from './base';

export class OrNurse extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'nurse', label: 'OR Nurse' });
  }

  /** Create OR case from order */
  async createCase(orderId: string): Promise<{ caseId: string }> {
    const res = await this.post<{ caseId: string }>('/api/or/cases/create-from-order', {
      orderId,
    });
    return this.assertOk(res, 'Create OR case');
  }

  /** Get OR case details */
  async getCase(caseId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>(`/api/or/cases/${caseId}`);
    return this.assertOk(res, 'Get OR case');
  }

  /** Record PRE_OP step (consent, surgeon, anesthesia) */
  async preOp(caseId: string, data: {
    surgeonUserId: string;
    anesthesiaUserId: string;
    checklist?: Record<string, boolean>;
    notes?: string;
  }): Promise<void> {
    const res = await this.post(`/api/or/cases/${caseId}/events`, {
      step: 'PRE_OP',
      checklist: {
        patientIdentified: true,
        procedureConfirmed: true,
        siteMarked: true,
        allergiesReviewed: true,
        ...(data.checklist || {}),
      },
      consentConfirmed: true,
      consentAt: new Date().toISOString(),
      surgeonUserId: data.surgeonUserId,
      anesthesiaUserId: data.anesthesiaUserId,
      notes: data.notes || null,
    });
    this.assertOk(res, 'PRE_OP step');
  }

  /** Record INTRA_OP step (surgery in progress) */
  async intraOp(caseId: string, data: {
    note: string;
    startedAt?: string;
    endedAt?: string;
  }): Promise<void> {
    const res = await this.post(`/api/or/cases/${caseId}/events`, {
      step: 'INTRA_OP',
      note: data.note,
      startedAt: data.startedAt || new Date().toISOString(),
      endedAt: data.endedAt || null,
    });
    this.assertOk(res, 'INTRA_OP step');
  }

  /** Record POST_OP step */
  async postOp(caseId: string, data: {
    note: string;
    complications?: boolean;
    complicationDescription?: string;
  }): Promise<void> {
    const res = await this.post(`/api/or/cases/${caseId}/events`, {
      step: 'POST_OP',
      note: data.note,
      complications: data.complications || false,
      complicationDescription: data.complicationDescription || '',
    });
    this.assertOk(res, 'POST_OP step');
  }

  /** Record RECOVERY step */
  async recovery(caseId: string, data: {
    handoffSummary: string;
    destination: 'WARD' | 'ICU' | 'DISCHARGE';
  }): Promise<void> {
    const res = await this.post(`/api/or/cases/${caseId}/events`, {
      step: 'RECOVERY',
      handoffSummary: data.handoffSummary,
      destination: data.destination,
    });
    this.assertOk(res, 'RECOVERY step');
  }

  /** Log surgical event — maps event types to the step-based OR workflow */
  async logEvent(caseId: string, event: {
    type: string;
    description: string;
    time?: string;
  }): Promise<void> {
    // The OR events API uses a step-based workflow; map generic event types to the expected step
    const typeToStep: Record<string, string> = {
      INCISION: 'INTRA_OP',
      PROCEDURE: 'INTRA_OP',
      CLOSURE: 'POST_OP',
      RECOVERY: 'RECOVERY',
    };
    const step = typeToStep[event.type.toUpperCase()] || event.type.toUpperCase();

    const payload: Record<string, unknown> = { step };
    if (step === 'INTRA_OP') {
      payload.note = event.description;
      payload.startedAt = event.time || new Date().toISOString();
    } else if (step === 'POST_OP') {
      payload.note = event.description;
      payload.complications = false;
    } else if (step === 'RECOVERY') {
      payload.handoffSummary = event.description;
      payload.destination = 'WARD';
    }

    const res = await this.post(`/api/or/cases/${caseId}/events`, payload);
    this.assertOk(res, `Log OR event: ${event.type}`);
  }

  /** Perform WHO time-out checklist */
  async timeOut(caseId: string, checklist: {
    patientIdentityConfirmed: boolean;
    siteMarked: boolean;
    consentSigned: boolean;
    allergiesReviewed: boolean;
    antibioticGiven: boolean;
  }): Promise<void> {
    const res = await this.post(`/api/or/cases/${caseId}/events`, {
      step: 'TIME_OUT',
      patientConfirmed: checklist.patientIdentityConfirmed,
      procedureConfirmed: true,
      siteConfirmed: checklist.siteMarked,
    });
    this.assertOk(res, 'Time-out checklist');
  }

  /** Update case status */
  async updateStatus(caseId: string, status: string): Promise<void> {
    const res = await this.put(`/api/or/cases/${caseId}`, { status });
    this.assertOk(res, `Update OR case → ${status}`);
  }

  /** Get case events — API returns { items: [...] } */
  async getEvents(caseId: string): Promise<{ items: unknown[] }> {
    const res = await this.get<{ items: unknown[] }>(`/api/or/cases/${caseId}/events`);
    return this.assertOk(res, 'Get OR events');
  }
}
