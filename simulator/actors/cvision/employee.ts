/**
 * CVision Employee Actor — Self-service operations.
 * Maps platform role 'staff' → employee
 *
 * Uses /api/cvision/self-service endpoint which checks SELF_SERVICE permission.
 * Staff role has this permission, so all self-service operations work.
 */

import { CVisionBaseActor, type CVisionActorOptions } from './base';

export class CVisionEmployee extends CVisionBaseActor {
  constructor(opts: CVisionActorOptions) {
    super({ ...opts, role: 'staff', label: opts.label || 'CVision Employee' });
  }

  // ── Self-Service Dashboard ──

  /** Get employee dashboard (profile summary, leave balance, notifications) */
  async getMyDashboard() {
    const res = await this.get<any>('/api/cvision/self-service');
    return this.assertOk(res, 'get my dashboard');
  }

  /** Get employee profile */
  async getMyProfile() {
    const res = await this.get<any>('/api/cvision/self-service', {
      action: 'my-profile',
    });
    return this.assertOk(res, 'get my profile');
  }

  // ── Leave (via self-service) ──

  async submitLeaveRequest(data: {
    type: string;
    startDate: string;
    endDate: string;
    days?: number;
    reason?: string;
  }) {
    const res = await this.post<any>('/api/cvision/self-service', {
      action: 'request-leave',
      leaveType: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      days: data.days || 1,
      reason: data.reason,
    });
    return this.assertOk(res, 'submit leave request');
  }

  async getMyLeaves() {
    const res = await this.get<any>('/api/cvision/self-service', {
      action: 'my-leaves',
    });
    return this.assertOk(res, 'get my leaves');
  }

  async getMyLeaveBalance() {
    // my-leaves returns both leaves and balance
    const res = await this.get<any>('/api/cvision/self-service', {
      action: 'my-leaves',
    });
    const data = this.assertOk(res, 'get my leave balance');
    return data?.balance || { annual: 21, sick: 30, used: 0, remaining: 21 };
  }

  // ── Requests (via self-service) ──

  async submitRequest(data: {
    type?: string;
    subject: string;
    description: string;
    priority?: string;
  }) {
    const res = await this.post<any>('/api/cvision/self-service', {
      action: 'request-general',
      subject: data.subject,
      description: data.description,
    });
    return this.assertOk(res, 'submit request');
  }

  async getMyRequests() {
    const res = await this.get<any>('/api/cvision/self-service', {
      action: 'my-requests',
    });
    return this.assertOk(res, 'get my requests');
  }

  // ── Payslips (via self-service) ──

  async getMyPayslips() {
    const res = await this.get<any>('/api/cvision/self-service', {
      action: 'my-payslips',
    });
    return this.assertOk(res, 'get my payslips');
  }

  // ── Attendance (via self-service for reads) ──

  async getMyAttendance() {
    const res = await this.get<any>('/api/cvision/self-service', {
      action: 'my-attendance',
    });
    return this.assertOk(res, 'get my attendance');
  }

  // ── Documents ──

  async getMyDocuments() {
    const res = await this.get<any>('/api/cvision/self-service', {
      action: 'my-documents',
    });
    return this.assertOk(res, 'get my documents');
  }

  // ── Letters (via self-service) ──

  async requestLetter(templateKey?: string) {
    const res = await this.post<any>('/api/cvision/self-service', {
      action: 'request-letter',
      templateKey: templateKey || 'salary_certificate',
    });
    return this.assertOk(res, 'request letter');
  }

  // ── Training (via self-service) ──

  async requestTraining(courseId: string) {
    const res = await this.post<any>('/api/cvision/self-service', {
      action: 'request-training',
      courseId,
    });
    return this.assertOk(res, 'request training enrollment');
  }

  // ── Personal Info ──

  async updatePersonalInfo(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/self-service', {
      action: 'update-personal',
      ...data,
    });
    return this.assertOk(res, 'update personal info');
  }

  // ── Performance (read-only, staff has PERFORMANCE_READ) ──

  async getMyOKRs() {
    const res = await this.get<any>('/api/cvision/okrs', {
      action: 'my-okrs',
    });
    return this.assertOk(res, 'get my OKRs');
  }

  /**
   * Submit self-review for a performance review cycle.
   * Uses the performance endpoint with action: submit-self-review.
   */
  async submitSelfReview(cycleId: string, data?: { score?: number; feedback?: string }) {
    const profile = await this.getMyProfile();
    // assertOk returns the full JSON body: { ok: true, data: <employee doc> }
    // The employee doc is at profile.data and has an 'id' field (UUID)
    const empDoc = profile?.data;
    const employeeId = empDoc?.id || empDoc?.employeeId;
    const res = await this.post<any>('/api/cvision/performance', {
      action: 'submit-self-review',
      cycleId,
      employeeId: employeeId || 'self',
      score: data?.score ?? 4,
      feedback: data?.feedback ?? 'Self-assessment submitted via scenario',
    });
    return this.assertOk(res, 'submit self-review');
  }

  /** Alias for submitSelfReview — backwards compatibility */
  async acknowledgeReview(cycleId: string) {
    return this.submitSelfReview(cycleId);
  }
}
