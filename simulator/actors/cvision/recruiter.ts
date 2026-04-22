/**
 * CVision Recruiter Actor — Recruitment pipeline operations.
 * Maps platform role 'hr-admin' → hr_admin (needs recruitment permissions)
 */

import { CVisionBaseActor, type CVisionActorOptions } from './base';

export class CVisionRecruiter extends CVisionBaseActor {
  constructor(opts: CVisionActorOptions) {
    super({ ...opts, role: 'hr-admin', label: opts.label || 'CVision Recruiter' });
  }

  // ── Requisitions ──

  async createRequisition(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/recruitment/requisitions', data);
    return this.assertOk(res, 'create requisition');
  }

  async getRequisition(id: string) {
    const res = await this.get<any>(`/api/cvision/recruitment/requisitions/${id}`);
    return this.assertOk(res, `get requisition ${id}`);
  }

  async updateRequisition(id: string, data: Record<string, unknown>) {
    const res = await this.put<any>(`/api/cvision/recruitment/requisitions/${id}`, data);
    return this.assertOk(res, `update requisition ${id}`);
  }

  async getRequisitionSlots(id: string) {
    const res = await this.get<any>(`/api/cvision/recruitment/requisitions/${id}/slots`);
    return this.assertOk(res, `get requisition slots ${id}`);
  }

  async listRequisitions(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/recruitment/requisitions', params);
    return this.assertOk(res, 'list requisitions');
  }

  // ── Candidates ──

  async createCandidate(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/recruitment/candidates', data);
    return this.assertOk(res, 'create candidate');
  }

  async getCandidate(id: string) {
    const res = await this.get<any>(`/api/cvision/recruitment/candidates/${id}`);
    return this.assertOk(res, `get candidate ${id}`);
  }

  async listCandidates(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/recruitment/candidates', params);
    return this.assertOk(res, 'list candidates');
  }

  async screenCandidate(id: string, data: { score: number; notes?: string; decision?: string }) {
    // Map actor-friendly `score` to API field `screeningScore` and default decision to `shortlisted`
    const payload: Record<string, unknown> = {
      screeningScore: data.score,
      decision: data.decision || (data.score >= 50 ? 'shortlisted' : 'rejected'),
    };
    if (data.notes) payload.notes = data.notes;
    const res = await this.post<any>(`/api/cvision/recruitment/candidates/${id}/screen`, payload);
    return this.assertOk(res, `screen candidate ${id}`);
  }

  async scheduleInterview(candidateId: string, data: Record<string, unknown>) {
    const res = await this.post<any>(
      `/api/cvision/recruitment/candidates/${candidateId}/interviews`,
      data,
    );
    return this.assertOk(res, `schedule interview for ${candidateId}`);
  }

  async createOffer(candidateId: string, data: Record<string, unknown>) {
    const res = await this.post<any>(
      `/api/cvision/recruitment/candidates/${candidateId}/offer`,
      data,
    );
    return this.assertOk(res, `create offer for ${candidateId}`);
  }

  async hireCandidate(candidateId: string, data: Record<string, unknown>) {
    const res = await this.post<any>(
      `/api/cvision/recruitment/candidates/${candidateId}/hire`,
      data,
    );
    return this.assertOk(res, `hire candidate ${candidateId}`);
  }

  async quickHire(candidateId: string, data: Record<string, unknown>) {
    const res = await this.post<any>(
      `/api/cvision/recruitment/candidates/${candidateId}/quick-hire`,
      data,
    );
    return this.assertOk(res, `quick-hire candidate ${candidateId}`);
  }

  // ── Pipeline ──

  async getPipeline() {
    const res = await this.get<any>('/api/cvision/recruitment/pipeline');
    return this.assertOk(res, 'get recruitment pipeline');
  }

  async getRequisitionCandidates(requisitionId: string) {
    const res = await this.get<any>(
      `/api/cvision/recruitment/requisitions/${requisitionId}/candidates`,
    );
    return this.assertOk(res, `get candidates for requisition ${requisitionId}`);
  }
}
