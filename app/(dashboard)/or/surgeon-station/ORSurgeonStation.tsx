'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import {
  Scissors, Search, RefreshCw, CheckCircle2, Clock,
  Activity, FileText, ClipboardList, Settings, AlertCircle,
  User, Layers,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TheaKpiCard } from '@/components/thea-ui';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ── Status badge styling ── */
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-muted text-foreground',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

/* ── Note status badge styling ── */
const NOTE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  SIGNED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  PENDING: 'bg-muted text-muted-foreground',
};

/* ── OR step phases ── */
const OR_PHASES = ['START', 'PRE_OP', 'TIME_OUT', 'INTRA_OP', 'POST_OP', 'RECOVERY'] as const;

interface CaseRow {
  id: string;
  procedureName?: string;
  patientMasterId?: string;
  patientName?: string;
  mrn?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  roomName?: string;
  roomNumber?: string;
  status?: string;
  urgency?: string;
  priority?: string;
  currentStep?: string;
  surgeonUserId?: string;
  surgeonName?: string;
  operativeNoteStatus?: string;
  postOpOrderStatus?: string;
  team?: { role?: string; userId?: string; userName?: string }[];
}

interface OperativeNoteForm {
  findings: string;
  technique: string;
  complications: string;
  disposition: string;
}

export default function ORSurgeonStation() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/or/surgeon-station');

  /* ── Data ── */
  const { data, mutate, isLoading } = useSWR('/api/or/cases/today', fetcher, { refreshInterval: 15000 });
  const allCases: CaseRow[] = data?.items || [];

  /* ── Filter to current surgeon's cases ── */
  const { data: meData } = useSWR('/api/auth/me', fetcher);
  const currentUserId = meData?.user?.id || meData?.userId || '';

  const myCases = useMemo(() => {
    if (!currentUserId) return allCases;
    return allCases.filter((c) => {
      if (c.surgeonUserId === currentUserId) return true;
      if (c.team?.some((t) => t.role === 'SURGEON' && t.userId === currentUserId)) return true;
      return false;
    });
  }, [allCases, currentUserId]);

  /* ── KPI calculations ── */
  const kpis = useMemo(() => {
    const total = myCases.length;
    const completed = myCases.filter((c) => c.status === 'COMPLETED').length;
    const inProgress = myCases.filter((c) => c.status === 'IN_PROGRESS').length;
    const pendingNotes = myCases.filter((c) => c.operativeNoteStatus !== 'SIGNED').length;
    return { total, completed, inProgress, pendingNotes };
  }, [myCases]);

  /* ── Local state ── */
  const [activeTab, setActiveTab] = useState('my-cases');
  const [search, setSearch] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<OperativeNoteForm>({
    findings: '',
    technique: '',
    complications: '',
    disposition: '',
  });
  const [noteSaving, setNoteSaving] = useState(false);
  const [postOpDialogOpen, setPostOpDialogOpen] = useState(false);
  const [postOpCaseId, setPostOpCaseId] = useState<string | null>(null);

  /* ── Search filter ── */
  const filtered = useMemo(() => {
    if (!search.trim()) return myCases;
    const q = search.toLowerCase();
    return myCases.filter(
      (c) =>
        (c.procedureName || '').toLowerCase().includes(q) ||
        (c.patientName || '').toLowerCase().includes(q) ||
        (c.mrn || '').toLowerCase().includes(q) ||
        (c.roomName || c.roomNumber || '').toLowerCase().includes(q),
    );
  }, [myCases, search]);

  /* ── Phase progress helper ── */
  const getPhaseIndex = (step?: string) => {
    const idx = (OR_PHASES as readonly string[]).indexOf(step ?? '');
    return idx >= 0 ? idx : 0;
  };

  /* ── Operative note helpers ── */
  const openNoteDialog = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setNoteForm({ findings: '', technique: '', complications: '', disposition: '' });
    setNoteDialogOpen(true);
  }, []);

  const { data: noteData, mutate: mutateNote } = useSWR(
    selectedCaseId && noteDialogOpen ? `/api/or/cases/${selectedCaseId}/operative-note` : null,
    fetcher,
  );

  // Pre-fill form when note data loads
  useMemo(() => {
    if (noteData?.note) {
      setNoteForm({
        findings: noteData.note.findings || '',
        technique: noteData.note.technique || '',
        complications: noteData.note.complications || '',
        disposition: noteData.note.disposition || '',
      });
    }
  }, [noteData]);

  const saveOperativeNote = async (sign: boolean) => {
    if (!selectedCaseId) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${selectedCaseId}/operative-note`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...noteForm,
          status: sign ? 'SIGNED' : 'DRAFT',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Failed to save'));
      toast({
        title: sign ? tr('تم التوقيع', 'Signed') : tr('تم الحفظ كمسودة', 'Saved as Draft'),
        description: tr('تم حفظ التقرير الجراحي', 'Operative note saved successfully'),
      });
      await mutateNote();
      await mutate();
      if (sign) setNoteDialogOpen(false);
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشل الحفظ', 'Failed to save'),
        variant: 'destructive' as const,
      });
    } finally {
      setNoteSaving(false);
    }
  };

  /* ── Post-op orders dialog ── */
  const openPostOpDialog = useCallback((caseId: string) => {
    setPostOpCaseId(caseId);
    setPostOpDialogOpen(true);
  }, []);

  const { data: postOpData } = useSWR(
    postOpCaseId && postOpDialogOpen ? `/api/or/cases/${postOpCaseId}/post-op-orders` : null,
    fetcher,
  );
  const postOpOrders: any[] = postOpData?.orders || [];

  /* ── Note status label ── */
  const noteStatusLabel = (status?: string) => {
    if (status === 'SIGNED') return tr('موقّع', 'Signed');
    if (status === 'DRAFT') return tr('مسودة', 'Draft');
    return tr('معلّق', 'Pending');
  };

  const noteStatusKey = (status?: string) => {
    if (status === 'SIGNED') return 'SIGNED';
    if (status === 'DRAFT') return 'DRAFT';
    return 'PENDING';
  };

  /* ── Case status label ── */
  const caseStatusLabel = (status?: string) => {
    if (status === 'IN_PROGRESS') return tr('جارية', 'In Progress');
    if (status === 'COMPLETED') return tr('مكتملة', 'Completed');
    if (status === 'CANCELLED') return tr('ملغاة', 'Cancelled');
    return tr('مفتوحة', 'Open');
  };

  /* ── Permission gate ── */
  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        {tr('ليس لديك صلاحية الوصول', 'You do not have permission to access this page')}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 bg-background min-h-screen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Scissors className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {tr('محطة الجراح', 'Surgeon Station')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {tr('لوحة تحكم الجراح - حالات اليوم والتوثيق', 'Surgeon dashboard - today\'s cases & documentation')}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => mutate()}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {tr('تحديث', 'Refresh')}
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TheaKpiCard
          label={tr('حالاتي اليوم', 'My Cases Today')}
          value={kpis.total}
          icon={<Layers className="h-4 w-4 text-indigo-500" />}
        />
        <TheaKpiCard
          label={tr('مكتملة', 'Completed')}
          value={kpis.completed}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        />
        <TheaKpiCard
          label={tr('قيد التنفيذ', 'In Progress')}
          value={kpis.inProgress}
          icon={<Activity className="h-4 w-4 text-blue-500" />}
        />
        <TheaKpiCard
          label={tr('تقارير معلّقة', 'Pending Notes')}
          value={kpis.pendingNotes}
          icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="my-cases" className="text-xs gap-1 py-2">
            <Scissors className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tr('حالاتي', 'My Cases')}</span>
          </TabsTrigger>
          <TabsTrigger value="operative-notes" className="text-xs gap-1 py-2">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tr('التقارير الجراحية', 'Operative Notes')}</span>
          </TabsTrigger>
          <TabsTrigger value="post-op-orders" className="text-xs gap-1 py-2">
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tr('أوامر ما بعد العملية', 'Post-Op Orders')}</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs gap-1 py-2">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tr('التفضيلات', 'Preferences')}</span>
          </TabsTrigger>
        </TabsList>

        {/* ───────────────────────────────────────────────────────
            Tab 1: My Cases
        ─────────────────────────────────────────────────────── */}
        <TabsContent value="my-cases" className="mt-4 space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tr('بحث بالمريض / الإجراء / الغرفة...', 'Search by patient / procedure / room...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Cases grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Scissors className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? tr('جاري التحميل...', 'Loading...')
                  : tr('لا توجد حالات عمليات اليوم', 'No OR cases found for today')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((c) => {
                const phaseIdx = getPhaseIndex(c.currentStep);
                const phasePct = ((phaseIdx + 1) / OR_PHASES.length) * 100;
                return (
                  <div
                    key={c.id}
                    className="border rounded-xl p-4 space-y-3 transition-all hover:shadow-md hover:border-primary/40 bg-card border-border"
                  >
                    {/* Top row: procedure + badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-foreground">
                          {c.procedureName || tr('إجراء غير محدد', 'Unnamed Procedure')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {c.patientName || tr('مريض', 'Patient')} {c.mrn ? `(${c.mrn})` : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`text-[10px] ${STATUS_COLORS[c.status || ''] || STATUS_COLORS.OPEN}`}>
                          {caseStatusLabel(c.status)}
                        </Badge>
                        {c.currentStep && (
                          <Badge variant="outline" className="text-[10px]">
                            {c.currentStep}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {(c.roomName || c.roomNumber) && (
                        <span className="flex items-center gap-1">
                          <Scissors className="h-3 w-3" /> {tr('غرفة', 'Room')} {c.roomName || c.roomNumber}
                        </span>
                      )}
                      {c.scheduledStartTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(c.scheduledStartTime).toLocaleTimeString(
                            language === 'ar' ? 'ar-SA' : 'en-US',
                            { hour: '2-digit', minute: '2-digit' },
                          )}
                        </span>
                      )}
                    </div>

                    {/* Phase progress bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{c.currentStep || 'START'}</span>
                        <span>{Math.round(phasePct)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            c.status === 'COMPLETED' ? 'bg-green-500' : 'bg-primary'
                          }`}
                          style={{ width: `${phasePct}%` }}
                        />
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => openNoteDialog(c.id)}
                      >
                        <FileText className="h-3 w-3" />
                        {tr('التقرير الجراحي', 'Op Note')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => openPostOpDialog(c.id)}
                      >
                        <ClipboardList className="h-3 w-3" />
                        {tr('أوامر ما بعد', 'Post-Op')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ───────────────────────────────────────────────────────
            Tab 2: Operative Notes
        ─────────────────────────────────────────────────────── */}
        <TabsContent value="operative-notes" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {tr('انقر على حالة لكتابة أو عرض التقرير الجراحي', 'Click a case to write or view the operative note')}
          </p>

          {myCases.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? tr('جاري التحميل...', 'Loading...')
                  : tr('لا توجد حالات', 'No cases found')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {myCases.map((c) => {
                const nKey = noteStatusKey(c.operativeNoteStatus);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openNoteDialog(c.id)}
                    className="w-full text-left border rounded-xl p-3 flex items-center justify-between gap-3 transition-all hover:shadow-sm hover:border-primary/40 bg-card border-border"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.procedureName || tr('إجراء غير محدد', 'Unnamed Procedure')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.patientName || tr('مريض', 'Patient')} {c.mrn ? `(${c.mrn})` : ''}
                          {(c.roomName || c.roomNumber) ? ` - ${tr('غرفة', 'Room')} ${c.roomName || c.roomNumber}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-[10px] ${NOTE_STATUS_COLORS[nKey]}`}>
                        {noteStatusLabel(c.operativeNoteStatus)}
                      </Badge>
                      <Badge className={`text-[10px] ${STATUS_COLORS[c.status || ''] || STATUS_COLORS.OPEN}`}>
                        {caseStatusLabel(c.status)}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ───────────────────────────────────────────────────────
            Tab 3: Post-Op Orders
        ─────────────────────────────────────────────────────── */}
        <TabsContent value="post-op-orders" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {tr('انقر على حالة لإدارة أوامر ما بعد العملية', 'Click a case to manage post-op orders')}
          </p>

          {myCases.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? tr('جاري التحميل...', 'Loading...')
                  : tr('لا توجد حالات', 'No cases found')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {myCases.map((c) => {
                const orderStatus = c.postOpOrderStatus || 'NONE';
                const orderBadgeColor =
                  orderStatus === 'ACTIVE'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : orderStatus === 'DRAFT'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : 'bg-muted text-muted-foreground';
                const orderLabel =
                  orderStatus === 'ACTIVE'
                    ? tr('نشط', 'Active')
                    : orderStatus === 'DRAFT'
                      ? tr('مسودة', 'Draft')
                      : tr('لا يوجد', 'None');

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openPostOpDialog(c.id)}
                    className="w-full text-left border rounded-xl p-3 flex items-center justify-between gap-3 transition-all hover:shadow-sm hover:border-primary/40 bg-card border-border"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                        <ClipboardList className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.procedureName || tr('إجراء غير محدد', 'Unnamed Procedure')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.patientName || tr('مريض', 'Patient')} {c.mrn ? `(${c.mrn})` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-[10px] ${orderBadgeColor}`}>
                        {orderLabel}
                      </Badge>
                      <Badge className={`text-[10px] ${STATUS_COLORS[c.status || ''] || STATUS_COLORS.OPEN}`}>
                        {caseStatusLabel(c.status)}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ───────────────────────────────────────────────────────
            Tab 4: Preferences (Placeholder)
        ─────────────────────────────────────────────────────── */}
        <TabsContent value="preferences" className="mt-4">
          <div className="text-center py-20 space-y-3">
            <Settings className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">
              {tr('تفضيلات الجراح', 'Surgeon Preferences')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {tr(
                'ستتوفر قريبًا قوالب التفضيلات الجراحية المخصصة، بما في ذلك إعدادات الأدوات والإجراءات المفضلة وبروتوكولات ما بعد العملية.',
                'Custom surgeon preference templates are coming soon, including preferred instrument setups, procedure preferences, and post-op protocols.',
              )}
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Operative Note Dialog ── */}
      <Dialog open={noteDialogOpen} onOpenChange={(open) => { if (!open) setNoteDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              {tr('التقرير الجراحي', 'Operative Note')}
            </DialogTitle>
            {selectedCaseId && (
              <p className="text-xs text-muted-foreground mt-1">
                {tr('معرف الحالة', 'Case ID')}: {selectedCaseId.slice(0, 8)}...
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Current note status */}
            {noteData?.note?.status && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{tr('الحالة الحالية', 'Current Status')}:</span>
                <Badge className={`text-[10px] ${NOTE_STATUS_COLORS[noteStatusKey(noteData.note.status)]}`}>
                  {noteStatusLabel(noteData.note.status)}
                </Badge>
              </div>
            )}

            {/* Findings */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">{tr('النتائج / الموجودات', 'Findings')}</Label>
              <Textarea
                value={noteForm.findings}
                onChange={(e) => setNoteForm((f) => ({ ...f, findings: e.target.value }))}
                placeholder={tr('وصف النتائج الجراحية...', 'Describe surgical findings...')}
                className="thea-input-focus min-h-[80px]"
              />
            </div>

            {/* Technique */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">{tr('التقنية / الإجراء', 'Technique')}</Label>
              <Textarea
                value={noteForm.technique}
                onChange={(e) => setNoteForm((f) => ({ ...f, technique: e.target.value }))}
                placeholder={tr('وصف التقنية الجراحية المستخدمة...', 'Describe the surgical technique used...')}
                className="thea-input-focus min-h-[80px]"
              />
            </div>

            {/* Complications */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">{tr('المضاعفات', 'Complications')}</Label>
              <Textarea
                value={noteForm.complications}
                onChange={(e) => setNoteForm((f) => ({ ...f, complications: e.target.value }))}
                placeholder={tr('أي مضاعفات أو لا يوجد...', 'Any complications or none...')}
                className="thea-input-focus min-h-[60px]"
              />
            </div>

            {/* Disposition */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">{tr('وجهة المريض', 'Disposition')}</Label>
              <Select
                value={noteForm.disposition}
                onValueChange={(v) => setNoteForm((f) => ({ ...f, disposition: v }))}
              >
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر الوجهة', 'Select disposition')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WARD">{tr('الجناح', 'Ward')}</SelectItem>
                  <SelectItem value="ICU">{tr('العناية المركزة', 'ICU')}</SelectItem>
                  <SelectItem value="PACU">{tr('وحدة الإفاقة', 'PACU')}</SelectItem>
                  <SelectItem value="DISCHARGE">{tr('خروج', 'Discharge')}</SelectItem>
                  <SelectItem value="OBSERVATION">{tr('ملاحظة', 'Observation')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => saveOperativeNote(false)}
                disabled={noteSaving}
                className="gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                {noteSaving
                  ? tr('جاري الحفظ...', 'Saving...')
                  : tr('حفظ كمسودة', 'Save as Draft')}
              </Button>
              <Button
                onClick={() => saveOperativeNote(true)}
                disabled={noteSaving}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {noteSaving
                  ? tr('جاري التوقيع...', 'Signing...')
                  : tr('توقيع وإغلاق', 'Sign & Close')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Post-Op Orders Dialog ── */}
      <Dialog open={postOpDialogOpen} onOpenChange={(open) => { if (!open) setPostOpDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-amber-500" />
              {tr('أوامر ما بعد العملية', 'Post-Op Orders')}
            </DialogTitle>
            {postOpCaseId && (
              <p className="text-xs text-muted-foreground mt-1">
                {tr('معرف الحالة', 'Case ID')}: {postOpCaseId.slice(0, 8)}...
              </p>
            )}
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {postOpOrders.length === 0 ? (
              <div className="text-center py-10">
                <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {tr('لا توجد أوامر ما بعد العملية بعد', 'No post-op orders yet')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tr(
                    'يمكنك إنشاء أوامر ما بعد العملية من صفحة الحالة',
                    'You can create post-op orders from the case page',
                  )}
                </p>
                {postOpCaseId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5 text-xs"
                    onClick={() => {
                      window.location.href = `/or/cases/${postOpCaseId}`;
                    }}
                  >
                    <Scissors className="h-3 w-3" />
                    {tr('فتح الحالة', 'Open Case')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {postOpOrders.map((order: any, idx: number) => (
                  <div
                    key={order.id || idx}
                    className="border rounded-lg p-3 bg-card border-border"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {order.orderName || order.description || tr('أمر', 'Order')} #{idx + 1}
                        </p>
                        {order.details && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {order.details}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={`text-[10px] ${
                          order.status === 'ACTIVE' || order.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : order.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {order.status === 'ACTIVE'
                          ? tr('نشط', 'Active')
                          : order.status === 'COMPLETED'
                            ? tr('مكتمل', 'Completed')
                            : order.status === 'PENDING'
                              ? tr('معلّق', 'Pending')
                              : tr('غير معروف', 'Unknown')}
                      </Badge>
                    </div>
                  </div>
                ))}

                {postOpCaseId && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        window.location.href = `/or/cases/${postOpCaseId}`;
                      }}
                    >
                      <Scissors className="h-3 w-3" />
                      {tr('فتح الحالة لإدارة الأوامر', 'Open Case to Manage Orders')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
