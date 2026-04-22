'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineEvent {
  dateTime: string;
  event: string;
  by: string;
  notes: string;
}

interface ContributingFactor {
  factor: string;
  category: string;
  impact: string;
}

interface SystemIssue {
  issue: string;
  category: string;
}

interface Recommendation {
  recommendation: string;
  responsible: string;
  dueDate: string;
  priority: string;
  status: string;
}

interface CommitteeMember {
  userId: string;
  name: string;
  role: string;
}

interface SecondaryDiagnosis {
  diagnosis: string;
  icdCode: string;
}

interface ReviewRecord {
  id: string;
  tenantId: string;
  patientMasterId: string;
  encounterId?: string | null;
  episodeId?: string | null;
  dateOfDeath: string;
  ageAtDeath?: number | null;
  gender?: string | null;
  primaryDiagnosis: string;
  icdCode?: string | null;
  secondaryDiagnoses?: SecondaryDiagnosis[] | null;
  department: string;
  attendingPhysician: string;
  admissionDate?: string | null;
  lengthOfStay?: number | null;
  deathType: string;
  preventability: string;
  reviewDate?: string | null;
  reviewerId?: string | null;
  reviewerName?: string | null;
  reviewCommittee?: CommitteeMember[] | null;
  timelineOfCare?: TimelineEvent[] | null;
  contributingFactors?: ContributingFactor[] | null;
  systemIssues?: SystemIssue[] | null;
  qualityOfCare?: string | null;
  delayInDiagnosis: boolean;
  delayInTreatment: boolean;
  communicationIssue: boolean;
  handoffIssue: boolean;
  findings?: string | null;
  recommendations?: Recommendation[] | null;
  lessonsLearned?: string | null;
  actionPlan?: string | null;
  status: string;
  mAndMPresented: boolean;
  mAndMDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEATH_TYPES = ['EXPECTED', 'UNEXPECTED', 'PERIOPERATIVE', 'ICU', 'ED'] as const;
const PREVENTABILITIES = ['DEFINITELY_PREVENTABLE', 'PROBABLY_PREVENTABLE', 'NOT_PREVENTABLE', 'UNKNOWN'] as const;
const QUALITY_LEVELS = ['APPROPRIATE', 'PARTIALLY_APPROPRIATE', 'INAPPROPRIATE'] as const;
const STATUSES = ['PENDING', 'IN_REVIEW', 'COMMITTEE_REVIEW', 'COMPLETED', 'CLOSED'] as const;
const FACTOR_CATEGORIES = ['CLINICAL', 'SYSTEM', 'HUMAN_FACTOR', 'COMMUNICATION', 'EQUIPMENT', 'ENVIRONMENT'] as const;
const REC_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
const REC_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MortalityReview() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/quality/mortality-review');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDeathType, setFilterDeathType] = useState('');
  const [filterPreventability, setFilterPreventability] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Main tab
  const [mainTab, setMainTab] = useState('cases');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('create');
  const [dialogTab, setDialogTab] = useState('patient');
  const [selectedReview, setSelectedReview] = useState<ReviewRecord | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [form, setForm] = useState<any>(getEmptyForm());

  // Build query string
  const queryParts: string[] = [];
  if (filterStatus) queryParts.push(`status=${filterStatus}`);
  if (filterDeathType) queryParts.push(`deathType=${filterDeathType}`);
  if (filterPreventability) queryParts.push(`preventability=${filterPreventability}`);
  if (filterDepartment) queryParts.push(`department=${encodeURIComponent(filterDepartment)}`);
  if (filterDateFrom) queryParts.push(`dateFrom=${filterDateFrom}`);
  if (filterDateTo) queryParts.push(`dateTo=${filterDateTo}`);
  const qs = queryParts.length ? `?${queryParts.join('&')}` : '';

  const { data, mutate } = useSWR(
    hasPermission ? `/api/quality/mortality-review${qs}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const items: ReviewRecord[] = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);
  const stats = data?.stats || {};

  // M&M Conference filter
  const [mmFilter, setMmFilter] = useState<'all' | 'presented' | 'pending'>('all');

  const mmItems = useMemo(() => {
    const completed = items.filter((i) => i.status === 'COMPLETED' || i.status === 'CLOSED');
    if (mmFilter === 'presented') return completed.filter((i) => i.mAndMPresented);
    if (mmFilter === 'pending') return completed.filter((i) => !i.mAndMPresented);
    return completed;
  }, [items, mmFilter]);

  // Loading guard
  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getEmptyForm(): any {
    return {
      patientMasterId: '',
      encounterId: '',
      episodeId: '',
      dateOfDeath: '',
      ageAtDeath: '',
      gender: '',
      primaryDiagnosis: '',
      icdCode: '',
      secondaryDiagnoses: [] as SecondaryDiagnosis[],
      department: '',
      attendingPhysician: '',
      admissionDate: '',
      deathType: 'EXPECTED',
      preventability: 'UNKNOWN',
      qualityOfCare: '',
      delayInDiagnosis: false,
      delayInTreatment: false,
      communicationIssue: false,
      handoffIssue: false,
      timelineOfCare: [] as TimelineEvent[],
      contributingFactors: [] as ContributingFactor[],
      systemIssues: [] as SystemIssue[],
      findings: '',
      recommendations: [] as Recommendation[],
      lessonsLearned: '',
      actionPlan: '',
      reviewCommittee: [] as CommitteeMember[],
      reviewDate: '',
      mAndMPresented: false,
      mAndMDate: '',
      status: 'PENDING',
      notes: '',
    };
  }

  function formFromRecord(r: ReviewRecord): any {
    return {
      patientMasterId: r.patientMasterId || '',
      encounterId: r.encounterId || '',
      episodeId: r.episodeId || '',
      dateOfDeath: r.dateOfDeath ? r.dateOfDeath.slice(0, 10) : '',
      ageAtDeath: r.ageAtDeath != null ? String(r.ageAtDeath) : '',
      gender: r.gender || '',
      primaryDiagnosis: r.primaryDiagnosis || '',
      icdCode: r.icdCode || '',
      secondaryDiagnoses: Array.isArray(r.secondaryDiagnoses) ? r.secondaryDiagnoses : [],
      department: r.department || '',
      attendingPhysician: r.attendingPhysician || '',
      admissionDate: r.admissionDate ? r.admissionDate.slice(0, 10) : '',
      deathType: r.deathType || 'EXPECTED',
      preventability: r.preventability || 'UNKNOWN',
      qualityOfCare: r.qualityOfCare || '',
      delayInDiagnosis: r.delayInDiagnosis ?? false,
      delayInTreatment: r.delayInTreatment ?? false,
      communicationIssue: r.communicationIssue ?? false,
      handoffIssue: r.handoffIssue ?? false,
      timelineOfCare: Array.isArray(r.timelineOfCare) ? r.timelineOfCare : [],
      contributingFactors: Array.isArray(r.contributingFactors) ? r.contributingFactors : [],
      systemIssues: Array.isArray(r.systemIssues) ? r.systemIssues : [],
      findings: r.findings || '',
      recommendations: Array.isArray(r.recommendations) ? r.recommendations : [],
      lessonsLearned: r.lessonsLearned || '',
      actionPlan: r.actionPlan || '',
      reviewCommittee: Array.isArray(r.reviewCommittee) ? r.reviewCommittee : [],
      reviewDate: r.reviewDate ? r.reviewDate.slice(0, 10) : '',
      mAndMPresented: r.mAndMPresented ?? false,
      mAndMDate: r.mAndMDate ? r.mAndMDate.slice(0, 10) : '',
      status: r.status || 'PENDING',
      notes: r.notes || '',
    };
  }

  function openCreate() {
    setDialogMode('create');
    setForm(getEmptyForm());
    setDialogTab('patient');
    setSelectedReview(null);
    setDialogOpen(true);
  }

  function openEdit(r: ReviewRecord) {
    setDialogMode('edit');
    setForm(formFromRecord(r));
    setDialogTab('patient');
    setSelectedReview(r);
    setDialogOpen(true);
  }

  function openView(r: ReviewRecord) {
    setDialogMode('view');
    setForm(formFromRecord(r));
    setDialogTab('patient');
    setSelectedReview(r);
    setDialogOpen(true);
  }

  async function handleSave() {
    setBusy(true);
    try {
      const payload: any = {
        ...form,
        ageAtDeath: form.ageAtDeath ? parseInt(form.ageAtDeath, 10) : null,
      };
      if (dialogMode === 'edit' && selectedReview) {
        payload.id = selectedReview.id;
        await fetch('/api/quality/mortality-review', {
          credentials: 'include',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/quality/mortality-review', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPresented(reviewId: string) {
    setBusy(true);
    try {
      await fetch('/api/quality/mortality-review', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reviewId,
          mAndMPresented: true,
          mAndMDate: new Date().toISOString(),
        }),
      });
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(reviewId: string, newStatus: string) {
    setBusy(true);
    try {
      await fetch('/api/quality/mortality-review', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reviewId, status: newStatus }),
      });
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Label helpers (bilingual)
  // ---------------------------------------------------------------------------

  function deathTypeLabel(dt: string): string {
    const map: Record<string, [string, string]> = {
      EXPECTED: ['متوقعة', 'Expected'],
      UNEXPECTED: ['غير متوقعة', 'Unexpected'],
      PERIOPERATIVE: ['أثناء العملية', 'Perioperative'],
      ICU: ['عناية مركزة', 'ICU'],
      ED: ['طوارئ', 'ED'],
    };
    const v = map[dt];
    return v ? tr(v[0], v[1]) : dt;
  }

  function preventabilityLabel(p: string): string {
    const map: Record<string, [string, string]> = {
      DEFINITELY_PREVENTABLE: ['قابلة للمنع بالتأكيد', 'Definitely Preventable'],
      PROBABLY_PREVENTABLE: ['ربما قابلة للمنع', 'Probably Preventable'],
      NOT_PREVENTABLE: ['غير قابلة للمنع', 'Not Preventable'],
      UNKNOWN: ['غير محدد', 'Unknown'],
    };
    const v = map[p];
    return v ? tr(v[0], v[1]) : p;
  }

  function qualityLabel(q: string): string {
    const map: Record<string, [string, string]> = {
      APPROPRIATE: ['مناسبة', 'Appropriate'],
      PARTIALLY_APPROPRIATE: ['مناسبة جزئياً', 'Partially Appropriate'],
      INAPPROPRIATE: ['غير مناسبة', 'Inappropriate'],
    };
    const v = map[q];
    return v ? tr(v[0], v[1]) : q;
  }

  function statusLabel(s: string): string {
    const map: Record<string, [string, string]> = {
      PENDING: ['معلق', 'Pending'],
      IN_REVIEW: ['قيد المراجعة', 'In Review'],
      COMMITTEE_REVIEW: ['مراجعة اللجنة', 'Committee Review'],
      COMPLETED: ['مكتمل', 'Completed'],
      CLOSED: ['مغلق', 'Closed'],
    };
    const v = map[s];
    return v ? tr(v[0], v[1]) : s;
  }

  function preventabilityColor(p: string): string {
    switch (p) {
      case 'DEFINITELY_PREVENTABLE': return 'bg-red-100 text-red-800 border-red-200';
      case 'PROBABLY_PREVENTABLE': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'NOT_PREVENTABLE': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  }

  function statusColor(s: string): string {
    switch (s) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'IN_REVIEW': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMMITTEE_REVIEW': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200';
      case 'CLOSED': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  }

  function qualityColor(q: string): string {
    switch (q) {
      case 'APPROPRIATE': return 'bg-green-100 text-green-800 border-green-200';
      case 'PARTIALLY_APPROPRIATE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'INAPPROPRIATE': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  }

  function factorCategoryLabel(c: string): string {
    const map: Record<string, [string, string]> = {
      CLINICAL: ['سريري', 'Clinical'],
      SYSTEM: ['نظامي', 'System'],
      HUMAN_FACTOR: ['عامل بشري', 'Human Factor'],
      COMMUNICATION: ['تواصل', 'Communication'],
      EQUIPMENT: ['أجهزة', 'Equipment'],
      ENVIRONMENT: ['بيئة', 'Environment'],
    };
    const v = map[c];
    return v ? tr(v[0], v[1]) : c;
  }

  function fmtDate(d: string | null | undefined): string {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
    } catch {
      return d;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{tr('مراجعة الوفيات', 'Mortality Review')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('مراجعة وتحليل حالات الوفاة لتحسين جودة الرعاية', 'Review and analyze mortality cases to improve care quality')}
          </p>
        </div>
        <Button className="rounded-xl" onClick={openCreate}>
          {tr('إنشاء مراجعة', 'Create Review')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPICard
          title={tr('إجمالي الوفيات', 'Total Deaths')}
          value={stats.totalDeaths ?? 0}
          color="text-foreground"
        />
        <KPICard
          title={tr('وفيات قابلة للمنع', 'Preventable Deaths')}
          value={stats.preventableDeaths ?? 0}
          color="text-red-600"
        />
        <KPICard
          title={tr('قيد المراجعة', 'Under Review')}
          value={stats.underReview ?? 0}
          color="text-blue-600"
        />
        <KPICard
          title={tr('متوسط مدة الإقامة', 'Avg Length of Stay')}
          value={`${stats.avgLos ?? 0} ${tr('يوم', 'days')}`}
          color="text-foreground"
        />
        <KPICard
          title={tr('نسبة عرض M&M', 'M&M Presented Rate')}
          value={`${stats.mAndMRate ?? 0}%`}
          color="text-foreground"
        />
        <KPICard
          title={tr('إجراءات معلقة', 'Actions Pending')}
          value={stats.actionItemsPending ?? 0}
          color="text-orange-600"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tr('التاريخ من', 'Date From')}
            </span>
            <Input
              type="date"
              className="rounded-xl border-[1.5px] border-border bg-muted/30"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tr('التاريخ إلى', 'Date To')}
            </span>
            <Input
              type="date"
              className="rounded-xl border-[1.5px] border-border bg-muted/30"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tr('القسم', 'Department')}
            </span>
            <Input
              className="rounded-xl border-[1.5px] border-border bg-muted/30"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              placeholder={tr('بحث القسم', 'Search department')}
            />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tr('نوع الوفاة', 'Death Type')}
            </span>
            <Select value={filterDeathType} onValueChange={setFilterDeathType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tr('الكل', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                {DEATH_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>{deathTypeLabel(dt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tr('إمكانية المنع', 'Preventability')}
            </span>
            <Select value={filterPreventability} onValueChange={setFilterPreventability}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tr('الكل', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                {PREVENTABILITIES.map((p) => (
                  <SelectItem key={p} value={p}>{preventabilityLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tr('الحالة', 'Status')}
            </span>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tr('الكل', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="bg-muted/50 rounded-xl">
          <TabsTrigger value="cases" className="rounded-lg">{tr('قائمة الحالات', 'Case List')}</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg">{tr('التحليلات', 'Analytics')}</TabsTrigger>
          <TabsTrigger value="mm" className="rounded-lg">{tr('مؤتمر M&M', 'M&M Conference')}</TabsTrigger>
        </TabsList>

        {/* Tab 1: Case List */}
        <TabsContent value="cases">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('التاريخ', 'Date')}
                    </th>
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('المريض', 'Patient')}
                    </th>
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('العمر', 'Age')}
                    </th>
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('التشخيص', 'Diagnosis')}
                    </th>
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('القسم', 'Department')}
                    </th>
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('نوع الوفاة', 'Death Type')}
                    </th>
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('إمكانية المنع', 'Preventability')}
                    </th>
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('جودة الرعاية', 'Quality of Care')}
                    </th>
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('الحالة', 'Status')}
                    </th>
                    <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr('إجراءات', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                        {tr('لا توجد مراجعات وفيات مسجلة.', 'No mortality reviews recorded.')}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">{fmtDate(item.dateOfDeath)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{item.patientMasterId.slice(0, 8)}...</td>
                        <td className="px-4 py-3">{item.ageAtDeath != null ? item.ageAtDeath : '-'}</td>
                        <td className="px-4 py-3 max-w-[200px] truncate" title={item.primaryDiagnosis}>
                          {item.primaryDiagnosis}
                        </td>
                        <td className="px-4 py-3">{item.department}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[11px]">{deathTypeLabel(item.deathType)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border ${preventabilityColor(item.preventability)}`}>
                            {preventabilityLabel(item.preventability)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {item.qualityOfCare ? (
                            <span className={`inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border ${qualityColor(item.qualityOfCare)}`}>
                              {qualityLabel(item.qualityOfCare)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border ${statusColor(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 px-2" onClick={() => openView(item)}>
                              {tr('عرض', 'View')}
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 px-2" onClick={() => openEdit(item)}>
                              {tr('تعديل', 'Edit')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Analytics */}
        <TabsContent value="analytics">
          <div className="space-y-4">
            {/* Deaths by Type & Preventability */}
            <div className="grid gap-4 md:grid-cols-2">
              <AnalyticsCard
                title={tr('الوفيات حسب النوع', 'Deaths by Type')}
                data={stats.byDeathType || {}}
                labelFn={deathTypeLabel}
              />
              <AnalyticsCard
                title={tr('حسب إمكانية المنع', 'By Preventability')}
                data={stats.byPreventability || {}}
                labelFn={preventabilityLabel}
              />
            </div>

            {/* Department Distribution */}
            <AnalyticsCard
              title={tr('التوزيع حسب القسم', 'Department Distribution')}
              data={stats.byDepartment || {}}
              labelFn={(d: string) => d}
            />

            {/* Monthly Trend */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-extrabold text-base">{tr('الاتجاه الشهري', 'Monthly Trend')}</h3>
              </div>
              <div className="p-5">
                {Object.keys(stats.monthlyTrend || {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tr('لا توجد بيانات.', 'No data.')}</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(stats.monthlyTrend || {})
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([month, count]) => {
                        const maxCount = Math.max(...Object.values(stats.monthlyTrend || {}).map(Number));
                        const pct = maxCount > 0 ? (Number(count) / maxCount) * 100 : 0;
                        return (
                          <div key={month} className="flex items-center gap-3">
                            <span className="text-sm w-20 shrink-0 font-medium">{month}</span>
                            <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                              <div
                                className="bg-primary/70 h-full rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm w-8 text-end font-bold">{String(count)}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Contributing Factors & System Issues */}
            <div className="grid gap-4 md:grid-cols-2">
              <FrequencyCard
                title={tr('العوامل المساهمة', 'Contributing Factors')}
                data={stats.contributingFactorsFreq || {}}
                emptyMsg={tr('لا توجد عوامل مسجلة.', 'No factors recorded.')}
              />
              <FrequencyCard
                title={tr('مشاكل النظام', 'System Issues')}
                data={stats.systemIssuesFreq || {}}
                emptyMsg={tr('لا توجد مشاكل مسجلة.', 'No issues recorded.')}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: M&M Conference */}
        <TabsContent value="mm">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">{tr('مؤتمر المراضة والوفيات', 'Morbidity & Mortality Conference')}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {tr('حالات مقدمة أو بانتظار التقديم في مؤتمر M&M', 'Cases presented or pending presentation at M&M conference')}
                </p>
              </div>
              <div>
                <Select value={mmFilter} onValueChange={(v) => setMmFilter(v as 'all' | 'presented' | 'pending')}>
                  <SelectTrigger className="rounded-xl w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr('الكل', 'All')}</SelectItem>
                    <SelectItem value="presented">{tr('تم العرض', 'Presented')}</SelectItem>
                    <SelectItem value="pending">{tr('بانتظار العرض', 'Pending')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-5">
              {mmItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {tr('لا توجد حالات مكتملة.', 'No completed cases.')}
                </p>
              ) : (
                <div className="space-y-3">
                  {mmItems.map((item) => (
                    <div key={item.id} className="border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{item.primaryDiagnosis}</span>
                            <Badge variant="outline" className="text-[11px]">{item.department}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {tr('تاريخ الوفاة:', 'Date of Death:')} {fmtDate(item.dateOfDeath)}
                            {' | '}
                            {tr('الطبيب:', 'Physician:')} {item.attendingPhysician}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.mAndMPresented ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border bg-green-100 text-green-800 border-green-200">
                                {tr('تم العرض', 'Presented')}
                              </span>
                              {item.mAndMDate && (
                                <span className="text-xs text-muted-foreground">{fmtDate(item.mAndMDate)}</span>
                              )}
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs h-7"
                              onClick={() => handleMarkPresented(item.id)}
                              disabled={busy}
                            >
                              {tr('تسجيل كمعروض', 'Mark as Presented')}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="rounded-lg text-xs h-7" onClick={() => openView(item)}>
                            {tr('عرض', 'View')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit/View Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create'
                ? tr('إنشاء مراجعة وفاة', 'Create Mortality Review')
                : dialogMode === 'edit'
                ? tr('تعديل مراجعة الوفاة', 'Edit Mortality Review')
                : tr('تفاصيل مراجعة الوفاة', 'Mortality Review Details')}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="bg-muted/50 rounded-xl flex-wrap">
              <TabsTrigger value="patient" className="rounded-lg text-xs">{tr('بيانات المريض', 'Patient Info')}</TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-lg text-xs">{tr('الجدول الزمني', 'Timeline')}</TabsTrigger>
              <TabsTrigger value="analysis" className="rounded-lg text-xs">{tr('التحليل', 'Analysis')}</TabsTrigger>
              <TabsTrigger value="recommendations" className="rounded-lg text-xs">{tr('التوصيات', 'Recommendations')}</TabsTrigger>
              <TabsTrigger value="committee" className="rounded-lg text-xs">{tr('اللجنة', 'Committee')}</TabsTrigger>
            </TabsList>

            {/* Dialog Tab 1: Patient Info */}
            <TabsContent value="patient" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={tr('معرف المريض', 'Patient ID')} required>
                  <Input
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={form.patientMasterId}
                    onChange={(e) => setForm({ ...form, patientMasterId: e.target.value })}
                    disabled={dialogMode === 'view'}
                    placeholder={tr('أدخل معرف المريض', 'Enter patient ID')}
                  />
                </FormField>
                <FormField label={tr('تاريخ الوفاة', 'Date of Death')} required>
                  <Input
                    type="date"
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={form.dateOfDeath}
                    onChange={(e) => setForm({ ...form, dateOfDeath: e.target.value })}
                    disabled={dialogMode === 'view'}
                  />
                </FormField>
                <FormField label={tr('العمر عند الوفاة', 'Age at Death')}>
                  <Input
                    type="number"
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={form.ageAtDeath}
                    onChange={(e) => setForm({ ...form, ageAtDeath: e.target.value })}
                    disabled={dialogMode === 'view'}
                    placeholder={tr('العمر', 'Age')}
                  />
                </FormField>
                <FormField label={tr('الجنس', 'Gender')}>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => setForm({ ...form, gender: v })}
                    disabled={dialogMode === 'view'}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={tr('اختر', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">{tr('ذكر', 'Male')}</SelectItem>
                      <SelectItem value="FEMALE">{tr('أنثى', 'Female')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={tr('التشخيص الرئيسي', 'Primary Diagnosis')} required>
                  <Input
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={form.primaryDiagnosis}
                    onChange={(e) => setForm({ ...form, primaryDiagnosis: e.target.value })}
                    disabled={dialogMode === 'view'}
                    placeholder={tr('أدخل التشخيص', 'Enter diagnosis')}
                  />
                </FormField>
                <FormField label={tr('رمز ICD', 'ICD Code')}>
                  <Input
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={form.icdCode}
                    onChange={(e) => setForm({ ...form, icdCode: e.target.value })}
                    disabled={dialogMode === 'view'}
                    placeholder="E.g. I21.0"
                  />
                </FormField>
              </div>

              {/* Secondary Diagnoses */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{tr('التشخيصات الثانوية', 'Secondary Diagnoses')}</span>
                  {dialogMode !== 'view' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs h-7"
                      onClick={() => setForm({ ...form, secondaryDiagnoses: [...form.secondaryDiagnoses, { diagnosis: '', icdCode: '' }] })}
                    >
                      {tr('إضافة', 'Add')}
                    </Button>
                  )}
                </div>
                {(form.secondaryDiagnoses || []).map((sd: SecondaryDiagnosis, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      className="rounded-xl border-[1.5px] border-border bg-muted/30 flex-1"
                      value={sd.diagnosis}
                      onChange={(e) => {
                        const arr = [...form.secondaryDiagnoses];
                        arr[idx] = { ...arr[idx], diagnosis: e.target.value };
                        setForm({ ...form, secondaryDiagnoses: arr });
                      }}
                      disabled={dialogMode === 'view'}
                      placeholder={tr('تشخيص', 'Diagnosis')}
                    />
                    <Input
                      className="rounded-xl border-[1.5px] border-border bg-muted/30 w-32"
                      value={sd.icdCode}
                      onChange={(e) => {
                        const arr = [...form.secondaryDiagnoses];
                        arr[idx] = { ...arr[idx], icdCode: e.target.value };
                        setForm({ ...form, secondaryDiagnoses: arr });
                      }}
                      disabled={dialogMode === 'view'}
                      placeholder={tr('رمز ICD', 'ICD')}
                    />
                    {dialogMode !== 'view' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 h-7 w-7 p-0"
                        onClick={() => {
                          const arr = form.secondaryDiagnoses.filter((_: any, i: number) => i !== idx);
                          setForm({ ...form, secondaryDiagnoses: arr });
                        }}
                      >
                        X
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={tr('القسم', 'Department')} required>
                  <Input
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    disabled={dialogMode === 'view'}
                    placeholder={tr('القسم', 'Department')}
                  />
                </FormField>
                <FormField label={tr('الطبيب المعالج', 'Attending Physician')} required>
                  <Input
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={form.attendingPhysician}
                    onChange={(e) => setForm({ ...form, attendingPhysician: e.target.value })}
                    disabled={dialogMode === 'view'}
                    placeholder={tr('اسم الطبيب', 'Physician name')}
                  />
                </FormField>
                <FormField label={tr('تاريخ الدخول', 'Admission Date')}>
                  <Input
                    type="date"
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={form.admissionDate}
                    onChange={(e) => setForm({ ...form, admissionDate: e.target.value })}
                    disabled={dialogMode === 'view'}
                  />
                </FormField>
                <FormField label={tr('مدة الإقامة (أيام)', 'Length of Stay (days)')}>
                  <Input
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={
                      form.admissionDate && form.dateOfDeath
                        ? (() => {
                            const a = new Date(form.admissionDate);
                            const d = new Date(form.dateOfDeath);
                            if (isNaN(a.getTime()) || isNaN(d.getTime())) return '';
                            return String(Math.max(0, Math.ceil((d.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))));
                          })()
                        : ''
                    }
                    disabled
                    placeholder={tr('يحسب تلقائياً', 'Auto-calculated')}
                  />
                </FormField>
                <FormField label={tr('نوع الوفاة', 'Death Type')} required>
                  <Select
                    value={form.deathType}
                    onValueChange={(v) => setForm({ ...form, deathType: v })}
                    disabled={dialogMode === 'view'}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEATH_TYPES.map((dt) => (
                        <SelectItem key={dt} value={dt}>{deathTypeLabel(dt)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={tr('معرف اللقاء', 'Encounter ID')}>
                  <Input
                    className="rounded-xl border-[1.5px] border-border bg-muted/30"
                    value={form.encounterId}
                    onChange={(e) => setForm({ ...form, encounterId: e.target.value })}
                    disabled={dialogMode === 'view'}
                    placeholder={tr('اختياري', 'Optional')}
                  />
                </FormField>
              </div>
            </TabsContent>

            {/* Dialog Tab 2: Clinical Timeline */}
            <TabsContent value="timeline" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{tr('الجدول الزمني للرعاية', 'Timeline of Care')}</h3>
                {dialogMode !== 'view' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg text-xs h-7"
                    onClick={() =>
                      setForm({
                        ...form,
                        timelineOfCare: [...form.timelineOfCare, { dateTime: '', event: '', by: '', notes: '' }],
                      })
                    }
                  >
                    {tr('إضافة حدث', 'Add Event')}
                  </Button>
                )}
              </div>

              {(form.timelineOfCare || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {tr('لا توجد أحداث في الجدول الزمني.', 'No timeline events.')}
                </p>
              ) : (
                <div className="space-y-4">
                  {(form.timelineOfCare || []).map((evt: TimelineEvent, idx: number) => (
                    <div key={idx} className="border border-border rounded-xl p-4 relative">
                      {/* Timeline dot */}
                      <div className="absolute -start-2 top-5 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                      <div className="grid gap-3 md:grid-cols-2">
                        <FormField label={tr('التاريخ والوقت', 'Date & Time')}>
                          <Input
                            type="datetime-local"
                            className="rounded-xl border-[1.5px] border-border bg-muted/30"
                            value={evt.dateTime}
                            onChange={(e) => {
                              const arr = [...form.timelineOfCare];
                              arr[idx] = { ...arr[idx], dateTime: e.target.value };
                              setForm({ ...form, timelineOfCare: arr });
                            }}
                            disabled={dialogMode === 'view'}
                          />
                        </FormField>
                        <FormField label={tr('بواسطة', 'By')}>
                          <Input
                            className="rounded-xl border-[1.5px] border-border bg-muted/30"
                            value={evt.by}
                            onChange={(e) => {
                              const arr = [...form.timelineOfCare];
                              arr[idx] = { ...arr[idx], by: e.target.value };
                              setForm({ ...form, timelineOfCare: arr });
                            }}
                            disabled={dialogMode === 'view'}
                            placeholder={tr('الشخص المسؤول', 'Responsible person')}
                          />
                        </FormField>
                        <FormField label={tr('الحدث', 'Event')} className="md:col-span-2">
                          <Input
                            className="rounded-xl border-[1.5px] border-border bg-muted/30"
                            value={evt.event}
                            onChange={(e) => {
                              const arr = [...form.timelineOfCare];
                              arr[idx] = { ...arr[idx], event: e.target.value };
                              setForm({ ...form, timelineOfCare: arr });
                            }}
                            disabled={dialogMode === 'view'}
                            placeholder={tr('وصف الحدث', 'Event description')}
                          />
                        </FormField>
                        <FormField label={tr('ملاحظات', 'Notes')} className="md:col-span-2">
                          <Textarea
                            className="rounded-xl border-[1.5px] border-border bg-muted/30 min-h-[60px]"
                            value={evt.notes}
                            onChange={(e) => {
                              const arr = [...form.timelineOfCare];
                              arr[idx] = { ...arr[idx], notes: e.target.value };
                              setForm({ ...form, timelineOfCare: arr });
                            }}
                            disabled={dialogMode === 'view'}
                          />
                        </FormField>
                      </div>
                      {dialogMode !== 'view' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 end-2 text-red-500 h-7 w-7 p-0"
                          onClick={() => {
                            const arr = form.timelineOfCare.filter((_: any, i: number) => i !== idx);
                            setForm({ ...form, timelineOfCare: arr });
                          }}
                        >
                          X
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Dialog Tab 3: Review Analysis */}
            <TabsContent value="analysis" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={tr('تقييم إمكانية المنع', 'Preventability Assessment')}>
                  <Select
                    value={form.preventability}
                    onValueChange={(v) => setForm({ ...form, preventability: v })}
                    disabled={dialogMode === 'view'}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PREVENTABILITIES.map((p) => (
                        <SelectItem key={p} value={p}>{preventabilityLabel(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={tr('تقييم جودة الرعاية', 'Quality of Care Assessment')}>
                  <Select
                    value={form.qualityOfCare || ''}
                    onValueChange={(v) => setForm({ ...form, qualityOfCare: v || null })}
                    disabled={dialogMode === 'view'}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={tr('اختر', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      {QUALITY_LEVELS.map((q) => (
                        <SelectItem key={q} value={q}>{qualityLabel(q)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              {/* Issue Checkboxes */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold">{tr('المشاكل المحددة', 'Identified Issues')}</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="delayInDiagnosis"
                      checked={form.delayInDiagnosis}
                      onCheckedChange={(v) => setForm({ ...form, delayInDiagnosis: !!v })}
                      disabled={dialogMode === 'view'}
                    />
                    <Label htmlFor="delayInDiagnosis" className="text-sm">
                      {tr('تأخر في التشخيص', 'Delay in Diagnosis')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="delayInTreatment"
                      checked={form.delayInTreatment}
                      onCheckedChange={(v) => setForm({ ...form, delayInTreatment: !!v })}
                      disabled={dialogMode === 'view'}
                    />
                    <Label htmlFor="delayInTreatment" className="text-sm">
                      {tr('تأخر في العلاج', 'Delay in Treatment')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="communicationIssue"
                      checked={form.communicationIssue}
                      onCheckedChange={(v) => setForm({ ...form, communicationIssue: !!v })}
                      disabled={dialogMode === 'view'}
                    />
                    <Label htmlFor="communicationIssue" className="text-sm">
                      {tr('مشكلة في التواصل', 'Communication Issue')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="handoffIssue"
                      checked={form.handoffIssue}
                      onCheckedChange={(v) => setForm({ ...form, handoffIssue: !!v })}
                      disabled={dialogMode === 'view'}
                    />
                    <Label htmlFor="handoffIssue" className="text-sm">
                      {tr('مشكلة في التسليم', 'Handoff Issue')}
                    </Label>
                  </div>
                </div>
              </div>

              {/* Contributing Factors */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{tr('العوامل المساهمة', 'Contributing Factors')}</h4>
                  {dialogMode !== 'view' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs h-7"
                      onClick={() =>
                        setForm({
                          ...form,
                          contributingFactors: [...form.contributingFactors, { factor: '', category: 'CLINICAL', impact: '' }],
                        })
                      }
                    >
                      {tr('إضافة عامل', 'Add Factor')}
                    </Button>
                  )}
                </div>
                {(form.contributingFactors || []).map((cf: ContributingFactor, idx: number) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <Select
                      value={cf.category}
                      onValueChange={(v) => {
                        const arr = [...form.contributingFactors];
                        arr[idx] = { ...arr[idx], category: v };
                        setForm({ ...form, contributingFactors: arr });
                      }}
                      disabled={dialogMode === 'view'}
                    >
                      <SelectTrigger className="rounded-xl w-40 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FACTOR_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{factorCategoryLabel(c)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="rounded-xl border-[1.5px] border-border bg-muted/30 flex-1"
                      value={cf.factor}
                      onChange={(e) => {
                        const arr = [...form.contributingFactors];
                        arr[idx] = { ...arr[idx], factor: e.target.value };
                        setForm({ ...form, contributingFactors: arr });
                      }}
                      disabled={dialogMode === 'view'}
                      placeholder={tr('وصف العامل', 'Factor description')}
                    />
                    <Input
                      className="rounded-xl border-[1.5px] border-border bg-muted/30 w-32"
                      value={cf.impact}
                      onChange={(e) => {
                        const arr = [...form.contributingFactors];
                        arr[idx] = { ...arr[idx], impact: e.target.value };
                        setForm({ ...form, contributingFactors: arr });
                      }}
                      disabled={dialogMode === 'view'}
                      placeholder={tr('الأثر', 'Impact')}
                    />
                    {dialogMode !== 'view' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 h-7 w-7 p-0 shrink-0"
                        onClick={() => {
                          const arr = form.contributingFactors.filter((_: any, i: number) => i !== idx);
                          setForm({ ...form, contributingFactors: arr });
                        }}
                      >
                        X
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* System Issues */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{tr('مشاكل النظام', 'System Issues')}</h4>
                  {dialogMode !== 'view' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs h-7"
                      onClick={() =>
                        setForm({
                          ...form,
                          systemIssues: [...form.systemIssues, { issue: '', category: 'SYSTEM' }],
                        })
                      }
                    >
                      {tr('إضافة مشكلة', 'Add Issue')}
                    </Button>
                  )}
                </div>
                {(form.systemIssues || []).map((si: SystemIssue, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select
                      value={si.category}
                      onValueChange={(v) => {
                        const arr = [...form.systemIssues];
                        arr[idx] = { ...arr[idx], category: v };
                        setForm({ ...form, systemIssues: arr });
                      }}
                      disabled={dialogMode === 'view'}
                    >
                      <SelectTrigger className="rounded-xl w-40 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FACTOR_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{factorCategoryLabel(c)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="rounded-xl border-[1.5px] border-border bg-muted/30 flex-1"
                      value={si.issue}
                      onChange={(e) => {
                        const arr = [...form.systemIssues];
                        arr[idx] = { ...arr[idx], issue: e.target.value };
                        setForm({ ...form, systemIssues: arr });
                      }}
                      disabled={dialogMode === 'view'}
                      placeholder={tr('وصف المشكلة', 'Issue description')}
                    />
                    {dialogMode !== 'view' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 h-7 w-7 p-0 shrink-0"
                        onClick={() => {
                          const arr = form.systemIssues.filter((_: any, i: number) => i !== idx);
                          setForm({ ...form, systemIssues: arr });
                        }}
                      >
                        X
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Dialog Tab 4: Recommendations */}
            <TabsContent value="recommendations" className="space-y-4 mt-4">
              {/* Recommendations List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{tr('التوصيات', 'Recommendations')}</h4>
                  {dialogMode !== 'view' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs h-7"
                      onClick={() =>
                        setForm({
                          ...form,
                          recommendations: [
                            ...form.recommendations,
                            { recommendation: '', responsible: '', dueDate: '', priority: 'MEDIUM', status: 'PENDING' },
                          ],
                        })
                      }
                    >
                      {tr('إضافة توصية', 'Add Recommendation')}
                    </Button>
                  )}
                </div>
                {(form.recommendations || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {tr('لا توجد توصيات.', 'No recommendations.')}
                  </p>
                ) : (
                  (form.recommendations || []).map((rec: Recommendation, idx: number) => (
                    <div key={idx} className="border border-border rounded-xl p-4 relative space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <FormField label={tr('التوصية', 'Recommendation')} className="md:col-span-2">
                          <Textarea
                            className="rounded-xl border-[1.5px] border-border bg-muted/30 min-h-[60px]"
                            value={rec.recommendation}
                            onChange={(e) => {
                              const arr = [...form.recommendations];
                              arr[idx] = { ...arr[idx], recommendation: e.target.value };
                              setForm({ ...form, recommendations: arr });
                            }}
                            disabled={dialogMode === 'view'}
                            placeholder={tr('وصف التوصية', 'Recommendation description')}
                          />
                        </FormField>
                        <FormField label={tr('المسؤول', 'Responsible')}>
                          <Input
                            className="rounded-xl border-[1.5px] border-border bg-muted/30"
                            value={rec.responsible}
                            onChange={(e) => {
                              const arr = [...form.recommendations];
                              arr[idx] = { ...arr[idx], responsible: e.target.value };
                              setForm({ ...form, recommendations: arr });
                            }}
                            disabled={dialogMode === 'view'}
                            placeholder={tr('الشخص المسؤول', 'Responsible person')}
                          />
                        </FormField>
                        <FormField label={tr('تاريخ الاستحقاق', 'Due Date')}>
                          <Input
                            type="date"
                            className="rounded-xl border-[1.5px] border-border bg-muted/30"
                            value={rec.dueDate}
                            onChange={(e) => {
                              const arr = [...form.recommendations];
                              arr[idx] = { ...arr[idx], dueDate: e.target.value };
                              setForm({ ...form, recommendations: arr });
                            }}
                            disabled={dialogMode === 'view'}
                          />
                        </FormField>
                        <FormField label={tr('الأولوية', 'Priority')}>
                          <Select
                            value={rec.priority}
                            onValueChange={(v) => {
                              const arr = [...form.recommendations];
                              arr[idx] = { ...arr[idx], priority: v };
                              setForm({ ...form, recommendations: arr });
                            }}
                            disabled={dialogMode === 'view'}
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HIGH">{tr('عالية', 'High')}</SelectItem>
                              <SelectItem value="MEDIUM">{tr('متوسطة', 'Medium')}</SelectItem>
                              <SelectItem value="LOW">{tr('منخفضة', 'Low')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                        <FormField label={tr('الحالة', 'Status')}>
                          <Select
                            value={rec.status}
                            onValueChange={(v) => {
                              const arr = [...form.recommendations];
                              arr[idx] = { ...arr[idx], status: v };
                              setForm({ ...form, recommendations: arr });
                            }}
                            disabled={dialogMode === 'view'}
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDING">{tr('معلق', 'Pending')}</SelectItem>
                              <SelectItem value="IN_PROGRESS">{tr('قيد التنفيذ', 'In Progress')}</SelectItem>
                              <SelectItem value="COMPLETED">{tr('مكتمل', 'Completed')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                      </div>
                      {dialogMode !== 'view' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 end-2 text-red-500 h-7 w-7 p-0"
                          onClick={() => {
                            const arr = form.recommendations.filter((_: any, i: number) => i !== idx);
                            setForm({ ...form, recommendations: arr });
                          }}
                        >
                          X
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Lessons Learned */}
              <FormField label={tr('الدروس المستفادة', 'Lessons Learned')}>
                <Textarea
                  className="rounded-xl border-[1.5px] border-border bg-muted/30 min-h-[80px]"
                  value={form.lessonsLearned}
                  onChange={(e) => setForm({ ...form, lessonsLearned: e.target.value })}
                  disabled={dialogMode === 'view'}
                  placeholder={tr('اكتب الدروس المستفادة من هذه الحالة', 'Write lessons learned from this case')}
                />
              </FormField>

              {/* Action Plan */}
              <FormField label={tr('خطة العمل', 'Action Plan')}>
                <Textarea
                  className="rounded-xl border-[1.5px] border-border bg-muted/30 min-h-[80px]"
                  value={form.actionPlan}
                  onChange={(e) => setForm({ ...form, actionPlan: e.target.value })}
                  disabled={dialogMode === 'view'}
                  placeholder={tr('اكتب خطة العمل التصحيحية', 'Write the corrective action plan')}
                />
              </FormField>

              {/* Findings Summary */}
              <FormField label={tr('ملخص النتائج', 'Findings Summary')}>
                <Textarea
                  className="rounded-xl border-[1.5px] border-border bg-muted/30 min-h-[80px]"
                  value={form.findings}
                  onChange={(e) => setForm({ ...form, findings: e.target.value })}
                  disabled={dialogMode === 'view'}
                  placeholder={tr('ملخص نتائج المراجعة', 'Summary of review findings')}
                />
              </FormField>
            </TabsContent>

            {/* Dialog Tab 5: Committee Review */}
            <TabsContent value="committee" className="space-y-4 mt-4">
              {/* Committee Members */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{tr('أعضاء لجنة المراجعة', 'Review Committee Members')}</h4>
                  {dialogMode !== 'view' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs h-7"
                      onClick={() =>
                        setForm({
                          ...form,
                          reviewCommittee: [...form.reviewCommittee, { userId: '', name: '', role: '' }],
                        })
                      }
                    >
                      {tr('إضافة عضو', 'Add Member')}
                    </Button>
                  )}
                </div>
                {(form.reviewCommittee || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {tr('لا يوجد أعضاء في اللجنة.', 'No committee members.')}
                  </p>
                ) : (
                  (form.reviewCommittee || []).map((m: CommitteeMember, idx: number) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        className="rounded-xl border-[1.5px] border-border bg-muted/30 w-32"
                        value={m.userId}
                        onChange={(e) => {
                          const arr = [...form.reviewCommittee];
                          arr[idx] = { ...arr[idx], userId: e.target.value };
                          setForm({ ...form, reviewCommittee: arr });
                        }}
                        disabled={dialogMode === 'view'}
                        placeholder={tr('معرف المستخدم', 'User ID')}
                      />
                      <Input
                        className="rounded-xl border-[1.5px] border-border bg-muted/30 flex-1"
                        value={m.name}
                        onChange={(e) => {
                          const arr = [...form.reviewCommittee];
                          arr[idx] = { ...arr[idx], name: e.target.value };
                          setForm({ ...form, reviewCommittee: arr });
                        }}
                        disabled={dialogMode === 'view'}
                        placeholder={tr('الاسم', 'Name')}
                      />
                      <Input
                        className="rounded-xl border-[1.5px] border-border bg-muted/30 w-40"
                        value={m.role}
                        onChange={(e) => {
                          const arr = [...form.reviewCommittee];
                          arr[idx] = { ...arr[idx], role: e.target.value };
                          setForm({ ...form, reviewCommittee: arr });
                        }}
                        disabled={dialogMode === 'view'}
                        placeholder={tr('الدور', 'Role')}
                      />
                      {dialogMode !== 'view' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 h-7 w-7 p-0 shrink-0"
                          onClick={() => {
                            const arr = form.reviewCommittee.filter((_: any, i: number) => i !== idx);
                            setForm({ ...form, reviewCommittee: arr });
                          }}
                        >
                          X
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Review Date */}
              <FormField label={tr('تاريخ المراجعة', 'Review Date')}>
                <Input
                  type="date"
                  className="rounded-xl border-[1.5px] border-border bg-muted/30"
                  value={form.reviewDate}
                  onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
                  disabled={dialogMode === 'view'}
                />
              </FormField>

              {/* M&M Conference */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold">{tr('مؤتمر المراضة والوفيات', 'M&M Conference')}</h4>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="mAndMPresented"
                    checked={form.mAndMPresented}
                    onCheckedChange={(v) => setForm({ ...form, mAndMPresented: !!v })}
                    disabled={dialogMode === 'view'}
                  />
                  <Label htmlFor="mAndMPresented" className="text-sm">
                    {tr('تم العرض في مؤتمر M&M', 'Presented at M&M Conference')}
                  </Label>
                </div>
                {form.mAndMPresented && (
                  <FormField label={tr('تاريخ العرض', 'Presentation Date')}>
                    <Input
                      type="date"
                      className="rounded-xl border-[1.5px] border-border bg-muted/30 w-60"
                      value={form.mAndMDate}
                      onChange={(e) => setForm({ ...form, mAndMDate: e.target.value })}
                      disabled={dialogMode === 'view'}
                    />
                  </FormField>
                )}
              </div>

              {/* Status Transitions */}
              {dialogMode === 'edit' && selectedReview && (
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold">{tr('تغيير الحالة', 'Status Transition')}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{tr('الحالة الحالية:', 'Current Status:')}</span>
                    <span className={`inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border ${statusColor(form.status)}`}>
                      {statusLabel(form.status)}
                    </span>
                  </div>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger className="rounded-xl w-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes */}
              <FormField label={tr('ملاحظات', 'Notes')}>
                <Textarea
                  className="rounded-xl border-[1.5px] border-border bg-muted/30 min-h-[80px]"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  disabled={dialogMode === 'view'}
                  placeholder={tr('ملاحظات إضافية', 'Additional notes')}
                />
              </FormField>
            </TabsContent>
          </Tabs>

          {/* Dialog Footer */}
          {dialogMode !== 'view' && (
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button className="rounded-xl" onClick={handleSave} disabled={busy}>
                {busy
                  ? tr('جاري الحفظ...', 'Saving...')
                  : dialogMode === 'create'
                  ? tr('إنشاء المراجعة', 'Create Review')
                  : tr('حفظ التغييرات', 'Save Changes')}
              </Button>
            </div>
          )}

          {dialogMode === 'view' && (
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
                {tr('إغلاق', 'Close')}
              </Button>
              <Button
                className="rounded-xl"
                onClick={() => {
                  if (selectedReview) openEdit(selectedReview);
                }}
              >
                {tr('تعديل', 'Edit')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className={`text-2xl font-extrabold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className || ''}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-red-500 ms-0.5">*</span>}
      </span>
      {children}
    </div>
  );
}

function AnalyticsCard({
  title,
  data,
  labelFn,
}: {
  title: string;
  data: Record<string, number>;
  labelFn: (key: string) => string;
}) {
  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-extrabold text-base">{title}</h3>
      </div>
      <div className="p-5">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">-</p>
        ) : (
          <div className="space-y-2">
            {entries.map(([key, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm w-40 shrink-0 truncate">{labelFn(key)}</span>
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-primary/60 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm w-12 text-end font-bold">{count}</span>
                  <span className="text-xs text-muted-foreground w-10 text-end">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FrequencyCard({
  title,
  data,
  emptyMsg,
}: {
  title: string;
  data: Record<string, number>;
  emptyMsg: string;
}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-extrabold text-base">{title}</h3>
      </div>
      <div className="p-5">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMsg}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {title}
                </th>
                <th className="py-2 text-end text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-20">
                  #
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, count]) => (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="py-2">{key}</td>
                  <td className="py-2 text-end font-bold">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
