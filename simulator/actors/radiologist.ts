/**
 * Radiologist Actor — Study management, reports, critical findings.
 */

import { BaseActor, type ActorOptions } from './base';

export class Radiologist extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'staff', label: 'Radiologist' });
  }

  /** Get radiology worklist */
  async getWorklist(): Promise<{ studies: unknown[] }> {
    const res = await this.get<{ studies: unknown[] }>('/api/radiology/worklist');
    return this.assertOk(res, 'Get radiology worklist');
  }

  /** Get studies */
  async getStudies(params?: Record<string, string>): Promise<{ studies: unknown[] }> {
    const res = await this.get<{ studies: unknown[] }>('/api/radiology/studies', params);
    return this.assertOk(res, 'Get radiology studies');
  }

  /** Update study status */
  async updateStudyStatus(studyId: string, status: string): Promise<void> {
    const res = await this.post('/api/radiology/studies', {
      studyId,
      action: status,
    });
    this.assertOk(res, `Update study → ${status}`);
  }

  /** Save radiology report */
  async saveReport(data: {
    orderId: string;
    studyId?: string;
    findings: string;
    impression: string;
    isCritical?: boolean;
  }): Promise<void> {
    const res = await this.post('/api/radiology/reports/save', {
      orderId: data.orderId,
      studyId: data.studyId,
      findings: data.findings,
      impression: data.impression,
      isCritical: data.isCritical || false,
      status: 'FINAL',
      reportedAt: new Date().toISOString(),
    });
    this.assertOk(res, 'Save radiology report');
  }

  /** Get reports */
  async getReports(params?: Record<string, string>): Promise<{ reports: unknown[] }> {
    const res = await this.get<{ reports: unknown[] }>('/api/radiology/reports', params);
    return this.assertOk(res, 'Get radiology reports');
  }
}
