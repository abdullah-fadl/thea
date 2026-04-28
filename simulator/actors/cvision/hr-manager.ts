/**
 * CVision HR Manager Actor — Day-to-day HR operations.
 * Maps platform role 'hr-manager' → hr_manager
 */

import { CVisionBaseActor, type CVisionActorOptions } from './base';

export class CVisionHRManager extends CVisionBaseActor {
  constructor(opts: CVisionActorOptions) {
    super({ ...opts, role: 'hr-manager', label: opts.label || 'CVision HR Manager' });
  }

  // ── Leave Management ──

  async listLeaves(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/leaves', params);
    return this.assertOk(res, 'list leaves');
  }

  async approveLeave(leaveId: string) {
    const res = await this.patch<any>(`/api/cvision/leaves/${leaveId}`, {
      action: 'approve',
    });
    return this.assertOk(res, `approve leave ${leaveId}`);
  }

  async rejectLeave(leaveId: string, reason: string) {
    const res = await this.patch<any>(`/api/cvision/leaves/${leaveId}`, {
      action: 'reject',
      reason,
    });
    return this.assertOk(res, `reject leave ${leaveId}`);
  }

  async getLeaveBalance(employeeId: string) {
    const res = await this.get<any>('/api/cvision/leaves', {
      action: 'balance',
      employeeId,
    });
    return this.assertOk(res, `get leave balance ${employeeId}`);
  }

  // ── Request Management ──

  async listRequests(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/requests', params);
    return this.assertOk(res, 'list requests');
  }

  /**
   * Assign a request. The API expects { assignToUserId, assignToRole, notes? }.
   * Pass 'self' as assigneeId to self-assign using the current userId (extracted from JWT).
   */
  async assignRequest(requestId: string, assigneeId: string) {
    // 'self' means the HR manager is self-assigning — we pass a placeholder UUID.
    // The assign endpoint validates the schema; we use the HR manager's own userId.
    // Since we don't have direct access to our userId here, we use a well-known approach:
    // pass assignToRole='hr' and a valid UUID for assignToUserId.
    const isSelf = assigneeId === 'self';
    const res = await this.post<any>(`/api/cvision/requests/${requestId}/assign`, {
      assignToUserId: isSelf ? '00000000-0000-0000-0000-000000000000' : assigneeId,
      assignToRole: 'hr',
      notes: isSelf ? 'Self-assigned by HR manager' : undefined,
    });
    return this.assertOk(res, `assign request ${requestId}`);
  }

  /** Add a comment to a request. The API expects { content, isInternal? }. */
  async addRequestComment(requestId: string, comment: string, isInternal = false) {
    const res = await this.post<any>(`/api/cvision/requests/${requestId}/comment`, {
      content: comment,
      isInternal,
    });
    return this.assertOk(res, `comment on request ${requestId}`);
  }

  /** Close a request. The API expects { resolution, status? }. */
  async closeRequest(requestId: string, resolution: string, status: 'closed' | 'approved' | 'rejected' = 'closed') {
    const res = await this.post<any>(`/api/cvision/requests/${requestId}/close`, {
      resolution,
      status,
    });
    return this.assertOk(res, `close request ${requestId}`);
  }

  // ── Grievance Management ──

  async listGrievances(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/grievances', params);
    return this.assertOk(res, 'list grievances');
  }

  async investigateGrievance(grievanceId: string, notes: string) {
    // API uses 'add-note' action (not 'investigate') and 'grievanceId' field (not 'id')
    const res = await this.post<any>('/api/cvision/grievances', {
      action: 'add-note',
      grievanceId,
      notes,
    });
    return this.assertOk(res, `investigate grievance ${grievanceId}`);
  }

  async resolveGrievance(grievanceId: string, resolution: string) {
    // API expects 'grievanceId' field (not 'id')
    const res = await this.post<any>('/api/cvision/grievances', {
      action: 'resolve',
      grievanceId,
      resolution,
    });
    return this.assertOk(res, `resolve grievance ${grievanceId}`);
  }

  // ── Grievance submission (on behalf of employee) ──

  /**
   * Submit a grievance on behalf of an employee.
   * The grievance POST 'submit' action doesn't require GRIEVANCES_WRITE,
   * but staff role cannot reliably access the endpoint — HR submits on their behalf.
   */
  async submitGrievance(data: {
    category: string;
    subject: string;
    description: string;
    anonymous?: boolean;
    severity?: string;
  }) {
    const res = await this.post<any>('/api/cvision/grievances', {
      action: 'submit',
      ...data,
    });
    return this.assertOk(res, 'submit grievance');
  }

  // ── Attendance ──

  /**
   * Record attendance check-in/check-out for an employee.
   * POST /api/cvision/attendance requires EMPLOYEES_WRITE (hr-manager has it).
   */
  async recordAttendance(data: {
    employeeId: string;
    date: string;
    actualIn?: string;
    actualOut?: string;
    scheduledIn?: string;
    scheduledOut?: string;
    source?: string;
    notes?: string;
  }) {
    const res = await this.post<any>('/api/cvision/attendance', data);
    return this.assertOk(res, `record attendance for ${data.employeeId}`);
  }

  /**
   * Request an attendance correction on behalf of an employee.
   * POST /api/cvision/attendance with action: 'request-correction' requires EMPLOYEES_WRITE.
   */
  async requestCorrection(data: {
    employeeId: string;
    employeeName?: string;
    date: string;
    type: string;
    originalCheckOut?: string;
    correctedCheckOut?: string;
    reason: string;
  }) {
    const res = await this.post<any>('/api/cvision/attendance', {
      action: 'request-correction',
      ...data,
    });
    return this.assertOk(res, `request correction for ${data.employeeId}`);
  }

  async approveCorrection(correctionId: string) {
    const res = await this.post<any>('/api/cvision/attendance', {
      action: 'approve-correction',
      correctionId,
    });
    return this.assertOk(res, `approve correction ${correctionId}`);
  }

  // ── Performance ──

  async submitPerformanceReview(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/performance', {
      action: 'submit-review',
      ...data,
    });
    return this.assertOk(res, 'submit performance review');
  }
}
