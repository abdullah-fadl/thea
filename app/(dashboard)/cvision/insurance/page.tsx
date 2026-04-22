'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import {
  Shield, Users, Heart, DollarSign, FileText, AlertTriangle,
  CheckCircle, XCircle, Clock, Plus, Search, Eye, Building2,
  CreditCard, UserPlus, RefreshCcw, MoreHorizontal, ArrowUpCircle,
  ArrowDownCircle, Trash2, History, Printer, UserMinus,
  Check, X, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

const API = '/api/cvision/insurance';

function fmtSAR(n: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: any) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  VIP:      { label: 'VIP',           color: 'bg-amber-100 text-amber-800 border-amber-300' },
  PREMIUM:  { label: 'A — Gold',      color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  STANDARD: { label: 'B — Silver',    color: 'bg-slate-100 text-slate-700 border-slate-300' },
  BASIC:    { label: 'C — Bronze',    color: 'bg-orange-100 text-orange-700 border-orange-300' },
};
const STATUS_VARIANTS: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  ACTIVE: 'default', PAID: 'default', APPROVED: 'default', PROCESSED: 'default',
  REJECTED: 'destructive', CANCELLED: 'destructive', EXPIRED: 'destructive',
  PENDING: 'secondary', SUBMITTED: 'secondary', UNDER_REVIEW: 'secondary',
  PARTIALLY_APPROVED: 'outline', SUSPENDED: 'outline',
};
const CLAIM_COLORS: Record<string, string> = {
  OUTPATIENT: 'bg-blue-100 text-blue-700', INPATIENT: 'bg-purple-100 text-purple-700',
  DENTAL: 'bg-cyan-100 text-cyan-700', OPTICAL: 'bg-indigo-100 text-indigo-700',
  MATERNITY: 'bg-pink-100 text-pink-700', EMERGENCY: 'bg-red-100 text-red-700',
  PHARMACY: 'bg-green-100 text-green-700',
};
const REQ_TYPE_LABELS_EN: Record<string, string> = {
  ENROLLMENT: 'Enrollment', ADD_DEPENDENT: 'Add Dependent', REMOVE_DEPENDENT: 'Remove Dependent',
  UPGRADE: 'Class Change', CANCELLATION: 'Cancellation', CARD_REPLACEMENT: 'Card Replacement',
};
const REQ_TYPE_LABELS_AR: Record<string, string> = {
  ENROLLMENT: 'تسجيل', ADD_DEPENDENT: 'إضافة تابع', REMOVE_DEPENDENT: 'حذف تابع',
  UPGRADE: 'تغيير فئة', CANCELLATION: 'إلغاء', CARD_REPLACEMENT: 'استبدال بطاقة',
};
function getReqTypeLabel(type: string, language: string) {
  const labels = language === 'ar' ? REQ_TYPE_LABELS_AR : REQ_TYPE_LABELS_EN;
  return labels[type] || type;
}

function TierBadge({ tier }: { tier: string }) {
  const t = TIER_LABELS[tier] || { label: tier, color: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${t.color}`}>{t.label}</span>;
}

// ═══════════════════════════════════════════════════════════════════════
// EMPLOYEES TAB
// ═══════════════════════════════════════════════════════════════════════
function EmployeesTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'not_insured' | 'expiring'>('all');
  const [providerFilter, setProviderFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Dialogs
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEmpId, setDetailEmpId] = useState('');
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollEmpId, setEnrollEmpId] = useState('');
  const [enrollEmpName, setEnrollEmpName] = useState('');
  const [depOpen, setDepOpen] = useState(false);
  const [depEmpId, setDepEmpId] = useState('');
  const [depEmpName, setDepEmpName] = useState('');
  const [classOpen, setClassOpen] = useState(false);
  const [classEmpId, setClassEmpId] = useState('');
  const [classEmpName, setClassEmpName] = useState('');
  const [classCurrentTier, setClassCurrentTier] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimEmpId, setClaimEmpId] = useState('');
  const [claimEmpName, setClaimEmpName] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelEmpId, setCancelEmpId] = useState('');
  const [cancelEmpName, setCancelEmpName] = useState('');

  const { data: insRaw, isLoading: insLoading, refetch: refetchIns } = useQuery({
    queryKey: cvisionKeys.insurance.list({ action: 'all-employees' }),
    queryFn: () => cvisionFetch(API, { params: { action: 'all-employees' } }),
  });
  useEffect(() => { setLoading(insLoading); }, [insLoading]);
  useEffect(() => { if (insRaw?.success) { setEmployees(insRaw.employees || []); setStats(insRaw.stats || null); } }, [insRaw]);
  const load = useCallback(() => refetchIns(), [refetchIns]);

  const filtered = employees.filter(e => {
    if (filter === 'active' && !e.insured) return false;
    if (filter === 'not_insured' && e.insured) return false;
    if (filter === 'expiring' && !e.expiringSoon) return false;
    if (providerFilter && e.providerName !== providerFilter) return false;
    if (classFilter && e.insuranceClass !== classFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (e.fullName || '').toLowerCase().includes(s)
        || (e.employeeId || '').toLowerCase().includes(s)
        || (e.cardNumber || '').toLowerCase().includes(s);
    }
    return true;
  });

  const providers = [...new Set(employees.filter(e => e.providerName).map(e => e.providerName))];
  const classes = [...new Set(employees.filter(e => e.insuranceClass).map(e => e.insuranceClass))];

  const openDetail = (empId: string) => { setDetailEmpId(empId); setDetailOpen(true); };

  const openEnroll = (empId: string, empName: string) => {
    setEnrollEmpId(empId); setEnrollEmpName(empName); setEnrollOpen(true);
  };
  const openAddDep = (empId: string, empName: string) => {
    setDepEmpId(empId); setDepEmpName(empName); setDepOpen(true);
  };
  const openChangeClass = (empId: string, empName: string, currentTier: string) => {
    setClassEmpId(empId); setClassEmpName(empName); setClassCurrentTier(currentTier); setClassOpen(true);
  };
  const openClaim = (empId: string, empName: string) => {
    setClaimEmpId(empId); setClaimEmpName(empName); setClaimOpen(true);
  };
  const openCancel = (empId: string, empName: string) => {
    setCancelEmpId(empId); setCancelEmpName(empName); setCancelOpen(true);
  };

  const handleReplaceCard = async (empId: string) => {
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replace-card', employeeId: empId }),
      });
      const d = await r.json();
      if (d.success) toast.success(tr('تم تقديم طلب استبدال البطاقة', 'Card replacement request submitted'));
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error('Error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CVisionButton C={C} isDark={isDark} onClick={() => openEnroll('', '')}>
            <UserPlus style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("تسجيل موظف", "Enroll Employee")}
          </CVisionButton>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C} style={{ paddingLeft: 32, width: 240 }} placeholder={tr("بحث بالاسم أو الرقم أو البطاقة...", "Search name, ID, card...")} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <CVisionSelect
                C={C}
                value={providerFilter || 'ALL'}
                placeholder={tr("مقدم الخدمة", "Provider")}
                options={[
                  { value: 'ALL', label: tr("جميع مقدمي الخدمة", "All Providers") },
                  ...providers.map(p => ({ value: p, label: p })),
                ]}
                style={{ width: 144 }}
              />
          <CVisionSelect
                C={C}
                value={classFilter || 'ALL'}
                placeholder={tr("الفئة", "Class")}
                options={[
                  { value: 'ALL', label: tr("جميع الفئات", "All Classes") },
                  ...classes.map(c => ({ value: c, label: TIER_LABELS[c]?.label || c })),
                ]}
                style={{ width: 128 }}
              />
        </div>
      </div>

      {/* Filter badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CVisionButton C={C} isDark={isDark} variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          {tr("الكل", "All")} ({stats?.total || 0})
        </CVisionButton>
        <CVisionButton C={C} isDark={isDark} variant={filter === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('active')}>
          <Shield style={{ height: 14, width: 14, marginRight: 4 }} /> {tr("نشط", "Active")} ({stats?.active || 0})
        </CVisionButton>
        <CVisionButton C={C} isDark={isDark} variant={filter === 'not_insured' ? 'destructive' : 'outline'} size="sm" onClick={() => setFilter('not_insured')}>
          <XCircle style={{ height: 14, width: 14, marginRight: 4 }} /> {tr("غير مؤمَّن", "Not Insured")} ({stats?.notInsured || 0})
        </CVisionButton>
        <CVisionButton C={C} isDark={isDark} variant={filter === 'expiring' ? 'secondary' : 'outline'} size="sm" onClick={() => setFilter('expiring')}>
          <AlertTriangle style={{ height: 14, width: 14, marginRight: 4 }} /> {tr("تنتهي قريباً", "Expiring Soon")} ({stats?.expiringSoon || 0})
        </CVisionButton>
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /> : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr("الموظف", "Employee")}</CVisionTh>
                  <CVisionTh C={C}>{tr("مقدم الخدمة", "Provider")}</CVisionTh>
                  <CVisionTh C={C}>{tr("الفئة", "Class")}</CVisionTh>
                  <CVisionTh C={C}>{tr("المعالون", "Dependents")}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr("الشهري", "Monthly")}</CVisionTh>
                  <CVisionTh C={C}>{tr("الحالة", "Status")}</CVisionTh>
                  <CVisionTh C={C} style={{ width: 40 }}></CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {filtered.map(emp => (
                  <CVisionTr C={C} key={emp.employeeId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => emp.insured && openDetail(emp.employeeId)}
                  >
                    <CVisionTd>
                      <div style={{ fontWeight: 500 }}>{emp.fullName}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{emp.employeeId}</div>
                    </CVisionTd>
                    <CVisionTd>
                      {emp.insured ? (
                        <div>
                          <div style={{ fontSize: 13 }}>{emp.providerName}</div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>{emp.planName}</div>
                        </div>
                      ) : (
                        <span style={{ color: C.orange, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle style={{ height: 14, width: 14 }} /> {tr("غير مؤمَّن", "NOT INSURED")}
                        </span>
                      )}
                    </CVisionTd>
                    <CVisionTd>
                      {emp.insured ? <TierBadge tier={emp.insuranceClass} /> : <span style={{ color: C.textMuted }}>—</span>}
                    </CVisionTd>
                    <CVisionTd>
                      {emp.insured ? (
                        emp.dependentCount > 0 ? (
                          <span style={{ fontSize: 13 }}>{emp.dependentCount} {emp.dependentCount > 1 ? tr('أعضاء', 'members') : tr('عضو', 'member')}</span>
                        ) : <span style={{ color: C.textMuted }}>—</span>
                      ) : <span style={{ color: C.textMuted }}>—</span>}
                    </CVisionTd>
                    <CVisionTd align="right">
                      {emp.insured ? <span style={{ fontWeight: 500 }}>{fmtSAR(emp.monthlyPremium)}</span> : <span style={{ color: C.textMuted }}>—</span>}
                    </CVisionTd>
                    <CVisionTd>
                      {emp.insured ? (
                        <CVisionBadge C={C} variant={emp.expiringSoon ? 'outline' : 'default'}>
                          {emp.expiringSoon ? tr('تنتهي قريباً', 'Expiring') : tr('نشط', 'Active')}
                        </CVisionBadge>
                      ) : (
                        <CVisionBadge C={C} variant="danger">{tr("غير مؤمَّن", "Not Insured")}</CVisionBadge>
                      )}
                    </CVisionTd>
                    <CVisionTd>
                      <div onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 32, width: 32, padding: 0 }}>
                            <MoreHorizontal style={{ height: 16, width: 16 }} />
                          </CVisionButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ width: 208 }}>
                          {emp.insured ? (
                            <>
                              <DropdownMenuItem onClick={() => openDetail(emp.employeeId)}>
                                <Eye style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("عرض التفاصيل", "View Details")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openAddDep(emp.employeeId, emp.fullName)}>
                                <UserPlus style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("إضافة معال", "Add Dependent")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDetail(emp.employeeId)}>
                                <UserMinus style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("إزالة معال", "Remove Dependent")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openChangeClass(emp.employeeId, emp.fullName, emp.insuranceClass)}>
                                <ArrowUpCircle style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("ترقية الفئة", "Upgrade Class")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openChangeClass(emp.employeeId, emp.fullName, emp.insuranceClass)}>
                                <ArrowDownCircle style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("تخفيض الفئة", "Downgrade Class")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openClaim(emp.employeeId, emp.fullName)}>
                                <DollarSign style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("تقديم مطالبة", "Submit Claim")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReplaceCard(emp.employeeId)}>
                                <CreditCard style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("استبدال البطاقة", "Replace Card")}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => openCancel(emp.employeeId, emp.fullName)}>
                                <XCircle style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("إلغاء التأمين", "Cancel Insurance")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openDetail(emp.employeeId)}>
                                <History style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("عرض السجل", "View History")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast.info(tr('ميزة الطباعة قادمة قريباً', 'Print functionality coming soon'))}>
                                <Printer style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("طباعة البطاقة", "Print Card")}
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onClick={() => openEnroll(emp.employeeId, emp.fullName)}>
                              <Shield style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("تسجيل في التأمين", "Enroll in Insurance")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </CVisionTd>
                  </CVisionTr>
                ))}
                {filtered.length === 0 && (
                  <CVisionTr C={C}><CVisionTd align="center" colSpan={7} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr("لا يوجد موظفون.", "No employees found.")}</CVisionTd></CVisionTr>
                )}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* CCHI Warning */}
      {stats && stats.notInsured > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, background: C.orangeDim, border: `1px solid ${C.border}`, color: C.orange }}>
          <AlertTriangle style={{ height: 20, width: 20, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {stats.notInsured} {stats.notInsured > 1 ? tr('موظفين بدون', 'employees without') : tr('موظف بدون', 'employee without')} {tr("تأمين إلزامي (مخالفة CCHI)", "mandatory insurance (CCHI violation)")}
          </span>
        </div>
      )}

      {/* All dialogs */}
      <EmployeeDetailDialog open={detailOpen} onOpenChange={setDetailOpen} employeeId={detailEmpId} onAction={load} />
      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} employeeId={enrollEmpId} employeeName={enrollEmpName} onSuccess={load} />
      <AddDependentDialog open={depOpen} onOpenChange={setDepOpen} employeeId={depEmpId} employeeName={depEmpName} onSuccess={load} />
      <ChangeClassDialog open={classOpen} onOpenChange={setClassOpen} employeeId={classEmpId} employeeName={classEmpName} currentTier={classCurrentTier} />
      <SubmitClaimDialog open={claimOpen} onOpenChange={setClaimOpen} employeeId={claimEmpId} employeeName={claimEmpName} />
      <CancelInsuranceDialog open={cancelOpen} onOpenChange={setCancelOpen} employeeId={cancelEmpId} employeeName={cancelEmpName} onSuccess={load} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// EMPLOYEE DETAIL DIALOG (sub-tabs: Insurance, Dependents, Claims, History)
// ═══════════════════════════════════════════════════════════════════════
function EmployeeDetailDialog({ open, onOpenChange, employeeId, onAction }: {
  open: boolean; onOpenChange: (o: boolean) => void; employeeId: string; onAction?: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('insurance');
  const [depOpen, setDepOpen] = useState(false);

  const loadDetail = useCallback(async (signal?: AbortSignal) => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}?action=employee-full-detail&employeeId=${employeeId}`, { credentials: 'include', signal });
      const d = await r.json();
      if (d.success) setData(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [employeeId]);

  useEffect(() => { if (!open || !employeeId) return; setTab('insurance'); const ac = new AbortController(); loadDetail(ac.signal); return () => ac.abort(); }, [open, employeeId, loadDetail]);

  const removeDep = async (depId: string) => {
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-dependent', employeeId, dependentId: depId }),
      });
      const d = await r.json();
      if (d.success) { toast.success(tr('تم إزالة المعال', 'Dependent removed')); loadDetail(); onAction?.(); }
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error('Error'); }
  };

  const activeDeps = data?.insurance?.dependents?.filter((d: any) => d.status === 'ACTIVE') || [];
  const maxDeps = 7;

  return (
    <>
      <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr("التفاصيل", "Details")} isDark={isDark}>            
          {loading ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: '100%' }}  /><CVisionSkeletonCard C={C} height={200} style={{ height: 128, width: '100%' }}  /></div> : data?.insurance ? (
            <>
              <CVisionTabs
                C={C}
                activeTab={tab}
                onChange={setTab}
                tabs={[
                  { id: 'insurance', label: tr("التأمين", "Insurance") },
                  { id: 'dependents', label: `${tr("المعالون", "Dependents")} (${activeDeps.length})` },
                  { id: 'claims', label: tr("المطالبات", "Claims") },
                  { id: 'history', label: tr("السجل", "History") },
                ]}
              >
                {/* Insurance Sub-tab */}
                <CVisionTabContent tabId="insurance">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 13 }}>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: 12 }}>{tr("مقدم الخدمة", "Provider")}</span>
                      <div style={{ fontWeight: 500 }}>{data.insurance.providerName} ({data.insurance.planName})</div>
                    </div>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: 12 }}>{tr("الفئة", "Class")}</span>
                      <div><TierBadge tier={data.insurance.tier} /></div>
                    </div>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: 12 }}>{tr("رقم البطاقة", "Card #")}</span>
                      <div style={{ fontFamily: 'monospace', fontWeight: 500 }}>{data.insurance.cardNumber}</div>
                    </div>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: 12 }}>{tr("رقم العضوية", "Membership #")}</span>
                      <div style={{ fontFamily: 'monospace' }}>{data.insurance.membershipNumber}</div>
                    </div>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: 12 }}>{tr("الفترة", "Valid")}</span>
                      <div>{fmtDate(data.insurance.enrollmentDate)} — {fmtDate(data.insurance.expiryDate)}</div>
                    </div>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: 12 }}>{tr("الحالة", "Status")}</span>
                      <div><CVisionBadge C={C} variant={STATUS_VARIANTS[data.insurance.status]}>{data.insurance.status}</CVisionBadge></div>
                    </div>
                  </div>
                  <hr />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 13 }}>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: 12 }}>{tr("القسط", "Premium")}</span>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtSAR(data.insurance.monthlyPremium)}<span style={{ fontSize: 12, color: C.textMuted }}>/{tr("شهر", "month")}</span></div>
                    </div>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: 12 }}>{tr("تدفع الشركة (75%)", "Company pays (75%)")}</span>
                      <div style={{ color: C.green, fontWeight: 600 }}>{fmtSAR(data.insurance.employerContribution)}</div>
                    </div>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: 12 }}>{tr("يدفع الموظف (25%)", "Employee pays (25%)")}</span>
                      <div style={{ color: C.blue, fontWeight: 600 }}>{fmtSAR(data.insurance.employeeContribution)}</div>
                    </div>
                  </div>
                </div>
                </CVisionTabContent>

                {/* Dependents Sub-tab */}
                <CVisionTabContent tabId="dependents">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                  {activeDeps.length === 0 ? (
                    <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>{tr("لم يتم إضافة معالين بعد.", "No dependents added yet.")}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activeDeps.map((dep: any) => (
                        <div key={dep.dependentId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, border: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.bgSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                              {dep.relationship === 'SPOUSE' ? '👩' : dep.relationship === 'PARENT' ? '👴' : '👦'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{dep.name}</div>
                              <div style={{ fontSize: 12, color: C.textMuted }}>
                                {dep.relationship} {dep.dateOfBirth ? `· DOB: ${dep.dateOfBirth}` : ''}
                                {dep.nationalId ? ` · ID: ${dep.nationalId}` : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CVisionBadge C={C} variant="default" style={{ fontSize: 12 }}>{tr("نشط", "Active")}</CVisionBadge>
                            <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 28 }} onClick={() => removeDep(dep.dependentId)}>
                              {tr("إزالة", "Remove")}
                            </CVisionButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
                    <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => setDepOpen(true)}>
                      <Plus style={{ height: 14, width: 14, marginRight: 4 }} /> {tr("إضافة معال", "Add Dependent")}
                    </CVisionButton>
                    <span style={{ fontSize: 12, color: C.textMuted }}>
                      {tr("الفتحات المتبقية:", "Remaining slots:")} {maxDeps - activeDeps.length} {tr("أكثر (الحد الأقصى", "more (max")} {maxDeps} {tr("معالين)", "dependents)")}
                    </span>
                  </div>
                </div>
                </CVisionTabContent>

                {/* Claims Sub-tab */}
                <CVisionTabContent tabId="claims">
                <div style={{ marginTop: 16 }}>
                  {(data.claims || []).length === 0 ? (
                    <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>{tr("لا توجد مطالبات لهذا الموظف.", "No claims for this employee.")}</p>
                  ) : (
                    <CVisionTable C={C}>
                      <CVisionTableHead C={C}>
                          <CVisionTh C={C}>{tr("رقم المطالبة", "Claim ID")}</CVisionTh>
                          <CVisionTh C={C}>{tr("النوع", "Type")}</CVisionTh>
                          <CVisionTh C={C}>{tr("التاريخ", "Date")}</CVisionTh>
                          <CVisionTh C={C} align="right">{tr("المبلغ", "Amount")}</CVisionTh>
                          <CVisionTh C={C}>{tr("الحالة", "Status")}</CVisionTh>
                      </CVisionTableHead>
                      <CVisionTableBody>
                        {data.claims.map((c: any) => (
                          <CVisionTr C={C} key={c.claimId}>
                            <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.claimId}</CVisionTd>
                            <CVisionTd><CVisionBadge C={C} className={`text-xs ${CLAIM_COLORS[c.type] || ''}`}>{c.type}</CVisionBadge></CVisionTd>
                            <CVisionTd style={{ fontSize: 13 }}>{fmtDate(c.claimDate)}</CVisionTd>
                            <CVisionTd align="right" style={{ fontSize: 13 }}>{fmtSAR(c.amount)}</CVisionTd>
                            <CVisionTd><CVisionBadge C={C} variant={STATUS_VARIANTS[c.status] || 'secondary'}>{c.status}</CVisionBadge></CVisionTd>
                          </CVisionTr>
                        ))}
                      </CVisionTableBody>
                    </CVisionTable>
                  )}
                </div>
                </CVisionTabContent>

                {/* History Sub-tab */}
                <CVisionTabContent tabId="history">
                <div style={{ marginTop: 16 }}>
                  {(data.requests || []).length === 0 ? (
                    <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>{tr("لا توجد سجلات سابقة.", "No history records.")}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {data.requests.map((req: any) => (
                        <div key={req.requestId} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, backgroundColor: req.status === 'APPROVED' || req.status === 'PROCESSED' ? '#22c55e'
                              : req.status === 'REJECTED' ? '#ef4444' : '#f59e0b' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{getReqTypeLabel(req.type, language)}</div>
                            <div style={{ fontSize: 12, color: C.textMuted }}>{fmtDate(req.submittedAt)} · {req.status}</div>
                            {req.details?.reason && <div style={{ fontSize: 12, marginTop: 4 }}>{req.details.reason}</div>}
                          </div>
                          <CVisionBadge C={C} variant={STATUS_VARIANTS[req.status] || 'secondary'} style={{ fontSize: 12 }}>{req.status}</CVisionBadge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </CVisionTabContent>
              </CVisionTabs>
            </>
          ) : (
            <p style={{ color: C.textMuted, fontSize: 13, paddingTop: 32, paddingBottom: 32, textAlign: 'center' }}>{tr("لا توجد بيانات تأمين لهذا الموظف.", "No insurance data found for this employee.")}</p>
          )}
      </CVisionDialog>

      <AddDependentDialog
        open={depOpen}
        onOpenChange={setDepOpen}
        employeeId={employeeId}
        employeeName={data?.employee?.fullName || ''}
        currentPremium={data?.insurance?.monthlyPremium}
        onSuccess={() => { loadDetail(); onAction?.(); }}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ENROLL DIALOG
// ═══════════════════════════════════════════════════════════════════════
function EnrollDialog({ open, onOpenChange, employeeId, employeeName, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; employeeId: string; employeeName: string; onSuccess: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [plans, setPlans] = useState<any[]>([]);
  const [uninsured, setUninsured] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedEmpId(employeeId || '');
    setSelectedPlan(null);
    setEffectiveDate(new Date().toISOString().slice(0, 10));
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API}?action=available-plans`, { credentials: 'include', signal: ac.signal }),
          fetch(`${API}?action=uninsured`, { credentials: 'include', signal: ac.signal }),
        ]);
        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        if (d1.success) setPlans(d1.plans || []);
        if (d2.success) setUninsured(d2.uninsured || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, [open, employeeId]);

  const enroll = async () => {
    const empId = selectedEmpId || employeeId;
    if (!empId || !selectedPlan) return;
    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enroll-employee',
          employeeId: empId,
          providerId: selectedPlan.providerId,
          planId: selectedPlan.planId,
          policyId: selectedPlan.policyId,
          tier: selectedPlan.tier,
          effectiveDate,
        }),
      });
      const d = await r.json();
      if (d.success) { toast.success(tr('تم تسجيل الموظف بنجاح', 'Employee enrolled successfully')); onOpenChange(false); onSuccess(); }
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error('Error'); } finally { setSubmitting(false); }
  };

  const providerGroups = plans.reduce((acc: Record<string, any[]>, p) => {
    (acc[p.providerName] = acc[p.providerName] || []).push(p);
    return acc;
  }, {});

  const annual = selectedPlan ? selectedPlan.annualPremium || selectedPlan.monthlyPremium * 12 : 0;
  const companyPct = 0.75;

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr("التفاصيل", "Details")} isDark={isDark}>          
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr("اختر مقدم الخدمة والفئة وتاريخ السريان.", "Select provider, class, and effective date.")}</p>
        {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 160, width: '100%' }}  /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Employee selector (if not pre-selected) */}
            {!employeeId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>{tr("الموظف *", "Employee *")}</label>
                <CVisionSelect
                C={C}
                value={selectedEmpId || undefined}
                onChange={setSelectedEmpId}
                placeholder={tr("اختر موظفاً غير مؤمَّن...", "Select uninsured employee...")}
                options={uninsured.map((e: any) => (
                      ({ value: e.employeeId, label: `${e.fullName || e.employeeId} — ${e.department || e.departmentName || ''}` })
                    ))}
              />
              </div>
            )}

            {/* Provider + Plan */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr("خطة التأمين *", "Insurance Plan *")}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
                {Object.entries(providerGroups).map(([provName, provPlans]) => (
                  <div key={provName}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>{provName}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(provPlans as any[]).sort((a: any, b: any) => b.monthlyPremium - a.monthlyPremium).map((p: any) => (
                        <div
                          key={`${p.providerId}-${p.planId}`}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            selectedPlan?.planId === p.planId && selectedPlan?.providerId === p.providerId
                              ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                          }`}
                          onClick={() => setSelectedPlan(p)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                selectedPlan?.planId === p.planId && selectedPlan?.providerId === p.providerId
                                  ? 'border-primary' : 'border-muted-foreground/30'
                              }`}>
                                {selectedPlan?.planId === p.planId && selectedPlan?.providerId === p.providerId && (
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.gold }} />
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>{p.planName}</div>
                                <TierBadge tier={p.tier} />
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtSAR(p.monthlyPremium)}/{tr("شهر", "mo")}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, marginLeft: 24 }}>
                            {(p.benefits || []).slice(0, 4).map((b: string) => (
                              <span key={b} style={{ fontSize: 12, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, background: C.bgSubtle, borderRadius: 6 }}>{b}</span>
                            ))}
                            {(p.benefits || []).length > 4 && (
                              <span style={{ fontSize: 12, color: C.textMuted }}>+{p.benefits.length - 4} {tr('المزيد', 'more')}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Effective date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr("تاريخ السريان *", "Effective Date *")}</label>
              <CVisionInput C={C} type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
            </div>

            {/* Cost summary */}
            {selectedPlan && (
              <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>{tr("ملخص التكلفة", "Cost Summary")}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr("السنوي", "Annual")}</span><span style={{ fontWeight: 500 }}>{fmtSAR(annual)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr("الشركة (75%)", "Company (75%)")}</span><span style={{ color: C.green }}>{fmtSAR(Math.round(annual * companyPct))}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr("الموظف (25%)", "Employee (25%)")}</span><span style={{ color: C.blue }}>{fmtSAR(Math.round(annual * (1 - companyPct)))}</span></div>
                <hr />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr("الاستقطاع الشهري", "Monthly deduction")}</span><span style={{ fontWeight: 700 }}>{fmtSAR(Math.round(selectedPlan.monthlyPremium * (1 - companyPct)))}</span></div>
              </div>
            )}

            <p style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Shield style={{ height: 12, width: 12 }} /> {tr("يمكن إضافة المعالين بعد التسجيل", "Can add dependents after enrollment")}
            </p>
          </div>
        )}

        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr("إلغاء", "Cancel")}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={enroll} disabled={submitting || !(selectedEmpId || employeeId) || !selectedPlan}>
            {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />} {tr("تسجيل الموظف", "Enroll Employee")}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ADD DEPENDENT DIALOG
// ═══════════════════════════════════════════════════════════════════════
function AddDependentDialog({ open, onOpenChange, employeeId, employeeName, currentPremium, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; employeeId: string; employeeName: string;
  currentPremium?: number; onSuccess?: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [form, setForm] = useState({ name: '', nameAr: '', relationship: 'SPOUSE', dateOfBirth: '', nationalId: '', gender: 'Male' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: '', nameAr: '', relationship: 'SPOUSE', dateOfBirth: '', nationalId: '', gender: 'Male' });
  }, [open]);

  const RULES: Record<string, { max: number; doc: string; note: string }> = {
    SPOUSE: { max: 1, doc: tr('شهادة الزواج مطلوبة', 'Marriage certificate required'), note: tr('زوج واحد فقط مسموح', 'Only 1 spouse allowed') },
    CHILD: { max: 4, doc: tr('شهادة الميلاد مطلوبة', 'Birth certificate required'), note: tr('يجب أن يكون تحت 25 سنة', 'Must be under 25 years old') },
    PARENT: { max: 2, doc: tr('الهوية الوطنية مطلوبة', 'National ID required'), note: tr('حتى والدين', 'Up to 2 parents') },
  };
  const rule = RULES[form.relationship] || RULES.SPOUSE;

  const premium = currentPremium || 600;
  const addition = Math.round(premium * 0.38);
  const newTotal = premium + addition;
  const companyPct = 0.75;

  const submit = async () => {
    if (!form.name || !form.nationalId) { toast.error(tr('يرجى ملء الحقول المطلوبة', 'Please fill required fields')); return; }
    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-dependent', employeeId, dependent: form }),
      });
      const d = await r.json();
      if (d.success) { toast.success(tr('تم إضافة المعال', 'Dependent added')); onOpenChange(false); onSuccess?.(); }
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error('Error'); } finally { setSubmitting(false); }
  };

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr("التفاصيل", "Details")} isDark={isDark}>          
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Relationship */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{tr("صلة القرابة *", "Relationship *")}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {['SPOUSE', 'CHILD', 'PARENT'].map(rel => (
                <button
                  key={rel}
                  type="button"
                  className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-colors ${
                    form.relationship === rel ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setForm(p => ({ ...p, relationship: rel }))}
                >
                  {rel === 'SPOUSE' ? `👩 ${tr('زوج/ة', 'Spouse')}` : rel === 'CHILD' ? `👦 ${tr('ابن/ابنة', 'Child')}` : `👴 ${tr('أحد الوالدين', 'Parent')}`}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle style={{ height: 12, width: 12, color: C.green }} /> {rule.note}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileText style={{ height: 12, width: 12, color: C.blue }} /> {rule.doc}</div>
              {form.relationship === 'CHILD' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle style={{ height: 12, width: 12, color: C.orange }} /> {tr("يجب أن يكون تحت 25 سنة", "Must be under 25 years old")}</div>
              )}
            </div>
          </div>

          {/* Names */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr("الاسم الكامل *", "Full Name *")}</label>
              <CVisionInput C={C} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={tr("الاسم الكامل", "Full name")} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr("الاسم (عربي)", "Name (Arabic)")}</label>
              <CVisionInput C={C} value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} placeholder="الاسم بالعربي" dir="rtl" />
            </div>
          </div>

          {/* ID & DOB */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr("الهوية الوطنية *", "National ID *")}</label>
              <CVisionInput C={C} value={form.nationalId} onChange={e => setForm(p => ({ ...p, nationalId: e.target.value }))} placeholder="10XXXXXXXXX" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr("تاريخ الميلاد *", "Date of Birth *")}</label>
              <CVisionInput C={C} type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} />
            </div>
          </div>

          {/* Gender */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{tr("الجنس *", "Gender *")}</label>
            <div style={{ display: 'flex', gap: 16 }}>
              {[tr('ذكر', 'Male'), tr('أنثى', 'Female')].map(g => (
                <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" name="gender" checked={form.gender === g} onChange={() => setForm(p => ({ ...p, gender: g }))} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 13 }}>{g}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Cost impact */}
          <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>{tr("أثر التكلفة", "Cost Impact")}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr("الحالي", "Current")}</span><span>{fmtSAR(premium)}/{tr("شهر", "month")}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.green }}><span>{tr("الإضافة", "Addition")}</span><span>+{fmtSAR(addition)}/{tr("شهر", "month")}</span></div>
            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>{tr("المجموع الجديد", "New total")}</span><span>{fmtSAR(newTotal)}/{tr("شهر", "month")}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMuted }}>
              <span>{tr("تدفع الشركة:", "Company pays:")} {fmtSAR(Math.round(newTotal * companyPct))} (75%)</span>
              <span>{tr("حصتك:", "Your share:")} {fmtSAR(Math.round(newTotal * (1 - companyPct)))} (25%)</span>
            </div>
          </div>

          <p style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock style={{ height: 12, width: 12 }} /> {tr("الطلب يحتاج موافقة مدير الموارد البشرية", "Request needs HR Manager approval")}
          </p>
        </div>

        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr("إلغاء", "Cancel")}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={submit} disabled={submitting || !form.name || !form.nationalId}>
            {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
            <Send style={{ height: 16, width: 16, marginRight: 8 }} /> {tr("تقديم الطلب", "Submit Request")}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CHANGE CLASS DIALOG (Upgrade / Downgrade)
// ═══════════════════════════════════════════════════════════════════════
function ChangeClassDialog({ open, onOpenChange, employeeId, employeeName, currentTier }: {
  open: boolean; onOpenChange: (o: boolean) => void; employeeId: string; employeeName: string; currentTier: string;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedPlan(null);
    setReason('');
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API}?action=available-plans`, { credentials: 'include', signal: ac.signal }),
          fetch(`${API}?action=employee-full-detail&employeeId=${employeeId}`, { credentials: 'include', signal: ac.signal }),
        ]);
        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        if (d1.success) setPlans(d1.plans || []);
        if (d2.success) setDetail(d2);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, [open, employeeId]);

  const currentPremium = detail?.insurance?.monthlyPremium || 0;
  const depCount = (detail?.insurance?.dependents || []).filter((d: any) => d.status === 'ACTIVE').length;

  const submit = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-class',
          employeeId,
          newPlanId: selectedPlan.planId,
          newProviderId: selectedPlan.providerId,
          reason,
        }),
      });
      const d = await r.json();
      if (d.success) { toast.success(tr('تم تقديم طلب تغيير الفئة', 'Class change request submitted')); onOpenChange(false); }
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error(tr('خطأ', 'Error')); } finally { setSubmitting(false); }
  };

  const TIER_ORDER: Record<string, number> = { VIP: 4, PREMIUM: 3, STANDARD: 2, BASIC: 1 };

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr("التفاصيل", "Details")} isDark={isDark}>          
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
            {tr('الحالي', 'Current')}: <TierBadge tier={currentTier} /> — {fmtSAR(currentPremium)}/{tr('شهر', 'month')}
          </p>
        {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Plan selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الخطط المتاحة', 'Available Plans')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                {plans.sort((a, b) => (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0)).map(p => {
                  const isCurrent = p.tier === currentTier;
                  const diff = p.monthlyPremium - currentPremium;
                  return (
                    <div
                      key={`${p.providerId}-${p.planId}`}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        isCurrent ? 'border-primary/40 bg-primary/5 opacity-70' :
                        selectedPlan?.planId === p.planId && selectedPlan?.providerId === p.providerId
                          ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                      }`}
                      onClick={() => !isCurrent && setSelectedPlan(p)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isCurrent ? 'border-primary bg-primary/20' :
                            selectedPlan?.planId === p.planId && selectedPlan?.providerId === p.providerId
                              ? 'border-primary' : 'border-muted-foreground/30'
                          }`}>
                            {(isCurrent || (selectedPlan?.planId === p.planId && selectedPlan?.providerId === p.providerId)) && (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.gold }} />
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>
                              {p.planName}
                              {isCurrent && <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 4 }}>({tr('الحالي', 'Current')})</span>}
                            </div>
                            <TierBadge tier={p.tier} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtSAR(p.monthlyPremium)}/{tr('شهر', 'mo')}</div>
                          {!isCurrent && diff !== 0 && (
                            <div className={`text-xs font-medium ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {diff > 0 ? '+' : ''}{fmtSAR(diff)}/{tr('شهر', 'mo')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, marginLeft: 24 }}>
                        {(p.benefits || []).map((b: string) => (
                          <span key={b} style={{ fontSize: 12, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, background: C.bgSubtle, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                            <Check style={{ height: 10, width: 10, color: C.green }} /> {b}
                          </span>
                        ))}
                      </div>
                      {p.deductible !== undefined && (
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, marginLeft: 24 }}>
                          {tr('الخصم', 'Deductible')}: {p.deductible > 0 ? `${fmtSAR(p.deductible)} ${tr('لكل زيارة', 'per visit')}` : tr('بدون خصم', 'Zero deductible')} · {tr('الرسوم المشتركة', 'Copay')}: {p.copay}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reason */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('سبب التغيير *', 'Reason for change *')}</label>
              <CVisionInput C={C} value={reason} onChange={e => setReason(e.target.value)} placeholder={tr('مثال: ترقية إلى مدير موارد بشرية أول', 'e.g. Promoted to Senior HR Manager')} />
            </div>

            {/* Cost impact */}
            {selectedPlan && (
              <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>{tr('تأثير التكلفة', 'Cost Impact')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                  <div></div>
                  <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{tr('الموظف', 'Employee')}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{tr('التابعون', 'Dependents')}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                  <div style={{ textAlign: 'left', fontSize: 12 }}>{tr('الحالي', 'Current')}</div>
                  <div>{fmtSAR(currentPremium)}</div>
                  <div>{depCount > 0 ? fmtSAR(Math.round(currentPremium * 0.38 * depCount)) : '—'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                  <div style={{ textAlign: 'left', fontSize: 12 }}>{tr('الجديد', 'New')}</div>
                  <div style={{ fontWeight: 500 }}>{fmtSAR(selectedPlan.monthlyPremium)}</div>
                  <div style={{ fontWeight: 500 }}>{depCount > 0 ? fmtSAR(Math.round(selectedPlan.monthlyPremium * 0.38 * depCount)) : '—'}</div>
                </div>
                <hr />
                {(() => {
                  const empDiff = selectedPlan.monthlyPremium - currentPremium;
                  const depDiff = depCount > 0 ? Math.round(selectedPlan.monthlyPremium * 0.38 * depCount) - Math.round(currentPremium * 0.38 * depCount) : 0;
                  const totalDiff = empDiff + depDiff;
                  return (
                    <>
                      <div className={`flex justify-between font-bold ${totalDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        <span>{tr('الإجمالي الشهري', 'Total monthly')} {totalDiff > 0 ? tr('زيادة', 'increase') : tr('توفير', 'saving')}</span>
                        <span>{totalDiff > 0 ? '+' : ''}{fmtSAR(totalDiff)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>
                        {tr('التأثير السنوي', 'Annual impact')}: {totalDiff > 0 ? '+' : ''}{fmtSAR(totalDiff * 12)}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {depCount > 0 && selectedPlan && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.orange, background: C.orangeDim, padding: 8, borderRadius: 6, border: `1px solid ${C.border}` }}>
                <AlertTriangle style={{ height: 14, width: 14, flexShrink: 0 }} />
                {tr('سيتم نقل التابعين إلى الفئة الجديدة أيضاً', 'Dependents will also be moved to the new class')}
              </div>
            )}

            <p style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock style={{ height: 12, width: 12 }} /> {tr('الطلب يحتاج موافقة مدير الموارد البشرية + المالية', 'Request needs HR Manager + Finance approval')}
            </p>
          </div>
        )}

        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={submit} disabled={submitting || !selectedPlan || !reason}>
            {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
            <Send style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('تقديم طلب التغيير', 'Submit Change Request')}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUBMIT CLAIM DIALOG
// ═══════════════════════════════════════════════════════════════════════
function SubmitClaimDialog({ open, onOpenChange, employeeId, employeeName }: {
  open: boolean; onOpenChange: (o: boolean) => void; employeeId: string; employeeName: string;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [form, setForm] = useState({ type: 'OUTPATIENT', provider: '', diagnosis: '', amount: '', receiptNumber: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setForm({ type: 'OUTPATIENT', provider: '', diagnosis: '', amount: '', receiptNumber: '' });
  }, [open]);

  const submit = async () => {
    if (!form.amount) { toast.error(tr('المبلغ مطلوب', 'Amount is required')); return; }
    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit-claim', employeeId, ...form }),
      });
      const d = await r.json();
      if (d.success) { toast.success(`${tr('تم تقديم المطالبة', 'Claim')} ${d.claimId} ${tr('', 'submitted')}`); onOpenChange(false); }
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error(tr('خطأ', 'Error')); } finally { setSubmitting(false); }
  };

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr("التفاصيل", "Details")} isDark={isDark}>                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('النوع *', 'Type *')}</label>
            <CVisionSelect
                C={C}
                value={form.type}
                options={[
                  { value: 'OUTPATIENT', label: tr('خارجي', 'Outpatient') },
                  { value: 'INPATIENT', label: tr('داخلي', 'Inpatient') },
                  { value: 'DENTAL', label: tr('أسنان', 'Dental') },
                  { value: 'PHARMACY', label: tr('صيدلية', 'Pharmacy') },
                  { value: 'EMERGENCY', label: tr('طوارئ', 'Emergency') },
                  { value: 'OPTICAL', label: tr('بصريات', 'Optical') },
                  { value: 'MATERNITY', label: tr('أمومة', 'Maternity') },
                ]}
              />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('مقدم الرعاية الصحية', 'Healthcare Provider')}</label>
            <CVisionInput C={C} value={form.provider} onChange={e => setForm(p => ({ ...p, provider: e.target.value }))} placeholder={tr('مستشفى / عيادة', 'Hospital / Clinic')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('التشخيص', 'Diagnosis')}</label>
            <CVisionInput C={C} value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('المبلغ (ريال) *', 'Amount (SAR) *')}</label>
              <CVisionInput C={C} type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('رقم الإيصال #', 'Receipt #')}</label>
              <CVisionInput C={C} value={form.receiptNumber} onChange={e => setForm(p => ({ ...p, receiptNumber: e.target.value }))} />
            </div>
          </div>
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={submit} disabled={submitting || !form.amount}>
            {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />} {tr('تقديم المطالبة', 'Submit Claim')}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CANCEL INSURANCE DIALOG
// ═══════════════════════════════════════════════════════════════════════
function CancelInsuranceDialog({ open, onOpenChange, employeeId, employeeName, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; employeeId: string; employeeName: string; onSuccess: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) setReason(''); }, [open]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel-insurance', employeeId, reason }),
      });
      const d = await r.json();
      if (d.success) { toast.success(tr('تم تقديم طلب الإلغاء', 'Cancellation request submitted')); onOpenChange(false); onSuccess(); }
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error(tr('خطأ', 'Error')); } finally { setSubmitting(false); }
  };

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr("التفاصيل", "Details")} isDark={isDark}>          
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('سيتم إنشاء طلب إلغاء يحتاج إلى موافقة.', 'This will create a cancellation request that needs approval.')}</p>        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 12, borderRadius: 12, background: C.redDim, border: `1px solid ${C.border}`, color: C.red, fontSize: 13 }}>
            <AlertTriangle style={{ height: 16, width: 16, marginRight: 4 }} />
            {tr('إلغاء التأمين يُعدّ انتهاكاً لـ CCHI للموظفين النشطين. تأكد من الامتثال.', 'Cancelling insurance is a CCHI violation for active employees. Ensure this is compliant.')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('السبب *', 'Reason *')}</label>
            <CVisionTextarea C={C} value={reason} onChange={e => setReason(e.target.value)} placeholder={tr('سبب الإلغاء...', 'Reason for cancellation...')} rows={3} />
          </div>
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="danger" onClick={submit} disabled={submitting || !reason}>
            {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />} {tr('تقديم الإلغاء', 'Submit Cancellation')}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// REQUESTS TAB
// ═══════════════════════════════════════════════════════════════════════
function RequestsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [processOpen, setProcessOpen] = useState(false);
  const [processReq, setProcessReq] = useState<any>(null);
  const [processNotes, setProcessNotes] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      let url = `${API}?action=list-requests`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const r = await fetch(url, { credentials: 'include', signal });
      const d = await r.json();
      if (d.success) setRequests(d.requests || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const processRequest = async (status: string) => {
    if (!processReq) return;
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process-request', requestId: processReq.requestId, status, notes: processNotes }),
      });
      const d = await r.json();
      if (d.success) { toast.success(`${tr('الطلب', 'Request')} ${status.toLowerCase()}`); setProcessOpen(false); load(); }
      else toast.error(d.error || tr('فشل', 'Failed'));
    } catch { toast.error(tr('خطأ', 'Error')); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CVisionSelect
                C={C}
                value={statusFilter || 'ALL'}
                placeholder={tr('جميع الحالات', 'All Statuses')}
                options={[
                  { value: 'ALL', label: tr('جميع الحالات', 'All Statuses') },
                  { value: 'PENDING', label: tr('معلق', 'Pending') },
                  { value: 'APPROVED', label: tr('موافق عليه', 'Approved') },
                  { value: 'REJECTED', label: tr('مرفوض', 'Rejected') },
                ]}
                style={{ width: 160 }}
              />
        </div>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => load()}><RefreshCcw style={{ height: 14, width: 14, marginRight: 4 }} /> {tr('تحديث', 'Refresh')}</CVisionButton>
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /> : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('رقم الطلب', 'Request ID')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                  <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                  <CVisionTh C={C}>{tr('التفاصيل', 'Details')}</CVisionTh>
                  <CVisionTh C={C}>{tr('تاريخ التقديم', 'Submitted')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C}></CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {requests.map(req => (
                  <CVisionTr C={C} key={req.requestId}>
                    <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{req.requestId}</CVisionTd>
                    <CVisionTd>
                      <div style={{ fontWeight: 500 }}>{req.employeeName || req.employee?.fullName || req.employeeId}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{req.employee?.department || req.employee?.departmentName || ''}</div>
                    </CVisionTd>
                    <CVisionTd><CVisionBadge C={C} variant="outline">{getReqTypeLabel(req.type, language)}</CVisionBadge></CVisionTd>
                    <CVisionTd style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.type === 'UPGRADE' && req.details ? (
                        <span>{req.details.currentTier} → {req.details.newTier} ({req.details.newPlanName})</span>
                      ) : req.details?.reason ? (
                        <span>{req.details.reason}</span>
                      ) : '—'}
                    </CVisionTd>
                    <CVisionTd style={{ fontSize: 13 }}>{fmtDate(req.submittedAt)}</CVisionTd>
                    <CVisionTd><CVisionBadge C={C} variant={STATUS_VARIANTS[req.status] || 'secondary'}>{req.status}</CVisionBadge></CVisionTd>
                    <CVisionTd>
                      {req.status === 'PENDING' && (
                        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => { setProcessReq(req); setProcessNotes(''); setProcessOpen(true); }}>
                          {tr('معالجة', 'Process')}
                        </CVisionButton>
                      )}
                    </CVisionTd>
                  </CVisionTr>
                ))}
                {requests.length === 0 && (
                  <CVisionTr C={C}><CVisionTd align="center" colSpan={7} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد طلبات.', 'No requests found.')}</CVisionTd></CVisionTr>
                )}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Process Request Dialog */}
      <CVisionDialog C={C} open={processOpen} onClose={() => setProcessOpen(false)} title="Process" isDark={isDark}>                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: C.bgSubtle, padding: 12, borderRadius: 12, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 500 }}>{processReq?.employeeName}</div>
              <div>{tr('النوع', 'Type')}: {getReqTypeLabel(processReq?.type, language)}</div>
              {processReq?.type === 'UPGRADE' && processReq?.details && (
                <>
                  <div>{tr('من', 'From')}: <TierBadge tier={processReq.details.currentTier} /> ({fmtSAR(processReq.details.currentPremium || 0)}/{tr('شهر', 'mo')})</div>
                  <div>{tr('إلى', 'To')}: <TierBadge tier={processReq.details.newTier} /> ({fmtSAR(processReq.details.newPremium || 0)}/{tr('شهر', 'mo')})</div>
                </>
              )}
              {processReq?.details?.reason && <div>{tr('السبب', 'Reason')}: {processReq.details.reason}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('ملاحظات', 'Notes')}</label>
              <CVisionTextarea C={C} value={processNotes} onChange={e => setProcessNotes(e.target.value)} placeholder={tr('ملاحظات اختيارية...', 'Optional notes...')} rows={2} />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setProcessOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="danger" onClick={() => processRequest('REJECTED')}>
              <X style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('رفض', 'Reject')}
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={() => processRequest('APPROVED')}>
              <Check style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('موافقة', 'Approve')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CLAIMS TAB
// ═══════════════════════════════════════════════════════════════════════
function ClaimsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitEmpId, setSubmitEmpId] = useState('');
  const [submitEmpName, setSubmitEmpName] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [processOpen, setProcessOpen] = useState(false);
  const [processClaim, setProcessClaim] = useState<any>(null);
  const [processForm, setProcessForm] = useState({ status: 'APPROVED', approvedAmount: '', rejectionReason: '' });

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      let url = `${API}?action=list-claims`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (typeFilter) url += `&type=${typeFilter}`;
      const r = await fetch(url, { credentials: 'include', signal });
      const d = await r.json();
      if (d.success) setClaims(d.claims || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const openNewClaim = async () => {
    try {
      const r = await fetch(`${API}?action=all-employees`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) setEmployees((d.employees || []).filter((e: any) => e.insured));
    } catch { /* ignore */ }
  };

  const processClaimAction = async () => {
    if (!processClaim) return;
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process-claim', claimId: processClaim.claimId, ...processForm }),
      });
      const d = await r.json();
      if (d.success) { toast.success(tr('تمت معالجة المطالبة', 'Claim processed')); setProcessOpen(false); load(); }
    } catch { toast.error(tr('خطأ', 'Error')); }
  };

  const filtered = claims.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.employeeName || '').toLowerCase().includes(s) || (c.claimId || '').toLowerCase().includes(s);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C} style={{ paddingLeft: 32, width: 208 }} placeholder={tr('بحث في المطالبات...', 'Search claims...')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <CVisionSelect
                C={C}
                value={statusFilter || 'ALL'}
                placeholder={tr('جميع الحالات', 'All Statuses')}
                options={[
                  { value: 'ALL', label: tr('الكل', 'All') },
                  { value: 'SUBMITTED', label: tr('مقدمة', 'Submitted') },
                  { value: 'UNDER_REVIEW', label: tr('قيد المراجعة', 'Under Review') },
                  { value: 'APPROVED', label: tr('موافق عليها', 'Approved') },
                  { value: 'PAID', label: tr('مدفوعة', 'Paid') },
                  { value: 'REJECTED', label: tr('مرفوضة', 'Rejected') },
                ]}
                style={{ width: 160 }}
              />
          <CVisionSelect
                C={C}
                value={typeFilter || 'ALL'}
                placeholder={tr('جميع الأنواع', 'All Types')}
                options={[
                  { value: 'ALL', label: tr('الكل', 'All') },
                  { value: 'OUTPATIENT', label: tr('خارجي', 'Outpatient') },
                  { value: 'INPATIENT', label: tr('داخلي', 'Inpatient') },
                  { value: 'DENTAL', label: tr('أسنان', 'Dental') },
                  { value: 'PHARMACY', label: tr('صيدلية', 'Pharmacy') },
                  { value: 'EMERGENCY', label: tr('طوارئ', 'Emergency') },
                  { value: 'MATERNITY', label: tr('أمومة', 'Maternity') },
                ]}
                style={{ width: 160 }}
              />
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={async () => { await openNewClaim(); setSubmitEmpId(''); setSubmitEmpName(''); setSubmitOpen(true); }}>
          <Plus style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('مطالبة جديدة', 'New Claim')}
        </CVisionButton>
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /> : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('رقم المطالبة', 'Claim ID')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                  <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                  <CVisionTh C={C}>{tr('مقدم الخدمة', 'Provider')}</CVisionTh>
                  <CVisionTh C={C}>{tr('التاريخ', 'Date')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المبلغ', 'Amount')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المعتمد', 'Approved')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C}></CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {filtered.map(c => (
                  <CVisionTr C={C} key={c.claimId}>
                    <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.claimId}</CVisionTd>
                    <CVisionTd style={{ fontWeight: 500 }}>{c.employeeName}</CVisionTd>
                    <CVisionTd><CVisionBadge C={C} className={`text-xs ${CLAIM_COLORS[c.type] || ''}`}>{c.type}</CVisionBadge></CVisionTd>
                    <CVisionTd>{c.provider || '—'}</CVisionTd>
                    <CVisionTd>{fmtDate(c.claimDate)}</CVisionTd>
                    <CVisionTd align="right">{fmtSAR(c.amount)}</CVisionTd>
                    <CVisionTd align="right">{c.approvedAmount > 0 ? fmtSAR(c.approvedAmount) : '—'}</CVisionTd>
                    <CVisionTd><CVisionBadge C={C} variant={STATUS_VARIANTS[c.status] || 'secondary'}>{c.status}</CVisionBadge></CVisionTd>
                    <CVisionTd>
                      {['SUBMITTED', 'UNDER_REVIEW'].includes(c.status) && (
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => {
                          setProcessClaim(c);
                          setProcessForm({ status: 'APPROVED', approvedAmount: String(c.amount), rejectionReason: '' });
                          setProcessOpen(true);
                        }}>{tr('معالجة', 'Process')}</CVisionButton>
                      )}
                    </CVisionTd>
                  </CVisionTr>
                ))}
                {filtered.length === 0 && (
                  <CVisionTr C={C}><CVisionTd align="center" colSpan={9} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد مطالبات.', 'No claims found.')}</CVisionTd></CVisionTr>
                )}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* New Claim with employee selector */}
      <CVisionDialog C={C} open={submitOpen && !submitEmpId} onClose={() => { setSubmitOpen(false); }} title="Submit" isDark={isDark}>                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            {employees.map(e => (
              <div
                key={e.employeeId}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 6, cursor: 'pointer' }}
                onClick={() => { setSubmitEmpId(e.employeeId); setSubmitEmpName(e.fullName); }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{e.fullName}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{e.department} · {e.providerName}</div>
                </div>
                <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{e.cardNumber}</CVisionBadge>
              </div>
            ))}
          </div>
      </CVisionDialog>

      <SubmitClaimDialog
        open={submitOpen && !!submitEmpId}
        onOpenChange={v => { if (!v) { setSubmitOpen(false); setSubmitEmpId(''); } }}
        employeeId={submitEmpId}
        employeeName={submitEmpName}
      />

      {/* Process Claim Dialog */}
      <CVisionDialog C={C} open={processOpen} onClose={() => setProcessOpen(false)} title="Process" isDark={isDark}>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: C.bgSubtle, padding: 12, borderRadius: 6, fontSize: 13 }}>
              <div>{processClaim?.employeeName} — {processClaim?.type}</div>
              <div style={{ fontWeight: 600 }}>{tr('المطالبة', 'Claimed')}: {fmtSAR(processClaim?.amount || 0)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('القرار', 'Decision')}</label>
              <CVisionSelect
                C={C}
                value={processForm.status}
                options={[
                  { value: 'APPROVED', label: tr('موافقة (كامل)', 'Approve (Full)') },
                  { value: 'PARTIALLY_APPROVED', label: tr('موافقة جزئية', 'Partially Approve') },
                  { value: 'REJECTED', label: tr('رفض', 'Reject') },
                ]}
              />
            </div>
            {processForm.status !== 'REJECTED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('المبلغ المعتمد (ريال)', 'Approved Amount (SAR)')}</label>
                <CVisionInput C={C} type="number" value={processForm.approvedAmount} onChange={e => setProcessForm(p => ({ ...p, approvedAmount: e.target.value }))} />
              </div>
            )}
            {processForm.status === 'REJECTED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('سبب الرفض', 'Rejection Reason')}</label>
                <CVisionTextarea C={C} value={processForm.rejectionReason} onChange={e => setProcessForm(p => ({ ...p, rejectionReason: e.target.value }))} />
              </div>
            )}
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setProcessOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={processClaimAction}>{tr('معالجة', 'Process')}</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PROVIDERS TAB
// ═══════════════════════════════════════════════════════════════════════
function ProvidersTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [providers, setProviders] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API}?action=list-providers`, { credentials: 'include', signal: ac.signal }),
          fetch(`${API}?action=list-policies`, { credentials: 'include', signal: ac.signal }),
        ]);
        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        if (d1.success) setProviders(d1.providers || []);
        if (d2.success) setPolicies(d2.policies || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, []);

  if (loading) return <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('مقدمو التأمين', 'Insurance Providers')}</h3>
      <div style={{ display: 'grid', gap: 16 }}>
        {providers.map((p: any) => (
          <CVisionCard C={C} key={p.providerId} style={{ cursor: 'pointer' }} onClick={() => setSelectedProvider(p)}>
            <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{p.name}</div>
                <CVisionBadge C={C} variant={p.status === 'ACTIVE' ? 'default' : 'secondary'}>{p.status}</CVisionBadge>
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{p.type} {tr('تأمين', 'Insurance')}</div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ color: C.textMuted }}>{p.contactPerson}</div>
                <div style={{ color: C.textMuted, fontSize: 12 }}>{p.contactEmail}</div>
                <div style={{ marginTop: 8, fontWeight: 500 }}>{p.plans?.length || 0} {tr('خطط متاحة', 'plans available')}</div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('وثائق الشركة', 'Company Policies')}</h3>
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 16 }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
                <CVisionTh C={C}>{tr('رقم الوثيقة', 'Policy #')}</CVisionTh>
                <CVisionTh C={C}>{tr('مقدم الخدمة', 'Provider')}</CVisionTh>
                <CVisionTh C={C}>{tr('الخطة', 'Plan')}</CVisionTh>
                <CVisionTh C={C}>{tr('الفترة', 'Period')}</CVisionTh>
                <CVisionTh C={C}>{tr('المسجلون', 'Enrolled')}</CVisionTh>
                <CVisionTh C={C}>{tr('التكلفة السنوية', 'Annual Cost')}</CVisionTh>
                <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {policies.map((p: any) => (
                <CVisionTr C={C} key={p.policyId}>
                  <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.policyNumber}</CVisionTd>
                  <CVisionTd style={{ fontWeight: 500 }}>{p.providerName}</CVisionTd>
                  <CVisionTd>{p.planName}</CVisionTd>
                  <CVisionTd>{fmtDate(p.startDate)} — {fmtDate(p.endDate)}</CVisionTd>
                  <CVisionTd>{p.enrolledCount}/{p.maxEnrolled}</CVisionTd>
                  <CVisionTd>{fmtSAR(p.annualCost || 0)}</CVisionTd>
                  <CVisionTd><CVisionBadge C={C} variant={STATUS_VARIANTS[p.status] || 'secondary'}>{p.status}</CVisionBadge></CVisionTd>
                </CVisionTr>
              ))}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      {/* Provider Plan Detail */}
      <CVisionDialog C={C} open={!!selectedProvider} onClose={() => setSelectedProvider(null)} title="Provider Details" isDark={isDark}>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(selectedProvider?.plans || []).map((plan: any) => (
              <CVisionCard C={C} key={plan.planId}>
                <CVisionCardBody style={{ paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{plan.name}</div>
                      <TierBadge tier={plan.tier} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.blue }}>{fmtSAR(plan.monthlyPremium)}/{tr('شهر', 'mo')}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{fmtSAR(plan.annualPremium)}/{tr('سنة', 'yr')}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13, marginBottom: 12 }}>
                    <div><span style={{ color: C.textMuted }}>{tr('أقصى تغطية', 'Max Coverage')}</span><div style={{ fontWeight: 500 }}>{fmtSAR(plan.maxCoverage)}</div></div>
                    <div><span style={{ color: C.textMuted }}>{tr('الخصم', 'Deductible')}</span><div style={{ fontWeight: 500 }}>{plan.deductible > 0 ? fmtSAR(plan.deductible) : tr('صفر', 'Zero')}</div></div>
                    <div><span style={{ color: C.textMuted }}>{tr('الرسوم المشتركة', 'Copay')}</span><div style={{ fontWeight: 500 }}>{plan.copay}%</div></div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {plan.benefits?.map((b: string) => (
                      <CVisionBadge C={C} key={b} variant="secondary" style={{ fontSize: 12 }}>{b}</CVisionBadge>
                    ))}
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            ))}
          </div>
      </CVisionDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function InsurancePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Heart style={{ height: 32, width: 32, color: C.red }} /> {tr('إدارة التأمين', 'Insurance Management')}
        </h1>
        <p style={{ color: C.textMuted }}>{tr('إدارة تأمين الموظفين الصحي والتابعين', 'Manage employee health insurance & dependents')}</p>
      </div>

      <CVisionTabs
        C={C}
        defaultTab="employees"
        tabs={[
          { id: 'employees', label: tr('الموظفون', 'Employees'), icon: <Users style={{ height: 14, width: 14 }} /> },
          { id: 'requests', label: tr('الطلبات', 'Requests'), icon: <FileText style={{ height: 14, width: 14 }} /> },
          { id: 'claims', label: tr('المطالبات', 'Claims'), icon: <DollarSign style={{ height: 14, width: 14 }} /> },
          { id: 'providers', label: tr('مقدمو الخدمة', 'Providers'), icon: <Building2 style={{ height: 14, width: 14 }} /> },
        ]}
      >
        <CVisionTabContent tabId="employees"><EmployeesTab /></CVisionTabContent>
        <CVisionTabContent tabId="requests"><RequestsTab /></CVisionTabContent>
        <CVisionTabContent tabId="claims"><ClaimsTab /></CVisionTabContent>
        <CVisionTabContent tabId="providers"><ProvidersTab /></CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}
