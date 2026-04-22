'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ─── Constants ─────────────────────────────────────────────────────────── */

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const SEVERITY_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  CRITICAL: { ar: 'حرج', en: 'Critical', color: 'bg-red-100 text-red-700 border-red-300' },
  HIGH: { ar: 'عالي', en: 'High', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  MEDIUM: { ar: 'متوسط', en: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  LOW: { ar: 'منخفض', en: 'Low', color: 'bg-green-100 text-green-700 border-green-300' },
};

const STATUS_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  OPEN: { ar: 'مفتوح', en: 'Open', color: 'bg-red-100 text-red-700' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', en: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  ITEMS_RETRIEVED: { ar: 'تم استرجاع العناصر', en: 'Items Retrieved', color: 'bg-purple-100 text-purple-700' },
  INVESTIGATION: { ar: 'تحقيق', en: 'Investigation', color: 'bg-amber-100 text-amber-700' },
  CLOSED: { ar: 'مغلق', en: 'Closed', color: 'bg-muted text-foreground' },
};

const RECALL_REASONS: { value: string; ar: string; en: string }[] = [
  { value: 'BI_FAILURE', ar: 'فشل المؤشر البيولوجي', en: 'Biological Indicator Failure' },
  { value: 'CI_FAILURE', ar: 'فشل المؤشر الكيميائي', en: 'Chemical Indicator Failure' },
  { value: 'EQUIPMENT_MALFUNCTION', ar: 'عطل في المعدات', en: 'Equipment Malfunction' },
  { value: 'PACKAGING_BREACH', ar: 'خلل في التغليف', en: 'Packaging Breach' },
  { value: 'EXPIRY', ar: 'انتهاء الصلاحية', en: 'Expiry' },
  { value: 'OTHER', ar: 'أخرى', en: 'Other' },
];

const RECALL_TYPES: { value: string; ar: string; en: string }[] = [
  { value: 'MANDATORY', ar: 'إلزامي', en: 'Mandatory' },
  { value: 'PRECAUTIONARY', ar: 'احترازي', en: 'Precautionary' },
];

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function CssdRecalls() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  /* ── Filters ─────────────────────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  /* ── Data ─────────────────────────────────────────────────────────────── */
  const queryParams = [
    statusFilter ? `status=${statusFilter}` : '',
    severityFilter ? `severity=${severityFilter}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data: recallsData, mutate: mutateRecalls } = useSWR(
    `/api/cssd/recalls${queryParams ? `?${queryParams}` : ''}`,
    fetcher,
    { refreshInterval: 15000 }
  );
  const recalls: any[] = Array.isArray(recallsData?.recalls) ? recallsData.recalls : [];

  /* ── Cycles for the create dialog ────────────────────────────────────── */
  const { data: cyclesData } = useSWR('/api/cssd/cycles', fetcher);
  const allCycles: any[] = Array.isArray(cyclesData?.cycles) ? cyclesData.cycles : [];

  /* ── Trays ───────────────────────────────────────────────────────────── */
  const { data: traysData } = useSWR('/api/cssd/trays', fetcher);
  const allTrays: any[] = Array.isArray(traysData?.trays) ? traysData.trays : [];

  /* ── Modals & state ──────────────────────────────────────────────────── */
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [manageRecall, setManageRecall] = useState<any | null>(null);
  const [manageTab, setManageTab] = useState<'details' | 'notifications' | 'investigation' | 'resolution'>('details');

  /* ── Create form ─────────────────────────────────────────────────────── */
  const [createForm, setCreateForm] = useState({
    cycleId: '',
    trayId: '',
    recallReason: 'BI_FAILURE',
    recallType: 'MANDATORY',
    severity: 'HIGH',
    notes: '',
  });

  /* ── Investigation form ──────────────────────────────────────────────── */
  const [investigationForm, setInvestigationForm] = useState({
    rootCause: '',
    correctiveAction: '',
    preventiveAction: '',
    investigationNotes: '',
  });

  /* ── Notification form ───────────────────────────────────────────────── */
  const [notificationForm, setNotificationForm] = useState({
    userId: '',
    role: 'staff',
    method: 'system',
  });

  /* ── Close form ──────────────────────────────────────────────────────── */
  const [closeNotes, setCloseNotes] = useState('');

  /* ── KPIs ─────────────────────────────────────────────────────────────── */
  const kpiTotalRecalls = recalls.length;
  const kpiOpenRecalls = recalls.filter((r) => r.status === 'OPEN' || r.status === 'IN_PROGRESS').length;

  const kpiAvgResolution = useMemo(() => {
    const closed = recalls.filter((r) => r.status === 'CLOSED' && r.closedAt && r.initiatedAt);
    if (closed.length === 0) return 0;
    const totalHours = closed.reduce((sum: number, r: any) => {
      const diff = new Date(r.closedAt).getTime() - new Date(r.initiatedAt).getTime();
      return sum + diff / (1000 * 60 * 60);
    }, 0);
    return Math.round(totalHours / closed.length);
  }, [recalls]);

  const kpiMostCommonReason = useMemo(() => {
    if (recalls.length === 0) return '-';
    const counts: Record<string, number> = {};
    recalls.forEach((r) => {
      counts[r.recallReason] = (counts[r.recallReason] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return '-';
    const reason = RECALL_REASONS.find((rr) => rr.value === top[0]);
    return reason ? tr(reason.ar, reason.en) : top[0];
  }, [recalls, language]);

  /* ── Auto-fill tray when cycle changes ───────────────────────────────── */
  const selectedCycle = allCycles.find((c) => c.id === createForm.cycleId);
  const selectedCycleDispatches = selectedCycle
    ? (() => {
        try {
          return Array.isArray(selectedCycle.dispatches) ? selectedCycle.dispatches : [];
        } catch {
          return [];
        }
      })()
    : [];

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  const trayName = (trayId: string) => {
    const tray = allTrays.find((t) => t.id === trayId);
    return tray ? (tray.trayName || tray.trayCode || trayId) : trayId;
  };

  const reasonLabel = (value: string) => {
    const r = RECALL_REASONS.find((rr) => rr.value === value);
    return r ? tr(r.ar, r.en) : value;
  };

  const typeLabel = (value: string) => {
    const t = RECALL_TYPES.find((tt) => tt.value === value);
    return t ? tr(t.ar, t.en) : value;
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const handleCreate = async () => {
    if (!createForm.cycleId || !createForm.recallReason || !createForm.severity) return;
    setBusy(true);
    try {
      const trayId = createForm.trayId || selectedCycle?.trayId || '';
      const res = await fetch('/api/cssd/recalls', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, trayId }),
      });
      if (res.ok) {
        setShowCreate(false);
        setCreateForm({ cycleId: '', trayId: '', recallReason: 'BI_FAILURE', recallType: 'MANDATORY', severity: 'HIGH', notes: '' });
        await mutateRecalls();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (recallId: string, newStatus: string) => {
    setBusy(true);
    try {
      const payload: any = { id: recallId, status: newStatus };
      if (newStatus === 'CLOSED') {
        payload.closedNotes = closeNotes;
      }
      await fetch('/api/cssd/recalls', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await mutateRecalls();
      if (manageRecall?.id === recallId) {
        const updated = { ...manageRecall, status: newStatus };
        setManageRecall(updated);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveInvestigation = async () => {
    if (!manageRecall) return;
    setBusy(true);
    try {
      await fetch('/api/cssd/recalls', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: manageRecall.id, ...investigationForm }),
      });
      await mutateRecalls();
    } finally {
      setBusy(false);
    }
  };

  const handleSendNotification = async () => {
    if (!manageRecall || !notificationForm.userId) return;
    setBusy(true);
    try {
      await fetch('/api/cssd/recalls', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: manageRecall.id, notification: notificationForm }),
      });
      await mutateRecalls();
      setNotificationForm({ userId: '', role: 'staff', method: 'system' });
    } finally {
      setBusy(false);
    }
  };

  const openManage = (recall: any) => {
    setManageRecall(recall);
    setManageTab('details');
    setInvestigationForm({
      rootCause: recall.rootCause || '',
      correctiveAction: recall.correctiveAction || '',
      preventiveAction: recall.preventiveAction || '',
      investigationNotes: recall.investigationNotes || '',
    });
    setCloseNotes('');
  };

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tr('استدعاء التعقيم', 'CSSD Recalls')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('إدارة عمليات استدعاء الأدوات والحزم المعقمة', 'Manage sterilization recall operations for trays and packs')}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0">
          {tr('+ استدعاء جديد', '+ New Recall')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">{tr('إجمالي الاستدعاءات', 'Total Recalls')}</p>
          <p className="text-2xl font-bold mt-1">{kpiTotalRecalls}</p>
        </div>
        <div className="border rounded-lg p-4 border-red-200 bg-red-50">
          <p className="text-xs text-red-600 uppercase">{tr('مفتوح / قيد التنفيذ', 'Open / In Progress')}</p>
          <p className="text-2xl font-bold mt-1 text-red-700">{kpiOpenRecalls}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">{tr('متوسط وقت الحل (ساعة)', 'Avg Resolution (hrs)')}</p>
          <p className="text-2xl font-bold mt-1">{kpiAvgResolution || '-'}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">{tr('أكثر سبب شيوعاً', 'Most Common Reason')}</p>
          <p className="text-lg font-semibold mt-1 truncate">{kpiMostCommonReason}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={tr('حالة الاستدعاء', 'Recall Status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{tr(cfg.ar, cfg.en)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={tr('الشدة', 'Severity')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
            {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{tr(cfg.ar, cfg.en)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter || severityFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('');
              setSeverityFilter('');
            }}
          >
            {tr('مسح الفلاتر', 'Clear Filters')}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('الحزمة', 'Tray')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('السبب', 'Reason')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('النوع', 'Type')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('الشدة', 'Severity')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recalls.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {tr('لا توجد استدعاءات', 'No recalls found')}
                  </td>
                </tr>
              )}
              {recalls.map((recall: any) => {
                const sevCfg = SEVERITY_CONFIG[recall.severity] || SEVERITY_CONFIG.MEDIUM;
                const stCfg = STATUS_CONFIG[recall.status] || STATUS_CONFIG.OPEN;
                return (
                  <tr key={recall.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(recall.initiatedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{trayName(recall.trayId)}</td>
                    <td className="px-4 py-3">{reasonLabel(recall.recallReason)}</td>
                    <td className="px-4 py-3">{typeLabel(recall.recallType)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sevCfg.color}`}>
                        {tr(sevCfg.ar, sevCfg.en)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stCfg.color}`}>
                        {tr(stCfg.ar, stCfg.en)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" onClick={() => openManage(recall)}>
                        {tr('إدارة', 'Manage')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
       * CREATE RECALL DIALOG
       * ────────────────────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('استدعاء جديد', 'New Recall')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Cycle */}
            <div>
              <Label>{tr('الدورة', 'Cycle')}</Label>
              <Select
                value={createForm.cycleId}
                onValueChange={(v) => {
                  const cycle = allCycles.find((c) => c.id === v);
                  setCreateForm((f) => ({
                    ...f,
                    cycleId: v,
                    trayId: cycle?.trayId || '',
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر الدورة', 'Select Cycle')} />
                </SelectTrigger>
                <SelectContent>
                  {allCycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cycleNumber || c.loadNumber} &mdash; {c.machine} ({c.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tray (auto-filled) */}
            {createForm.trayId && (
              <div>
                <Label>{tr('الحزمة', 'Tray')}</Label>
                <Input value={trayName(createForm.trayId)} readOnly className="bg-muted/50" />
              </div>
            )}

            {/* Recall reason */}
            <div>
              <Label>{tr('سبب الاستدعاء', 'Recall Reason')}</Label>
              <Select value={createForm.recallReason} onValueChange={(v) => setCreateForm((f) => ({ ...f, recallReason: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECALL_REASONS.map((rr) => (
                    <SelectItem key={rr.value} value={rr.value}>{tr(rr.ar, rr.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recall type */}
            <div>
              <Label>{tr('نوع الاستدعاء', 'Recall Type')}</Label>
              <Select value={createForm.recallType} onValueChange={(v) => setCreateForm((f) => ({ ...f, recallType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECALL_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>{tr(rt.ar, rt.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Severity */}
            <div>
              <Label>{tr('الشدة', 'Severity')}</Label>
              <Select value={createForm.severity} onValueChange={(v) => setCreateForm((f) => ({ ...f, severity: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{tr(cfg.ar, cfg.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Affected dispatches preview */}
            {selectedCycleDispatches.length > 0 && (
              <div>
                <Label>{tr('التوزيعات المتأثرة', 'Affected Dispatches')}</Label>
                <div className="border rounded p-2 bg-muted/30 mt-1 space-y-1 max-h-32 overflow-y-auto text-xs">
                  {selectedCycleDispatches.map((d: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{d.dispatchedTo || tr('غير محدد', 'Unknown')}</span>
                      <span className="text-muted-foreground">{d.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label>{tr('ملاحظات', 'Notes')}</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
                rows={3}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={busy}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={busy || !createForm.cycleId}>
                {busy ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء الاستدعاء', 'Create Recall')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────
       * MANAGE RECALL DIALOG
       * ────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!manageRecall} onOpenChange={(open) => !open && setManageRecall(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {tr('إدارة الاستدعاء', 'Manage Recall')}
              {manageRecall && (
                <span className={`ms-3 inline-block px-2 py-0.5 rounded-full text-xs ${(STATUS_CONFIG[manageRecall.status] || STATUS_CONFIG.OPEN).color}`}>
                  {tr((STATUS_CONFIG[manageRecall.status] || STATUS_CONFIG.OPEN).ar, (STATUS_CONFIG[manageRecall.status] || STATUS_CONFIG.OPEN).en)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {manageRecall && (
            <div className="mt-2">
              {/* Tabs */}
              <div className="flex gap-1 border-b mb-4">
                {(['details', 'notifications', 'investigation', 'resolution'] as const).map((tab) => {
                  const tabLabels: Record<string, { ar: string; en: string }> = {
                    details: { ar: 'التفاصيل', en: 'Details' },
                    notifications: { ar: 'الإشعارات', en: 'Notifications' },
                    investigation: { ar: 'التحقيق', en: 'Investigation' },
                    resolution: { ar: 'الإغلاق', en: 'Resolution' },
                  };
                  const lbl = tabLabels[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => setManageTab(tab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        manageTab === tab
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tr(lbl.ar, lbl.en)}
                    </button>
                  );
                })}
              </div>

              {/* ── Tab 1: Details ──────────────────────────────────────── */}
              {manageTab === 'details' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('تاريخ البدء', 'Initiated At')}</p>
                      <p className="font-medium">{fmtDate(manageRecall.initiatedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('الحزمة', 'Tray')}</p>
                      <p className="font-medium">{trayName(manageRecall.trayId)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('السبب', 'Reason')}</p>
                      <p className="font-medium">{reasonLabel(manageRecall.recallReason)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('النوع', 'Type')}</p>
                      <p className="font-medium">{typeLabel(manageRecall.recallType)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('الشدة', 'Severity')}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${(SEVERITY_CONFIG[manageRecall.severity] || SEVERITY_CONFIG.MEDIUM).color}`}>
                        {tr((SEVERITY_CONFIG[manageRecall.severity] || SEVERITY_CONFIG.MEDIUM).ar, (SEVERITY_CONFIG[manageRecall.severity] || SEVERITY_CONFIG.MEDIUM).en)}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('بدأ بواسطة', 'Initiated By')}</p>
                      <p className="font-medium text-xs">{manageRecall.initiatedBy || '-'}</p>
                    </div>
                  </div>

                  {/* Affected loads */}
                  {Array.isArray(manageRecall.affectedLoads) && manageRecall.affectedLoads.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">{tr('الحمولات المتأثرة', 'Affected Loads')}</p>
                      <div className="border rounded overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-start">{tr('رقم الحمولة', 'Load #')}</th>
                              <th className="px-3 py-2 text-start">{tr('الجهاز', 'Machine')}</th>
                              <th className="px-3 py-2 text-start">{tr('التاريخ', 'Date')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(manageRecall.affectedLoads ?? []).map((load: { loadNumber?: string; machine?: string; date?: string }, i: number) => (
                              <tr key={i}>
                                <td className="px-3 py-2">{load.loadNumber || '-'}</td>
                                <td className="px-3 py-2">{load.machine || '-'}</td>
                                <td className="px-3 py-2">{load.date ? fmtDate(load.date) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Affected dispatches */}
                  {Array.isArray(manageRecall.affectedDispatches) && manageRecall.affectedDispatches.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">{tr('التوزيعات المتأثرة', 'Affected Dispatches')}</p>
                      <div className="border rounded overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-start">{tr('القسم', 'Department')}</th>
                              <th className="px-3 py-2 text-start">{tr('الحالة', 'Status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(manageRecall.affectedDispatches ?? []).map((d: { department?: string; status?: string }, i: number) => (
                              <tr key={i}>
                                <td className="px-3 py-2">{d.department || '-'}</td>
                                <td className="px-3 py-2">{d.status || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Status transition */}
                  {manageRecall.status !== 'CLOSED' && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <p className="text-sm font-medium w-full">{tr('تغيير الحالة', 'Change Status')}</p>
                      {manageRecall.status === 'OPEN' && (
                        <Button size="sm" onClick={() => handleStatusChange(manageRecall.id, 'IN_PROGRESS')} disabled={busy}>
                          {tr('بدء التنفيذ', 'Start Processing')}
                        </Button>
                      )}
                      {manageRecall.status === 'IN_PROGRESS' && (
                        <Button size="sm" onClick={() => handleStatusChange(manageRecall.id, 'ITEMS_RETRIEVED')} disabled={busy}>
                          {tr('تم الاسترجاع', 'Items Retrieved')}
                        </Button>
                      )}
                      {(manageRecall.status === 'ITEMS_RETRIEVED' || manageRecall.status === 'IN_PROGRESS') && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(manageRecall.id, 'INVESTIGATION')} disabled={busy}>
                          {tr('بدء التحقيق', 'Begin Investigation')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab 2: Notifications ───────────────────────────────── */}
              {manageTab === 'notifications' && (
                <div className="space-y-4">
                  <p className="text-sm font-medium">{tr('سجل الإشعارات', 'Notification Log')}</p>

                  {Array.isArray(manageRecall.notifications) && manageRecall.notifications.length > 0 ? (
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-start">{tr('المستخدم', 'User')}</th>
                            <th className="px-3 py-2 text-start">{tr('الدور', 'Role')}</th>
                            <th className="px-3 py-2 text-start">{tr('الطريقة', 'Method')}</th>
                            <th className="px-3 py-2 text-start">{tr('التاريخ', 'Date')}</th>
                            <th className="px-3 py-2 text-start">{tr('مُعترف به', 'Ack')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(manageRecall.notifications ?? []).map((n: { userId?: string; role?: string; method?: string; notifiedAt?: string; acknowledged?: boolean }, i: number) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{n.userId || '-'}</td>
                              <td className="px-3 py-2">{n.role || '-'}</td>
                              <td className="px-3 py-2">{n.method || '-'}</td>
                              <td className="px-3 py-2">{n.notifiedAt ? fmtDate(n.notifiedAt) : '-'}</td>
                              <td className="px-3 py-2">{n.acknowledged ? tr('نعم', 'Yes') : tr('لا', 'No')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">{tr('لم يتم إرسال إشعارات بعد', 'No notifications sent yet')}</p>
                  )}

                  {/* Send new notification */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium">{tr('إرسال إشعار جديد', 'Send New Notification')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label>{tr('معرف المستخدم', 'User ID')}</Label>
                        <Input
                          value={notificationForm.userId}
                          onChange={(e) => setNotificationForm((f) => ({ ...f, userId: e.target.value }))}
                          placeholder={tr('أدخل معرف المستخدم', 'Enter user ID')}
                        />
                      </div>
                      <div>
                        <Label>{tr('الدور', 'Role')}</Label>
                        <Select value={notificationForm.role} onValueChange={(v) => setNotificationForm((f) => ({ ...f, role: v }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff">{tr('موظف', 'Staff')}</SelectItem>
                            <SelectItem value="nurse">{tr('ممرض/ة', 'Nurse')}</SelectItem>
                            <SelectItem value="surgeon">{tr('جراح', 'Surgeon')}</SelectItem>
                            <SelectItem value="admin">{tr('مدير', 'Admin')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{tr('الطريقة', 'Method')}</Label>
                        <Select value={notificationForm.method} onValueChange={(v) => setNotificationForm((f) => ({ ...f, method: v }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">{tr('نظام', 'System')}</SelectItem>
                            <SelectItem value="sms">{tr('رسالة نصية', 'SMS')}</SelectItem>
                            <SelectItem value="email">{tr('بريد إلكتروني', 'Email')}</SelectItem>
                            <SelectItem value="phone">{tr('هاتف', 'Phone')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleSendNotification} disabled={busy || !notificationForm.userId}>
                        {tr('إرسال', 'Send')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab 3: Investigation ───────────────────────────────── */}
              {manageTab === 'investigation' && (
                <div className="space-y-4">
                  <div>
                    <Label>{tr('السبب الجذري', 'Root Cause')}</Label>
                    <Textarea
                      value={investigationForm.rootCause}
                      onChange={(e) => setInvestigationForm((f) => ({ ...f, rootCause: e.target.value }))}
                      placeholder={tr('حدد السبب الجذري للمشكلة...', 'Identify the root cause of the issue...')}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{tr('الإجراء التصحيحي', 'Corrective Action')}</Label>
                    <Textarea
                      value={investigationForm.correctiveAction}
                      onChange={(e) => setInvestigationForm((f) => ({ ...f, correctiveAction: e.target.value }))}
                      placeholder={tr('ما الإجراء المتخذ لإصلاح المشكلة الحالية...', 'What was done to fix the current issue...')}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{tr('الإجراء الوقائي', 'Preventive Action')}</Label>
                    <Textarea
                      value={investigationForm.preventiveAction}
                      onChange={(e) => setInvestigationForm((f) => ({ ...f, preventiveAction: e.target.value }))}
                      placeholder={tr('ما الخطوات لمنع التكرار...', 'Steps to prevent recurrence...')}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{tr('ملاحظات التحقيق', 'Investigation Notes')}</Label>
                    <Textarea
                      value={investigationForm.investigationNotes}
                      onChange={(e) => setInvestigationForm((f) => ({ ...f, investigationNotes: e.target.value }))}
                      placeholder={tr('ملاحظات إضافية عن التحقيق...', 'Additional investigation notes...')}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button onClick={handleSaveInvestigation} disabled={busy}>
                      {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التحقيق', 'Save Investigation')}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Tab 4: Resolution ──────────────────────────────────── */}
              {manageTab === 'resolution' && (
                <div className="space-y-4">
                  {manageRecall.status === 'CLOSED' ? (
                    <div className="space-y-3">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-green-800">{tr('تم إغلاق هذا الاستدعاء', 'This recall has been closed')}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">{tr('أغلق بواسطة', 'Closed By')}</p>
                            <p className="font-medium">{manageRecall.closedBy || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{tr('تاريخ الإغلاق', 'Closed At')}</p>
                            <p className="font-medium">{fmtDate(manageRecall.closedAt)}</p>
                          </div>
                        </div>
                        {manageRecall.closedNotes && (
                          <div className="mt-2">
                            <p className="text-muted-foreground text-xs">{tr('ملاحظات الإغلاق', 'Close Notes')}</p>
                            <p className="text-sm mt-1">{manageRecall.closedNotes}</p>
                          </div>
                        )}
                      </div>

                      {/* Summary of investigation */}
                      {(manageRecall.rootCause || manageRecall.correctiveAction || manageRecall.preventiveAction) && (
                        <div className="border rounded-lg p-4 space-y-2">
                          <p className="text-sm font-medium">{tr('ملخص التحقيق', 'Investigation Summary')}</p>
                          {manageRecall.rootCause && (
                            <div>
                              <p className="text-xs text-muted-foreground">{tr('السبب الجذري', 'Root Cause')}</p>
                              <p className="text-sm">{manageRecall.rootCause}</p>
                            </div>
                          )}
                          {manageRecall.correctiveAction && (
                            <div>
                              <p className="text-xs text-muted-foreground">{tr('الإجراء التصحيحي', 'Corrective Action')}</p>
                              <p className="text-sm">{manageRecall.correctiveAction}</p>
                            </div>
                          )}
                          {manageRecall.preventiveAction && (
                            <div>
                              <p className="text-xs text-muted-foreground">{tr('الإجراء الوقائي', 'Preventive Action')}</p>
                              <p className="text-sm">{manageRecall.preventiveAction}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-amber-800">
                          {tr('إغلاق الاستدعاء سينهي هذه العملية نهائياً', 'Closing this recall will finalize the process permanently')}
                        </p>
                      </div>

                      <div>
                        <Label>{tr('ملاحظات الإغلاق', 'Close Notes')}</Label>
                        <Textarea
                          value={closeNotes}
                          onChange={(e) => setCloseNotes(e.target.value)}
                          placeholder={tr('أدخل ملاحظات الإغلاق...', 'Enter close notes...')}
                          rows={4}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => handleStatusChange(manageRecall.id, 'CLOSED')}
                          disabled={busy}
                        >
                          {busy ? tr('جاري الإغلاق...', 'Closing...') : tr('إغلاق الاستدعاء', 'Close Recall')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
