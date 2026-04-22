/**
 * CVisionBaseActor — Base actor for all CVision HR module actors.
 * Sets activePlatform=cvision so CVision API routes accept the request.
 */

import { BaseActor, type ActorCredentials } from '../base';

export interface CVisionActorOptions {
  baseUrl: string;
  credentials: ActorCredentials;
  role?: string;
  label?: string;
  tenantId?: string;
}

export class CVisionBaseActor extends BaseActor {
  constructor(opts: CVisionActorOptions & { role: string; label: string }) {
    super({ ...opts, platform: 'cvision' });
  }

  // ── Shared CVision helpers ──

  /** List employees with optional filters */
  async listEmployees(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/employees', params);
    return this.assertOk(res, 'list employees');
  }

  /** Get single employee */
  async getEmployee(id: string) {
    const res = await this.get<any>(`/api/cvision/employees/${id}`);
    return this.assertOk(res, `get employee ${id}`);
  }

  /** List departments */
  async listDepartments() {
    const res = await this.get<any>('/api/cvision/org/departments');
    return this.assertOk(res, 'list departments');
  }

  /** List grades */
  async listGrades() {
    const res = await this.get<any>('/api/cvision/grades');
    return this.assertOk(res, 'list grades');
  }

  /** List job titles */
  async listJobTitles() {
    const res = await this.get<any>('/api/cvision/org/job-titles');
    return this.assertOk(res, 'list job titles');
  }

  /** Get org tree */
  async getOrgTree() {
    const res = await this.get<any>('/api/cvision/org/tree');
    return this.assertOk(res, 'get org tree');
  }

  /** Get dashboard summary */
  async getDashboardSummary() {
    const res = await this.get<any>('/api/cvision/dashboard/summary');
    return this.assertOk(res, 'get dashboard summary');
  }
}
