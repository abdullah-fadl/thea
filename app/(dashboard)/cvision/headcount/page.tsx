'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import Link from 'next/link';

import {
  Users, TrendingUp, Building2, AlertTriangle, DollarSign,
  Plus, Download, RefreshCw, CheckCircle2, ChevronDown, ChevronRight,
  ExternalLink, Calendar, ShieldCheck, Clock, FileEdit,
} from 'lucide-react';
/* Collapsible replaced with state-based expand/collapse */

export default function HeadcountBudgetPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [expandedBudgets, setExpandedBudgets] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    departmentId: '', departmentName: '',
    positions: [{ title: '', gradeId: '', approvedCount: 1, actualCount: 0, monthlyCost: 0, status: 'VACANT' }],
  });

  const { data: summaryRaw, isLoading: loadingSummary } = useQuery({
    queryKey: cvisionKeys.headcount.list({ action: 'summary', year: String(year) }),
    queryFn: () => cvisionFetch('/api/cvision/headcount-budget', { params: { action: 'summary', year: String(year) } }),
  });
  const summary = (summaryRaw as any)?.data || null;

  const { data: budgetsRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.headcount.list({ action: 'list', year: String(year) }),
    queryFn: () => cvisionFetch('/api/cvision/headcount-budget', { params: { action: 'list', year: String(year) } }),
  });
  const budgets = (budgetsRaw as any)?.data || [];

  const { data: vacanciesRaw } = useQuery({
    queryKey: cvisionKeys.headcount.list({ action: 'vacancies', year: String(year) }),
    queryFn: () => cvisionFetch('/api/cvision/headcount-budget', { params: { action: 'vacancies', year: String(year) } }),
  });
  const vacancies = (vacanciesRaw as any)?.data || [];

  const load = () => { queryClient.invalidateQueries({ queryKey: cvisionKeys.headcount.all }); };

  const createMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate('/api/cvision/headcount-budget', 'POST', payload),
    onSuccess: () => {
      load();
      setShowCreate(false);
    },
  });

  const create = async () => {
    createMutation.mutate({ action: 'create', year, ...form });
  };

  const exportCSV = () => {
    const header = 'Department,Position,Grade,Approved,Actual,Variance,Monthly Cost,Status';
    const rows = budgets.flatMap((b: any) =>
      (b.positions || []).map((p: any) =>
        `"${b.departmentName}","${p.title}","${p.gradeName || p.gradeId || ''}",${p.approvedCount},${p.actualCount},${(p.approvedCount || 0) - (p.actualCount || 0)},${p.monthlyCost || 0},"${p.status}"`
      )
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `headcount-budget-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s: string) => {
    if (s === 'FILLED') return <CVisionBadge C={C} style={{ background: C.greenDim, color: C.green }}>{tr('مشغول', 'Filled')}</CVisionBadge>;
    if (s === 'PARTIAL') return <CVisionBadge C={C} style={{ background: C.blueDim, color: C.blue }}>{tr('جزئي', 'Partial')}</CVisionBadge>;
    if (s === 'VACANT') return <CVisionBadge C={C} style={{ background: C.orangeDim, color: C.orange }}>{tr('شاغر', 'Vacant')}</CVisionBadge>;
    if (s === 'FROZEN') return <CVisionBadge C={C} variant="muted">{tr('مجمد', 'Frozen')}</CVisionBadge>;
    return <CVisionBadge C={C} variant="muted">{s}</CVisionBadge>;
  };

  /** Budget-level approval status badge (DRAFT / PENDING_APPROVAL / APPROVED / ACTIVE) */
  const budgetStatusBadge = (b: any) => {
    const s = (b.status || 'ACTIVE').toUpperCase();
    if (s === 'APPROVED') return (
      <CVisionBadge C={C} style={{ background: C.greenDim, color: C.green, gap: 4 }}>
        <ShieldCheck style={{ height: 12, width: 12 }} /> {tr('معتمد', 'Approved')}
      </CVisionBadge>
    );
    if (s === 'DRAFT') return (
      <CVisionBadge C={C} style={{ background: C.orangeDim, color: C.orange, gap: 4 }}>
        <FileEdit style={{ height: 12, width: 12 }} /> {tr('مسودة', 'Draft')}
      </CVisionBadge>
    );
    if (s === 'PENDING_APPROVAL' || s === 'PENDING') return (
      <CVisionBadge C={C} style={{ background: C.blueDim, color: C.blue, gap: 4 }}>
        <Clock style={{ height: 12, width: 12 }} /> {tr('بانتظار الموافقة', 'Pending Approval')}
      </CVisionBadge>
    );
    if (s === 'ACTIVE') return (
      <CVisionBadge C={C} style={{ gap: 4 }}>
        <CheckCircle2 style={{ height: 12, width: 12 }} /> {tr('نشط', 'Active')}
      </CVisionBadge>
    );
    return <CVisionBadge C={C} variant="muted">{s}</CVisionBadge>;
  };

  const approveMutation = useMutation({
    mutationFn: (budgetId: string) => cvisionMutate('/api/cvision/headcount-budget', 'POST', { action: 'approve', budgetId }),
    onSuccess: () => load(),
  });

  const approveBudget = async (budgetId: string) => {
    approveMutation.mutate(budgetId);
  };

  const utilizationPct = (approved: number, actual: number) => {
    if (approved === 0) return actual > 0 ? 100 : 0;
    return Math.round((actual / approved) * 100);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users style={{ height: 24, width: 24, color: C.blue }} />
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>{tr('ميزانية القوى العاملة', 'Headcount Budget')}</h1>
            <p style={{ fontSize: 13, color: C.textMuted }}>{tr('تخطيط واستخدام القوى العاملة بالأقسام', 'Department headcount planning and utilization')}</p>
          </div>
          <CVisionBadge C={C} variant="outline" style={{ fontSize: 13, fontWeight: 600, paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, gap: 6, color: C.blue, background: C.blueDim }}>
            <Calendar style={{ height: 14, width: 14 }} /> FY {year}
          </CVisionBadge>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select style={{ border: `1px solid ${C.border}`, borderRadius: 6, paddingLeft: 8, paddingRight: 8, height: 36, fontSize: 13 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw style={{ height: 14, width: 14, marginInlineEnd: 4 }} /> {tr('تحديث', 'Refresh')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={exportCSV}>
            <Download style={{ height: 14, width: 14, marginInlineEnd: 4 }} /> {tr('تصدير', 'Export')}
          </CVisionButton>
          <Link href="/cvision/manpower/plans">
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm">
              <ExternalLink style={{ height: 14, width: 14, marginInlineEnd: 4 }} /> {tr('خطط القوى العاملة', 'Manpower Plans')}
            </CVisionButton>
          </Link>
          <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => setShowCreate(true)}>
            <Plus style={{ height: 14, width: 14, marginInlineEnd: 4 }} /> {tr('إضافة ميزانية', 'Add Budget')}
          </CVisionButton>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[
            { label: tr('المعتمد', 'Approved'), value: summary.totalApproved, icon: Users, color: C.blue },
            { label: tr('الفعلي', 'Actual'), value: summary.totalActual, icon: CheckCircle2, color: C.green },
            { label: tr('الفرق', 'Variance'), value: summary.variance, icon: TrendingUp, color: summary.variance > 0 ? C.orange : C.green },
            { label: tr('شاغر', 'Vacant'), value: summary.totalVacant, icon: AlertTriangle, color: C.red },
            { label: tr('مجمد', 'Frozen'), value: summary.totalFrozen, icon: Building2, color: C.textMuted },
            { label: tr('الميزانية الشهرية', 'Monthly Budget'), value: summary.totalBudget > 0 ? `${(summary.totalBudget / 1000).toFixed(0)}K` : '0', icon: DollarSign, color: C.purple },
          ].map(m => (
            <CVisionCard C={C} key={m.label}>
              <CVisionCardBody style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <m.icon size={20} color={m.color} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{m.value}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{m.label}</div>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}

      {/* Approval Status Summary */}
      {summary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500, color: C.textMuted }}>{tr('حالة الميزانية:', 'Budget Status:')}</span>
          {(summary.approvedBudgets || 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck style={{ height: 14, width: 14, color: C.green }} />
              <span style={{ fontWeight: 600, color: C.green }}>{summary.approvedBudgets}</span>
              <span style={{ color: C.textMuted }}>{tr('معتمد', 'Approved')}</span>
            </div>
          )}
          {(summary.activeBudgets || 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 style={{ height: 14, width: 14 }} />
              <span style={{ fontWeight: 600 }}>{summary.activeBudgets}</span>
              <span style={{ color: C.textMuted }}>{tr('نشط', 'Active')}</span>
            </div>
          )}
          {(summary.pendingBudgets || 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ height: 14, width: 14, color: C.blue }} />
              <span style={{ fontWeight: 600, color: C.blue }}>{summary.pendingBudgets}</span>
              <span style={{ color: C.textMuted }}>{tr('معلق', 'Pending')}</span>
            </div>
          )}
          {(summary.draftBudgets || 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileEdit style={{ height: 14, width: 14, color: C.orange }} />
              <span style={{ fontWeight: 600, color: C.orange }}>{summary.draftBudgets}</span>
              <span style={{ color: C.textMuted }}>{tr('مسودة', 'Draft')}</span>
            </div>
          )}
          {!summary.approvedBudgets && !summary.activeBudgets && !summary.pendingBudgets && !summary.draftBudgets && (
            <span style={{ color: C.textMuted }}>{tr('لا توجد ميزانيات لهذه السنة', 'No budgets for this year')}</span>
          )}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <CVisionCard C={C} style={{ borderColor: C.blue }}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('ميزانية قسم جديدة', 'New Department Budget')} — FY {year}</div></CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <CVisionInput C={C} placeholder={tr('رقم القسم', 'Department ID')} value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} />
              <CVisionInput C={C} placeholder={tr('اسم القسم', 'Department Name')} value={form.departmentName} onChange={e => setForm({ ...form, departmentName: e.target.value })} />
            </div>
            {form.positions.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('المسمى الوظيفي', 'Position title')} value={p.title} onChange={e => { const pos = [...form.positions]; pos[i] = { ...pos[i], title: e.target.value }; setForm({ ...form, positions: pos }); }} />
                <CVisionInput C={C} placeholder={tr('الدرجة', 'Grade')} value={p.gradeId} onChange={e => { const pos = [...form.positions]; pos[i] = { ...pos[i], gradeId: e.target.value }; setForm({ ...form, positions: pos }); }} />
                <CVisionInput C={C} type="number" placeholder={tr('معتمد', 'Approved')} value={p.approvedCount} onChange={e => { const pos = [...form.positions]; pos[i] = { ...pos[i], approvedCount: Number(e.target.value) }; setForm({ ...form, positions: pos }); }} />
                <CVisionInput C={C} type="number" placeholder={tr('فعلي', 'Actual')} value={p.actualCount} onChange={e => { const pos = [...form.positions]; pos[i] = { ...pos[i], actualCount: Number(e.target.value) }; setForm({ ...form, positions: pos }); }} />
                <CVisionInput C={C} type="number" placeholder={tr('التكلفة الشهرية', 'Monthly Cost')} value={p.monthlyCost} onChange={e => { const pos = [...form.positions]; pos[i] = { ...pos[i], monthlyCost: Number(e.target.value) }; setForm({ ...form, positions: pos }); }} />
              </div>
            ))}
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setForm({ ...form, positions: [...form.positions, { title: '', gradeId: '', approvedCount: 1, actualCount: 0, monthlyCost: 0, status: 'VACANT' }] })}>
              {tr('+ إضافة وظيفة', '+ Add Position')}
            </CVisionButton>
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} onClick={create}>{tr('إنشاء', 'Create')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowCreate(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Department Budgets */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 style={{ height: 16, width: 16 }} /> {tr('ميزانيات الأقسام', 'Department Budgets')} — FY {year}
            {budgets.length > 0 && <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12, marginInlineStart: 4 }}>{budgets.length} {tr('قسم', 'departments')}</CVisionBadge>}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {loading ? (
            <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>{tr('جاري التحميل...', 'Loading...')}</div>
          ) : budgets.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48, color: C.textMuted }}>
              <Users style={{ height: 40, width: 40, marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontWeight: 500 }}>{tr('لا توجد أقسام', 'No departments found')}</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>{tr('أضف أقسام وموظفين لعرض ميزانيات القوى العاملة.', 'Add departments and employees to see headcount budgets.')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {budgets.map((b: any) => {
                const variance = (b.totalApproved || 0) - (b.totalActual || 0);
                const pct = utilizationPct(b.totalApproved, b.totalActual);
                return (
                  <div key={b.budgetId || b.departmentId}>
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12 }}>
                      <div
                        onClick={() => {
                          const key = b.budgetId || b.departmentId;
                          setExpandedBudgets(prev => {
                            const next = new Set(prev);
                            next.has(key) ? next.delete(key) : next.add(key);
                            return next;
                          });
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, cursor: 'pointer' }}
                      >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <ChevronRight style={{ height: 16, width: 16, color: C.textMuted, flexShrink: 0, transition: 'transform 0.2s', transform: expandedBudgets.has(b.budgetId || b.departmentId) ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.departmentName || 'Unknown'}</p>
                              {b.departmentCode && <p style={{ fontSize: 12, color: C.textMuted }}>{b.departmentCode}</p>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
                            <div style={{ textAlign: 'center', width: 64 }}>
                              <div style={{ fontWeight: 700 }}>{b.totalApproved || 0}</div>
                              <div style={{ color: C.textMuted }}>{tr('الميزانية', 'Budget')}</div>
                            </div>
                            <div style={{ textAlign: 'center', width: 64 }}>
                              <div style={{ fontWeight: 700, color: C.green }}>{b.totalActual || 0}</div>
                              <div style={{ color: C.textMuted }}>{tr('الفعلي', 'Actual')}</div>
                            </div>
                            <div style={{ textAlign: 'center', width: 64 }}>
                              <div style={{ fontWeight: 700, color: variance > 0 ? C.orange : variance < 0 ? C.red : C.green }}>
                                {variance > 0 ? `+${variance}` : variance}
                              </div>
                              <div style={{ color: C.textMuted }}>{tr('الفرق', 'Gap')}</div>
                            </div>
                            <div style={{ width: 96, display: 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
                                <span style={{ fontSize: 12, color: C.textMuted, width: 32 }}>{pct}%</span>
                              </div>
                            </div>
                            {b.totalBudget > 0 && (
                              <div style={{ textAlign: 'center', width: 64, display: 'none' }}>
                                <div style={{ fontWeight: 500, color: C.textMuted }}>{(b.totalBudget / 1000).toFixed(0)}K</div>
                                <div style={{ color: C.textMuted }}>{tr('التكلفة/شهر', 'Cost/mo')}</div>
                              </div>
                            )}
                            {budgetStatusBadge(b)}
                            {b.approvedAt && (
                              <span style={{ color: C.textMuted, display: 'none' }} title={`Approved: ${new Date(b.approvedAt).toLocaleDateString()}`}>
                                {new Date(b.approvedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      {expandedBudgets.has(b.budgetId || b.departmentId) && (
                        (b.positions || []).length > 0 ? (
                          <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
                            <table style={{ width: '100%', fontSize: 13 }}>
                              <thead>
                                <tr style={{ fontSize: 12, color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                                  <th style={{ textAlign: isRTL ? 'right' : 'left', paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 }}>{tr('الوظيفة', 'Position')}</th>
                                  <th style={{ textAlign: isRTL ? 'right' : 'left', paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 }}>{tr('الدرجة', 'Grade')}</th>
                                  <th style={{ textAlign: isRTL ? 'left' : 'right', paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 }}>{tr('معتمد', 'Approved')}</th>
                                  <th style={{ textAlign: isRTL ? 'left' : 'right', paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 }}>{tr('فعلي', 'Actual')}</th>
                                  <th style={{ textAlign: isRTL ? 'left' : 'right', paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 }}>{tr('الفرق', 'Gap')}</th>
                                  <th style={{ textAlign: isRTL ? 'left' : 'right', paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 }}>{tr('الحالة', 'Status')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(b.positions || []).map((p: any, i: number) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                                    <td style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8, fontWeight: 500 }}>{p.title}</td>
                                    <td style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8, color: C.textMuted }}>{p.gradeName || p.gradeId || '-'}</td>
                                    <td style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>{p.approvedCount || 0}</td>
                                    <td style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>{p.actualCount || 0}</td>
                                    <td style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>
                                      {(() => {
                                        const gap = (p.approvedCount || 0) - (p.actualCount || 0);
                                        return gap > 0
                                          ? <span style={{ color: C.orange }}>+{gap}</span>
                                          : gap < 0
                                          ? <span style={{ color: C.red }}>{gap}</span>
                                          : <span style={{ color: C.green }}>0</span>;
                                      })()}
                                    </td>
                                    <td style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>{statusBadge(p.status)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              {(b.status === 'DRAFT' || b.status === 'PENDING_APPROVAL') && b.budgetId && (
                                <CVisionButton C={C} isDark={isDark} size="sm" variant="default" style={{ height: 28, fontSize: 12, gap: 4 }} onClick={() => approveBudget(b.budgetId)}>
                                  <ShieldCheck style={{ height: 12, width: 12 }} /> {tr('اعتماد الميزانية', 'Approve Budget')}
                                </CVisionButton>
                              )}
                              <div style={{ flex: 1 }} />
                              <Link href={`/cvision/manpower/plans?departmentId=${b.departmentId}`} style={{ fontSize: 12, color: C.gold, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {tr('عرض خطة القوى العاملة', 'View Manpower Plan')} <ExternalLink style={{ height: 12, width: 12 }} />
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12, fontSize: 13, color: C.textMuted }}>
                            {tr('لا توجد وظائف مخصصة.', 'No budgeted positions defined.')} {b.totalActual > 0 ? tr(`${b.totalActual} موظف معيّن.`, `${b.totalActual} employee(s) assigned.`) : ''}
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              {(b.status === 'DRAFT' || b.status === 'PENDING_APPROVAL') && b.budgetId && (
                                <CVisionButton C={C} isDark={isDark} size="sm" variant="default" style={{ height: 28, fontSize: 12, gap: 4 }} onClick={() => approveBudget(b.budgetId)}>
                                  <ShieldCheck style={{ height: 12, width: 12 }} /> {tr('اعتماد الميزانية', 'Approve Budget')}
                                </CVisionButton>
                              )}
                              <div style={{ flex: 1 }} />
                              <Link href={`/cvision/manpower/plans?departmentId=${b.departmentId}`} style={{ fontSize: 12, color: C.gold, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {tr('عرض خطة القوى العاملة', 'View Manpower Plan')} <ExternalLink style={{ height: 12, width: 12 }} />
                              </Link>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Vacancies */}
      {vacancies.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle style={{ height: 16, width: 16, color: C.orange }} /> {tr('الشواغر المفتوحة', 'Open Vacancies')}
              <CVisionBadge C={C} variant="danger" style={{ fontSize: 12, marginLeft: 4 }}>{vacancies.length}</CVisionBadge>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left', fontSize: 12, color: C.textMuted }}>
                    <th style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>{tr('القسم', 'Department')}</th>
                    <th style={{ paddingLeft: 8, paddingRight: 8 }}>{tr('الوظيفة', 'Position')}</th>
                    <th style={{ paddingLeft: 8, paddingRight: 8 }}>{tr('الدرجة', 'Grade')}</th>
                    <th style={{ paddingLeft: 8, paddingRight: 8, textAlign: isRTL ? 'left' : 'right' }}>{tr('الفرق', 'Gap')}</th>
                    <th style={{ paddingLeft: 8, paddingRight: 8, textAlign: isRTL ? 'left' : 'right' }}>{tr('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {vacancies.map((v: any, i: number) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>{v.department}</td>
                      <td style={{ paddingLeft: 8, paddingRight: 8, fontWeight: 500 }}>{v.title}</td>
                      <td style={{ paddingLeft: 8, paddingRight: 8, color: C.textMuted }}>{v.gradeId || '-'}</td>
                      <td style={{ paddingLeft: 8, paddingRight: 8, textAlign: 'right', color: C.red, fontWeight: 500 }}>{v.gap}</td>
                      <td style={{ paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>{statusBadge(v.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}
