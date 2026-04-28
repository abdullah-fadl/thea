/**
 * CVision Payroll Admin Actor — Payroll operations.
 * Maps platform role 'hr-admin' → hr_admin (payroll permissions)
 */

import { CVisionBaseActor, type CVisionActorOptions } from './base';

export class CVisionPayrollAdmin extends CVisionBaseActor {
  constructor(opts: CVisionActorOptions) {
    super({ ...opts, role: 'hr-admin', label: opts.label || 'CVision Payroll Admin' });
  }

  // ── Payroll Profiles ──

  async createPayrollProfile(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/payroll/profiles', data);
    // 409 = profile already exists for this employee — treat as success (idempotent)
    if (res.status === 409) {
      return res.data;
    }
    return this.assertOk(res, 'create payroll profile');
  }

  async getPayrollProfile(id: string) {
    const res = await this.get<any>(`/api/cvision/payroll/profiles/${id}`);
    return this.assertOk(res, `get payroll profile ${id}`);
  }

  async listPayrollProfiles(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/payroll/profiles', params);
    return this.assertOk(res, 'list payroll profiles');
  }

  // ── Payroll Runs ──

  async createPayrollRun(data: { period: string; description?: string }) {
    const res = await this.post<any>('/api/cvision/payroll/runs', data);
    return this.assertOk(res, 'create payroll run');
  }

  async getPayrollRun(id: string) {
    const res = await this.get<any>(`/api/cvision/payroll/runs/${id}`);
    return this.assertOk(res, `get payroll run ${id}`);
  }

  async listPayrollRuns(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/payroll/runs', params);
    return this.assertOk(res, 'list payroll runs');
  }

  async dryRunPayroll(runId: string) {
    const res = await this.post<any>(`/api/cvision/payroll/runs/${runId}/dry-run`, {});
    return this.assertOk(res, `dry-run payroll ${runId}`);
  }

  async approvePayrollRun(runId: string) {
    const res = await this.post<any>(`/api/cvision/payroll/runs/${runId}/approve`, {});
    return this.assertOk(res, `approve payroll run ${runId}`);
  }

  async exportWPS(runId: string) {
    const res = await this.post<any>(`/api/cvision/payroll/runs/${runId}/export-wps`, {});
    return this.assertOk(res, `export WPS ${runId}`);
  }

  // ── Payslips ──

  async getPayslips(runId: string) {
    const res = await this.get<any>(`/api/cvision/payroll/runs/${runId}/payslips`);
    return this.assertOk(res, `get payslips for run ${runId}`);
  }

  async getPayslip(payslipId: string) {
    const res = await this.get<any>(`/api/cvision/payroll/payslips/${payslipId}`);
    return this.assertOk(res, `get payslip ${payslipId}`);
  }

  // ── Calculations ──

  async calculatePayroll(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/payroll/calculate', data);
    return this.assertOk(res, 'calculate payroll');
  }

  // ── Loans ──

  async createLoan(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/loans', data);
    return this.assertOk(res, 'create loan');
  }

  // ── GOSI ──

  async getGosiSummary(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/gosi', params);
    return this.assertOk(res, 'get GOSI summary');
  }
}
