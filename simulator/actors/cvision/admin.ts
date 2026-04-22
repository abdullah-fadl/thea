/**
 * CVision Admin Actor — Full access to all CVision operations.
 * Maps platform role 'admin' → cvision_admin
 *
 * All "getOrCreate" helpers are idempotent — they catch "already exists"
 * errors (HTTP 400 with CODE_ALREADY_EXISTS / duplicate messages) and
 * return the existing record instead, so scenarios can be re-run safely.
 */

import { CVisionBaseActor, type CVisionActorOptions } from './base';

export class CVisionAdmin extends CVisionBaseActor {
  constructor(opts: CVisionActorOptions) {
    super({ ...opts, role: 'admin', label: opts.label || 'CVision Admin' });
  }

  // ── helpers ──

  /** Return true when an API result looks like a "duplicate / already exists" error */
  private isDuplicateError(res: { ok: boolean; status: number; data: any }): boolean {
    if (res.ok) return false;
    // HTTP 400 or 409 with duplicate-related error codes / messages
    if (res.status !== 400 && res.status !== 409) return false;
    const d = res.data;
    const code = d?.code || '';
    const error = typeof d?.error === 'string' ? d.error : '';
    const message = d?.message || '';
    const detailsMsg = d?.details?.message || '';
    // Fallback: stringify the whole response to catch any nested duplicate signals
    const fullJson = JSON.stringify(d || '').toLowerCase();
    const combined = `${code} ${error} ${message} ${detailsMsg}`.toLowerCase();
    return (
      combined.includes('already exists') ||
      combined.includes('already uses') ||
      combined.includes('code_already_exists') ||
      combined.includes('duplicate') ||
      combined.includes('duplicate_position_code') ||
      combined.includes('conflict') ||
      fullJson.includes('already exists') ||
      fullJson.includes('already uses') ||
      fullJson.includes('duplicate')
    );
  }

  // ── Organization Management ──

  async createDepartment(data: {
    name: string;
    nameAr?: string;
    code: string;
    description?: string;
    parentId?: string;
  }) {
    const res = await this.post<any>('/api/cvision/org/departments', data);
    return this.assertOk(res, 'create department');
  }

  /**
   * Idempotent: create department or return the existing one when the code
   * already exists.  Returns `{ id, name, code }`.
   */
  async getOrCreateDepartment(data: {
    name: string;
    nameAr?: string;
    code: string;
    description?: string;
    parentId?: string;
  }): Promise<{ id: string; name: string; code: string }> {
    const res = await this.post<any>('/api/cvision/org/departments', data);

    if (res.ok) {
      // Departments API returns { items: [{ id, name, code, ... }] }
      const d = res.data;
      const item = d?.items?.[0] ?? d?.department ?? d;
      return { id: item.id, name: item.name ?? data.name, code: item.code ?? data.code };
    }

    if (this.isDuplicateError(res)) {
      // Fast path: the API may return the existing record inline
      const d = res.data;
      if (d?.existing?.id) {
        return { id: d.existing.id, name: d.existing.name ?? data.name, code: d.existing.code ?? data.code };
      }

      // Slow path: look up existing by code — include archived departments.
      // Retry up to 3 times with backoff because the GET handler silently
      // returns { items: [] } on transient DB/pool errors and the POST
      // duplicate check proves the record DOES exist.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
        const listRes = await this.get<any>('/api/cvision/org/departments', {
          includeArchived: '1',
        });
        if (listRes.ok) {
          const list = listRes.data;
          const items: any[] = list?.items ?? list?.data ?? (Array.isArray(list) ? list : []);
          const targetCode = data.code.toLowerCase();
          const targetName = data.name.toLowerCase();
          const existing = items.find(
            (d: any) =>
              (d.code && d.code.toLowerCase() === targetCode) ||
              (d.name && d.name.toLowerCase() === targetName),
          );
          if (existing) {
            return { id: existing.id, name: existing.name, code: existing.code ?? data.code };
          }
          // If we got items but none matched, no point retrying
          if (items.length > 0) break;
          // 0 items but POST saw duplicate → transient DB issue, retry
        }
      }

      // Last resort: re-POST the same department.  If the duplicate detection
      // is working on this attempt, we'll get the `existing` record back.
      // If not, the POST succeeds idempotently (PrismaShim swallows unique
      // constraint violations and returns acknowledged: false with a 201).
      const retryRes = await this.post<any>('/api/cvision/org/departments', data);
      if (this.isDuplicateError(retryRes)) {
        const rd = retryRes.data;
        if (rd?.existing?.id) {
          return { id: rd.existing.id, name: rd.existing.name ?? data.name, code: rd.existing.code ?? data.code };
        }
      }
      if (retryRes.ok) {
        const rd = retryRes.data;
        const item = rd?.items?.[0] ?? rd?.department ?? rd;
        if (item?.id) {
          return { id: item.id, name: item.name ?? data.name, code: item.code ?? data.code };
        }
      }

      // If all lookups fail, throw a descriptive error
      throw new Error(
        `[${this.label}] Department code "${data.code}" reported as duplicate but could not be resolved after retries`,
      );
    }

    // Some other error — let assertOk throw the proper message
    return this.assertOk(res, 'create department');
  }

  async createUnit(data: { name: string; nameAr?: string; departmentId: string }) {
    const res = await this.post<any>('/api/cvision/org/units', data);
    return this.assertOk(res, 'create unit');
  }

  async createGrade(data: {
    code: string;
    name: string;
    nameAr?: string;
    level: number;
    minSalary: number;
    maxSalary: number;
    currency?: string;
  }) {
    const res = await this.post<any>('/api/cvision/grades', data);
    return this.assertOk(res, 'create grade');
  }

  /**
   * Idempotent: create grade or return the existing one.
   * Returns `{ id, code }`.
   */
  async getOrCreateGrade(data: {
    code: string;
    name: string;
    nameAr?: string;
    level: number;
    minSalary: number;
    maxSalary: number;
    currency?: string;
  }): Promise<{ id: string; code: string }> {
    const res = await this.post<any>('/api/cvision/grades', data);

    if (res.ok) {
      // Grades API returns { success: true, grade: { id, code, ... } }
      const d = res.data;
      const grade = d?.grade ?? d?.items?.[0] ?? d;
      return { id: grade.id, code: grade.code ?? data.code };
    }

    if (this.isDuplicateError(res)) {
      const listRes = await this.get<any>('/api/cvision/grades');
      const list = this.assertOk(listRes, 'list grades for fallback');
      const items: any[] = list?.data ?? list?.items ?? (Array.isArray(list) ? list : []);
      const existing = items.find((g: any) => g.code === data.code);
      if (existing) {
        return { id: existing.id, code: existing.code };
      }
      throw new Error(
        `[${this.label}] Grade code "${data.code}" reported as duplicate but not found in list`,
      );
    }

    return this.assertOk(res, 'create grade');
  }

  async createJobTitle(data: {
    code: string;
    name: string;
    nameAr?: string;
    departmentId: string;
  }) {
    const res = await this.post<any>('/api/cvision/job-titles', data);
    return this.assertOk(res, 'create job title');
  }

  /**
   * Idempotent: create job title or return existing.
   * Returns `{ id, code, departmentId? }`.
   */
  async getOrCreateJobTitle(data: {
    code: string;
    name: string;
    nameAr?: string;
    departmentId: string;
  }): Promise<{ id: string; code: string; departmentId?: string }> {
    const res = await this.post<any>('/api/cvision/job-titles', data);

    if (res.ok) {
      // Job Titles API returns { success: true, jobTitle: { id, code, ... } }
      const d = res.data;
      const jt = d?.jobTitle ?? d?.items?.[0] ?? d;
      return { id: jt.id, code: jt.code ?? data.code, departmentId: jt.departmentId ?? data.departmentId };
    }

    if (this.isDuplicateError(res)) {
      // Also handle CODE_ALREADY_EXISTS which includes the existing record details
      const d = res.data;
      if (d?.code === 'CODE_ALREADY_EXISTS' && d?.details?.existingId) {
        return {
          id: d.details.existingId,
          code: d.details.existingName ? data.code : data.code,
          departmentId: d.details.existingDepartmentId ?? data.departmentId,
        };
      }
      try {
        // List all job titles, filter by code + departmentId
        const listRes = await this.get<any>('/api/cvision/org/job-titles', {
          departmentId: data.departmentId,
        });
        if (listRes.ok) {
          const list = listRes.data;
          const items: any[] = list?.items ?? list?.data ?? (Array.isArray(list) ? list : []);
          const existing = items.find(
            (jt: any) => jt.code === data.code,
          );
          if (existing) {
            return { id: existing.id, code: existing.code, departmentId: existing.departmentId ?? data.departmentId };
          }
        }
        // Fallback: try without departmentId filter (in case the API filtering is different)
        const listAllRes = await this.get<any>('/api/cvision/job-titles');
        if (listAllRes.ok) {
          const listAll = listAllRes.data;
          const allItems: any[] = listAll?.items ?? listAll?.data ?? (Array.isArray(listAll) ? listAll : []);
          const existingGlobal = allItems.find(
            (jt: any) => jt.code === data.code && jt.departmentId === data.departmentId,
          );
          if (existingGlobal) {
            return { id: existingGlobal.id, code: existingGlobal.code, departmentId: existingGlobal.departmentId };
          }
          // Last resort: match only by code (department may be stored differently)
          const existingByCode = allItems.find(
            (jt: any) => jt.code === data.code,
          );
          if (existingByCode) {
            return { id: existingByCode.id, code: existingByCode.code, departmentId: existingByCode.departmentId ?? data.departmentId };
          }
        }
      } catch (lookupErr) {
        // Lookup failed — extract info from the duplicate error response itself
        if (d?.details?.existingDepartmentId) {
          // We know the item exists, but can't look it up. Try to use error details.
          console.warn(
            `[${this.label}] Job title "${data.code}" duplicate lookup failed, using error details`,
          );
        }
      }
      // If all lookups fail, throw a clear duplicate error instead of the raw API error
      throw new Error(
        `[${this.label}] Job title code "${data.code}" in dept "${data.departmentId}" reported as duplicate but could not be resolved from list`,
      );
    }

    return this.assertOk(res, 'create job title');
  }

  async createBudgetedPosition(data: {
    departmentId: string;
    jobTitleId: string;
    gradeId: string;
    budgetedHeadcount: number;
  }) {
    const res = await this.post<any>('/api/cvision/org/budgeted-positions', data);
    return this.assertOk(res, 'create budgeted position');
  }

  /**
   * Idempotent: create budgeted position or return existing.
   * Since budgeted positions have auto-generated positionCodes, we match
   * by (departmentId + jobTitleId) to find an existing one.
   * Returns the position data.
   */
  async getOrCreateBudgetedPosition(data: {
    departmentId: string;
    jobTitleId: string;
    gradeId: string;
    budgetedHeadcount: number;
  }): Promise<any> {
    const res = await this.post<any>('/api/cvision/org/budgeted-positions', data);

    if (res.ok) {
      // Returns { success: true, position: { ... } }
      const d = res.data;
      return d?.position ?? d?.items?.[0] ?? d;
    }

    if (this.isDuplicateError(res)) {
      // Look up existing by jobTitleId + departmentId
      const listRes = await this.get<any>('/api/cvision/org/budgeted-positions', {
        departmentId: data.departmentId,
        jobTitleId: data.jobTitleId,
      });
      const list = this.assertOk(listRes, 'list budgeted positions for fallback');
      const items: any[] = list?.items ?? list?.data ?? (Array.isArray(list) ? list : []);
      const existing = items.find(
        (p: any) =>
          p.departmentId === data.departmentId && p.jobTitleId === data.jobTitleId,
      );
      if (existing) {
        return existing;
      }
      // If none found with exact match, just return first item
      if (items.length > 0) return items[0];
      throw new Error(
        `[${this.label}] Budgeted position for job "${data.jobTitleId}" reported as duplicate but not found in list`,
      );
    }

    return this.assertOk(res, 'create budgeted position');
  }

  // ── Employee Management ──

  async createEmployee(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/employees', data);
    return this.assertOk(res, 'create employee');
  }

  async transitionEmployeeStatus(employeeId: string, data: {
    newStatus: string;
    reason?: string;
    effectiveDate?: string;
    endOfServiceAmount?: number;
  }) {
    // Map scenario-friendly field names to the API schema:
    //   API expects: { toStatus, reason, effectiveAt?, lastWorkingDay? }
    const body: Record<string, unknown> = {
      toStatus: data.newStatus,
      reason: data.reason || 'Status transition',
    };
    if (data.effectiveDate) {
      body.effectiveAt = data.effectiveDate;
    }
    if (data.endOfServiceAmount !== undefined) {
      body.endOfServiceAmount = data.endOfServiceAmount;
    }
    const res = await this.post<any>(
      `/api/cvision/employees/${employeeId}/status/transition`,
      body,
    );
    return this.assertOk(res, `transition employee ${employeeId} status`);
  }

  async getEmployeeStatusHistory(employeeId: string) {
    const res = await this.get<any>(`/api/cvision/employees/${employeeId}/status/history`);
    return this.assertOk(res, `get status history ${employeeId}`);
  }

  // ── Audit ──

  async getAuditLog(params?: Record<string, string>) {
    const res = await this.get<any>('/api/cvision/audit-log', params);
    return this.assertOk(res, 'get audit log');
  }

  // ── Training ──

  async createTrainingCourse(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/training', {
      action: 'create-course',
      ...data,
    });
    return this.assertOk(res, 'create training course');
  }

  // ── Insurance ──

  async enrollInsuranceEmployee(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/insurance', {
      action: 'enroll-employee',
      ...data,
    });
    return this.assertOk(res, 'enroll employee in insurance');
  }

  async createInsurancePolicy(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/insurance', {
      action: 'create-policy',
      ...data,
    });
    return this.assertOk(res, 'create insurance policy');
  }

  async submitInsuranceClaim(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/insurance', {
      action: 'submit-claim',
      ...data,
    });
    return this.assertOk(res, 'submit insurance claim');
  }

  async processInsuranceClaim(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/insurance', {
      action: 'process-claim',
      ...data,
    });
    return this.assertOk(res, 'process insurance claim');
  }

  // ── Performance ──

  async createReviewCycle(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/performance', {
      action: 'create-review-cycle',
      ...data,
    });
    return this.assertOk(res, 'create review cycle');
  }

  async createOKR(data: Record<string, unknown>) {
    // OKRs API expects action: 'create' in the body
    const res = await this.post<any>('/api/cvision/okrs', {
      action: 'create',
      ...data,
    });
    return this.assertOk(res, 'create OKR');
  }

  // ── Scheduling ──

  async createShift(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/scheduling', {
      action: 'create-template',
      ...data,
    });
    return this.assertOk(res, 'create shift');
  }

  async assignShift(data: Record<string, unknown>) {
    const res = await this.post<any>('/api/cvision/scheduling', {
      action: 'assign-shift',
      ...data,
    });
    return this.assertOk(res, 'assign shift');
  }
}
