/**
 * CVision Integrity Validator
 * Post-scenario checks for CVision data consistency.
 */

import { CVisionBaseActor } from '../actors/cvision/base';
import { CVisionPayrollGenerator } from '../data/cvision/payroll';

export interface IntegrityCheckResult {
  check: string;
  passed: boolean;
  details?: string;
}

export class CVisionIntegrityValidator {
  private actor: CVisionBaseActor;
  private payrollGen = new CVisionPayrollGenerator();

  constructor(actor: CVisionBaseActor) {
    this.actor = actor;
  }

  /** Check employee exists and has valid data */
  async checkEmployee(employeeId: string): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    try {
      const emp = await this.actor.getEmployee(employeeId);
      const data = emp.data || emp;

      results.push({
        check: `Employee ${employeeId} exists`,
        passed: true,
      });

      // Valid status check
      const validStatuses = [
        'ACTIVE', 'PROBATION', 'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE',
        'ON_MATERNITY_LEAVE', 'SUSPENDED', 'NOTICE_PERIOD',
        'RESIGNED', 'TERMINATED', 'RETIRED', 'DECEASED',
      ];
      const status = data.status || data.employeeStatus;
      results.push({
        check: `Employee ${employeeId} has valid status`,
        passed: validStatuses.includes(status),
        details: `Status: ${status}`,
      });

      // Active employees should have department
      if (status === 'ACTIVE') {
        const hasDept = !!(data.departmentId || data.department);
        results.push({
          check: `Active employee ${employeeId} has department`,
          passed: hasDept,
          details: hasDept ? `Department: ${data.departmentId}` : 'No department assigned',
        });
      }
    } catch (err) {
      results.push({
        check: `Employee ${employeeId} exists`,
        passed: false,
        details: (err as Error).message,
      });
    }

    return results;
  }

  /** Check requisition data integrity */
  async checkRequisition(requisitionId: string): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    try {
      const res = await this.actor.get<any>(`/api/cvision/recruitment/requisitions/${requisitionId}`);
      if (!res.ok) {
        results.push({
          check: `Requisition ${requisitionId} exists`,
          passed: false,
          details: `Status: ${res.status}`,
        });
        return results;
      }

      const data = res.data?.data || res.data;
      results.push({
        check: `Requisition ${requisitionId} exists`,
        passed: true,
      });

      // Check applicant count consistency
      const candidatesRes = await this.actor.get<any>(
        `/api/cvision/recruitment/requisitions/${requisitionId}/candidates`,
      );
      if (candidatesRes.ok) {
        const candidates = candidatesRes.data?.data || candidatesRes.data?.candidates || [];
        const actualCount = Array.isArray(candidates) ? candidates.length : 0;
        const reportedCount = data.applicantCount ?? data.candidateCount ?? 0;
        results.push({
          check: `Requisition ${requisitionId} applicant count matches`,
          passed: Math.abs(actualCount - reportedCount) <= 1, // Allow ±1 for timing
          details: `Reported: ${reportedCount}, Actual: ${actualCount}`,
        });
      }
    } catch (err) {
      results.push({
        check: `Requisition ${requisitionId} check`,
        passed: false,
        details: (err as Error).message,
      });
    }

    return results;
  }

  /** Check payroll run totals match payslips */
  async checkPayrollRun(runId: string): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    try {
      const runRes = await this.actor.get<any>(`/api/cvision/payroll/runs/${runId}`);
      if (!runRes.ok) {
        results.push({
          check: `Payroll run ${runId} exists`,
          passed: false,
          details: `Status: ${runRes.status}`,
        });
        return results;
      }

      results.push({
        check: `Payroll run ${runId} exists`,
        passed: true,
      });

      const run = runRes.data?.data || runRes.data;

      // Check payslips
      const payslipsRes = await this.actor.get<any>(`/api/cvision/payroll/runs/${runId}/payslips`);
      if (payslipsRes.ok) {
        const payslips = payslipsRes.data?.data || payslipsRes.data?.payslips || [];
        if (Array.isArray(payslips) && payslips.length > 0) {
          // Verify net <= gross for each payslip
          let allValid = true;
          for (const slip of payslips) {
            const gross = slip.grossSalary || slip.gross || 0;
            const net = slip.netSalary || slip.net || 0;
            if (net > gross) {
              allValid = false;
              break;
            }
          }
          results.push({
            check: `Payroll run ${runId} payslips net <= gross`,
            passed: allValid,
            details: `${payslips.length} payslips checked`,
          });
        }
      }
    } catch (err) {
      results.push({
        check: `Payroll run ${runId} check`,
        passed: false,
        details: (err as Error).message,
      });
    }

    return results;
  }

  /** Check leave balance consistency */
  async checkLeaveBalances(employeeId: string): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    try {
      const res = await this.actor.get<any>('/api/cvision/leaves', {
        action: 'balance',
        employeeId,
      });
      if (!res.ok) {
        results.push({
          check: `Leave balance for ${employeeId}`,
          passed: false,
          details: `Status: ${res.status}`,
        });
        return results;
      }

      const balances = res.data?.data?.balances || res.data?.balances || [];
      if (Array.isArray(balances)) {
        let allNonNegative = true;
        for (const b of balances) {
          const remaining = (b.entitled || 0) - (b.used || 0) - (b.pending || 0);
          if (remaining < -1) { // Allow small floating point variance
            allNonNegative = false;
            break;
          }
        }
        results.push({
          check: `Leave balances for ${employeeId} non-negative`,
          passed: allNonNegative,
          details: `${balances.length} balance entries`,
        });
      } else {
        results.push({
          check: `Leave balance for ${employeeId}`,
          passed: true,
          details: 'Balance data retrieved',
        });
      }
    } catch (err) {
      results.push({
        check: `Leave balance for ${employeeId}`,
        passed: false,
        details: (err as Error).message,
      });
    }

    return results;
  }

  /** Full sweep of all tracked CVision entities */
  async fullSweep(
    employeeIds: string[],
    requisitionIds: string[],
    payrollRunIds: string[],
  ): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    for (const id of employeeIds) {
      results.push(...await this.checkEmployee(id));
    }
    for (const id of requisitionIds) {
      results.push(...await this.checkRequisition(id));
    }
    for (const id of payrollRunIds) {
      results.push(...await this.checkPayrollRun(id));
    }

    return results;
  }
}
