'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const CYCLE_STATUS_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  IN_PROGRESS: { ar: 'جارٍ', en: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed', color: 'bg-green-100 text-green-700' },
  FAILED: { ar: 'فاشل', en: 'Failed', color: 'bg-red-100 text-red-700' },
  RECALLED: { ar: 'مسترجع', en: 'Recalled', color: 'bg-orange-100 text-orange-700' },
};

const METHODS = [
  { value: 'STEAM', ar: 'بخار الماء', en: 'Steam Autoclave' },
  { value: 'ETO', ar: 'إيثيلين أوكسايد', en: 'Ethylene Oxide' },
  { value: 'PLASMA', ar: 'بلازما', en: 'Plasma (H2O2)' },
  { value: 'CHEMICAL', ar: 'كيميائي', en: 'Chemical' },
];

const DISPATCH_STATUS_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  DISPATCHED: { ar: 'موزع', en: 'Dispatched', color: 'bg-blue-100 text-blue-700' },
  RECEIVED: { ar: 'مستلم', en: 'Received', color: 'bg-green-100 text-green-700' },
  RETURNED: { ar: 'مُعاد', en: 'Returned', color: 'bg-muted text-foreground' },
};

export default function CssdDashboard() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [activeTab, setActiveTab] = useState<'trays' | 'cycles' | 'dispatches'>('trays');
  const [deptFilter, setDeptFilter] = useState('');
  const [cycleStatusFilter, setCycleStatusFilter] = useState('');

  const { data: traysData, mutate: mutateTrays } = useSWR('/api/cssd/trays', fetcher, { refreshInterval: 30000 });
  const { data: cyclesData, mutate: mutateCycles } = useSWR(
    `/api/cssd/cycles${cycleStatusFilter ? `?status=${cycleStatusFilter}` : ''}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const trays: any[] = Array.isArray(traysData?.trays) ? traysData.trays : [];
  const cycles: any[] = Array.isArray(cyclesData?.cycles) ? cyclesData.cycles : [];

  // Collect all dispatches from cycles
  const allDispatches: any[] = cycles.flatMap((c: any) => (Array.isArray(c.dispatches) ? c.dispatches : []));

  const updateDispatchStatus = async (dispatchId: string, action: 'receive' | 'return') => {
    setBusy(true);
    try {
      await fetch(`/api/cssd/dispatches/${dispatchId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await mutateCycles();
    } finally {
      setBusy(false);
    }
  };

  // Modals
  const [showNewTray, setShowNewTray] = useState(false);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showDispatch, setShowDispatch] = useState<{ cycleId: string; trayName: string } | null>(null);
  const [showUpdateCycle, setShowUpdateCycle] = useState<{ id: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Tray form
  const [trayForm, setTrayForm] = useState({ trayName: '', trayCode: '', department: '', totalInstruments: '' });

  // Cycle form
  const [cycleForm, setCycleForm] = useState({
    trayId: '',
    loadNumber: '',
    machine: '',
    method: 'STEAM',
    temperature: '',
    pressure: '',
    duration: '',
    biologicalIndicator: '',
    chemicalIndicator: '',
  });

  // Dispatch form
  const [dispatchForm, setDispatchForm] = useState({ dispatchedTo: '', notes: '' });
  const [updateStatus, setUpdateStatus] = useState('COMPLETED');
  const [biologicalResult, setBiologicalResult] = useState('');

  const createTray = async () => {
    if (!trayForm.trayName.trim() || !trayForm.trayCode.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/cssd/trays', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...trayForm, totalInstruments: Number(trayForm.totalInstruments) || 0 }),
      });
      if (res.ok) {
        setShowNewTray(false);
        setTrayForm({ trayName: '', trayCode: '', department: '', totalInstruments: '' });
        await mutateTrays();
      }
    } finally {
      setBusy(false);
    }
  };

  const createCycle = async () => {
    if (!cycleForm.trayId || !cycleForm.loadNumber || !cycleForm.machine) return;
    setBusy(true);
    try {
      const res = await fetch('/api/cssd/cycles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cycleForm,
          temperature: cycleForm.temperature ? Number(cycleForm.temperature) : null,
          pressure: cycleForm.pressure ? Number(cycleForm.pressure) : null,
          duration: cycleForm.duration ? Number(cycleForm.duration) : null,
        }),
      });
      if (res.ok) {
        setShowNewCycle(false);
        setCycleForm({ trayId: '', loadNumber: '', machine: '', method: 'STEAM', temperature: '', pressure: '', duration: '', biologicalIndicator: '', chemicalIndicator: '' });
        await mutateCycles();
      }
    } finally {
      setBusy(false);
    }
  };

  const doDispatch = async () => {
    if (!showDispatch || !dispatchForm.dispatchedTo.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cssd/cycles/${showDispatch.cycleId}/dispatch`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchForm),
      });
      if (res.ok) {
        setShowDispatch(null);
        setDispatchForm({ dispatchedTo: '', notes: '' });
        await mutateCycles();
      }
    } finally {
      setBusy(false);
    }
  };

  const updateCycleStatus = async () => {
    if (!showUpdateCycle) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cssd/cycles/${showUpdateCycle.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: updateStatus, biologicalResult: biologicalResult || undefined }),
      });
      if (res.ok) {
        setShowUpdateCycle(null);
        setBiologicalResult('');
        await mutateCycles();
      }
    } finally {
      setBusy(false);
    }
  };

  const filteredTrays = deptFilter
    ? trays.filter((t) => t.department === deptFilter)
    : trays;

  const departments = Array.from(new Set(trays.map((t) => t.department).filter(Boolean)));

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {tr('التعقيم المركزي (CSSD)', 'CSSD / Central Sterilization')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('إدارة دورات التعقيم والأطباق والتوزيع', 'Manage sterilization cycles, trays and dispatch')}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'trays' && (
            <Button onClick={() => setShowNewTray(true)}>
              {tr('طبق جديد', 'New Tray')}
            </Button>
          )}
          {activeTab === 'cycles' && (
            <Button onClick={() => setShowNewCycle(true)}>
              {tr('بدء دورة', 'Start Cycle')}
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: tr('إجمالي الأطباق', 'Total Trays'), value: trays.length, color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: tr('دورات جارية', 'In Progress'), value: cycles.filter((c) => c.status === 'IN_PROGRESS').length, color: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: tr('دورات مكتملة', 'Completed'), value: cycles.filter((c) => c.status === 'COMPLETED').length, color: 'bg-green-50 border-green-200 text-green-800' },
          { label: tr('دورات فاشلة', 'Failed/Recalled'), value: cycles.filter((c) => c.status === 'FAILED' || c.status === 'RECALLED').length, color: 'bg-red-50 border-red-200 text-red-800' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-4 ${kpi.color}`}>
            <p className="text-xs font-medium opacity-70">{kpi.label}</p>
            <p className="text-3xl font-extrabold mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'trays', ar: 'الأطباق', en: 'Trays' },
          { key: 'cycles', ar: 'دورات التعقيم', en: 'Cycles' },
          { key: 'dispatches', ar: 'التوزيع', en: 'Dispatches' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tr(tab.ar, tab.en)}
          </button>
        ))}
      </div>

      {/* Trays Tab */}
      {activeTab === 'trays' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-4">
            <h2 className="font-bold text-sm flex-1">{tr('كتالوج الأطباق', 'Tray Catalog')}</h2>
            <Select value={deptFilter || '__all__'} onValueChange={(v) => setDeptFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder={tr('كل الأقسام', 'All Departments')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{tr('كل الأقسام', 'All Departments')}</SelectItem>
                {departments.map((d: string) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredTrays.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {tr('لا توجد أطباق', 'No trays found')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-start font-semibold">{tr('الطبق', 'Tray')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('الكود', 'Code')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('القسم', 'Department')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('عدد الأدوات', 'Instruments')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrays.map((t: any) => (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{t.trayName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{t.trayCode}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.department || '—'}</td>
                      <td className="px-4 py-3">{t.totalInstruments}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                          {t.active ? tr('فعال', 'Active') : tr('غير فعال', 'Inactive')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cycles Tab */}
      {activeTab === 'cycles' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-4">
            <h2 className="font-bold text-sm flex-1">{tr('دورات التعقيم', 'Sterilization Cycles')}</h2>
            <Select value={cycleStatusFilter || '__all__'} onValueChange={(v) => setCycleStatusFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder={tr('كل الحالات', 'All Statuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{tr('كل الحالات', 'All Statuses')}</SelectItem>
                {Object.entries(CYCLE_STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cycles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {tr('لا توجد دورات', 'No cycles found')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-start font-semibold">{tr('رقم الحمولة', 'Load #')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('الطبق', 'Tray')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('الجهاز', 'Machine')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('الطريقة', 'Method')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('البدء', 'Started')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('الحالة', 'Status')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c: any) => {
                    const statusCfg = CYCLE_STATUS_CONFIG[c.status] || { ar: c.status, en: c.status, color: 'bg-muted text-foreground' };
                    const methodCfg = METHODS.find((m) => m.value === c.method);
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{c.loadNumber}</td>
                        <td className="px-4 py-3">{c.tray?.trayName || '—'}</td>
                        <td className="px-4 py-3">{c.machine}</td>
                        <td className="px-4 py-3 text-xs">
                          {methodCfg ? tr(methodCfg.ar, methodCfg.en) : c.method}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(c.startTime).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                            {tr(statusCfg.ar, statusCfg.en)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {c.status === 'IN_PROGRESS' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowUpdateCycle({ id: c.id, status: c.status })}
                              >
                                {tr('تحديث', 'Update')}
                              </Button>
                            )}
                            {c.status === 'COMPLETED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowDispatch({ cycleId: c.id, trayName: c.tray?.trayName || '' })}
                              >
                                {tr('توزيع', 'Dispatch')}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dispatches Tab */}
      {activeTab === 'dispatches' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-bold text-sm">{tr('سجل التوزيع', 'Dispatch Log')}</h2>
          </div>
          {allDispatches.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {tr('لا توجد عمليات توزيع', 'No dispatches yet')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-start font-semibold">{tr('القسم المستلم', 'Dispatched To')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('تاريخ التوزيع', 'Dispatched At')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('الحالة', 'Status')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('ملاحظات', 'Notes')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allDispatches.map((d: any) => {
                    const statusCfg = DISPATCH_STATUS_CONFIG[d.status] || { ar: d.status, en: d.status, color: 'bg-muted text-foreground' };
                    return (
                      <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">{d.dispatchedTo}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(d.dispatchedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                            {tr(statusCfg.ar, statusCfg.en)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.notes || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {d.status === 'DISPATCHED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => updateDispatchStatus(d.id, 'receive')}
                              >
                                {tr('استلام', 'Receive')}
                              </Button>
                            )}
                            {(d.status === 'DISPATCHED' || d.status === 'RECEIVED') && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => updateDispatchStatus(d.id, 'return')}
                              >
                                {tr('إعادة', 'Return')}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* New Tray Dialog */}
      <Dialog open={showNewTray} onOpenChange={setShowNewTray}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('طبق جديد', 'New Tray')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('اسم الطبق', 'Tray Name')} *</Label>
                <Input value={trayForm.trayName} onChange={(e) => setTrayForm((f) => ({ ...f, trayName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('الكود', 'Tray Code')} *</Label>
                <Input value={trayForm.trayCode} onChange={(e) => setTrayForm((f) => ({ ...f, trayCode: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('القسم', 'Department')}</Label>
                <Input value={trayForm.department} onChange={(e) => setTrayForm((f) => ({ ...f, department: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('عدد الأدوات', 'Total Instruments')}</Label>
                <Input type="number" value={trayForm.totalInstruments} onChange={(e) => setTrayForm((f) => ({ ...f, totalInstruments: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNewTray(false)} disabled={busy}>{tr('إلغاء', 'Cancel')}</Button>
              <Button onClick={createTray} disabled={busy || !trayForm.trayName.trim() || !trayForm.trayCode.trim()}>
                {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Cycle Dialog */}
      <Dialog open={showNewCycle} onOpenChange={setShowNewCycle}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('بدء دورة تعقيم', 'Start Sterilization Cycle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{tr('الطبق', 'Tray')} *</Label>
              <Select value={cycleForm.trayId} onValueChange={(v) => setCycleForm((f) => ({ ...f, trayId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر طبقاً...', 'Select tray...')} />
                </SelectTrigger>
                <SelectContent>
                  {trays.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.trayName} ({t.trayCode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('رقم الحمولة', 'Load Number')} *</Label>
                <Input value={cycleForm.loadNumber} onChange={(e) => setCycleForm((f) => ({ ...f, loadNumber: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('الجهاز', 'Machine')} *</Label>
                <Input value={cycleForm.machine} onChange={(e) => setCycleForm((f) => ({ ...f, machine: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr('طريقة التعقيم', 'Sterilization Method')} *</Label>
              <Select value={cycleForm.method} onValueChange={(v) => setCycleForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{tr(m.ar, m.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>{tr('الحرارة °C', 'Temp °C')}</Label>
                <Input type="number" value={cycleForm.temperature} onChange={(e) => setCycleForm((f) => ({ ...f, temperature: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('الضغط (bar)', 'Pressure (bar)')}</Label>
                <Input type="number" value={cycleForm.pressure} onChange={(e) => setCycleForm((f) => ({ ...f, pressure: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('المدة (دقيقة)', 'Duration (min)')}</Label>
                <Input type="number" value={cycleForm.duration} onChange={(e) => setCycleForm((f) => ({ ...f, duration: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('مؤشر بيولوجي', 'Biological Indicator')}</Label>
                <Input value={cycleForm.biologicalIndicator} onChange={(e) => setCycleForm((f) => ({ ...f, biologicalIndicator: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('مؤشر كيميائي', 'Chemical Indicator')}</Label>
                <Input value={cycleForm.chemicalIndicator} onChange={(e) => setCycleForm((f) => ({ ...f, chemicalIndicator: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNewCycle(false)} disabled={busy}>{tr('إلغاء', 'Cancel')}</Button>
              <Button onClick={createCycle} disabled={busy || !cycleForm.trayId || !cycleForm.loadNumber.trim() || !cycleForm.machine.trim()}>
                {busy ? tr('جاري البدء...', 'Starting...') : tr('بدء', 'Start')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispatch Dialog */}
      <Dialog open={!!showDispatch} onOpenChange={(open) => !open && setShowDispatch(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('توزيع الطبق', 'Dispatch Tray')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{showDispatch?.trayName}</p>
            <div className="space-y-1">
              <Label>{tr('القسم المستلم', 'Dispatch To')} *</Label>
              <Input value={dispatchForm.dispatchedTo} onChange={(e) => setDispatchForm((f) => ({ ...f, dispatchedTo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{tr('ملاحظات', 'Notes')}</Label>
              <Textarea value={dispatchForm.notes} onChange={(e) => setDispatchForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDispatch(null)} disabled={busy}>{tr('إلغاء', 'Cancel')}</Button>
              <Button onClick={doDispatch} disabled={busy || !dispatchForm.dispatchedTo.trim()}>
                {busy ? tr('جاري التوزيع...', 'Dispatching...') : tr('توزيع', 'Dispatch')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Cycle Status Dialog */}
      <Dialog open={!!showUpdateCycle} onOpenChange={(open) => !open && setShowUpdateCycle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('تحديث حالة الدورة', 'Update Cycle Status')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{tr('الحالة الجديدة', 'New Status')}</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CYCLE_STATUS_CONFIG).filter(([k]) => k !== 'IN_PROGRESS').map(([k, v]) => (
                    <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('نتيجة المؤشر البيولوجي', 'Biological Indicator Result')}</Label>
              <Input value={biologicalResult} onChange={(e) => setBiologicalResult(e.target.value)} placeholder={tr('سالب / موجب', 'Negative / Positive')} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowUpdateCycle(null)} disabled={busy}>{tr('إلغاء', 'Cancel')}</Button>
              <Button onClick={updateCycleStatus} disabled={busy}>
                {busy ? tr('جاري التحديث...', 'Updating...') : tr('تحديث', 'Update')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
