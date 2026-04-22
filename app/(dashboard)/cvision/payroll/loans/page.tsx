'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import {
  DollarSign, Users, Clock, AlertTriangle, CheckCircle, XCircle,
  Plus, Search, Eye, RefreshCcw, TrendingUp, TrendingDown,
  Banknote, CalendarDays, Check, X, Send, CreditCard,
  ArrowUpRight, Settings2, ShieldCheck, Home, Car,
} from 'lucide-react';
import { toast } from 'sonner';

const API = '/api/cvision/loans';

function fmtSAR(n: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: any) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_VARIANTS: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  PENDING: 'secondary', MANAGER_APPROVED: 'secondary', HR_APPROVED: 'secondary',
  FINANCE_APPROVED: 'outline', DISBURSED: 'outline',
  REPAYING: 'default', COMPLETED: 'default',
  REJECTED: 'destructive', DEFAULTED: 'destructive',
  PAID: 'default', OVERDUE: 'destructive', PARTIALLY_PAID: 'outline',
};
const TYPE_LABELS_AR: Record<string, string> = {
  SALARY_ADVANCE: 'سلفة راتب', PERSONAL_LOAN: 'قرض شخصي',
  HOUSING_LOAN: 'قرض سكن', EMERGENCY_LOAN: 'قرض طوارئ', CAR_LOAN: 'قرض سيارة',
};
const TYPE_LABELS_EN: Record<string, string> = {
  SALARY_ADVANCE: 'Salary Advance', PERSONAL_LOAN: 'Personal Loan',
  HOUSING_LOAN: 'Housing Loan', EMERGENCY_LOAN: 'Emergency Loan', CAR_LOAN: 'Car Loan',
};
function getTypeLabels(tr: (ar: string, en: string) => string): Record<string, string> {
  return {
    SALARY_ADVANCE: tr('سلفة راتب', 'Salary Advance'), PERSONAL_LOAN: tr('قرض شخصي', 'Personal Loan'),
    HOUSING_LOAN: tr('قرض سكن', 'Housing Loan'), EMERGENCY_LOAN: tr('قرض طوارئ', 'Emergency Loan'), CAR_LOAN: tr('قرض سيارة', 'Car Loan'),
  };
}
const TYPE_ICONS: Record<string, typeof DollarSign> = {
  SALARY_ADVANCE: Banknote, PERSONAL_LOAN: CreditCard, HOUSING_LOAN: Home, EMERGENCY_LOAN: AlertTriangle, CAR_LOAN: Car,
};

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════
function DashboardTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { data: summaryRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.payroll.loans.list({ action: 'summary' }),
    queryFn: () => cvisionFetch(API, { params: { action: 'summary' } }),
  });
  const summary = summaryRaw?.summary ?? null;

  if (loading) return <div style={{ display: 'grid', gap: 16 }}>{[...Array(8)].map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 96 }}  />)}</div>;
  if (!summary) return <p style={{ color: C.textMuted, textAlign: 'center', paddingTop: 48, paddingBottom: 48 }}>{tr('لا توجد بيانات', 'No data available')}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <DollarSign style={{ height: 32, width: 32, color: C.blue }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtSAR(summary.totalOutstanding)}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي المستحق', 'Total Outstanding')}</div>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <TrendingUp style={{ height: 32, width: 32, color: C.green }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.activeLoans}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{tr('القروض النشطة', 'Active Loans')}</div>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Clock style={{ height: 32, width: 32, color: C.orange }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.orange }}>{summary.pendingRequests}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{tr('طلبات معلقة', 'Pending Requests')}</div>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertTriangle style={{ height: 32, width: 32, color: C.red }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{summary.overdueCount}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{tr('أقساط متأخرة', 'Overdue Installments')}</div>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Banknote style={{ height: 32, width: 32, color: C.purple }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtSAR(summary.thisMonthDeductions)}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{tr('خصومات هذا الشهر', "This Month's Deductions")}</div>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي المصروف', 'Total Disbursed')}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtSAR(summary.totalDisbursed)}</div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي المسدد', 'Total Repaid')}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{fmtSAR(summary.totalPaid)}</div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ fontSize: 13, color: C.textMuted }}>{tr('قروض مكتملة', 'Completed Loans')}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.completedLoans}</div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {summary.overdueCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, background: C.redDim, border: `1px solid ${C.border}`, color: C.red }}>
          <AlertTriangle style={{ height: 20, width: 20, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {summary.overdueCount} {tr('قسط متأخر بإجمالي', `overdue installment${summary.overdueCount > 1 ? 's' : ''} totaling`)} {fmtSAR(summary.overdueAmount)}
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// REQUESTS TAB (Pending approvals)
// ═══════════════════════════════════════════════════════════════════════
function RequestsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const typeLabel = (t: string) => (language === 'ar' ? TYPE_LABELS_AR : TYPE_LABELS_EN)[t] || t;
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoan, setDetailLoan] = useState<any>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveLoanData, setApproveLoanData] = useState<any>(null);
  const [approveStep, setApproveStep] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectLoanData, setRejectLoanData] = useState<any>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}?action=pending`, { credentials: 'include', signal });
      const d = await r.json();
      if (d.success) setLoans(d.loans || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const getNextStep = (loan: any): string => {
    const approvedSteps = new Set((loan.approvals || []).filter((a: any) => a.decision === 'APPROVED').map((a: any) => a.step));
    const chain: string[] = loan.type === 'EMERGENCY_LOAN' ? ['HR'] :
      loan.type === 'SALARY_ADVANCE' ? ['MANAGER', 'HR'] : ['MANAGER', 'HR', 'FINANCE'];
    for (const step of chain) {
      if (!approvedSteps.has(step)) return step;
    }
    return '';
  };

  const handleApprove = async () => {
    if (!approveLoanData) return;
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', loanId: approveLoanData.loanId, step: approveStep, notes: approveNotes }),
      });
      const d = await r.json();
      if (d.success) { toast.success(tr(`تم اعتماد القرض (${d.newStatus})`, `Loan approved (${d.newStatus})`)); setApproveOpen(false); load(); }
      else toast.error(d.error || 'Failed');
    } catch { toast.error(tr('خطأ', 'Error')); }
  };

  const handleReject = async () => {
    if (!rejectLoanData || !rejectNotes) { toast.error(tr('سبب الرفض مطلوب', 'Rejection reason required')); return; }
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject', loanId: rejectLoanData.loanId,
          step: getNextStep(rejectLoanData), notes: rejectNotes,
        }),
      });
      const d = await r.json();
      if (d.success) { toast.success(tr('تم رفض القرض', 'Loan rejected')); setRejectOpen(false); load(); }
      else toast.error(d.error || 'Failed');
    } catch { toast.error(tr('خطأ', 'Error')); }
  };

  const handleDisburse = async (loanId: string) => {
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disburse', loanId }),
      });
      const d = await r.json();
      if (d.success) { toast.success(tr('تم صرف القرض', 'Loan disbursed')); load(); }
      else toast.error(d.error || 'Failed');
    } catch { toast.error(tr('خطأ', 'Error')); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontWeight: 600 }}>{tr('طلبات القروض المعلقة', 'Pending Loan Requests')} ({loans.length})</h3>
        <CVisionButton C={C} isDark={isDark} onClick={() => setNewOpen(true)}>
          <Plus style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('طلب قرض جديد', 'New Loan Request')}
        </CVisionButton>
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /> : loans.length === 0 ? (
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: C.textMuted }}>{tr('لا توجد طلبات معلقة', 'No pending requests')}</CVisionCardBody></CVisionCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loans.map(loan => {
            const nextStep = getNextStep(loan);
            return (
              <CVisionCard C={C} key={loan.loanId}>
                <CVisionCardBody style={{ paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-muted">
                        {(() => { const LIcon = TYPE_ICONS[loan.type] || Banknote; return <LIcon className="h-5 w-5" />; })()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{loan.employeeName}</span>
                          <span style={{ fontSize: 12, color: C.textMuted, fontFamily: 'monospace' }}>{loan.loanId}</span>
                        </div>
                        <div style={{ fontSize: 13, color: C.textMuted }}>
                          {getTypeLabels(tr)[loan.type] || loan.type} · {loan.installments} {tr('قسط', 'installments')}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>{loan.reason}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <CVisionBadge C={C} variant={STATUS_VARIANTS[loan.status] || 'secondary'}>{loan.status}</CVisionBadge>
                          {nextStep && (
                            <span style={{ fontSize: 12, color: C.orange, fontWeight: 500 }}>
                              {tr(`بانتظار اعتماد ${nextStep}`, `Awaiting ${nextStep} approval`)}
                            </span>
                          )}
                        </div>
                        {/* Approval chain progress */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                          {(loan.type === 'EMERGENCY_LOAN' ? ['HR'] :
                            loan.type === 'SALARY_ADVANCE' ? ['MANAGER', 'HR'] :
                            ['MANAGER', 'HR', 'FINANCE']).map((step: string) => {
                            const approval = (loan.approvals || []).find((a: any) => a.step === step);
                            return (
                              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                  approval?.decision === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                  approval?.decision === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {approval?.decision === 'APPROVED' ? <Check style={{ height: 12, width: 12 }} /> :
                                   approval?.decision === 'REJECTED' ? <X style={{ height: 12, width: 12 }} /> :
                                   step[0]}
                                </div>
                                <span style={{ fontSize: 12, color: C.textMuted }}>{step}</span>
                                {step !== 'FINANCE' && <ArrowUpRight style={{ height: 12, width: 12 }} />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtSAR(loan.requestedAmount)}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>
                        {fmtSAR(loan.installmentAmount)}/month × {loan.installments}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{fmtDate(loan.requestDate)}</div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => { setDetailLoan(loan); setDetailOpen(true); }}>
                          <Eye style={{ height: 14, width: 14 }} />
                        </CVisionButton>
                        {nextStep && (
                          <>
                            <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => {
                              setApproveLoanData(loan); setApproveStep(nextStep); setApproveNotes(''); setApproveOpen(true);
                            }}>
                              <Check style={{ height: 14, width: 14, marginRight: 4 }} /> {tr('اعتماد', 'Approve')}
                            </CVisionButton>
                            <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" onClick={() => {
                              setRejectLoanData(loan); setRejectNotes(''); setRejectOpen(true);
                            }}>
                              <X style={{ height: 14, width: 14, marginRight: 4 }} /> {tr('رفض', 'Reject')}
                            </CVisionButton>
                          </>
                        )}
                        {loan.status === 'FINANCE_APPROVED' && (
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => handleDisburse(loan.loanId)}>
                            <Banknote style={{ height: 14, width: 14, marginRight: 4 }} /> {tr('صرف', 'Disburse')}
                          </CVisionButton>
                        )}
                      </div>
                    </div>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      {/* Approve Dialog */}
      <CVisionDialog C={C} open={approveOpen} onClose={() => setApproveOpen(false)} title={tr('اعتماد', 'Approve')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {approveLoanData?.employeeName} · {getTypeLabels(tr)[approveLoanData?.type]} · {fmtSAR(approveLoanData?.requestedAmount || 0)}
            </p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: C.bgSubtle, padding: 12, borderRadius: 12, fontSize: 13 }}>
              <div>{tr('خطوة الاعتماد', 'Approval Step')}: <strong>{approveStep}</strong></div>
              <div>{tr('السبب', 'Reason')}: {approveLoanData?.reason}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('ملاحظات (اختياري)', 'Notes (optional)')}</label>
              <CVisionTextarea C={C} value={approveNotes} onChange={e => setApproveNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setApproveOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleApprove}><Check style={{ height: 16, width: 16, marginRight: 4 }} /> {tr(`اعتماد كـ ${approveStep}`, `Approve as ${approveStep}`)}</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Reject Dialog */}
      <CVisionDialog C={C} open={rejectOpen} onClose={() => setRejectOpen(false)} title={tr('رفض', 'Reject')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('مراجعة ورفض طلب القرض.', 'Review and reject this loan request.')}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: C.bgSubtle, padding: 12, borderRadius: 12, fontSize: 13 }}>
              {rejectLoanData?.employeeName} · {getTypeLabels(tr)[rejectLoanData?.type]} · {fmtSAR(rejectLoanData?.requestedAmount || 0)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('سبب الرفض *', 'Rejection Reason *')}</label>
              <CVisionTextarea C={C} value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} rows={3} placeholder={tr('اشرح سبب رفض هذا القرض...', 'Explain why this loan is being rejected...')} />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setRejectOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="danger" onClick={handleReject} disabled={!rejectNotes}>
              <X style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('رفض', 'Reject')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Detail Dialog */}
      <LoanDetailDialog open={detailOpen} onOpenChange={setDetailOpen} loan={detailLoan} onAction={load} />

      {/* New Request Dialog */}
      <NewLoanDialog open={newOpen} onOpenChange={setNewOpen} onSuccess={load} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ACTIVE LOANS TAB
// ═══════════════════════════════════════════════════════════════════════
function ActiveLoansTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const typeLabel = (t: string) => (language === 'ar' ? TYPE_LABELS_AR : TYPE_LABELS_EN)[t] || t;
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoan, setDetailLoan] = useState<any>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}?action=active`, { credentials: 'include', signal });
      const d = await r.json();
      if (d.success) setLoans(d.loans || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const filtered = loans.filter(l => {
    if (typeFilter && l.type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (l.employeeName || '').toLowerCase().includes(s) || (l.loanId || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C} style={{ paddingLeft: 32, width: 224 }} placeholder={tr('بحث القروض...', 'Search loans...')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <CVisionSelect
                C={C}
                value={typeFilter || 'ALL'}
                placeholder={tr('جميع الأنواع', 'All Types')}
                options={[
                  { value: 'ALL', label: tr('كل الأنواع', 'All Types') },
                  ...Object.entries(getTypeLabels(tr)).map(([k, v]) => ({ value: k, label: v })),
                ]}
                style={{ width: 176 }}
              />
        </div>
        <CVisionBadge C={C} variant="outline">{filtered.length} {tr('قرض نشط', 'active loans')}</CVisionBadge>
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /> : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('رقم القرض', 'Loan ID')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                  <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المبلغ', 'Amount')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المتبقي', 'Remaining')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('الشهري', 'Monthly')}</CVisionTh>
                  <CVisionTh C={C}>{tr('التقدم', 'Progress')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C}></CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {filtered.map(loan => (
                  <CVisionTr C={C} key={loan.loanId} style={{ cursor: 'pointer' }} onClick={() => { setDetailLoan(loan); setDetailOpen(true); }}>
                    <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{loan.loanId}</CVisionTd>
                    <CVisionTd style={{ fontWeight: 500 }}>{loan.employeeName}</CVisionTd>
                    <CVisionTd>
                      <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {(() => { const TIc = TYPE_ICONS[loan.type] || Banknote; return <TIc className="h-3.5 w-3.5" />; })()}
                        {getTypeLabels(tr)[loan.type]}
                      </span>
                    </CVisionTd>
                    <CVisionTd align="right">{fmtSAR(loan.approvedAmount || loan.requestedAmount)}</CVisionTd>
                    <CVisionTd align="right" style={{ fontWeight: 500 }}>{fmtSAR(loan.remainingBalance)}</CVisionTd>
                    <CVisionTd align="right">{fmtSAR(loan.installmentAmount)}</CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden', width: 80 }}>
                          <div
                            className={`h-full rounded-full ${loan.overdueCount > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${loan.progress || 0}%` }}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: C.textMuted, width: 32 }}>{loan.progress || 0}%</span>
                      </div>
                      {loan.overdueCount > 0 && (
                        <span style={{ fontSize: 12, color: C.red }}>{loan.overdueCount} {tr('متأخر', 'overdue')}</span>
                      )}
                    </CVisionTd>
                    <CVisionTd>
                      <CVisionBadge C={C} variant={STATUS_VARIANTS[loan.status] || 'secondary'}>{loan.status}</CVisionBadge>
                    </CVisionTd>
                    <CVisionTd onClick={e => e.stopPropagation()}>
                      <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => { setDetailLoan(loan); setDetailOpen(true); }}>
                        <Eye style={{ height: 16, width: 16 }} />
                      </CVisionButton>
                    </CVisionTd>
                  </CVisionTr>
                ))}
                {filtered.length === 0 && (
                  <CVisionTr C={C}><CVisionTd align="center" colSpan={9} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد قروض نشطة.', 'No active loans found.')}</CVisionTd></CVisionTr>
                )}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <LoanDetailDialog open={detailOpen} onOpenChange={setDetailOpen} loan={detailLoan} onAction={load} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HISTORY TAB
// ═══════════════════════════════════════════════════════════════════════
function HistoryTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const typeLabel = (t: string) => (language === 'ar' ? TYPE_LABELS_AR : TYPE_LABELS_EN)[t] || t;
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoan, setDetailLoan] = useState<any>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      let url = `${API}?action=list`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (typeFilter) url += `&type=${typeFilter}`;
      const r = await fetch(url, { credentials: 'include', signal });
      const d = await r.json();
      if (d.success) setLoans(d.loans || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const filtered = loans.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (l.employeeName || '').toLowerCase().includes(s) || (l.loanId || '').toLowerCase().includes(s);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C} style={{ paddingLeft: 32, width: 224 }} placeholder={tr('بحث...', 'Search...')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <CVisionSelect
                C={C}
                value={statusFilter || 'ALL'}
                placeholder={tr('جميع الحالات', 'All Statuses')}
                options={[
                  { value: 'ALL', label: tr('كل الحالات', 'All Statuses') },
                  { value: 'PENDING', label: tr('معلق', 'Pending') },
                  { value: 'REPAYING', label: tr('قيد السداد', 'Repaying') },
                  { value: 'COMPLETED', label: tr('مكتمل', 'Completed') },
                  { value: 'REJECTED', label: tr('مرفوض', 'Rejected') },
                  { value: 'DEFAULTED', label: tr('متعثر', 'Defaulted') },
                ]}
                style={{ width: 176 }}
              />
          <CVisionSelect
                C={C}
                value={typeFilter || 'ALL'}
                placeholder={tr('جميع الأنواع', 'All Types')}
                options={[
                  { value: 'ALL', label: tr('كل الأنواع', 'All Types') },
                  ...Object.entries(getTypeLabels(tr)).map(([k, v]) => ({ value: k, label: v })),
                ]}
                style={{ width: 176 }}
              />
        </div>
        <CVisionBadge C={C} variant="outline">{filtered.length} {tr('قرض', 'loans')}</CVisionBadge>
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /> : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('رقم القرض', 'Loan ID')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                  <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المبلغ', 'Amount')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المدفوع', 'Paid')}</CVisionTh>
                  <CVisionTh C={C}>{tr('تاريخ الطلب', 'Requested')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C}></CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {filtered.map(loan => (
                  <CVisionTr C={C} key={loan.loanId}>
                    <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{loan.loanId}</CVisionTd>
                    <CVisionTd style={{ fontWeight: 500 }}>{loan.employeeName}</CVisionTd>
                    <CVisionTd style={{ fontSize: 13 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {(() => { const TIc = TYPE_ICONS[loan.type] || Banknote; return <TIc className="h-3.5 w-3.5" />; })()}
                        {getTypeLabels(tr)[loan.type]}
                      </span>
                    </CVisionTd>
                    <CVisionTd align="right">{fmtSAR(loan.approvedAmount || loan.requestedAmount)}</CVisionTd>
                    <CVisionTd align="right" style={{ color: C.green }}>{fmtSAR(loan.totalPaid || 0)}</CVisionTd>
                    <CVisionTd style={{ fontSize: 13 }}>{fmtDate(loan.requestDate)}</CVisionTd>
                    <CVisionTd><CVisionBadge C={C} variant={STATUS_VARIANTS[loan.status] || 'secondary'}>{loan.status}</CVisionBadge></CVisionTd>
                    <CVisionTd>
                      <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => { setDetailLoan(loan); setDetailOpen(true); }}>
                        <Eye style={{ height: 16, width: 16 }} />
                      </CVisionButton>
                    </CVisionTd>
                  </CVisionTr>
                ))}
                {filtered.length === 0 && (
                  <CVisionTr C={C}><CVisionTd align="center" colSpan={8} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد قروض.', 'No loans found.')}</CVisionTd></CVisionTr>
                )}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <LoanDetailDialog open={detailOpen} onOpenChange={setDetailOpen} loan={detailLoan} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS TAB (Loan Policies)
// ═══════════════════════════════════════════════════════════════════════
function SettingsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const typeLabel = (t: string) => (language === 'ar' ? TYPE_LABELS_AR : TYPE_LABELS_EN)[t] || t;
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(`${API}?action=policy`, { credentials: 'include', signal: ac.signal });
        const d = await r.json();
        if (d.success) setPolicies(d.policies || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, []);

  if (loading) return <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('إعدادات سياسة القروض', 'Loan Policy Configuration')}</h3>
        <p style={{ fontSize: 13, color: C.textMuted }}>{tr('تحديد القواعد لكل نوع قرض — الحد الأقصى، الأقساط، سلاسل الاعتماد، وفترات الانتظار.', 'Define rules for each loan type — max amounts, installments, approval chains, and cooldown periods.')}</p>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {policies.map(p => (
          <CVisionCard C={C} key={p.type}>
            <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8 }} className="bg-muted">
                  {(() => { const PIc = TYPE_ICONS[p.type] || Banknote; return <PIc className="h-5 w-5" />; })()}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{p.type}</div>
                </div>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('الحد الأقصى', 'Max Amount')}</span>
                  <div style={{ fontWeight: 500 }}>{p.maxAmount.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('الحد الأقصى للأقساط', 'Max Installments')}</span>
                  <div style={{ fontWeight: 500 }}>{p.maxInstallments} {tr('شهر', 'months')}</div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('معدل الربح', 'Interest Rate')}</span>
                  <div style={{ fontWeight: 500, color: C.green }}>{p.interestRate}% (Islamic)</div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('فترة الانتظار', 'Cooldown')}</span>
                  <div style={{ fontWeight: 500 }}>{p.cooldownDays} {tr('يوم', 'days')}</div>
                </div>
              </div>

              <div>
                <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('سلسلة الاعتماد', 'Approval Chain')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  {p.approvalChain.map((step: string, idx: number) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{step}</CVisionBadge>
                      {idx < p.approvalChain.length - 1 && <ArrowUpRight style={{ height: 12, width: 12 }} />}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {p.requiresGuarantor ? (
                    <><ShieldCheck style={{ height: 14, width: 14, color: C.orange }} /> {tr('ضامن مطلوب', 'Guarantor required')}</>
                  ) : (
                    <><CheckCircle style={{ height: 14, width: 14, color: C.green }} /> {tr('بدون ضامن', 'No guarantor')}</>
                  )}
                </div>
                {p.minTenure && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarDays style={{ height: 14, width: 14, color: C.blue }} /> {tr(`حد أدنى ${Math.round(p.minTenure / 365)} سنة`, `Min ${Math.round(p.minTenure / 365)}yr tenure`)}
                  </div>
                )}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LOAN DETAIL DIALOG
// ═══════════════════════════════════════════════════════════════════════
function LoanDetailDialog({ open, onOpenChange, loan, onAction }: {
  open: boolean; onOpenChange: (o: boolean) => void; loan: any; onAction?: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const typeLabel = (t: string) => (language === 'ar' ? TYPE_LABELS_AR : TYPE_LABELS_EN)[t] || t;
  const [tab, setTab] = useState('overview');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInst, setPaymentInst] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  if (!loan) return null;

  const schedule: any[] = loan.installmentSchedule || [];
  const paidCount = schedule.filter((i: any) => i.status === 'PAID').length;
  const progress = schedule.length > 0 ? Math.round((paidCount / schedule.length) * 100) : 0;
  const now = new Date();

  const handleRecordPayment = async () => {
    if (!paymentInst || !paymentAmount) return;
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-payment',
          loanId: loan.loanId,
          installmentNumber: paymentInst.installmentNumber,
          amount: paymentAmount,
        }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(d.loanCompleted ? tr('تم سداد القرض بالكامل!', 'Loan fully paid!') : tr('تم تسجيل الدفعة', 'Payment recorded'));
        setPaymentOpen(false);
        onAction?.();
        onOpenChange(false);
      } else toast.error(d.error || 'Failed');
    } catch { toast.error(tr('خطأ', 'Error')); }
  };

  const handleEarlySettle = async () => {
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'early-settle', loanId: loan.loanId }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(tr(`تم تسوية القرض. المدفوع: ${fmtSAR(d.settledAmount)}`, `Loan settled. Paid: ${fmtSAR(d.settledAmount)}`));
        onAction?.();
        onOpenChange(false);
      } else toast.error(d.error || 'Failed');
    } catch { toast.error(tr('خطأ', 'Error')); }
  };

  return (
    <>
      <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr("التفاصيل", "Details")} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{getTypeLabels(tr)[loan.type]} · {fmtSAR(loan.approvedAmount || loan.requestedAmount)}</p>
          <CVisionTabs
            C={C}
            activeTab={tab}
            onChange={setTab}
            tabs={[
              { id: 'overview', label: tr('نظرة عامة', 'Overview') },
              { id: 'schedule', label: `${tr('الجدول', 'Schedule')} (${schedule.length})` },
              { id: 'approvals', label: tr('الموافقات', 'Approvals') },
            ]}
          >
            <CVisionTabContent tabId="overview">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 13 }}>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('الحالة', 'Status')}</span>
                  <div><CVisionBadge C={C} variant={STATUS_VARIANTS[loan.status]}>{loan.status}</CVisionBadge></div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('النوع', 'Type')}</span>
                  <div style={{ fontWeight: 500 }}>{getTypeLabels(tr)[loan.type]}</div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('المبلغ المطلوب', 'Requested Amount')}</span>
                  <div style={{ fontWeight: 500 }}>{fmtSAR(loan.requestedAmount)}</div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('المبلغ المعتمد', 'Approved Amount')}</span>
                  <div style={{ fontWeight: 500 }}>{loan.approvedAmount ? fmtSAR(loan.approvedAmount) : '—'}</div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('الأقساط', 'Installments')}</span>
                  <div style={{ fontWeight: 500 }}>{loan.installments} × {fmtSAR(loan.installmentAmount)}</div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('معدل الربح', 'Interest Rate')}</span>
                  <div style={{ fontWeight: 500, color: C.green }}>{loan.interestRate || 0}%</div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('تاريخ الطلب', 'Request Date')}</span>
                  <div>{fmtDate(loan.requestDate)}</div>
                </div>
                <div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('الانتهاء المتوقع', 'Expected Completion')}</span>
                  <div>{fmtDate(loan.expectedCompletionDate)}</div>
                </div>
              </div>

              <hr />
              <div>
                <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('السبب', 'Reason')}</span>
                <div style={{ fontSize: 13, marginTop: 4 }}>{loan.reason || '—'}</div>
              </div>

              {loan.guarantor && (
                <>
                  <hr />
                  <div>
                    <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('الضامن', 'Guarantor')}</span>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{loan.guarantor.employeeName}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      {loan.guarantor.acknowledged ? tr('تم التأكيد', 'Acknowledged') : tr('بانتظار التأكيد', 'Pending acknowledgment')}
                    </div>
                  </div>
                </>
              )}

              {/* Repayment progress */}
              {['REPAYING', 'DISBURSED'].includes(loan.status) && (
                <>
                  <hr />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: C.textMuted }}>{tr('تقدم السداد', 'Repayment Progress')}</span>
                      <span style={{ fontWeight: 500 }}>{progress}% ({paidCount}/{schedule.length})</span>
                    </div>
                    <div style={{ height: 12, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                      <div style={{ background: C.greenDim, borderRadius: '50%', transition: 'all 0.2s', width: `${progress}%` }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13 }}>
                      <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('المدفوع', 'Total Paid')}</span><div style={{ fontWeight: 600, color: C.green }}>{fmtSAR(loan.totalPaid || 0)}</div></div>
                      <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('المتبقي', 'Remaining')}</span><div style={{ fontWeight: 600 }}>{fmtSAR(loan.remainingBalance || 0)}</div></div>
                      <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('إجمالي السداد', 'Total Repayment')}</span><div style={{ fontWeight: 600 }}>{fmtSAR(loan.totalRepayment || loan.requestedAmount)}</div></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                      <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={handleEarlySettle}>
                        <CreditCard style={{ height: 14, width: 14, marginRight: 4 }} /> {tr('تسوية مبكرة', 'Early Settlement')}
                      </CVisionButton>
                    </div>
                  </div>
                </>
              )}
            </div>
            </CVisionTabContent>

            <CVisionTabContent tabId="schedule">
            <div style={{ marginTop: 16 }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                    <CVisionTh C={C}>#</CVisionTh>
                    <CVisionTh C={C}>{tr('تاريخ الاستحقاق', 'Due Date')}</CVisionTh>
                    <CVisionTh C={C}>{tr('شهر الرواتب', 'Payroll Month')}</CVisionTh>
                    <CVisionTh C={C} align="right">{tr('المبلغ', 'Amount')}</CVisionTh>
                    <CVisionTh C={C} align="right">{tr('المدفوع', 'Paid')}</CVisionTh>
                    <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                    <CVisionTh C={C}></CVisionTh>
                </CVisionTableHead>
                <CVisionTableBody>
                  {schedule.map((inst: any) => {
                    const overdue = inst.status === 'PENDING' && new Date(inst.dueDate) < now;
                    return (
                      <CVisionTr C={C} key={inst.installmentNumber} className={overdue ? 'bg-red-50' : ''}>
                        <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{inst.installmentNumber}</CVisionTd>
                        <CVisionTd style={{ fontSize: 13 }}>{fmtDate(inst.dueDate)}</CVisionTd>
                        <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{inst.payrollMonth || '—'}</CVisionTd>
                        <CVisionTd align="right">{fmtSAR(inst.amount)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.green }}>{inst.paidAmount > 0 ? fmtSAR(inst.paidAmount) : '—'}</CVisionTd>
                        <CVisionTd>
                          <CVisionBadge C={C} variant={overdue ? 'destructive' : STATUS_VARIANTS[inst.status] || 'secondary'}>
                            {overdue ? 'OVERDUE' : inst.status}
                          </CVisionBadge>
                        </CVisionTd>
                        <CVisionTd>
                          {(inst.status === 'PENDING' || inst.status === 'PARTIALLY_PAID') && loan.status === 'REPAYING' && (
                            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ fontSize: 12 }} onClick={() => {
                              setPaymentInst(inst);
                              setPaymentAmount(String(inst.amount - (inst.paidAmount || 0)));
                              setPaymentOpen(true);
                            }}>{tr('دفع', 'Pay')}</CVisionButton>
                          )}
                        </CVisionTd>
                      </CVisionTr>
                    );
                  })}
                </CVisionTableBody>
              </CVisionTable>
            </div>
            </CVisionTabContent>

            <CVisionTabContent tabId="approvals">
            <div style={{ marginTop: 16 }}>
              {(loan.approvals || []).length === 0 ? (
                <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>{tr('لا توجد إجراءات اعتماد بعد.', 'No approval actions yet.')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {loan.approvals.map((a: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13 }}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        a.decision === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {a.decision === 'APPROVED' ? <Check style={{ height: 16, width: 16 }} /> : <X style={{ height: 16, width: 16 }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{a.step} — {a.decision}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>{a.approverName} · {fmtDate(a.date)}</div>
                        {a.notes && <div style={{ fontSize: 12, marginTop: 4 }}>{a.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </CVisionTabContent>
          </CVisionTabs>
      </CVisionDialog>

      {/* Record Payment Dialog */}
      <CVisionDialog C={C} open={paymentOpen} onClose={() => setPaymentOpen(false)} title={tr('تسجيل دفعة', 'Record Payment')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('تسجيل دفعة لهذا القسط.', 'Record a payment for this installment.')}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: C.bgSubtle, padding: 12, borderRadius: 12, fontSize: 13 }}>
              <div>{tr('الاستحقاق', 'Due')}: {fmtDate(paymentInst?.dueDate)}</div>
              <div>{tr('المبلغ', 'Amount')}: {fmtSAR(paymentInst?.amount || 0)}</div>
              <div>{tr('المدفوع مسبقاً', 'Already paid')}: {fmtSAR(paymentInst?.paidAmount || 0)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('مبلغ الدفعة (ر.س)', 'Payment Amount (SAR)')}</label>
              <CVisionInput C={C} type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setPaymentOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleRecordPayment} disabled={!paymentAmount}>{tr('تسجيل الدفعة', 'Record Payment')}</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// NEW LOAN REQUEST DIALOG
// ═══════════════════════════════════════════════════════════════════════
function NewLoanDialog({ open, onOpenChange, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const typeLabel = (t: string) => (language === 'ar' ? TYPE_LABELS_AR : TYPE_LABELS_EN)[t] || t;
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({
    employeeId: '', type: 'SALARY_ADVANCE', requestedAmount: '', installments: '1', reason: '', guarantorEmployeeId: '',
  });
  const [eligibility, setEligibility] = useState<any>(null);
  const [checkingElig, setCheckingElig] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ employeeId: '', type: 'SALARY_ADVANCE', requestedAmount: '', installments: '1', reason: '', guarantorEmployeeId: '' });
    setEligibility(null);
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch('/api/cvision/employees?limit=200', { credentials: 'include', signal: ac.signal });
        const d = await r.json();
        setEmployees(d.data || d.employees || []);
      } catch { /* ignore */ }
    })();
    return () => ac.abort();
  }, [open]);

  const checkElig = async (empId: string, type: string) => {
    if (!empId || !type) return;
    setCheckingElig(true);
    try {
      const r = await fetch(`${API}?action=eligibility&employeeId=${empId}&type=${type}`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) setEligibility(d);
    } catch { /* ignore */ } finally { setCheckingElig(false); }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', ...form }),
      });
      const d = await r.json();
      if (d.success) { toast.success(`Loan request ${d.loanId} submitted`); onOpenChange(false); onSuccess(); }
      else toast.error(d.error || 'Failed');
    } catch { toast.error(tr('خطأ', 'Error')); } finally { setSubmitting(false); }
  };

  const REQUIRES_GUARANTOR = ['HOUSING_LOAN', 'CAR_LOAN'].includes(form.type);
  const MAX_INSTALLMENTS: Record<string, number> = {
    SALARY_ADVANCE: 3, PERSONAL_LOAN: 12, HOUSING_LOAN: 48, EMERGENCY_LOAN: 6, CAR_LOAN: 24,
  };
  const installmentAmount = form.requestedAmount && form.installments
    ? Math.ceil(parseFloat(form.requestedAmount) / parseInt(form.installments))
    : 0;

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr("التفاصيل", "Details")} isDark={isDark}>          
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Submit a loan or advance request for an employee.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Employee */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Employee *</label>
            <CVisionSelect
                C={C}
                value={form.employeeId || undefined}
                placeholder="Select employee..."
                options={employees.map((e: any) => (
                  ({ value: e.employeeId || e.id || e._id?.toString(), label: `${e.fullName || e.name || [e.firstName, e.lastName].filter(Boolean).join(' ')} - ${e.department || e.departmentName || ''}` })
                ))}
              />
          </div>

          {/* Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('نوع القرض', 'Loan Type')} *</label>
            <CVisionSelect
                C={C}
                value={form.type}
                options={Object.entries(getTypeLabels(tr)).map(([k, v]) => (
                    { value: k, label: v }
                  ))}
              />
          </div>

          {/* Eligibility check */}
          {form.employeeId && (
            <div className={`p-3 rounded-lg border text-sm ${
              checkingElig ? 'bg-muted' :
              eligibility?.eligible ? 'bg-green-50 border-green-200 text-green-800' :
              'bg-red-50 border-red-200 text-red-800'
            }`}>
              {checkingElig ? 'Checking eligibility...' : eligibility?.eligible ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><CheckCircle style={{ height: 16, width: 16 }} /> Eligible</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Max amount: {fmtSAR(eligibility.maxAmount)} · Monthly salary: {fmtSAR(eligibility.monthlySalary)}</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><XCircle style={{ height: 16, width: 16 }} /> Not Eligible</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{eligibility?.reason || 'Unknown reason'}</div>
                </>
              )}
            </div>
          )}

          {/* Amount + Installments */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Amount (SAR) *</label>
              <CVisionInput C={C}
                type="number"
                value={form.requestedAmount}
                onChange={e => setForm(p => ({ ...p, requestedAmount: e.target.value }))}
                max={eligibility?.maxAmount}
              />
              {eligibility?.maxAmount && (
                <span style={{ fontSize: 12, color: C.textMuted }}>Max: {fmtSAR(eligibility.maxAmount)}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Installments *</label>
              <CVisionSelect
                C={C}
                value={form.installments}
                options={Array.from({ length: MAX_INSTALLMENTS[form.type] || 12 }, (_, i) => i + 1).map(n => (
                    ({ value: String(n), label: `${n} month${n > 1 ? 's' : ''}` })
                  ))}
              />
            </div>
          </div>

          {/* Monthly breakdown */}
          {installmentAmount > 0 && (
            <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monthly installment</span>
                <span style={{ fontWeight: 700 }}>{fmtSAR(installmentAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                <span>Total repayment (0% interest)</span>
                <span>{fmtSAR(parseFloat(form.requestedAmount) || 0)}</span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Reason *</label>
            <CVisionTextarea C={C} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} placeholder="Why is this loan needed?" />
          </div>

          {/* Guarantor (if required) */}
          {REQUIRES_GUARANTOR && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Guarantor Employee *</label>
              <CVisionSelect
                C={C}
                value={form.guarantorEmployeeId || undefined}
                placeholder={tr('اختر الضامن...', 'Select guarantor...')}
                options={employees.filter(e => (e.employeeId || e.id || e._id?.toString()) !== form.employeeId).map((e: any) => (
                    ({ value: e.employeeId || e.id || e._id?.toString(), label: e.fullName || e.name || [e.firstName, e.lastName].filter(Boolean).join(' ') })
                  ))}
              />
              <span style={{ fontSize: 12, color: C.orange, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck style={{ height: 12, width: 12 }} /> {tr('مطلوب ضامن لـ', 'Guarantor required for')} {getTypeLabels(tr)[form.type]}
              </span>
            </div>
          )}
        </div>

        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark}
            onClick={submit}
            disabled={submitting || !form.employeeId || !form.requestedAmount || !form.reason || !eligibility?.eligible || (REQUIRES_GUARANTOR && !form.guarantorEmployeeId)}
          >
            {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
            <Send style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('تقديم الطلب', 'Submit Request')}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function PayrollLoansPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Banknote style={{ height: 32, width: 32, color: C.green }} /> {tr('القروض والسلف', 'Loans & Advances')}
        </h1>
        <p style={{ color: C.textMuted }}>{tr('إدارة قروض الموظفين وسلف الرواتب وجداول السداد', 'Manage employee loans, salary advances, and repayment schedules')}</p>
      </div>

      <CVisionTabs
        C={C}
        defaultTab="dashboard"
        tabs={[
          { id: 'dashboard', label: tr('لوحة التحكم', 'Dashboard'), icon: <TrendingUp style={{ height: 14, width: 14 }} /> },
          { id: 'requests', label: tr('الطلبات', 'Requests'), icon: <Clock style={{ height: 14, width: 14 }} /> },
          { id: 'active', label: tr('القروض النشطة', 'Active Loans'), icon: <DollarSign style={{ height: 14, width: 14 }} /> },
          { id: 'history', label: tr('السجل', 'History'), icon: <CalendarDays style={{ height: 14, width: 14 }} /> },
          { id: 'settings', label: tr('الإعدادات', 'Settings'), icon: <Settings2 style={{ height: 14, width: 14 }} /> },
        ]}
      >
        <CVisionTabContent tabId="dashboard"><DashboardTab /></CVisionTabContent>
        <CVisionTabContent tabId="requests"><RequestsTab /></CVisionTabContent>
        <CVisionTabContent tabId="active"><ActiveLoansTab /></CVisionTabContent>
        <CVisionTabContent tabId="history"><HistoryTab /></CVisionTabContent>
        <CVisionTabContent tabId="settings"><SettingsTab /></CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}
