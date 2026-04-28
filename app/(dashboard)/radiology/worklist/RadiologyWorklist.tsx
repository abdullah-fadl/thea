'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Search,
  AlertTriangle,
  Activity,
  FileText,
  CheckCircle2,
  UserPlus,
  ArrowRight,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ─── Types ──────────────────────────────────────────────────────────── */
interface WorklistStudy {
  id: string;
  orderId: string;
  patientName: string;
  mrn: string;
  modality: string;
  bodyPart: string;
  examName: string;
  examNameAr?: string;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  status: string;
  orderedAt: string;
  assignedRadiologist?: string;
  accessionNumber?: string;
  encounterId?: string;
  patientId?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────── */
const MODALITY_OPTIONS = ['All', 'XR', 'CT', 'MR', 'US', 'NM', 'PET'] as const;
const PRIORITY_OPTIONS = ['All', 'STAT', 'URGENT', 'ROUTINE'] as const;
const STATUS_OPTIONS = ['All', 'ORDERED', 'IN_PROGRESS', 'REPORTED', 'VERIFIED'] as const;

const MODALITY_COLORS: Record<string, string> = {
  XR: 'bg-muted text-foreground',
  CT: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  MR: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  US: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  NM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
  PET: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  STAT: 'bg-red-100 text-red-700',
  URGENT: 'bg-amber-100 text-amber-700',
  ROUTINE: 'bg-muted text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  ORDERED: 'bg-yellow-100 text-yellow-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  REPORTED: 'bg-green-100 text-green-700',
  VERIFIED: 'bg-emerald-100 text-emerald-700',
};

const PRIORITY_SORT_ORDER: Record<string, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 };

/* ─── Helpers ────────────────────────────────────────────────────────── */
function timeSince(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return lang === 'ar' ? `${mins} د` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'ar' ? `${hrs} س` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return lang === 'ar' ? `${days} ي` : `${days}d`;
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function RadiologyWorklist() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalityFilter, setModalityFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Build query params for the API
  const apiParams = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== 'All') {
      p.set('status', statusFilter);
    } else {
      p.set('status', 'ORDERED,SCHEDULED,IN_PROGRESS,REPORTED,VERIFIED');
    }
    if (modalityFilter !== 'All') p.set('modality', modalityFilter);
    if (search) p.set('search', search);
    return p.toString();
  }, [statusFilter, modalityFilter, search]);

  const { data, isLoading, mutate } = useSWR(
    `/api/radiology/worklist?${apiParams}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const rawStudies: WorklistStudy[] = Array.isArray(data?.orders) ? data.orders : [];

  // Client-side priority filter + sort
  const studies = useMemo(() => {
    let filtered = rawStudies;
    if (priorityFilter !== 'All') {
      filtered = filtered.filter((s) => s.priority === priorityFilter);
    }
    return [...filtered].sort((a, b) => {
      const pa = PRIORITY_SORT_ORDER[a.priority] ?? 9;
      const pb = PRIORITY_SORT_ORDER[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime();
    });
  }, [rawStudies, priorityFilter]);

  // KPI computations
  const kpis = useMemo(() => {
    const pending = rawStudies.filter((s) => s.status === 'ORDERED' || s.status === 'SCHEDULED').length;
    const inProgress = rawStudies.filter((s) => s.status === 'IN_PROGRESS').length;
    const reported = rawStudies.filter((s) => s.status === 'REPORTED' || s.status === 'VERIFIED').length;
    const critical = 0; // Placeholder: critical findings from a separate endpoint
    return { pending, inProgress, reported, critical };
  }, [rawStudies]);

  // Claim study
  const handleClaim = async (studyId: string) => {
    setClaimingId(studyId);
    try {
      const res = await fetch('/api/radiology/reports/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: studyId, findings: '', impression: '', status: 'IN_PROGRESS' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم استلام الدراسة', 'Study claimed successfully') });
      await mutate();
    } catch {
      toast({ title: tr('فشل استلام الدراسة', 'Failed to claim study'), variant: 'destructive' });
    } finally {
      setClaimingId(null);
    }
  };

  const priorityBorder = (priority: string) => {
    if (priority === 'STAT') return 'border-l-4 border-l-red-500';
    if (priority === 'URGENT') return 'border-l-4 border-l-orange-400';
    return '';
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {tr('قائمة عمل الأشعة', 'Radiology Worklist')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {studies.length} {tr('دراسة', 'studies')}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-950/40 rounded-xl">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{kpis.pending}</p>
                <p className="text-xs text-muted-foreground">{tr('دراسات معلقة', 'Pending Studies')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-950/40 rounded-xl">
                <Activity className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{kpis.inProgress}</p>
                <p className="text-xs text-muted-foreground">{tr('قيد التنفيذ', 'In Progress')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-950/40 rounded-xl">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{kpis.reported}</p>
                <p className="text-xs text-muted-foreground">{tr('تم التقرير اليوم', 'Reported Today')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-950/40 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{kpis.critical}</p>
                <p className="text-xs text-muted-foreground">{tr('نتائج حرجة', 'Critical Findings')}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={tr('بحث بالاسم، رقم الملف...', 'Search by name, MRN...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={tr('الحالة', 'Status')} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'All'
                      ? tr('الكل', 'All')
                      : s === 'ORDERED'
                      ? tr('مطلوب', 'Ordered')
                      : s === 'IN_PROGRESS'
                      ? tr('قيد التنفيذ', 'In Progress')
                      : s === 'REPORTED'
                      ? tr('تم التقرير', 'Reported')
                      : tr('موثق', 'Verified')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modalityFilter} onValueChange={setModalityFilter}>
              <SelectTrigger>
                <SelectValue placeholder={tr('النوع', 'Modality')} />
              </SelectTrigger>
              <SelectContent>
                {MODALITY_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m === 'All' ? tr('الكل', 'All') : m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder={tr('الأولوية', 'Priority')} />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === 'All'
                      ? tr('الكل', 'All')
                      : p === 'STAT'
                      ? tr('طارئ', 'STAT')
                      : p === 'URGENT'
                      ? tr('عاجل', 'URGENT')
                      : tr('روتيني', 'ROUTINE')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Study List */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                  {tr('المريض', 'Patient')}
                </th>
                <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                  {tr('النوع', 'Modality')}
                </th>
                <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                  {tr('الفحص', 'Exam')}
                </th>
                <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                  {tr('الأولوية', 'Priority')}
                </th>
                <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                  {tr('مدة الانتظار', 'Wait Time')}
                </th>
                <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                  {tr('الطبيب', 'Radiologist')}
                </th>
                <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                  {tr('الحالة', 'Status')}
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                  {tr('إجراءات', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {tr('جاري التحميل...', 'Loading...')}
                  </td>
                </tr>
              ) : studies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {tr('لا توجد دراسات', 'No studies found')}
                  </td>
                </tr>
              ) : (
                studies.map((study) => (
                  <tr
                    key={study.id}
                    className={`hover:bg-muted/30 transition-colors ${priorityBorder(study.priority)}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground text-sm">{study.patientName}</div>
                      <div className="text-xs text-muted-foreground">{study.mrn || '---'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${MODALITY_COLORS[study.modality] || 'bg-muted text-muted-foreground'}`}>
                        {study.modality}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">
                        {language === 'ar' && study.examNameAr ? study.examNameAr : study.examName}
                      </div>
                      <div className="text-xs text-muted-foreground">{study.bodyPart || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${PRIORITY_COLORS[study.priority] || ''}`}>
                        {study.priority === 'STAT'
                          ? tr('طارئ', 'STAT')
                          : study.priority === 'URGENT'
                          ? tr('عاجل', 'URGENT')
                          : tr('روتيني', 'ROUTINE')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {timeSince(study.orderedAt, language)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {study.assignedRadiologist || tr('غير معين', 'Unassigned')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${STATUS_COLORS[study.status] || 'bg-muted text-muted-foreground'}`}>
                        {study.status === 'ORDERED'
                          ? tr('مطلوب', 'Ordered')
                          : study.status === 'SCHEDULED'
                          ? tr('مجدول', 'Scheduled')
                          : study.status === 'IN_PROGRESS'
                          ? tr('قيد التنفيذ', 'In Progress')
                          : study.status === 'REPORTED'
                          ? tr('تم التقرير', 'Reported')
                          : study.status === 'VERIFIED'
                          ? tr('موثق', 'Verified')
                          : study.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {(study.status === 'ORDERED' || study.status === 'SCHEDULED') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={claimingId === study.id}
                            onClick={() => handleClaim(study.id)}
                            className="gap-1 text-xs h-7"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            {claimingId === study.id
                              ? tr('جاري...', 'Claiming...')
                              : tr('استلام', 'Claim')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            window.location.href = `/radiology/reporting?orderId=${study.id}`;
                          }}
                          className="gap-1 text-xs h-7"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          {tr('التقرير', 'Report')}
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
    </div>
  );
}
