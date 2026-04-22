/**
 * Admin Actor — Administrative operations including PDPL erasure requests.
 */

import { BaseActor, type ActorOptions } from './base';

export class Admin extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'admin', label: 'Admin' });
  }

  /** Submit a PDPL erasure request for a patient */
  async submitErasureRequest(
    patientId: string,
    reason: string,
  ): Promise<{ requestId: string; status: string }> {
    const res = await this.post<{
      success: boolean;
      request: { id: string; status: string };
    }>(`/api/patients/${patientId}/erasure`, { reason });
    const raw = this.assertOk(res, 'Submit erasure request');
    return { requestId: raw.request.id, status: raw.request.status };
  }

  /** Get erasure requests for a patient */
  async getErasureRequests(
    patientId: string,
  ): Promise<Array<{ id: string; status: string; reason: string | null }>> {
    const res = await this.get<{
      requests: Array<{ id: string; status: string; reason: string | null }>;
    }>(`/api/patients/${patientId}/erasure`);
    const raw = this.assertOk(res, 'Get erasure requests');
    return raw.requests;
  }

  /** Execute an erasure request */
  async executeErasure(
    patientId: string,
    requestId: string,
  ): Promise<{
    status: string;
    summary: {
      retained: Array<{ category: string; reason: string }>;
      deleted: Array<{ category: string; action: string }>;
    };
  }> {
    const res = await this.post<{
      success: boolean;
      status: string;
      summary: {
        retained: Array<{ category: string; reason: string }>;
        deleted: Array<{ category: string; action: string }>;
      };
    }>(`/api/patients/${patientId}/erasure/execute`, { requestId });
    return this.assertOk(res, 'Execute erasure');
  }
}
