'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionSelect, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionTabs, CVisionTabContent, CVisionPageLayout, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import {
  Play, AlertTriangle, CheckCircle, XCircle, ArrowUpDown, FileText,
  Download, BarChart3, BookOpen, DollarSign, TrendingUp, TrendingDown,
  Users, Building2, Globe, ArrowLeft, RefreshCcw, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const API = '/api/cvision/payroll/advanced';
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function fmtSAR(n: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(n);
}

function PctBadge({ pct }: { pct: number }) {
  const { C, isDark } = useCVisionTheme();
  if (pct > 0) return <span style={{ color: C.red, display: 'flex', alignItems: 'center', fontSize: 12 }}><TrendingUp style={{ width: 12, height: 12, marginRight: 2 }} />+{pct}%</span>;
  if (pct < 0) return <span style={{ color: C.green, display: 'flex', alignItems: 'center', fontSize: 12 }}><TrendingDown style={{ width: 12, height: 12, marginRight: 2 }} />{pct}%</span>;
  return <span style={{ color: C.textMuted, fontSize: 12 }}>0%</span>;
}

// ─── DRY RUN TAB ────────────────────────────────────────────────────
function DryRunTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [month, setMonth] = useState(currentMonth);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [approving, setApproving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEmp, setDetailEmp] = useState<any>(null);

  const { data: historyRaw, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: cvisionKeys.payroll.advanced.list({ action: 'dry-run-list' }),
    queryFn: () => cvisionFetch(`${API}`, { params: { action: 'dry-run-list' } }),
  });
  const history: any[] = historyRaw?.runs || [];
  const loadHistory = useCallback(() => refetchHistory(), [refetchHistory]);

  const runDryRun = async () => {
    setRunning(true); setResult(null);
    try {
      const r = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run-dry-run', month }) });
      const d = await r.json();
      if (d.success) { setResult(d.result); toast.success(tr('تم التشغيل التجريبي', 'Dry run completed')); loadHistory(); }
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error(tr('خطأ في الشبكة', 'Network error')); } finally { setRunning(false); }
  };

  const approvePayroll = async () => {
    if (!result?.dryRunId) return;
    setApproving(true);
    try {
      const r = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve-payroll', dryRunId: result.dryRunId }) });
      const d = await r.json();
      if (d.success) { toast.success(tr(`تم اعتماد الرواتب لـ ${d.employeesProcessed} موظف`, `Payroll approved for ${d.employeesProcessed} employees`)); loadHistory(); }
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error(tr('خطأ في الشبكة', 'Network error')); } finally { setApproving(false); }
  };

  const loadDetail = async (dryRunId: string) => {
    try {
      const r = await fetch(`${API}?action=dry-run-detail&dryRunId=${dryRunId}`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) setResult(d.run);
    } catch { toast.error(tr('فشل التحميل', 'Failed to load')); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}><Play style={{ height: 20, width: 20 }} /> {tr('تشغيل تجريبي للرواتب', 'Run Payroll Dry Run')}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{tr('اختبار معالجة الرواتب بدون تطبيق. يتحقق من بيانات جميع الموظفين ويحسب الإجماليات.', 'Test payroll processing without committing. Validates all employee data and calculates totals.')}</div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الشهر', 'Month')}</label>
              <CVisionInput C={C} type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 192 }} />
            </div>
            <CVisionButton C={C} isDark={isDark} onClick={runDryRun} disabled={running}>
              {running ? <RefreshCcw style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <Play style={{ width: 16, height: 16, marginRight: 8 }} />}
              {running ? tr('جاري المعالجة...', 'Processing...') : tr('تشغيل تجريبي', 'Run Dry Run')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {result && (
        <>
          <div style={{ display: 'grid', gap: 16 }}>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ fontSize: 13, color: C.textMuted }}>{tr('الموظفين', 'Employees')}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{result.summary?.totalEmployees || 0}</div></CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي الراتب', 'Total Gross')}</div><div style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{fmtSAR(result.summary?.totalGrossPay || 0)}</div></CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ fontSize: 13, color: C.textMuted }}>{tr('صافي الراتب', 'Total Net')}</div><div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{fmtSAR(result.summary?.totalNetPay || 0)}</div></CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ fontSize: 13, color: C.textMuted }}>{tr('تكلفة صاحب العمل', 'Total Employer Cost')}</div><div style={{ fontSize: 24, fontWeight: 700, color: C.purple }}>{fmtSAR(result.summary?.totalCost || 0)}</div></CVisionCardBody></CVisionCard>
          </div>

          {(result.errors?.length > 0 || result.warnings?.length > 0) && (
            <div style={{ display: 'grid', gap: 16 }}>
              {result.errors?.length > 0 && (
                <CVisionCard C={C} className="border-red-200">
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.red, display: 'flex', alignItems: 'center', gap: 8 }}><XCircle style={{ height: 16, width: 16 }} /> {result.errors.length} {tr('أخطاء', 'Errors')}</div></CVisionCardHeader>
                  <CVisionCardBody style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {result.errors.map((e: any, i: number) => (
                      <div key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <CVisionBadge C={C} variant={e.severity === 'CRITICAL' ? 'destructive' : 'outline'} style={{ fontSize: 12 }}>{e.severity}</CVisionBadge>
                        <span><strong>{e.employeeName}</strong>: {e.message}</span>
                      </div>
                    ))}
                  </CVisionCardBody>
                </CVisionCard>
              )}
              {result.warnings?.length > 0 && (
                <CVisionCard C={C} className="border-amber-200">
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.orange, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle style={{ height: 16, width: 16 }} /> {result.warnings.length} {tr('تحذيرات', 'Warnings')}</div></CVisionCardHeader>
                  <CVisionCardBody style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {result.warnings.map((w: any, i: number) => (
                      <div key={i} style={{ fontSize: 13 }}><strong>{w.employeeName}</strong>: {w.message}</div>
                    ))}
                  </CVisionCardBody>
                </CVisionCard>
              )}
            </div>
          )}

          <CVisionCard C={C}>
            <CVisionCardHeader C={C} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تفاصيل الموظفين', 'Employee Breakdown')}</div>
              {result.status === 'COMPLETED' && !result.approvedAt && (
                <CVisionButton C={C} isDark={isDark} onClick={approvePayroll} disabled={approving} style={{ background: C.greenDim }}>
                  {approving ? <RefreshCcw style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <CheckCircle style={{ width: 16, height: 16, marginRight: 8 }} />}
                  {tr('اعتماد ونهائي', 'Approve & Finalize')}
                </CVisionButton>
              )}
              {result.approvedAt && <CVisionBadge C={C} style={{ background: C.greenDim, color: C.green }}>{tr('معتمد', 'Approved')}</CVisionBadge>}
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ overflowX: 'auto' }}>
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                      <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                      <CVisionTh C={C} align="right">{tr('الأساسي', 'Basic')}</CVisionTh>
                      <CVisionTh C={C} align="right">{tr('الإجمالي', 'Gross')}</CVisionTh>
                      <CVisionTh C={C} align="right">{tr('التأمينات', 'GOSI')}</CVisionTh>
                      <CVisionTh C={C} align="right">{tr('الخصومات', 'Deductions')}</CVisionTh>
                      <CVisionTh C={C} align="right">{tr('صافي الراتب', 'Net Pay')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                      <CVisionTh C={C}></CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {(result.employees || []).map((emp: any) => (
                      <CVisionTr C={C} key={emp.employeeId} style={emp.hasErrors ? { background: C.redDim } : undefined}>
                        <CVisionTd style={{ fontWeight: 500, color: C.text }}>{emp.name}</CVisionTd>
                        <CVisionTd style={{ color: C.text }}>{emp.department}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(emp.basicSalary)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(emp.grossPay)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(emp.gosiEmployee)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(emp.otherDeductions)}</CVisionTd>
                        <CVisionTd align="right" style={{ fontWeight: 600, color: C.text }}>{fmtSAR(emp.netPay)}</CVisionTd>
                        <CVisionTd style={{ color: C.text }}>{emp.hasErrors ? <XCircle style={{ height: 16, width: 16, color: C.red }} /> : <CheckCircle style={{ height: 16, width: 16, color: C.green }} />}</CVisionTd>
                        <CVisionTd style={{ color: C.text }}><CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => { setDetailEmp(emp); setDetailOpen(true); }}><Eye style={{ height: 16, width: 16 }} /></CVisionButton></CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </>
      )}

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('سجل التشغيل التجريبي', 'Dry Run History')}</div></CVisionCardHeader>
        <CVisionCardBody>
          {historyLoading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 80, width: '100%' }}  /> : history.length === 0 ? (
            <p style={{ color: C.textMuted, fontSize: 13 }}>{tr('لا توجد تشغيلات تجريبية بعد. قم بأول تشغيل أعلاه.', 'No dry runs yet. Run your first one above.')}</p>
          ) : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}><CVisionTh C={C}>{tr('الشهر', 'Month')}</CVisionTh><CVisionTh C={C}>{tr('تاريخ التشغيل', 'Run Date')}</CVisionTh><CVisionTh C={C}>{tr('الموظفين', 'Employees')}</CVisionTh><CVisionTh C={C}>{tr('صافي الراتب', 'Total Net')}</CVisionTh><CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh><CVisionTh C={C}></CVisionTh></CVisionTableHead>
              <CVisionTableBody>
                {history.map((h: any) => (
                  <CVisionTr C={C} key={h.dryRunId}>
                    <CVisionTd style={{ fontWeight: 500, color: C.text }}>{h.month}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{new Date(h.runDate).toLocaleDateString()}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{h.summary?.totalEmployees || 0}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{fmtSAR(h.summary?.totalNetPay || 0)}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}><CVisionBadge C={C} variant={h.status === 'COMPLETED' ? 'default' : h.status === 'APPROVED' ? 'default' : 'destructive'}>{h.approvedAt ? 'APPROVED' : h.status}</CVisionBadge></CVisionTd>
                    <CVisionTd style={{ color: C.text }}><CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => loadDetail(h.dryRunId)}><Eye style={{ height: 16, width: 16 }} /></CVisionButton></CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CVisionCardBody>
      </CVisionCard>

      <CVisionDialog C={C} open={detailOpen} onClose={() => setDetailOpen(false)} title={tr('تفاصيل راتب الموظف', 'Employee Payroll Detail')} width={512}>
          {detailEmp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('الاسم', 'Name')}</span><span style={{ fontWeight: 500 }}>{detailEmp.name}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('القسم', 'Department')}</span><span>{detailEmp.department}</span></div>
              <hr style={{ borderColor: C.border }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('الراتب الأساسي', 'Basic Salary')}</span><span>{fmtSAR(detailEmp.basicSalary)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('بدل السكن', 'Housing Allowance')}</span><span>{fmtSAR(detailEmp.housingAllowance)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('بدل النقل', 'Transport Allowance')}</span><span>{fmtSAR(detailEmp.transportAllowance)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('بدلات أخرى', 'Other Allowances')}</span><span>{fmtSAR(detailEmp.otherAllowances)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>{tr('إجمالي الراتب', 'Gross Pay')}</span><span style={{ color: C.blue }}>{fmtSAR(detailEmp.grossPay)}</span></div>
              <hr style={{ borderColor: C.border }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('التأمينات (موظف 9.75%)', 'GOSI (Employee 9.75%)')}</span><span style={{ color: C.red }}>-{fmtSAR(detailEmp.gosiEmployee)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('خصومات أخرى', 'Other Deductions')}</span><span style={{ color: C.red }}>-{fmtSAR(detailEmp.otherDeductions)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}><span>{tr('صافي الراتب', 'Net Pay')}</span><span style={{ color: C.green }}>{fmtSAR(detailEmp.netPay)}</span></div>
              <hr style={{ borderColor: C.border }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('التأمينات (صاحب العمل 11.75%)', 'GOSI (Employer 11.75%)')}</span><span>{fmtSAR(detailEmp.gosiEmployer)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>{tr('تكلفة صاحب العمل الكلية', 'Total Employer Cost')}</span><span style={{ color: C.purple }}>{fmtSAR(detailEmp.totalCost)}</span></div>
              <hr style={{ borderColor: C.border }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('البنك', 'Bank')}</span><span>{detailEmp.bankName || '—'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('الآيبان', 'IBAN')}</span><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{detailEmp.iban || '—'}</span></div>
            </div>
          )}
      </CVisionDialog>
    </div>
  );
}

// ─── COMPARISON TAB ─────────────────────────────────────────────────
function ComparisonTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const prevMonth = `${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0')}`;
  const [month1, setMonth1] = useState(prevMonth);
  const [month2, setMonth2] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const compare = async () => {
    setLoading(true); setData(null);
    try {
      const r = await fetch(`${API}?action=comparison&month1=${month1}&month2=${month2}`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) setData(d.comparison);
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error(tr('خطأ في الشبكة', 'Network error')); } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}><div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}><ArrowUpDown style={{ height: 20, width: 20 }} /> {tr('مقارنة شهر بشهر', 'Month-over-Month Comparison')}</div></CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الشهر 1', 'Month 1')}</label><CVisionInput C={C} type="month" value={month1} onChange={e => setMonth1(e.target.value)} style={{ width: 192 }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الشهر 2', 'Month 2')}</label><CVisionInput C={C} type="month" value={month2} onChange={e => setMonth2(e.target.value)} style={{ width: 192 }} /></div>
            <CVisionButton C={C} isDark={isDark} onClick={compare} disabled={loading}>{loading ? <RefreshCcw style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <BarChart3 style={{ width: 16, height: 16, marginRight: 8 }} />} {tr('مقارنة', 'Compare')}</CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {data && (
        <>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('ملخص المقارنة', 'Summary Comparison')}</div></CVisionCardHeader>
            <CVisionCardBody>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}><CVisionTh C={C}>{tr('المقياس', 'Metric')}</CVisionTh><CVisionTh C={C} align="right">{data.month1}</CVisionTh><CVisionTh C={C} align="right">{data.month2}</CVisionTh><CVisionTh C={C} align="right">{tr('التغيير', 'Change')}</CVisionTh><CVisionTh C={C} align="right">%</CVisionTh></CVisionTableHead>
                <CVisionTableBody>
                  {data.summary?.map((s: any) => (
                    <CVisionTr C={C} key={s.field}>
                      <CVisionTd style={{ fontWeight: 500, color: C.text }}>{s.field.replace(/([A-Z])/g, ' $1')}</CVisionTd>
                      <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(s.month1Value)}</CVisionTd>
                      <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(s.month2Value)}</CVisionTd>
                      <CVisionTd align="right" style={{ color: C.text }}>{s.change >= 0 ? '+' : ''}{fmtSAR(s.change)}</CVisionTd>
                      <CVisionTd align="right" style={{ color: C.text }}><PctBadge pct={s.changePercent} /></CVisionTd>
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </CVisionCardBody>
          </CVisionCard>

          <div style={{ display: 'grid', gap: 16 }}>
            <CVisionCard C={C} className={data.newHires?.length > 0 ? 'border-green-200' : ''}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{tr('موظفين جدد', 'New Hires')} ({data.newHires?.length || 0})</div></CVisionCardHeader>
              <CVisionCardBody style={{ overflowY: 'auto' }}>
                {data.newHires?.length > 0 ? data.newHires.map((h: any) => (
                  <div key={h.employeeId} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}><span>{h.name}</span><span style={{ color: C.textMuted }}>{fmtSAR(h.netPay)}</span></div>
                )) : <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا يوجد', 'None')}</p>}
              </CVisionCardBody>
            </CVisionCard>
            <CVisionCard C={C} className={data.terminations?.length > 0 ? 'border-red-200' : ''}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.red }}>{tr('إنهاء خدمة', 'Terminations')} ({data.terminations?.length || 0})</div></CVisionCardHeader>
              <CVisionCardBody style={{ overflowY: 'auto' }}>
                {data.terminations?.length > 0 ? data.terminations.map((t: any) => (
                  <div key={t.employeeId} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}><span>{t.name}</span><span style={{ color: C.textMuted }}>{fmtSAR(t.lastPay)}</span></div>
                )) : <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا يوجد', 'None')}</p>}
              </CVisionCardBody>
            </CVisionCard>
            <CVisionCard C={C} className={data.salaryChanges?.length > 0 ? 'border-amber-200' : ''}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.orange }}>{tr('تغييرات الرواتب', 'Salary Changes')} ({data.salaryChanges?.length || 0})</div></CVisionCardHeader>
              <CVisionCardBody style={{ overflowY: 'auto' }}>
                {data.salaryChanges?.length > 0 ? data.salaryChanges.map((c: any) => (
                  <div key={c.employeeId} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}><span>{c.name}</span><span className={c.change > 0 ? 'text-green-600' : 'text-red-600'}>{c.change > 0 ? '+' : ''}{fmtSAR(c.change)}</span></div>
                )) : <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا يوجد', 'None')}</p>}
              </CVisionCardBody>
            </CVisionCard>
          </div>

          {data.departmentComparison?.length > 0 && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('مقارنة الأقسام', 'Department Comparison')}</div></CVisionCardHeader>
              <CVisionCardBody>
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}><CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh><CVisionTh C={C} align="right">{tr('عدد الموظفين', 'HC')} ({data.month1})</CVisionTh><CVisionTh C={C} align="right">{tr('عدد الموظفين', 'HC')} ({data.month2})</CVisionTh><CVisionTh C={C} align="right">{tr('التكلفة', 'Cost')} ({data.month1})</CVisionTh><CVisionTh C={C} align="right">{tr('التكلفة', 'Cost')} ({data.month2})</CVisionTh><CVisionTh C={C} align="right">{tr("التغيير", "Change")}</CVisionTh></CVisionTableHead>
                  <CVisionTableBody>
                    {data.departmentComparison.map((d: any) => (
                      <CVisionTr C={C} key={d.department}>
                        <CVisionTd style={{ fontWeight: 500, color: C.text }}>{d.department}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{d.month1Headcount}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{d.month2Headcount}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(d.month1Total)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(d.month2Total)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}><PctBadge pct={d.changePercent} /></CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              </CVisionCardBody>
            </CVisionCard>
          )}
        </>
      )}
    </div>
  );
}

// ─── PAYSLIPS TAB ───────────────────────────────────────────────────
function PayslipsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [viewSlip, setViewSlip] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}?action=payslips-bulk&month=${month}`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) setPayslips(d.payslips || []);
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error(tr('خطأ في الشبكة', 'Network error')); } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}><div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}><FileText style={{ height: 20, width: 20 }} /> {tr('إنشاء كشوفات الرواتب', 'Payslip Generation')}</div></CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500 }}>Month</label><CVisionInput C={C} type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 192 }} /></div>
            <CVisionButton C={C} isDark={isDark} onClick={load} disabled={loading}>
              {loading ? <RefreshCcw style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <FileText style={{ width: 16, height: 16, marginRight: 8 }} />}
              {tr('إنشاء كشوفات', 'Generate Payslips')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {payslips.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{payslips.length} Payslips — {month}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}><CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh><CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh><CVisionTh C={C}>{tr('المسمى الوظيفي', 'Job Title')}</CVisionTh><CVisionTh C={C} align="right">{tr('الإجمالي', 'Gross')}</CVisionTh><CVisionTh C={C} align="right">{tr('الخصومات', 'Deductions')}</CVisionTh><CVisionTh C={C} align="right">{tr('صافي الراتب', 'Net Pay')}</CVisionTh><CVisionTh C={C}></CVisionTh></CVisionTableHead>
              <CVisionTableBody>
                {payslips.map(ps => (
                  <CVisionTr C={C} key={ps.employeeId}>
                    <CVisionTd style={{ fontWeight: 500, color: C.text }}>{ps.employeeName}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{ps.department}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{ps.jobTitle}</CVisionTd>
                    <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(ps.totalEarnings)}</CVisionTd>
                    <CVisionTd style={{ textAlign: 'right', color: C.red }}>{fmtSAR(ps.totalDeductions)}</CVisionTd>
                    <CVisionTd style={{ textAlign: 'right', fontWeight: 600, color: C.green }}>{fmtSAR(ps.netPay)}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}><CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => setViewSlip(ps)}><Eye style={{ height: 16, width: 16 }} /></CVisionButton></CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <CVisionDialog C={C} open={!!viewSlip} onClose={() => setViewSlip(null)} title={`${tr('كشف الراتب', 'Payslip')} — ${viewSlip?.employeeName}`} width={672}>
          {viewSlip && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
              <div style={{ background: C.bgSubtle, padding: 16, borderRadius: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{viewSlip.companyName}</div>
                <div style={{ color: C.textMuted }}>{viewSlip.companyAddress}</div>
                {viewSlip.commercialRegistration && <div style={{ color: C.textMuted, fontSize: 12 }}>CR: {viewSlip.commercialRegistration}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, padding: 16, borderRadius: 12 }}>
                <div><div style={{ color: C.textMuted, fontSize: 12 }}>{tr('الموظف', 'Employee')}</div><div style={{ fontWeight: 500 }}>{viewSlip.employeeName}</div></div>
                <div><div style={{ color: C.textMuted, fontSize: 12 }}>{tr('رقم الموظف', 'Employee ID')}</div><div>{viewSlip.employeeId}</div></div>
                <div><div style={{ color: C.textMuted, fontSize: 12 }}>{tr('القسم', 'Department')}</div><div>{viewSlip.department}</div></div>
                <div><div style={{ color: C.textMuted, fontSize: 12 }}>{tr('المسمى الوظيفي', 'Job Title')}</div><div>{viewSlip.jobTitle}</div></div>
                <div><div style={{ color: C.textMuted, fontSize: 12 }}>{tr('فترة الدفع', 'Pay Period')}</div><div style={{ fontWeight: 500 }}>{viewSlip.month}</div></div>
                <div><div style={{ color: C.textMuted, fontSize: 12 }}>{tr('تاريخ الدفع', 'Pay Date')}</div><div>{viewSlip.payDate}</div></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: 8, color: C.green }}>{tr('الأرباح', 'Earnings')}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('الراتب الأساسي', 'Basic Salary')}</span><span>{fmtSAR(viewSlip.basicSalary)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('بدل السكن', 'Housing Allowance')}</span><span>{fmtSAR(viewSlip.housingAllowance)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('بدل النقل', 'Transport Allowance')}</span><span>{fmtSAR(viewSlip.transportAllowance)}</span></div>
                    {viewSlip.otherAllowances?.map((a: any) => (
                      <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{a.name}</span><span>{fmtSAR(a.amount)}</span></div>
                    ))}
                    <hr />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>{tr('إجمالي الأرباح', 'Total Earnings')}</span><span style={{ color: C.green }}>{fmtSAR(viewSlip.totalEarnings)}</span></div>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: 8, color: C.red }}>{tr('الخصومات', 'Deductions')}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('التأمينات (9.75%)', 'GOSI (9.75%)')}</span><span>{fmtSAR(viewSlip.gosiEmployee)}</span></div>
                    {viewSlip.loanDeduction > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('سداد القرض', 'Loan Repayment')}</span><span>{fmtSAR(viewSlip.loanDeduction)}</span></div>}
                    {viewSlip.absentDeduction > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('خصم الغياب', 'Absence Deduction')}</span><span>{fmtSAR(viewSlip.absentDeduction)}</span></div>}
                    {viewSlip.otherDeductions?.map((d: any) => (
                      <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{d.name}</span><span>{fmtSAR(d.amount)}</span></div>
                    ))}
                    <hr />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>{tr('إجمالي الخصومات', 'Total Deductions')}</span><span style={{ color: C.red }}>{fmtSAR(viewSlip.totalDeductions)}</span></div>
                  </div>
                </div>
              </div>

              <div style={{ background: C.greenDim, padding: 16, borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: C.textMuted }}>{tr('صافي الراتب', 'Net Pay')}</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: C.green }}>{fmtSAR(viewSlip.netPay)}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{viewSlip.netPayWords}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 12, color: C.textMuted, padding: 12, borderRadius: 6 }}>
                <div>{tr('البنك', 'Bank')}: {viewSlip.bankName || '—'}</div>
                <div>{tr('الآيبان', 'IBAN')}: {viewSlip.iban || '—'}</div>
              </div>
            </div>
          )}
      </CVisionDialog>
    </div>
  );
}

// ─── COST REPORT TAB ────────────────────────────────────────────────
function CostReportTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [viewBy, setViewBy] = useState<'department' | 'nationality' | 'grade'>('department');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}?action=total-cost&month=${month}`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) setReport(d.report);
      else toast.error(d.error || 'Failed');
    } catch { toast.error(tr('خطأ في الشبكة', 'Network error')); } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}><div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}><DollarSign style={{ height: 20, width: 20 }} /> {tr('تقرير التكلفة الإجمالية', 'Total Cost Report')}</div></CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500 }}>Month</label><CVisionInput C={C} type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 192 }} /></div>
            <CVisionButton C={C} isDark={isDark} onClick={load} disabled={loading}>
              {loading ? <RefreshCcw style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <BarChart3 style={{ width: 16, height: 16, marginRight: 8 }} />}
              {tr('إنشاء تقرير', 'Generate Report')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {report && (
        <>
          <div style={{ display: 'grid', gap: 16 }}>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ fontSize: 13, color: C.textMuted }}>{tr('عدد الموظفين', 'Headcount')}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{report.summary?.headcount || 0}</div></CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي الرواتب', 'Total Gross Salaries')}</div><div style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{fmtSAR(report.summary?.totalGrossSalaries || 0)}</div></CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ fontSize: 13, color: C.textMuted }}>{tr('التأمينات (صاحب العمل)', 'GOSI (Employer)')}</div><div style={{ fontSize: 24, fontWeight: 700, color: C.orange }}>{fmtSAR(report.summary?.totalGOSI_Employer || 0)}</div></CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ fontSize: 13, color: C.textMuted }}>{tr('تكلفة الموظفين الكلية', 'Total Employee Cost')}</div><div style={{ fontSize: 24, fontWeight: 700, color: C.purple }}>{fmtSAR(report.summary?.totalEmployeeCost || 0)}</div><div style={{ fontSize: 12, color: C.textMuted }}>Avg: {fmtSAR(report.summary?.avgCostPerEmployee || 0)}/emp</div></CVisionCardBody></CVisionCard>
          </div>

          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('التفاصيل', 'Breakdown')}</div>
                <CVisionSelect C={C} value={viewBy} onChange={(v: string) => setViewBy(v as 'department' | 'nationality' | 'grade')}
                  options={[
                    { value: 'department', label: tr('القسم', 'Department') },
                    { value: 'nationality', label: tr('الجنسية', 'Nationality') },
                    { value: 'grade', label: tr('الدرجة', 'Grade') },
                  ]}
                  style={{ width: 160 }}
                />
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              {viewBy === 'department' && (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}><CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh><CVisionTh C={C} align="right">{tr('العدد', 'HC')}</CVisionTh><CVisionTh C={C} align="right">{tr('الإجمالي', 'Gross')}</CVisionTh><CVisionTh C={C} align="right">{tr('التأمينات', 'GOSI Employer')}</CVisionTh><CVisionTh C={C} align="right">{tr('التكلفة الكلية', 'Total Cost')}</CVisionTh><CVisionTh C={C} align="right">{tr('المتوسط/موظف', 'Avg/Employee')}</CVisionTh><CVisionTh C={C} align="right">{tr('% من الإجمالي', '% of Total')}</CVisionTh></CVisionTableHead>
                  <CVisionTableBody>
                    {report.byDepartment?.map((d: any) => (
                      <CVisionTr C={C} key={d.department}>
                        <CVisionTd style={{ fontWeight: 500, color: C.text }}>{d.department}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{d.headcount}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(d.totalGross)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(d.totalGOSI_Employer)}</CVisionTd>
                        <CVisionTd align="right" style={{ fontWeight: 600, color: C.text }}>{fmtSAR(d.totalCost)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(d.avgCostPerEmployee)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{d.percentOfTotal}%</CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
              {viewBy === 'nationality' && (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}><CVisionTh C={C}>{tr('الجنسية', 'Nationality')}</CVisionTh><CVisionTh C={C} align="right">{tr('العدد', 'HC')}</CVisionTh><CVisionTh C={C} align="right">{tr('التكلفة الكلية', 'Total Cost')}</CVisionTh><CVisionTh C={C} align="right">{tr('المتوسط/موظف', 'Avg/Employee')}</CVisionTh></CVisionTableHead>
                  <CVisionTableBody>
                    {report.byNationality?.map((n: any) => (
                      <CVisionTr C={C} key={n.nationality}><CVisionTd style={{ fontWeight: 500, color: C.text }}>{n.nationality}</CVisionTd><CVisionTd align="right" style={{ color: C.text }}>{n.headcount}</CVisionTd><CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(n.totalCost)}</CVisionTd><CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(n.avgCost)}</CVisionTd></CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
              {viewBy === 'grade' && (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}><CVisionTh C={C}>{tr('الدرجة', 'Grade')}</CVisionTh><CVisionTh C={C} align="right">{tr('العدد', 'HC')}</CVisionTh><CVisionTh C={C} align="right">{tr('التكلفة الكلية', 'Total Cost')}</CVisionTh><CVisionTh C={C} align="right">{tr('المتوسط/موظف', 'Avg/Employee')}</CVisionTh></CVisionTableHead>
                  <CVisionTableBody>
                    {report.byGrade?.map((g: any) => (
                      <CVisionTr C={C} key={g.grade}><CVisionTd style={{ fontWeight: 500, color: C.text }}>{g.grade}</CVisionTd><CVisionTd align="right" style={{ color: C.text }}>{g.headcount}</CVisionTd><CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(g.totalCost)}</CVisionTd><CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(g.avgCost)}</CVisionTd></CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </CVisionCardBody>
          </CVisionCard>

          {report.budgetComparison?.some((b: any) => b.budgetedAmount > 0) && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الميزانية مقابل الفعلي', 'Budget vs Actual')}</div></CVisionCardHeader>
              <CVisionCardBody>
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}><CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh><CVisionTh C={C} align="right">{tr('الميزانية', 'Budget')}</CVisionTh><CVisionTh C={C} align="right">{tr('الفعلي', 'Actual')}</CVisionTh><CVisionTh C={C} align="right">{tr('الفرق', 'Variance')}</CVisionTh><CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh></CVisionTableHead>
                  <CVisionTableBody>
                    {report.budgetComparison.filter((b: any) => b.budgetedAmount > 0).map((b: any) => (
                      <CVisionTr C={C} key={b.department}>
                        <CVisionTd style={{ fontWeight: 500, color: C.text }}>{b.department}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(b.budgetedAmount)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(b.actualAmount)}</CVisionTd>
                        <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(b.variance)}</CVisionTd>
                        <CVisionTd style={{ color: C.text }}><CVisionBadge C={C} variant={b.status === 'UNDER_BUDGET' ? 'default' : b.status === 'OVER_BUDGET' ? 'destructive' : 'secondary'}>{b.status.replace(/_/g, ' ')}</CVisionBadge></CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              </CVisionCardBody>
            </CVisionCard>
          )}
        </>
      )}
    </div>
  );
}

// ─── ACCOUNTING TAB ─────────────────────────────────────────────────
function AccountingTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<any>(null);
  const [glMapping, setGlMapping] = useState<Record<string, { code: string; name: string }>>({});
  const [editMapping, setEditMapping] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);

  const loadJournal = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}?action=journal-entry&month=${month}`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) setEntry(d.entry);
      else toast.error(d.error || 'Failed');
    } catch { toast.error(tr('خطأ في الشبكة', 'Network error')); } finally { setLoading(false); }
  };

  const loadMapping = async (signal?: AbortSignal) => {
    try {
      const r = await fetch(`${API}?action=gl-mapping`, { credentials: 'include', signal });
      const d = await r.json();
      if (d.success) setGlMapping(d.mapping || {});
    } catch { /* ignore */ }
  };

  useEffect(() => { const ac = new AbortController(); loadMapping(ac.signal); return () => ac.abort(); }, []);

  const exportCSV = async () => {
    try {
      const r = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'export-journal', month }) });
      const d = await r.json();
      if (d.success && d.csv) {
        const blob = new Blob([d.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = d.filename || `journal-${month}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success(tr('تم تنزيل CSV', 'CSV downloaded'));
      }
    } catch { toast.error(tr('فشل التصدير', 'Export failed')); }
  };

  const saveMapping = async () => {
    setSavingMapping(true);
    try {
      const r = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update-gl-mapping', mapping: glMapping }) });
      const d = await r.json();
      if (d.success) { toast.success(tr('تم حفظ ربط الحسابات', 'GL mapping saved')); setEditMapping(false); }
      else toast.error(d.error || 'Failed');
    } catch { toast.error(tr('خطأ في الشبكة', 'Network error')); } finally { setSavingMapping(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}><div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen style={{ height: 20, width: 20 }} /> {tr('قيد يومية الرواتب', 'Payroll Journal Entry')}</div></CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500 }}>Month</label><CVisionInput C={C} type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 192 }} /></div>
            <CVisionButton C={C} isDark={isDark} onClick={loadJournal} disabled={loading}>
              {loading ? <RefreshCcw style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <BookOpen style={{ width: 16, height: 16, marginRight: 8 }} />}
              {tr('إنشاء قيد يومية', 'Generate Journal Entry')}
            </CVisionButton>
            {entry && <CVisionButton C={C} isDark={isDark} variant="outline" onClick={exportCSV}><Download style={{ width: 16, height: 16, marginRight: 8 }} /> {tr('تصدير CSV', 'Export CSV')}</CVisionButton>}
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {entry && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{entry.entryId}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{entry.description} — {entry.date}</div>
              </div>
              <CVisionBadge C={C} variant={entry.status === 'POSTED' ? 'default' : 'secondary'}>{entry.status}</CVisionBadge>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ overflowX: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                    <CVisionTh C={C}>{tr('رمز الحساب', 'Account Code')}</CVisionTh>
                    <CVisionTh C={C}>{tr('اسم الحساب', 'Account Name')}</CVisionTh>
                    <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                    <CVisionTh C={C} align="right">{tr('مدين', 'Debit')}</CVisionTh>
                    <CVisionTh C={C} align="right">{tr('دائن', 'Credit')}</CVisionTh>
                    <CVisionTh C={C}>{tr('الوصف', 'Description')}</CVisionTh>
                </CVisionTableHead>
                <CVisionTableBody>
                  {entry.lines?.map((line: any, i: number) => (
                    <CVisionTr C={C} key={i}>
                      <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{line.accountCode}</CVisionTd>
                      <CVisionTd style={{ color: C.text }}>{line.accountName}</CVisionTd>
                      <CVisionTd style={{ color: C.text }}>{line.department || '—'}</CVisionTd>
                      <CVisionTd align="right" style={{ color: C.text }}>{line.debit > 0 ? fmtSAR(line.debit) : ''}</CVisionTd>
                      <CVisionTd align="right" style={{ color: C.text }}>{line.credit > 0 ? fmtSAR(line.credit) : ''}</CVisionTd>
                      <CVisionTd style={{ color: C.textMuted, fontSize: 12 }}>{line.description}</CVisionTd>
                    </CVisionTr>
                  ))}
                  <CVisionTr C={C} style={{ background: C.bgSubtle, fontWeight: 700 }}>
                    <CVisionTd colSpan={3}>{tr('الإجماليات', 'Totals')}</CVisionTd>
                    <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(entry.totalDebit)}</CVisionTd>
                    <CVisionTd align="right" style={{ color: C.text }}>{fmtSAR(entry.totalCredit)}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{entry.totalDebit === entry.totalCredit ? <CheckCircle style={{ height: 16, width: 16, color: C.green }} /> : <XCircle style={{ height: 16, width: 16, color: C.red }} />}</CVisionTd>
                  </CVisionTr>
                </CVisionTableBody>
              </CVisionTable>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('ربط رموز الحسابات', 'GL Code Mapping')}</div>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setEditMapping(!editMapping)}>
              {editMapping ? tr('إلغاء', 'Cancel') : tr('تعديل الربط', 'Edit Mapping')}
            </CVisionButton>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{tr('ربط فئات الرواتب بدليل الحسابات', 'Map payroll categories to your Chart of Accounts')}</div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}><CVisionTh C={C}>{tr('الفئة', 'Category')}</CVisionTh><CVisionTh C={C}>{tr('رمز الحساب', 'Account Code')}</CVisionTh><CVisionTh C={C}>{tr('اسم الحساب', 'Account Name')}</CVisionTh></CVisionTableHead>
            <CVisionTableBody>
              {Object.entries(glMapping).map(([key, val]) => (
                <CVisionTr C={C} key={key}>
                  <CVisionTd style={{ fontWeight: 500, fontSize: 12 }}>{key.replace(/_/g, ' ')}</CVisionTd>
                  <CVisionTd style={{ color: C.text }}>
                    {editMapping ? (
                      <CVisionInput C={C} style={{ width: 96, height: 32, fontFamily: 'monospace', fontSize: 12 }} value={val.code}
                        onChange={e => setGlMapping(prev => ({ ...prev, [key]: { ...prev[key], code: e.target.value } }))} />
                    ) : <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{val.code}</span>}
                  </CVisionTd>
                  <CVisionTd style={{ color: C.text }}>
                    {editMapping ? (
                      <CVisionInput C={C} style={{ width: 240, height: 32, fontSize: 12 }} value={val.name}
                        onChange={e => setGlMapping(prev => ({ ...prev, [key]: { ...prev[key], name: e.target.value } }))} />
                    ) : <span style={{ fontSize: 12 }}>{val.name}</span>}
                  </CVisionTd>
                </CVisionTr>
              ))}
            </CVisionTableBody>
          </CVisionTable>
          {editMapping && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <CVisionButton C={C} isDark={isDark} onClick={saveMapping} disabled={savingMapping}>
                {savingMapping ? <RefreshCcw style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : null}
                {tr('حفظ ربط الحسابات', 'Save GL Mapping')}
              </CVisionButton>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────
export default function PayrollAdvancedPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/cvision/payroll">
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm"><ArrowLeft style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('الرواتب', 'Payroll')}</CVisionButton>
        </Link>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700 }}>{tr('الرواتب المتقدمة', 'Advanced Payroll')}</h1>
          <p style={{ color: C.textMuted }}>{tr('التشغيل التجريبي، المقارنات، قسائم الراتب، تحليل التكلفة والمحاسبة', 'Dry runs, comparisons, payslips, cost analysis & accounting')}</p>
        </div>
      </div>

      <CVisionTabs C={C} isRTL={isRTL} defaultTab="dry-run" tabs={[
        { id: 'dry-run', label: tr('التشغيل التجريبي', 'Dry Run'), icon: Play },
        { id: 'comparison', label: tr('المقارنة', 'Comparison'), icon: ArrowUpDown },
        { id: 'payslips', label: tr('قسائم الراتب', 'Payslips'), icon: FileText },
        { id: 'cost', label: tr('تقرير التكلفة', 'Cost Report'), icon: DollarSign },
        { id: 'accounting', label: tr('المحاسبة', 'Accounting'), icon: BookOpen },
      ]}>
        <CVisionTabContent tabId="dry-run"><DryRunTab /></CVisionTabContent>
        <CVisionTabContent tabId="comparison"><ComparisonTab /></CVisionTabContent>
        <CVisionTabContent tabId="payslips"><PayslipsTab /></CVisionTabContent>
        <CVisionTabContent tabId="cost"><CostReportTab /></CVisionTabContent>
        <CVisionTabContent tabId="accounting"><AccountingTab /></CVisionTabContent>
      </CVisionTabs>
    </CVisionPageLayout>
  );
}
