'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useToast } from '@/hooks/use-toast';
import { useDevMode } from '@/lib/dev-mode';

import {
  TrendingUp, Plus, Search, CheckCircle2, XCircle, Clock, AlertTriangle,
  ArrowRight, DollarSign, Building2, Briefcase, Award, Send, Loader2,
  ChevronRight, User, FileText, BarChart3, Trash2, Star, ArrowUpRight, Sparkles, Trophy,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Types                                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface Promotion {
  id: string; promotionNumber: string; employeeId: string; employeeName: string;
  employeeNumber?: string; type: string; justification: string; achievements?: string[];
  current: { department: string; departmentId: string; jobTitle: string; jobTitleId: string; gradeId?: string; grade?: string; basicSalary: number };
  proposed: { department: string; departmentId: string; jobTitle: string; jobTitleId: string; gradeId?: string; grade?: string; basicSalary: number; salaryChange: number; salaryChangePercent: number };
  effectiveDate?: string; status: string; hasActiveWarnings: boolean; activeWarningsCount: number;
  submittedByName: string;
  approvals: { approvedByName: string; approvedAt: string; comments: string }[];
  rejectionReason?: string; comments: any[]; createdAt: string; updatedAt: string;
}

interface Recommendation {
  employeeId: string;
  employee: { id: string; name: string; department: string; departmentId: string; jobTitle: string; jobTitleId: string; gradeId?: string; grade?: string; gradeLevel?: number; basicSalary: number; hireDate?: string };
  score: number; tier: string;
  tenureScore: number; performanceScore: number; promotionHistoryScore: number; disciplinaryScore: number;
  tenureMonths: number | null;
  performance: { overallScore: number | null; rating: string | null };
  activeWarnings: number; lastPromotionDate: string | null;
  reasonText: string;
  suggestedGrade: GradeInfo | null;
  suggestedSalary: SalaryCalc | null;
  suggestedTitle: string;
}

interface GradeInfo { id: string; code: string; name: string; level: number; minSalary: number; midSalary: number; maxSalary: number }
interface SalaryCalc { suggestedSalary: number; minAllowed: number; maxAllowed: number; midpoint: number; increase: number; increasePercent: number; monthlyImpact: number; annualImpact: number; gosiImpact: number }

interface Lookups {
  departments: { id: string; name: string }[];
  jobTitles: { id: string; name: string; departmentId?: string }[];
  grades: GradeInfo[];
}

interface Stats {
  total: number; approved: number; pending: number; effective: number; rejected: number;
  byType: Record<string, number>; byDepartment: Record<string, number>; avgSalaryIncrease: number;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Constants                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

const TYPE_LABELS: Record<string, string> = {
  PROMOTION: 'Promotion', GRADE_UPGRADE: 'Grade Upgrade', TITLE_CHANGE: 'Title Change',
  DEPARTMENT_TRANSFER: 'Department Transfer', SALARY_ADJUSTMENT: 'Salary Adjustment',
};
const TYPE_ICONS: Record<string, typeof TrendingUp> = {
  PROMOTION: TrendingUp, GRADE_UPGRADE: Award, TITLE_CHANGE: Briefcase,
  DEPARTMENT_TRANSFER: Building2, SALARY_ADJUSTMENT: DollarSign,
};
const getStatusCfg = (tr: (ar: string, en: string) => string): Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> => ({
  DRAFT: { label: tr('مسودة', 'Draft'), variant: 'secondary', icon: FileText },
  PENDING_APPROVAL: { label: tr('معلق', 'Pending'), variant: 'outline', icon: Clock },
  APPROVED: { label: tr('معتمد', 'Approved'), variant: 'default', icon: CheckCircle2 },
  REJECTED: { label: tr('مرفوض', 'Rejected'), variant: 'destructive', icon: XCircle },
  EFFECTIVE: { label: tr('ساري', 'Effective'), variant: 'default', icon: CheckCircle2 },
  CANCELLED: { label: tr('ملغي', 'Cancelled'), variant: 'secondary', icon: XCircle },
});
const getTierCfg = (tr: (ar: string, en: string) => string): Record<string, { label: string; border: string; badge: string }> => ({
  HIGHLY_RECOMMENDED: { label: tr('موصى به بشدة', 'Highly Recommended'), border: 'border-l-4 border-l-green-500', badge: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  RECOMMENDED: { label: tr('موصى به', 'Recommended'), border: 'border-l-4 border-l-blue-500', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  CONSIDER: { label: tr('للنظر', 'Consider'), border: 'border-l-4 border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' },
  NOT_READY: { label: tr('غير جاهز', 'Not Ready'), border: 'border-l-4 border-l-gray-300', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
});
const APPROVAL_CHAIN = ['Manager', 'HR', 'Director'];

const fmt = (d: string | undefined | null) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const sal = (n: number) => n > 0 ? `SAR ${n.toLocaleString('en-US')}` : 'Not set';

function approvalStage(p: Promotion) {
  if (p.status === 'DRAFT') return 0;
  if (p.status === 'PENDING_APPROVAL') return p.approvals.length > 0 ? 1 : 0;
  if (p.status === 'APPROVED' || p.status === 'EFFECTIVE') return 3;
  return p.approvals.length;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Main Page                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function PromotionsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const STATUS_CFG = getStatusCfg(tr);
  const TIER_CFG = getTierCfg(tr);

  const { toast } = useToast();
  const isDev = useDevMode();
  const [tab, setTab] = useState('recommended');
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardRec, setWizardRec] = useState<Recommendation | null>(null);
  const [formData, setFormData] = useState(defaultForm());
  const [submitting, setSubmitting] = useState(false);

  // Dialogs
  const [detailPromo, setDetailPromo] = useState<Promotion | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; promo: Promotion } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  function defaultForm() {
    return { type: 'PROMOTION', justification: '', proposedSalary: '', effectiveDate: nextMonth(), proposedJobTitleId: '', proposedGradeId: '', proposedDepartmentId: '', achievements: [''] as string[] };
  }
  function nextMonth() { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(1); return d.toISOString().slice(0, 10); }

  /* ─── Fetchers (React Query) ─────────────────────────────────────── */

  const { data: promRes, isLoading: loadingProm } = useQuery({
    queryKey: cvisionKeys.promotions.list({ action: 'list', limit: '100' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/promotions', { params: { action: 'list', limit: '100' } }),
  });
  const promotions: Promotion[] = promRes?.data?.items || promRes?.data || [];

  const { data: recRes } = useQuery({
    queryKey: cvisionKeys.promotions.list({ action: 'recommendations' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/promotions', { params: { action: 'recommendations' } }),
  });
  const recommendations: Recommendation[] = recRes?.data?.items || recRes?.data || [];
  const gradeStructure: GradeInfo[] = recRes?.gradeStructure || [];

  const { data: lookRes } = useQuery({
    queryKey: cvisionKeys.promotions.list({ action: 'lookups' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/promotions', { params: { action: 'lookups' } }),
  });
  const lookups: Lookups = lookRes?.data || { departments: [], jobTitles: [], grades: [] };

  const { data: statRes } = useQuery({
    queryKey: cvisionKeys.promotions.list({ action: 'stats' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/promotions', { params: { action: 'stats' } }),
  });
  const stats: Stats | null = statRes?.data || null;

  const loading = loadingProm;

  const fetchAll = () => { queryClient.invalidateQueries({ queryKey: cvisionKeys.promotions.all }); };

  /* ─── Seed ─────────────────────────────────────────────────────────── */
  const handleSeed = async () => {
    setSeeding(true);
    await cvisionMutate('/api/cvision/promotions', 'POST', { action: 'seed-grades' });
    const json = await cvisionMutate<any>('/api/cvision/promotions', 'POST', { action: 'seed' });
    toast({ title: 'Seed Complete', description: json.message || 'Done' });
    fetchAll();
    setSeeding(false);
  };

  /* ─── Start wizard from recommendation ─────────────────────────────── */
  const startFromRec = (rec: Recommendation) => {
    setWizardRec(rec);
    setFormData({
      type: 'PROMOTION',
      justification: rec.reasonText,
      proposedSalary: rec.suggestedSalary ? String(rec.suggestedSalary.suggestedSalary) : String(rec.employee.basicSalary),
      effectiveDate: nextMonth(),
      proposedJobTitleId: '',
      proposedGradeId: rec.suggestedGrade?.id || '',
      proposedDepartmentId: '',
      achievements: [''],
    });
    setWizardStep(2);
    setShowWizard(true);
    setTab('propose');
  };

  /* ─── Create promotion ─────────────────────────────────────────────── */
  const handleCreate = async (asDraft: boolean) => {
    if (!wizardRec) return;
    setSubmitting(true);
    try {
      const cJson = await cvisionMutate<any>('/api/cvision/promotions', 'POST', {
        action: 'create', employeeId: wizardRec.employee.id, type: formData.type,
        justification: formData.justification,
        achievements: formData.achievements.filter(a => a.trim()),
        proposedSalary: formData.proposedSalary ? parseFloat(formData.proposedSalary) : undefined,
        proposedJobTitleId: formData.proposedJobTitleId || undefined,
        proposedGradeId: formData.proposedGradeId || undefined,
        proposedDepartmentId: formData.proposedDepartmentId || undefined,
        effectiveDate: formData.effectiveDate || undefined,
      });
      if (!cJson.success) { toast({ title: 'Error', description: cJson.error, variant: 'destructive' }); return; }
      if (!asDraft && cJson.data?.id) {
        await cvisionMutate('/api/cvision/promotions', 'POST', { action: 'submit', id: cJson.data.id });
      }
      toast({ title: 'Success', description: asDraft ? 'Saved as draft' : 'Submitted for approval' });
      setShowWizard(false); setWizardRec(null); setFormData(defaultForm()); setTab('all');
      fetchAll();
    } catch { toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
    finally { setSubmitting(false); }
  };

  /* ─── Action handler ───────────────────────────────────────────────── */
  const handleAction = async () => {
    if (!actionDialog) return;
    setActionLoading(true);
    const map: Record<string, any> = {
      approve: { action: 'approve', id: actionDialog.promo.id, comments: actionReason },
      reject: { action: 'reject', id: actionDialog.promo.id, reason: actionReason },
      submit: { action: 'submit', id: actionDialog.promo.id },
      'make-effective': { action: 'make-effective', id: actionDialog.promo.id },
      cancel: { action: 'cancel', id: actionDialog.promo.id, reason: actionReason },
    };
    try {
      const json = await cvisionMutate<any>('/api/cvision/promotions', 'POST', map[actionDialog.type]);
      if (json.success) { toast({ title: 'Success', description: json.message }); setActionDialog(null); setActionReason(''); fetchAll(); }
      else toast({ title: 'Error', description: json.error, variant: 'destructive' });
    } catch { toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const filteredPromos = useMemo(() => {
    let list = promotions;
    if (filterStatus !== 'all') list = list.filter(p => p.status === filterStatus);
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); list = list.filter(p => p.employeeName.toLowerCase().includes(q) || p.promotionNumber.toLowerCase().includes(q)); }
    return list;
  }, [promotions, filterStatus, searchQuery]);

  /* ═══════ RENDER ════════════════════════════════════════════════════ */

  if (loading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 256 }}  />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>{[1,2,3,4,5].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 96 }}  />)}</div>
      <CVisionSkeletonCard C={C} height={200} style={{ height: 384 }}  />
    </div>
  );

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp style={{ height: 24, width: 24, color: C.gold }} />Promotions</h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>Smart promotion recommendations, proposals, and tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isDev && promotions.length === 0 && <CVisionButton C={C} isDark={isDark} variant="outline" onClick={handleSeed} disabled={seeding}>{seeding && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}Seed Sample Data</CVisionButton>}
          <CVisionButton C={C} isDark={isDark} onClick={() => { setShowWizard(false); setWizardRec(null); setFormData(defaultForm()); setTab('propose'); }}>
            <Plus style={{ height: 16, width: 16, marginRight: 8 }} />{tr('اقتراح ترقية', 'Propose Promotion')}
          </CVisionButton>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {[
          { l: 'Recommended', v: recommendations.filter(r => r.score >= 60).length, c: 'text-emerald-600', icon: Sparkles },
          { l: 'Pending', v: stats?.pending || 0, c: 'text-yellow-600', icon: Clock },
          { l: 'Approved', v: stats?.approved || 0, c: 'text-green-600', icon: CheckCircle2 },
          { l: 'Effective', v: stats?.effective || 0, c: 'text-blue-600', icon: Award },
          { l: 'Avg Increase', v: stats?.avgSalaryIncrease ? sal(stats.avgSalaryIncrease) : '—', icon: DollarSign },
        ].map(s => (
          <CVisionCard C={C} key={s.l}>
            <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMuted, fontWeight: 500, textTransform: 'uppercase' }}><s.icon style={{ height: 12, width: 12 }} />{s.l}</div>
              <div className={`text-2xl font-bold mt-1 ${s.c || ''}`}>{s.v}</div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'recommended', label: tr('موصى به', 'Recommended'), icon: <Sparkles style={{ height: 14, width: 14 }} /> },
          { id: 'propose', label: tr('اقتراح جديد', 'Propose New') },
          { id: 'all', label: tr('كل الترقيات', 'All Promotions') },
          { id: 'analytics', label: tr('التحليلات', 'Analytics') },
        ]}
      >
        {/* ══════ TAB 1: Recommended ════════════════════════════════════ */}
        <CVisionTabContent tabId="recommended">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles style={{ height: 20, width: 20, color: C.gold }} />AI-Recommended Promotions</h2>
              <p style={{ fontSize: 13, color: C.textMuted }}>Employees ranked by promotion readiness score</p>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
              <Sparkles style={{ height: 48, width: 48, marginBottom: 12 }} />
              <p style={{ color: C.textMuted }}>No employees found to evaluate. Make sure employees exist with active status.</p>
            </CVisionCardBody></CVisionCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recommendations.map(rec => (
                <RecommendationCard key={rec.employeeId} rec={rec} onPromote={() => startFromRec(rec)} />
              ))}
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* ══════ TAB 2: Propose New ════════════════════════════════════ */}
        <CVisionTabContent tabId="propose">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!showWizard && !wizardRec ? (
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 40, paddingBottom: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Sparkles style={{ height: 40, width: 40 }} />
              <p style={{ color: C.textMuted }}>Select an employee from the <strong>Recommended</strong> tab, or choose one below.</p>
              <div style={{ maxWidth: 448 }}><EmployeePicker recommendations={recommendations} onSelect={startFromRec} /></div>
            </CVisionCardBody></CVisionCard>
          ) : wizardRec ? (
            <PromotionWizard
              step={wizardStep} setStep={setWizardStep}
              rec={wizardRec} lookups={lookups} gradeStructure={gradeStructure}
              formData={formData} setFormData={setFormData}
              submitting={submitting}
              onDraft={() => handleCreate(true)} onSubmit={() => handleCreate(false)}
              onCancel={() => { setShowWizard(false); setWizardRec(null); setFormData(defaultForm()); }}
            />
          ) : null}
        </div>
        </CVisionTabContent>

        {/* ══════ TAB 3: All Promotions ═════════════════════════════════ */}
        <CVisionTabContent tabId="all">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 384 }}>
              <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
              <CVisionInput C={C} placeholder="Search..." style={{ paddingLeft: 36 }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <CVisionSelect
                C={C}
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'all', label: tr('كل الحالات', 'All Statuses') },
                  ...Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label })),
                ]}
              />
          </div>
          {filteredPromos.length === 0 ? (
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}><TrendingUp style={{ height: 48, width: 48, marginBottom: 12 }} /><p style={{ color: C.textMuted }}>{promotions.length === 0 ? 'No promotions yet.' : 'No promotions match your filters.'}</p></CVisionCardBody></CVisionCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{filteredPromos.map(p => <PromoCard key={p.id} promo={p} onView={() => setDetailPromo(p)} onAction={t => setActionDialog({ type: t, promo: p })} />)}</div>
          )}
        </div>
        </CVisionTabContent>

        {/* ══════ TAB 4: Analytics ═══════════════════════════════════════ */}
        <CVisionTabContent tabId="analytics"><AnalyticsTab stats={stats} promotions={promotions} /></CVisionTabContent>
      </CVisionTabs>

      {/* Detail dialog */}
      <CVisionDialog C={C} open={!!detailPromo} onClose={() => setDetailPromo(null)} title="Promotion Details" isDark={isDark}>
          {detailPromo && <PromoDetail promo={detailPromo} onAction={t => { setDetailPromo(null); setActionDialog({ type: t, promo: detailPromo }); }} />}
      </CVisionDialog>

      {/* Action dialog */}
      <CVisionDialog C={C} open={!!actionDialog} onClose={() => setActionDialog(null)} title="Confirm Action" isDark={isDark}>
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{actionDialog?.promo.promotionNumber} for {actionDialog?.promo.employeeName}</p>          {(actionDialog?.type === 'reject' || actionDialog?.type === 'cancel' || actionDialog?.type === 'approve') && (
            <CVisionTextarea C={C} value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder={actionDialog.type === 'approve' ? 'Optional comments...' : 'Provide a reason...'} style={{ marginTop: 8 }} />
          )}
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setActionDialog(null); setActionReason(''); }}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleAction} disabled={actionLoading || ((actionDialog?.type === 'reject' || actionDialog?.type === 'cancel') && !actionReason.trim())} variant={actionDialog?.type === 'reject' || actionDialog?.type === 'cancel' ? 'destructive' : 'default'}>
              {actionLoading && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
              {{ approve: 'Approve', reject: 'Reject', submit: 'Submit', 'make-effective': 'Confirm', cancel: 'Cancel Promotion' }[actionDialog?.type || 'approve']}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Recommendation Card                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

function RecommendationCard({ rec, onPromote }: { rec: Recommendation; onPromote: () => void }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const TIER_CFG = getTierCfg(tr);
  const tier = TIER_CFG[rec.tier] || TIER_CFG.NOT_READY;
  const emp = rec.employee;

  return (
    <CVisionCard C={C} className={`${tier.border} hover:shadow-md transition-shadow`}>
      <CVisionCardBody style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Score badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trophy style={{ height: 16, width: 16, color: C.gold }} />
                <span style={{ fontSize: 16, fontWeight: 700 }}>{rec.score}</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>/100</span>
              </div>
              <CVisionBadge C={C} className={`text-xs ${tier.badge}`}>{tier.label}</CVisionBadge>
              {rec.activeWarnings > 0 && <CVisionBadge C={C} variant="danger" style={{ fontSize: 12 }}><AlertTriangle style={{ height: 12, width: 12, marginRight: 2 }} />{rec.activeWarnings} Warning(s)</CVisionBadge>}
            </div>

            {/* Employee info */}
            <h3 style={{ fontWeight: 600 }}>{emp.name}</h3>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              {emp.jobTitle} &middot; {emp.department}{emp.grade ? ` · ${emp.grade}` : ''}
            </p>

            {/* Breakdown */}
            <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 8, fontSize: 12 }}>
              {rec.tenureMonths !== null && (
                <span style={{ color: C.textMuted }}>Tenure: <strong className="text-foreground">{fmtTenure(rec.tenureMonths)}</strong></span>
              )}
              {(rec.performance.rating || (rec.performance.overallScore != null && rec.performance.overallScore > 0)) ? (
                <span style={{ color: C.textMuted }}>Performance: <strong className="text-foreground">{rec.performance.overallScore?.toFixed(1) || '—'}{rec.performance.rating ? ` (${rec.performance.rating.replace(/_/g, ' ')})` : ''}</strong></span>
              ) : (
                <span style={{ color: C.textMuted }}>Performance: <strong style={{ color: C.orange }}>No review</strong></span>
              )}
              <span style={{ color: C.textMuted }}>Salary: <strong className={emp.basicSalary > 0 ? 'text-foreground' : 'text-amber-600'}>{sal(emp.basicSalary)}</strong></span>
            </div>

            {/* Score breakdown bars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
              {[
                { l: 'Tenure', v: rec.tenureScore, w: 30 },
                { l: 'Performance', v: rec.performanceScore, w: 40 },
                { l: 'Promo History', v: rec.promotionHistoryScore, w: 20 },
                { l: 'Disciplinary', v: rec.disciplinaryScore, w: 10 },
              ].map(b => (
                <div key={b.l}>
                  <div style={{ color: C.textMuted, marginBottom: 2 }}>{b.l} ({b.w}%)</div>
                  <div style={{ height: 6, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                    <div style={{ background: C.gold, borderRadius: '50%', transition: 'all 0.2s', width: `${b.v}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendation text */}
            <div style={{ marginTop: 12, fontSize: 13, color: C.textMuted, borderRadius: 6, padding: 10, display: 'flex', gap: 8 }}>
              <Sparkles style={{ height: 16, width: 16, color: C.gold, marginTop: 2 }} />
              <span>{rec.reasonText}</span>
            </div>
          </div>

          {/* Action */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {rec.suggestedSalary && rec.suggestedSalary.suggestedSalary > 0 && (
              <div style={{ textAlign: 'right', fontSize: 12 }}>
                {emp.basicSalary > 0 ? (
                  <>
                    <div style={{ color: C.textMuted }}>{sal(emp.basicSalary)} → <span style={{ fontWeight: 600, color: C.green }}>{sal(rec.suggestedSalary.suggestedSalary)}</span></div>
                    {rec.suggestedSalary.increasePercent > 0 && <div style={{ color: C.green, fontWeight: 500 }}>+{rec.suggestedSalary.increasePercent}%</div>}
                  </>
                ) : (
                  <div style={{ color: C.textMuted }}>Suggested: <span style={{ fontWeight: 600 }}>{sal(rec.suggestedSalary.suggestedSalary)}</span></div>
                )}
              </div>
            )}
            <CVisionButton C={C} isDark={isDark} onClick={onPromote} style={{ gap: 6 }}>
              <ArrowUpRight style={{ height: 16, width: 16 }} />{tr('ترقية', 'Promote')}
            </CVisionButton>
          </div>
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );
}

function fmtTenure(m: number) {
  if (m < 12) return `${m} mo`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return `${y}y${r > 0 ? ` ${r}mo` : ''}`;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Employee Picker                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

function EmployeePicker({ recommendations, onSelect }: { recommendations: Recommendation[]; onSelect: (r: Recommendation) => void }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const TIER_CFG = getTierCfg(tr);
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return recommendations.slice(0, 8);
    const s = q.toLowerCase();
    return recommendations.filter(r => r.employee.name.toLowerCase().includes(s) || r.employee.department.toLowerCase().includes(s));
  }, [recommendations, q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
        <CVisionInput C={C} placeholder="Search employee..." style={{ paddingLeft: 36 }} value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(r => (
          <div key={r.employeeId} onClick={() => onSelect(r)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            <div>
              <p style={{ fontWeight: 500 }}>{r.employee.name}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{r.employee.department} &middot; {r.employee.jobTitle}</p>
            </div>
            <CVisionBadge C={C} className={`text-[10px] ${TIER_CFG[r.tier]?.badge || ''}`}>{r.score}</CVisionBadge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Promotion Wizard (4-step)                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function PromotionWizard({ step, setStep, rec, lookups, gradeStructure, formData, setFormData, submitting, onDraft, onSubmit, onCancel }: {
  step: number; setStep: (n: number) => void; rec: Recommendation; lookups: Lookups; gradeStructure: GradeInfo[];
  formData: any; setFormData: (d: any) => void; submitting: boolean;
  onDraft: () => void; onSubmit: () => void; onCancel: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const TIER_CFG = getTierCfg(tr);
  const emp = rec.employee;
  const curSal = emp.basicSalary;
  const propSal = parseFloat(formData.proposedSalary) || 0;
  const diff = propSal - curSal;
  const pct = curSal > 0 ? Math.round((diff / curSal) * 100) : 0;
  const selectedGrade = formData.proposedGradeId ? gradeStructure.find(g => g.id === formData.proposedGradeId) : null;
  const propTitle = formData.proposedJobTitleId ? lookups.jobTitles.find(t => t.id === formData.proposedJobTitleId)?.name || emp.jobTitle : emp.jobTitle;
  const propDept = formData.proposedDepartmentId ? lookups.departments.find(d => d.id === formData.proposedDepartmentId)?.name || emp.department : emp.department;
  const propGradeName = selectedGrade?.name || rec.suggestedGrade?.name || emp.grade;

  const gosiDiff = Math.round((Math.min(propSal, 45000) - Math.min(curSal, 45000)) * 0.0975);

  const STEPS = [{ n: 1, l: 'Employee' }, { n: 2, l: 'Details' }, { n: 3, l: 'Justification' }, { n: 4, l: 'Review' }];

  const addAch = () => setFormData({ ...formData, achievements: [...formData.achievements, ''] });
  const rmAch = (i: number) => { const a = formData.achievements.filter((_: any, j: number) => j !== i); setFormData({ ...formData, achievements: a.length ? a : [''] }); };
  const updAch = (i: number, v: string) => { const a = [...formData.achievements]; a[i] = v; setFormData({ ...formData, achievements: a }); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Step bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <ChevronRight style={{ height: 16, width: 16, color: C.textMuted }} />}
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${step === s.n ? 'bg-primary text-primary-foreground' : step > s.n ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
              {step > s.n && <CheckCircle2 style={{ height: 12, width: 12 }} />}{s.l}
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Employee summary */}
      {step === 1 && (
        <CVisionCard C={C} className="bg-muted/30">
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Selected Employee</div></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <CVisionBadge C={C} className={`${TIER_CFG[rec.tier]?.badge}`}>Readiness: {rec.score}/100</CVisionBadge>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
              <div><span style={{ color: C.textMuted, fontSize: 12, display: 'block' }}>Name</span><span style={{ fontWeight: 500 }}>{emp.name}</span></div>
              <div><span style={{ color: C.textMuted, fontSize: 12, display: 'block' }}>Title</span><span style={{ fontWeight: 500 }}>{emp.jobTitle}</span></div>
              <div><span style={{ color: C.textMuted, fontSize: 12, display: 'block' }}>Grade</span><span style={{ fontWeight: 500 }}>{emp.grade || '—'}</span></div>
              <div><span style={{ color: C.textMuted, fontSize: 12, display: 'block' }}>Department</span><span style={{ fontWeight: 500 }}>{emp.department}</span></div>
              <div><span style={{ color: C.textMuted, fontSize: 12, display: 'block' }}>Salary</span><span style={{ fontWeight: 500 }}>{sal(curSal)}</span></div>
              <div><span style={{ color: C.textMuted, fontSize: 12, display: 'block' }}>Tenure</span><span style={{ fontWeight: 500 }}>{rec.tenureMonths !== null ? fmtTenure(rec.tenureMonths) : '—'}</span></div>
              <div><span style={{ color: C.textMuted, fontSize: 12, display: 'block' }}>Performance</span><span style={{ fontWeight: 500 }}>{rec.performance.overallScore != null && rec.performance.overallScore > 0 ? `${rec.performance.overallScore.toFixed(1)}${rec.performance.rating ? ` (${rec.performance.rating.replace(/_/g, ' ')})` : ''}` : 'No review'}</span></div>
              <div><span style={{ color: C.textMuted, fontSize: 12, display: 'block' }}>Warnings</span><span className={`font-medium ${rec.activeWarnings > 0 ? 'text-red-600' : 'text-green-600'}`}>{rec.activeWarnings === 0 ? 'None' : rec.activeWarnings}</span></div>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: C.textMuted, background: C.bgCard, borderRadius: 6, padding: 10, display: 'flex', gap: 8, border: `1px solid ${C.border}` }}>
              <Sparkles style={{ height: 16, width: 16, color: C.gold, marginTop: 2 }} /><span>{rec.reasonText}</span>
            </div>
          </CVisionCardBody>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingLeft: 24, paddingRight: 24, paddingBottom: 16 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={onCancel}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={() => setStep(2)}>Next <ChevronRight style={{ height: 16, width: 16, marginLeft: 4 }} /></CVisionButton>
          </div>
        </CVisionCard>
      )}

      {/* Step 2: Promotion details */}
      {step === 2 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Promotion Details</div><div style={{ fontSize: 12, color: C.textMuted }}>For {emp.name} ({emp.department})</div></CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              <div>
                <CVisionLabel C={C}>New Job Title</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formData.proposedJobTitleId || '_same'}
                options={[
                  { value: '_same', label: 'Same ({emp.jobTitle})' },
                  ...lookups.jobTitles.map(t => ({ value: t.id, label: t.name })),
                ]}
                style={{ marginTop: 4 }}
              />
              </div>
              <div>
                <CVisionLabel C={C}>New Grade</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formData.proposedGradeId || '_same'}
                options={[
                  { value: '_same', label: `Same (${emp.grade || 'None'})` },
                  ...lookups.grades.map(g => ({ value: g.id, label: `${g.name} (${g.code}) - ${sal(g.minSalary)}-${sal(g.maxSalary)}` })),
                ]}
                style={{ marginTop: 4 }}
              />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              <div>
                <CVisionLabel C={C}>New Department</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formData.proposedDepartmentId || '_same'}
                options={[
                  { value: '_same', label: `Same (${emp.department})` },
                  ...lookups.departments.map(d => ({ value: d.id, label: d.name })),
                ]}
                style={{ marginTop: 4 }}
              />
              </div>
              <div>
                <CVisionLabel C={C}>Promotion Type</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formData.type}
                options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                style={{ marginTop: 4 }}
              />
              </div>
            </div>

            {/* Salary input + range bar */}
            <div>
              <CVisionLabel C={C}>Proposed Basic Salary (SAR)</CVisionLabel>
              <CVisionInput C={C} type="number" style={{ marginTop: 4 }} value={formData.proposedSalary} onChange={e => setFormData({ ...formData, proposedSalary: e.target.value })} />
              {/* Grade range bar */}
              {selectedGrade && selectedGrade.maxSalary > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: C.textMuted, marginBottom: 4 }}>
                    <span>{sal(selectedGrade.minSalary)}</span>
                    <span>Mid: {sal(selectedGrade.midSalary)}</span>
                    <span>{sal(selectedGrade.maxSalary)}</span>
                  </div>
                  <div style={{ position: 'relative', height: 8, background: C.bgSubtle, borderRadius: '50%' }}>
                    <div style={{ position: 'absolute', borderRadius: '50%', left: 0, width: '100%' }} />
                    {propSal > 0 && (
                      <div style={{ position: 'absolute', width: 12, height: 12, background: C.gold, borderRadius: '50%', left: `${Math.max(0, Math.min(100, ((propSal - selectedGrade.minSalary) / (selectedGrade.maxSalary - selectedGrade.minSalary)) * 100))}%` }} />
                    )}
                  </div>
                  {propSal > 0 && (propSal < selectedGrade.minSalary || propSal > selectedGrade.maxSalary) && (
                    <p style={{ fontSize: 12, color: C.orange, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle style={{ height: 12, width: 12 }} />Salary is outside the grade range</p>
                  )}
                </div>
              )}
            </div>

            {/* Salary comparison */}
            {propSal > 0 && diff !== 0 && (
              <div className={`rounded-lg border p-3 text-sm space-y-1 ${diff > 0 ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Current</span><span>{sal(curSal)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Proposed</span><span style={{ fontWeight: 500 }}>{sal(propSal)}</span></div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
                  <span>Increase</span>
                  <span className={diff > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700'}>{diff > 0 ? '+' : ''}{sal(diff)} ({pct > 0 ? '+' : ''}{pct}%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: C.textMuted }}>Monthly impact</span><span>{diff > 0 ? '+' : ''}{sal(diff)}/mo</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: C.textMuted }}>Annual impact</span><span>{diff > 0 ? '+' : ''}{sal(diff * 12)}/yr</span></div>
                {gosiDiff !== 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: C.textMuted }}>GOSI employer change</span><span>{gosiDiff > 0 ? '+' : ''}SAR {Math.abs(gosiDiff).toLocaleString()}/mo</span></div>}
              </div>
            )}

            <div>
              <CVisionLabel C={C}>Effective Date</CVisionLabel>
              <CVisionInput C={C} type="date" style={{ marginTop: 4 }} value={formData.effectiveDate} onChange={e => setFormData({ ...formData, effectiveDate: e.target.value })} />
            </div>
          </CVisionCardBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 24, paddingBottom: 16 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setStep(1)}>Back</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={() => setStep(3)}>Next <ChevronRight style={{ height: 16, width: 16, marginLeft: 4 }} /></CVisionButton>
          </div>
        </CVisionCard>
      )}

      {/* Step 3: Justification */}
      {step === 3 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Justification</div></CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <CVisionLabel C={C}>Reason</CVisionLabel>
              <CVisionTextarea C={C} style={{ marginTop: 4 }} rows={4} value={formData.justification} onChange={e => setFormData({ ...formData, justification: e.target.value })} placeholder="Explain why..." />
            </div>
            <div>
              <CVisionLabel C={C}>Key Achievements</CVisionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {formData.achievements.map((a: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <CVisionInput C={C} value={a} onChange={e => updAch(i, e.target.value)} placeholder={`Achievement ${i + 1}...`} />
                    {formData.achievements.length > 1 && <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" className="shrink-0" onClick={() => rmAch(i)}><Trash2 style={{ height: 16, width: 16 }} /></CVisionButton>}
                  </div>
                ))}
                <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={addAch}><Plus style={{ height: 12, width: 12, marginRight: 4 }} />Add</CVisionButton>
              </div>
            </div>
          </CVisionCardBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 24, paddingBottom: 16 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setStep(2)}>Back</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={() => setStep(4)} disabled={!formData.justification.trim()}>Review <ChevronRight style={{ height: 16, width: 16, marginLeft: 4 }} /></CVisionButton>
          </div>
        </CVisionCard>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Review & Submit</div></CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Before → After */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: C.textMuted }}>Before</p>
                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Briefcase style={{ height: 14, width: 14, color: C.textMuted }} />{emp.jobTitle}</div>
                  {emp.grade && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Award style={{ height: 14, width: 14, color: C.textMuted }} />{emp.grade}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 style={{ height: 14, width: 14, color: C.textMuted }} />{emp.department}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign style={{ height: 14, width: 14, color: C.textMuted }} />{sal(curSal)}</div>
                </div>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: C.gold }}>After</p>
                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Briefcase style={{ height: 14, width: 14, color: C.gold }} /><span className={propTitle !== emp.jobTitle ? 'font-semibold text-primary' : ''}>{propTitle}</span></div>
                  {(propGradeName || emp.grade) && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Award style={{ height: 14, width: 14, color: C.gold }} /><span className={propGradeName !== emp.grade ? 'font-semibold text-primary' : ''}>{propGradeName || emp.grade}</span></div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 style={{ height: 14, width: 14, color: C.gold }} /><span className={propDept !== emp.department ? 'font-semibold text-primary' : ''}>{propDept}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign style={{ height: 14, width: 14, color: C.gold }} /><span className={diff !== 0 ? 'font-semibold text-primary' : ''}>{sal(propSal || curSal)}</span>{diff > 0 && <span style={{ color: C.green, fontSize: 12 }}>+{pct}%</span>}</div>
                </div>
              </div>
            </div>

            {diff > 0 && (
              <div style={{ fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <span><span style={{ color: C.textMuted }}>Increase:</span> <span style={{ fontWeight: 500, color: C.green }}>+{sal(diff)} (+{pct}%)</span></span>
                <span><span style={{ color: C.textMuted }}>Annual:</span> <span style={{ fontWeight: 500 }}>+{sal(diff * 12)}</span></span>
              </div>
            )}

            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p><span style={{ color: C.textMuted }}>Type:</span> <span style={{ fontWeight: 500 }}>{TYPE_LABELS[formData.type]}</span></p>
              {formData.effectiveDate && <p><span style={{ color: C.textMuted }}>Effective:</span> <span style={{ fontWeight: 500 }}>{formData.effectiveDate}</span></p>}
            </div>

            <div><p style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, textTransform: 'uppercase' }}>Justification</p><p style={{ fontSize: 13, borderRadius: 6, padding: 8, marginTop: 4 }}>{formData.justification}</p></div>

            {formData.achievements.some((a: string) => a.trim()) && (
              <div>
                <p style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, textTransform: 'uppercase' }}>Achievements</p>
                <ul style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>{formData.achievements.filter((a: string) => a.trim()).map((a: string, i: number) => <li key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}><CheckCircle2 style={{ height: 14, width: 14, color: C.green, marginTop: 2 }} />{a}</li>)}</ul>
              </div>
            )}

            <div>
              <p style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, textTransform: 'uppercase', marginBottom: 8 }}>Approval Chain</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {APPROVAL_CHAIN.map((s, i) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {i > 0 && <div style={{ width: 24 }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textMuted }}><div style={{ height: 16, width: 16, borderRadius: '50%', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </CVisionCardBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 24, paddingBottom: 16 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setStep(3)}>Back</CVisionButton>
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={onDraft} disabled={submitting}>{submitting && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}<FileText style={{ height: 16, width: 16, marginRight: 4 }} />Save Draft</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={onSubmit} disabled={submitting}>{submitting && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}<Send style={{ height: 16, width: 16, marginRight: 4 }} />Submit for Approval</CVisionButton>
            </div>
          </div>
        </CVisionCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Promo Card                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function ApprovalChain({ promo, size = 'sm' }: { promo: Promotion; size?: 'sm' | 'md' }) {
  const stage = approvalStage(promo);
  const isRejected = promo.status === 'REJECTED';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {APPROVAL_CHAIN.map((step, i) => {
        const done = i < stage && !isRejected;
        const cur = i === stage && promo.status === 'PENDING_APPROVAL';
        const rej = isRejected && i === stage;
        const sz = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
        const tx = size === 'md' ? 'text-xs' : 'text-[10px]';
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <div className={`w-3 h-px ${done ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />}
            <div className={`flex items-center gap-0.5 ${tx}`}>
              {done && <CheckCircle2 className={`${sz} text-green-500`} />}
              {cur && <Clock className={`${sz} text-blue-500 animate-pulse`} />}
              {rej && <XCircle className={`${sz} text-red-500`} />}
              {!done && !cur && !rej && <div className={`${size === 'md' ? 'h-4 w-4' : 'h-3 w-3'} rounded-full border border-muted-foreground/30`} />}
              <span className={done ? 'text-green-600' : cur ? 'text-blue-600 font-medium' : rej ? 'text-red-600' : 'text-muted-foreground'}>{step}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PromoCard({ promo, onView, onAction }: { promo: Promotion; onView: () => void; onAction: (t: string) => void }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const STATUS_CFG = getStatusCfg(tr);
  const cfg = STATUS_CFG[promo.status] || STATUS_CFG.DRAFT;
  const Icon = cfg.icon;
  const TI = TYPE_ICONS[promo.type] || TrendingUp;
  const tc = promo.current.jobTitle !== promo.proposed.jobTitle;
  const gc = promo.current.grade && promo.proposed.grade && promo.current.grade !== promo.proposed.grade;
  const dc = promo.current.department !== promo.proposed.department;

  return (
    <CVisionCard C={C} className="hover:shadow-md transition-shadow">
      <CVisionCardBody style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.textMuted }}>{promo.promotionNumber}</span>
                <CVisionBadge C={C} variant={cfg.variant} style={{ fontSize: 12 }}><Icon style={{ height: 12, width: 12, marginRight: 4 }} />{cfg.label}</CVisionBadge>
                <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}><TI style={{ height: 12, width: 12, marginRight: 4 }} />{TYPE_LABELS[promo.type] || promo.type}</CVisionBadge>
              </div>
              <span style={{ fontSize: 12, color: C.textMuted }}>{fmt(promo.createdAt)}</span>
            </div>
            <h3 style={{ fontWeight: 600, marginTop: 8 }}>{promo.employeeName}</h3>
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
              {tc && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Briefcase style={{ height: 12, width: 12, color: C.textMuted }} /><span style={{ color: C.textMuted }}>{promo.current.jobTitle}</span><ArrowRight style={{ height: 12, width: 12 }} /><span style={{ fontWeight: 500 }}>{promo.proposed.jobTitle}</span></div>}
              {gc && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Award style={{ height: 12, width: 12, color: C.textMuted }} /><span style={{ color: C.textMuted }}>{promo.current.grade}</span><ArrowRight style={{ height: 12, width: 12 }} /><span style={{ fontWeight: 500 }}>{promo.proposed.grade}</span></div>}
              {dc && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 style={{ height: 12, width: 12, color: C.textMuted }} /><span style={{ color: C.textMuted }}>{promo.current.department}</span><ArrowRight style={{ height: 12, width: 12 }} /><span style={{ fontWeight: 500 }}>{promo.proposed.department}</span></div>}
              {!tc && !dc && <p style={{ color: C.textMuted }}>{promo.current.department} &middot; {promo.current.jobTitle}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign style={{ height: 12, width: 12, color: C.textMuted }} /><span style={{ color: C.textMuted }}>{sal(promo.current.basicSalary)}</span><ArrowRight style={{ height: 12, width: 12 }} /><span style={{ fontWeight: 500 }}>{sal(promo.proposed.basicSalary)}</span>{promo.proposed.salaryChange > 0 && <span style={{ color: C.green, fontSize: 12, fontWeight: 500 }}>(+{promo.proposed.salaryChangePercent}%)</span>}</div>
            </div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}><ApprovalChain promo={promo} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={onView}>View</CVisionButton>
            {promo.status === 'DRAFT' && <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => onAction('submit')}><Send style={{ height: 12, width: 12, marginRight: 4 }} />Submit</CVisionButton>}
            {promo.status === 'PENDING_APPROVAL' && <>
              <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => onAction('approve')}><CheckCircle2 style={{ height: 12, width: 12, marginRight: 4 }} />Approve</CVisionButton>
              <CVisionButton C={C} isDark={isDark} size="sm" variant="danger" onClick={() => onAction('reject')}><XCircle style={{ height: 12, width: 12, marginRight: 4 }} />Reject</CVisionButton>
            </>}
            {promo.status === 'APPROVED' && <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => onAction('make-effective')}><CheckCircle2 style={{ height: 12, width: 12, marginRight: 4 }} />Apply</CVisionButton>}
          </div>
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Promo Detail Dialog                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

function PromoDetail({ promo, onAction }: { promo: Promotion; onAction: (t: string) => void }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const STATUS_CFG = getStatusCfg(tr);
  const cfg = STATUS_CFG[promo.status] || STATUS_CFG.DRAFT;
  return (
    <>        
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{TYPE_LABELS[promo.type]} for {promo.employeeName}</p>      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <CVisionCard C={C}><CVisionCardHeader C={C} style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Before</div></CVisionCardHeader><CVisionCardBody style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <p><span style={{ color: C.textMuted }}>Title:</span> {promo.current.jobTitle}</p>
            {promo.current.grade && <p><span style={{ color: C.textMuted }}>Grade:</span> {promo.current.grade}</p>}
            <p><span style={{ color: C.textMuted }}>Dept:</span> {promo.current.department}</p>
            <p><span style={{ color: C.textMuted }}>Salary:</span> {sal(promo.current.basicSalary)}</p>
          </CVisionCardBody></CVisionCard>
          <CVisionCard C={C} className="border-primary/30"><CVisionCardHeader C={C} style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>After</div></CVisionCardHeader><CVisionCardBody style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <p><span style={{ color: C.textMuted }}>Title:</span> <span className={promo.current.jobTitle !== promo.proposed.jobTitle ? 'font-semibold text-primary' : ''}>{promo.proposed.jobTitle}</span></p>
            {promo.proposed.grade && <p><span style={{ color: C.textMuted }}>Grade:</span> <span className={promo.current.grade !== promo.proposed.grade ? 'font-semibold text-primary' : ''}>{promo.proposed.grade}</span></p>}
            <p><span style={{ color: C.textMuted }}>Dept:</span> <span className={promo.current.department !== promo.proposed.department ? 'font-semibold text-primary' : ''}>{promo.proposed.department}</span></p>
            <p><span style={{ color: C.textMuted }}>Salary:</span> <span className={promo.proposed.salaryChange > 0 ? 'font-semibold text-primary' : ''}>{sal(promo.proposed.basicSalary)}</span>{promo.proposed.salaryChange > 0 && <span style={{ color: C.green, marginLeft: 4 }}>+{promo.proposed.salaryChangePercent}%</span>}</p>
          </CVisionCardBody></CVisionCard>
        </div>
        {promo.proposed.salaryChange > 0 && <div style={{ background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Annual impact</span><span style={{ fontWeight: 500, color: C.green }}>+{sal(promo.proposed.salaryChange * 12)}</span></div>}
        <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>Justification</CVisionLabel><p style={{ fontSize: 13, marginTop: 4, borderRadius: 6, padding: 12 }}>{promo.justification}</p></div>
        {promo.achievements && promo.achievements.length > 0 && <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>Achievements</CVisionLabel><ul style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>{promo.achievements.map((a, i) => <li key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}><CheckCircle2 style={{ height: 14, width: 14, color: C.green, marginTop: 2 }} />{a}</li>)}</ul></div>}
        <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>Approval Chain</CVisionLabel><div style={{ marginTop: 4 }}><ApprovalChain promo={promo} size="md" /></div></div>
        {promo.rejectionReason && <div style={{ background: C.redDim, borderRadius: 6, padding: 12, fontSize: 13, color: C.red }}>{promo.rejectionReason}</div>}
        {promo.approvals.length > 0 && <div>{promo.approvals.map((a, i) => <div key={i} style={{ fontSize: 13, background: C.greenDim, borderRadius: 6, padding: 8, marginBottom: 4 }}><span style={{ fontWeight: 500 }}>{a.approvedByName}</span> approved {fmt(a.approvedAt)}{a.comments && <span style={{ color: C.textMuted }}> — {a.comments}</span>}</div>)}</div>}
        <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
          {promo.status === 'DRAFT' && <><CVisionButton C={C} isDark={isDark} size="sm" onClick={() => onAction('submit')}><Send style={{ height: 12, width: 12, marginRight: 4 }} />Submit</CVisionButton><CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => onAction('cancel')}>Cancel</CVisionButton></>}
          {promo.status === 'PENDING_APPROVAL' && <><CVisionButton C={C} isDark={isDark} size="sm" onClick={() => onAction('approve')}><CheckCircle2 style={{ height: 12, width: 12, marginRight: 4 }} />Approve</CVisionButton><CVisionButton C={C} isDark={isDark} size="sm" variant="danger" onClick={() => onAction('reject')}><XCircle style={{ height: 12, width: 12, marginRight: 4 }} />Reject</CVisionButton></>}
          {promo.status === 'APPROVED' && <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => onAction('make-effective')}><CheckCircle2 style={{ height: 12, width: 12, marginRight: 4 }} />Make Effective</CVisionButton>}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Analytics Tab                                                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

function AnalyticsTab({ stats, promotions }: { stats: Stats | null; promotions: Promotion[] }) {
  const { C, isDark } = useCVisionTheme();
  if (!stats || stats.total === 0) return <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}><BarChart3 style={{ height: 48, width: 48, marginBottom: 12 }} /><p style={{ color: C.textMuted }}>No data yet.</p></CVisionCardBody></CVisionCard>;

  const te = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]);
  const de = Object.entries(stats.byDepartment).sort((a, b) => b[1] - a[1]);
  const mt = Math.max(...te.map(([, v]) => v), 1);
  const md = Math.max(...de.map(([, v]) => v), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {[{ l: 'Total', v: stats.total }, { l: 'Approved', v: stats.approved + stats.effective, c: 'text-green-600' }, { l: 'Rejected', v: stats.rejected, c: 'text-red-600' }, { l: 'Avg Increase', v: sal(stats.avgSalaryIncrease) }].map(s => (
          <CVisionCard C={C} key={s.l}><CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, textAlign: 'center' }}><div className={`text-3xl font-bold ${s.c || ''}`}>{s.v}</div><div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{s.l}</div></CVisionCardBody></CVisionCard>
        ))}
      </div>
      <CVisionCard C={C}><CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>By Type</div></CVisionCardHeader><CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {te.map(([t, c]) => <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 13, width: 144, color: C.textMuted }}>{TYPE_LABELS[t] || t}</span><div style={{ flex: 1, height: 24, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}><div style={{ background: C.gold, borderRadius: '50%', width: `${(c / mt) * 100}%` }} /></div><span style={{ fontSize: 13, fontWeight: 500, width: 32, textAlign: 'right' }}>{c}</span></div>)}
      </CVisionCardBody></CVisionCard>
      <CVisionCard C={C}><CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>By Department</div></CVisionCardHeader><CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {de.map(([d, c]) => <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 13, width: 144, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</span><div style={{ flex: 1, height: 24, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}><div style={{ background: C.blueDim, borderRadius: '50%', width: `${(c / md) * 100}%` }} /></div><span style={{ fontSize: 13, fontWeight: 500, width: 32, textAlign: 'right' }}>{c}</span></div>)}
      </CVisionCardBody></CVisionCard>
    </div>
  );
}
