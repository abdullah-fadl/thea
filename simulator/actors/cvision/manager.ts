/**
 * CVision Manager Actor — Department manager operations.
 * Maps platform role 'manager' → manager (department-scoped)
 */

import { CVisionBaseActor, type CVisionActorOptions } from './base';

export class CVisionManager extends CVisionBaseActor {
  constructor(opts: CVisionActorOptions) {
    super({ ...opts, role: 'manager', label: opts.label || 'CVision Manager' });
  }

  // ── Team Management ──

  async getDirectReports(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/employees', params);
    return this.assertOk(res, 'get direct reports');
  }

  // ── Leave Approvals ──

  async approveLeave(leaveId: string) {
    const res = await this.put<any>(`/api/cvision/leaves/${leaveId}`, {
      action: 'approve',
    });
    return this.assertOk(res, `approve leave ${leaveId}`);
  }

  async rejectLeave(leaveId: string, reason: string) {
    const res = await this.put<any>(`/api/cvision/leaves/${leaveId}`, {
      action: 'reject',
      reason,
    });
    return this.assertOk(res, `reject leave ${leaveId}`);
  }

  // ── Performance ──

  async submitPerformanceReview(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/performance', {
      action: 'submit-review',
      ...data,
    });
    return this.assertOk(res, 'submit performance review');
  }

  async getTeamOKRs() {
    const res = await this.get<any>('/api/cvision/okrs', {
      action: 'team-okrs',
    });
    return this.assertOk(res, 'get team OKRs');
  }
}
