import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  LOAN_POLICIES, LOAN_TYPE_LABELS,
  checkEligibility, createLoanRequest, approveLoan, rejectLoan,
  disburseLoan, recordPayment, earlySettle, rescheduleLoan, getLoanSummary,
  type LoanType,
} from '@/lib/cvision/loans/loans-engine';
import { onRequestApproved, onRequestRejected } from '@/lib/cvision/lifecycle';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ── Old ↔ New status mapping ─────────────────────────────────────── */
const STATUS_MAP_OLD_TO_NEW: Record<string, string> = {
  pending: 'PENDING',
  active: 'ACTIVE',
  paid_off: 'PAID_OFF',
  cancelled: 'CANCELLED',
};

/**
 * Normalize a loan document so old payroll-format records
 * look identical to new loans-engine records for the frontend.
 */
function normalizeLoan(raw: any): any {
  // Already new format — has loanId or requestedAmount
  if (raw.loanId && raw.requestedAmount != null) return raw;

  const isOldFormat = raw.principal != null || STATUS_MAP_OLD_TO_NEW[raw.status];

  if (!isOldFormat) return raw;

  const principal = raw.principal ?? raw.requestedAmount ?? 0;
  const remaining = raw.remaining ?? raw.remainingBalance ?? principal;
  const monthly   = raw.monthlyDeduction ?? raw.installmentAmount ?? 0;
  const totalPaid = principal - remaining;
  const installments = monthly > 0 ? Math.ceil(principal / monthly) : 0;
  const paidInstallments = monthly > 0 ? Math.floor(totalPaid / monthly) : 0;
  const progress = principal > 0 ? Math.round((totalPaid / principal) * 100) : 0;

  return {
    ...raw,
    // Canonical IDs
    loanId: raw.loanId || raw.loanNumber || raw.id,
    // Amounts
    requestedAmount: principal,
    approvedAmount: principal,
    remainingBalance: remaining,
    installmentAmount: monthly,
    totalPaid,
    totalRepayment: principal,
    // Schedule info
    installments,
    installmentSchedule: raw.installmentSchedule || [],
    // Progress
    progress,
    paidCount: paidInstallments,
    overdueCount: 0,
    // Status mapped to uppercase
    status: STATUS_MAP_OLD_TO_NEW[raw.status] || raw.status,
    // Type fallback
    type: raw.type || 'SALARY_ADVANCE',
    // Dates
    requestDate: raw.requestDate || raw.createdAt,
    // Name
    employeeName: raw.employeeName || 'Employee',
    // Reason
    reason: raw.reason || raw.notes || '',
  };
}

function normalizeLoans(loans: any[]): any[] {
  return loans.map(normalizeLoan);
}

/**
 * Enrich loans that are missing employeeName by looking up employees.
 */
async function enrichEmployeeNames(db: any, tenantId: string, loans: any[]): Promise<any[]> {
  const needsEnrichment = loans.filter(l => !l.employeeName || l.employeeName === 'Employee');
  if (needsEnrichment.length === 0) return loans;

  const empIds = [...new Set(needsEnrichment.map(l => l.employeeId).filter(Boolean))];
  if (empIds.length === 0) return loans;

  const empColl = db.collection('cvision_employees');
  const employees = await empColl.find({
    tenantId,
    $or: [{ id: { $in: empIds } }, { employeeId: { $in: empIds } }],
    deletedAt: null,
  }).toArray();

  const empMap = new Map<string, string>();
  for (const emp of employees) {
    const name = emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee';
    if (emp.id) empMap.set(emp.id, name);
    if (emp.employeeId) empMap.set(emp.employeeId, name);
  }

  return loans.map(l => {
    if (l.employeeName && l.employeeName !== 'Employee') return l;
    return { ...l, employeeName: empMap.get(l.employeeId) || l.employeeName || 'Employee' };
  });
}

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || '';
      const db = await getCVisionDb(tenantId);

      /* ── List loans (filterable) ──────────────────────────────── */
      if (action === 'list') {
        const filter: any = { tenantId };
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const employeeId = searchParams.get('employeeId');
        if (status && status !== 'ALL') filter.status = status;
        if (type && type !== 'ALL') filter.type = type;
        if (employeeId) filter.employeeId = employeeId;

        const loans = await db.collection('cvision_loans')
          .find(filter).sort({ createdAt: -1 }).limit(200).toArray();
        const normalized = await enrichEmployeeNames(db, tenantId, normalizeLoans(loans));
        return NextResponse.json({ success: true, loans: normalized, total: normalized.length });
      }

      /* ── Single loan detail ───────────────────────────────────── */
      if (action === 'detail') {
        const loanId = searchParams.get('loanId');
        if (!loanId) return NextResponse.json({ success: false, error: 'Missing loanId' }, { status: 400 });
        const loan = await db.collection('cvision_loans').findOne({
          tenantId, $or: [{ loanId }, { loanNumber: loanId }, { id: loanId }],
        });
        if (!loan) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true, loan: normalizeLoan(loan) });
      }

      /* ── All loans for one employee ───────────────────────────── */
      if (action === 'employee') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const loans = await db.collection('cvision_loans')
          .find({ tenantId, employeeId }).sort({ createdAt: -1 }).limit(100).toArray();
        const normalizedEmp = await enrichEmployeeNames(db, tenantId, normalizeLoans(loans));
        return NextResponse.json({ success: true, loans: normalizedEmp });
      }

      /* ── Pending approval ─────────────────────────────────────── */
      if (action === 'pending') {
        const loans = await db.collection('cvision_loans').find({
          tenantId,
          status: 'PENDING',
        }).sort({ createdAt: 1 }).limit(200).toArray();
        const normalizedPending = await enrichEmployeeNames(db, tenantId, normalizeLoans(loans));
        return NextResponse.json({ success: true, loans: normalizedPending, total: normalizedPending.length });
      }

      /* ── Active / repaying ────────────────────────────────────── */
      if (action === 'active') {
        const loans = await db.collection('cvision_loans').find({
          tenantId,
          status: 'ACTIVE',
        }).sort({ createdAt: -1 }).limit(200).toArray();

        const now = new Date();
        const normalizedActive = await enrichEmployeeNames(db, tenantId, normalizeLoans(loans));
        const enriched = normalizedActive.map((loan: any) => {
          const schedule = loan.installmentSchedule || [];
          const paidCount = schedule.filter((i: any) => i.status === 'PAID').length;
          const overdueCount = schedule.filter(
            (i: any) => i.status === 'PENDING' && new Date(i.dueDate) < now,
          ).length;
          const progress = schedule.length > 0
            ? Math.round((paidCount / schedule.length) * 100)
            : loan.progress || 0;
          return { ...loan, paidCount, overdueCount, progress };
        });

        return NextResponse.json({ success: true, loans: enriched, total: enriched.length });
      }

      /* ── Dashboard summary ────────────────────────────────────── */
      if (action === 'summary') {
        const summary = await getLoanSummary(db, tenantId);
        return NextResponse.json({ success: true, summary });
      }

      /* ── Loan policy rules ────────────────────────────────────── */
      if (action === 'policy') {
        const policies = Object.entries(LOAN_POLICIES).map(([type, policy]) => ({
          type,
          label: LOAN_TYPE_LABELS[type as LoanType],
          ...policy,
        }));
        return NextResponse.json({ success: true, policies });
      }

      /* ── Eligibility check ────────────────────────────────────── */
      if (action === 'eligibility') {
        const employeeId = searchParams.get('employeeId');
        const type = searchParams.get('type') as LoanType;
        if (!employeeId || !type) return NextResponse.json({ success: false, error: 'Missing employeeId or type' }, { status: 400 });
        const result = await checkEligibility(db, tenantId, employeeId, type);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (err: any) {
      logger.error('[loans GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.loans.read' },
);

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { action } = body;
      const db = await getCVisionDb(tenantId);

      /* ── Request a new loan ───────────────────────────────────── */
      if (action === 'request') {
        const { employeeId, type, requestedAmount, installments, reason, guarantorEmployeeId } = body;
        if (!employeeId || !type || !requestedAmount || !installments) {
          return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const result = await createLoanRequest(db, tenantId, {
          employeeId, type, requestedAmount: parseFloat(requestedAmount),
          installments: parseInt(installments), reason: reason || '',
          guarantorEmployeeId, createdBy: userId,
        });

        if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        return NextResponse.json({ success: true, loanId: result.loanId });
      }

      /* ── Approve ──────────────────────────────────────────────── */
      if (action === 'approve') {
        const { loanId, step, notes } = body;
        if (!loanId || !step) return NextResponse.json({ success: false, error: 'Missing loanId or step' }, { status: 400 });

        const user = await db.collection('cvision_employees').findOne({
          tenantId, id: userId,
        }) || await db.collection('cvision_employees').findOne({
          tenantId, userId: userId,
        });

        const result = await approveLoan(db, tenantId, loanId, {
          step,
          approverId: userId,
          approverName: user?.fullName || user?.name || userId,
          notes,
        });

        if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

        // Lifecycle: dispatch event, notifications
        onRequestApproved(db, tenantId, 'loan', loanId, userId, { employeeId: body.employeeId })
          .catch(err => logger.error('[Lifecycle] loan onRequestApproved failed:', err));

        return NextResponse.json({ success: true, newStatus: result.newStatus });
      }

      /* ── Reject ───────────────────────────────────────────────── */
      if (action === 'reject') {
        const { loanId, step, notes } = body;
        if (!loanId || !step || !notes) return NextResponse.json({ success: false, error: 'Missing fields (notes required)' }, { status: 400 });

        const user = await db.collection('cvision_employees').findOne({
          tenantId, id: userId,
        }) || await db.collection('cvision_employees').findOne({
          tenantId, userId: userId,
        });

        const result = await rejectLoan(db, tenantId, loanId, {
          step,
          approverId: userId,
          approverName: user?.fullName || user?.name || userId,
          notes,
        });

        if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

        // Lifecycle: dispatch event, notifications
        onRequestRejected(db, tenantId, 'loan', loanId, userId, notes)
          .catch(err => logger.error('[Lifecycle] loan onRequestRejected failed:', err));

        return NextResponse.json({ success: true });
      }

      /* ── Disburse ─────────────────────────────────────────────── */
      if (action === 'disburse') {
        const { loanId } = body;
        if (!loanId) return NextResponse.json({ success: false, error: 'Missing loanId' }, { status: 400 });
        const result = await disburseLoan(db, tenantId, loanId);
        if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      /* ── Record manual payment ────────────────────────────────── */
      if (action === 'record-payment') {
        const { loanId, installmentNumber, amount } = body;
        if (!loanId || !installmentNumber || !amount) {
          return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        }
        const result = await recordPayment(db, tenantId, loanId, parseInt(installmentNumber), parseFloat(amount));
        if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        return NextResponse.json({ success: true, loanCompleted: result.loanCompleted });
      }

      /* ── Payroll deduction (called by payroll system) ──────────── */
      if (action === 'payroll-deduct') {
        const { payrollMonth } = body;
        if (!payrollMonth) return NextResponse.json({ success: false, error: 'Missing payrollMonth' }, { status: 400 });

        const loans = await db.collection('cvision_loans').find({
          tenantId, status: 'ACTIVE',
        }).toArray();

        let totalDeducted = 0;
        let loansProcessed = 0;

        for (const loan of loans) {
          const installment = ((loan as Record<string, unknown>).installmentSchedule as Array<Record<string, unknown>> || []).find(
            (i: Record<string, unknown>) => i.payrollMonth === payrollMonth && i.status === 'PENDING',
          );
          if (installment) {
            await recordPayment(
              db, tenantId, (loan as Record<string, unknown>).loanId as string,
              installment.installmentNumber as number, installment.amount as number, payrollMonth,
            );
            totalDeducted += installment.amount as number;
            loansProcessed++;
          }
        }

        return NextResponse.json({ success: true, totalDeducted, loansProcessed });
      }

      /* ── Early settlement ─────────────────────────────────────── */
      if (action === 'early-settle') {
        const { loanId } = body;
        if (!loanId) return NextResponse.json({ success: false, error: 'Missing loanId' }, { status: 400 });
        const result = await earlySettle(db, tenantId, loanId);
        if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        return NextResponse.json({ success: true, settledAmount: result.settledAmount });
      }

      /* ── Reschedule installments ──────────────────────────────── */
      if (action === 'reschedule') {
        const { loanId, newInstallments } = body;
        if (!loanId || !newInstallments) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        const result = await rescheduleLoan(db, tenantId, loanId, parseInt(newInstallments));
        if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      /* ── Update loan policy settings ──────────────────────────── */
      if (action === 'update-policy') {
        const { type, settings } = body;
        if (!type || !settings) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        await db.collection('cvision_loan_policies').updateOne(
          { tenantId, type },
          { $set: { ...settings, tenantId, type, updatedAt: new Date(), updatedBy: userId } },
          { upsert: true },
        );
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (err: any) {
      logger.error('[loans POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.loans.write' },
);
