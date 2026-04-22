'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import {
  Clock, CheckCircle2, AlertCircle, XCircle, PauseCircle, Ban, Plus,
  Printer, QrCode, RefreshCw, ChevronDown, Search, Pill, Heart,
  Utensils, Stethoscope, TestTube, Syringe, Activity, ClipboardList,
  Droplets, FileText, ChevronRight, Sun, Moon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  TASK_CATEGORY_CONFIG,
  TASK_STATUS_CONFIG,
  MISSED_REASON_OPTIONS,
  type TaskCategory,
  type TaskStatus,
  type ShiftType,
} from '@/lib/clinical/carePath';
import { CarePathTaskExecutor } from './CarePathTaskExecutor';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

interface DailyCarePathViewProps {
  patientMasterId: string;
  department: string;
  encounterCoreId?: string;
  episodeId?: string;
  erEncounterId?: string;
  date?: string; // ISO date string
}

const CATEGORY_ICONS: Partial<Record<TaskCategory, React.ReactNode>> = {
  VITALS: <Heart className="w-4 h-4" />,
  MEDICATION: <Pill className="w-4 h-4" />,
  LAB: <TestTube className="w-4 h-4" />,
  RADIOLOGY: <Activity className="w-4 h-4" />,
  PROCEDURE: <Syringe className="w-4 h-4" />,
  DIET: <Utensils className="w-4 h-4" />,
  DOCTOR_VISIT: <Stethoscope className="w-4 h-4" />,
  NURSING_CARE: <ClipboardList className="w-4 h-4" />,
  IO: <Droplets className="w-4 h-4" />,
  INSTRUCTION: <FileText className="w-4 h-4" />,
};

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  PENDING: <Clock className="w-4 h-4 text-muted-foreground" />,
  IN_PROGRESS: <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />,
  DONE: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  MISSED: <XCircle className="w-4 h-4 text-red-500" />,
  HELD: <PauseCircle className="w-4 h-4 text-orange-500" />,
  REFUSED: <Ban className="w-4 h-4 text-red-600" />,
  CANCELLED: <XCircle className="w-4 h-4 text-muted-foreground" />,
};

export function DailyCarePathView({
  patientMasterId,
  department,
  encounterCoreId,
  episodeId,
  erEncounterId,
  date: propDate,
}: DailyCarePathViewProps) {
  const { language, isRTL } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();
  const [activeShift, setActiveShift] = useState<'ALL' | 'DAY' | 'NIGHT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [taskDialog, setTaskDialog] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const dateStr = propDate ?? new Date().toISOString().split('T')[0];
  const apiUrl = `/api/care-path?patientMasterId=${patientMasterId}&date=${dateStr}&department=${department}`;

  const { data, isLoading, mutate: refresh } = useSWR(apiUrl, fetcher, {
    refreshInterval: 30000,
  });

  const carePath = data?.paths?.[0];
  const tasks = carePath?.tasks ?? [];
  const shifts = carePath?.shifts ?? [];
  const alerts = carePath?.alerts ?? [];

  const generatePath = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/care-path/generate', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId,
          encounterCoreId,
          episodeId,
          erEncounterId,
          department,
          date: dateStr,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      toast({ title: tr('تم إنشاء المسار اليومي', 'Daily care path generated') });
      refresh();
    } catch {
      toast({ title: tr('خطأ في إنشاء المسار', 'Failed to generate path'), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [patientMasterId, encounterCoreId, episodeId, erEncounterId, department, dateStr, toast, tr, refresh]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (activeShift !== 'ALL') {
      const shiftId = shifts.find((s: any) => s.shiftType === activeShift)?.id;
      if (shiftId) result = result.filter((t: any) => t.shiftId === shiftId);
    }

    if (categoryFilter !== 'ALL') {
      result = result.filter((t: any) => t.category === categoryFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t: any) =>
        t.title?.toLowerCase().includes(q) ||
        t.titleAr?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [tasks, activeShift, shifts, categoryFilter, search]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t: any) => t.status === 'DONE').length;
    const missed = tasks.filter((t: any) => ['MISSED', 'REFUSED'].includes(t.status)).length;
    const pending = tasks.filter((t: any) => t.status === 'PENDING').length;
    const held = tasks.filter((t: any) => t.status === 'HELD').length;
    return { total, done, missed, pending, held, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/care-path/${carePath.id}/tasks/${taskId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) throw new Error('Failed');
      refresh();
      toast({ title: tr('تم التحديث', 'Updated successfully') });
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
    }
  }, [carePath?.id, refresh, toast, tr]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await fetch(`/api/care-path/${carePath.id}/alerts`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'ADDED_TO_PATH' }),
      });
      refresh();
    } catch { /* silent */ }
  }, [carePath?.id, refresh]);

  const signOffShift = useCallback(async (shiftId: string) => {
    try {
      const res = await fetch(`/api/care-path/${carePath.id}/shifts/${shiftId}/sign-off`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast({ title: tr('تم إنهاء الوردية', 'Shift signed off') });
      refresh();
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
    }
  }, [carePath?.id, refresh, toast, tr]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const isOverdue = (task: any) => {
    if (task.status !== 'PENDING') return false;
    return new Date(task.scheduledTime) < new Date();
  };

  // No path yet - show generate button
  if (!isLoading && !carePath) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <ClipboardList className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground text-lg">
          {tr('لا يوجد مسار رعاية لهذا اليوم', 'No care path for today')}
        </p>
        <button
          onClick={generatePath}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {tr('إنشاء المسار اليومي', 'Generate Daily Care Path')}
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const snapshot = (carePath.patientSnapshot ?? {}) as Record<string, string>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">
            {tr('مسار الرعاية اليومي', 'Daily Care Path')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {snapshot.fullName} — {snapshot.mrn ? `MRN: ${snapshot.mrn}` : ''}
            {snapshot.room ? ` | ${tr('غرفة', 'Room')} ${snapshot.room}` : ''}
            {snapshot.bed ? `-${snapshot.bed}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`/care-path/bedside/${carePath.bedsideToken}`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-muted/50"
            title={tr('شاشة المريض', 'Bedside View')}
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">{tr('شاشة المريض', 'Bedside')}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-muted/50"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{tr('طباعة', 'Print')}</span>
          </button>
          <button
            onClick={() => refresh()}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-muted/50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert: any) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                alert.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' :
                alert.severity === 'URGENT' ? 'bg-orange-50 border-orange-200' :
                'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${
                  alert.severity === 'CRITICAL' ? 'text-red-500' : 'text-orange-500'
                }`} />
                <div>
                  <p className="font-semibold text-sm">{isAr ? alert.titleAr || alert.title : alert.title}</p>
                  {alert.message && <p className="text-xs text-muted-foreground">{isAr ? alert.messageAr || alert.message : alert.message}</p>}
                </div>
              </div>
              <button
                onClick={() => acknowledgeAlert(alert.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-card border rounded-lg hover:bg-muted/50"
              >
                {tr('تأكيد', 'Confirm')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label={tr('الإجمالي', 'Total')} value={stats.total} color="bg-muted" />
        <StatCard label={tr('تم', 'Done')} value={stats.done} color="bg-green-100 text-green-700" />
        <StatCard label={tr('قيد الانتظار', 'Pending')} value={stats.pending} color="bg-blue-100 text-blue-700" />
        <StatCard label={tr('فائت', 'Missed')} value={stats.missed} color="bg-red-100 text-red-700" />
        <div className="flex items-center justify-center p-3 rounded-xl bg-black text-white">
          <span className="text-2xl font-bold">{stats.pct}%</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Shift filter */}
        <div className="flex bg-muted rounded-lg p-0.5">
          {(['ALL', 'DAY', 'NIGHT'] as const).map(s => (
            <button
              key={s}
              onClick={() => setActiveShift(s)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeShift === s ? 'bg-card shadow-sm' : 'hover:bg-muted'
              }`}
            >
              {s === 'ALL' ? tr('الكل', 'All')
                : s === 'DAY' ? tr('صباحي', 'Day')
                  : tr('مسائي', 'Night')}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('كل الفئات', 'All Categories')}</SelectItem>
            {Object.entries(TASK_CATEGORY_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.icon} {isAr ? cfg.labelAr : cfg.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tr('بحث...', 'Search...')}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Task timeline */}
      <div className="space-y-1">
        {filteredTasks.map((task: any, idx: number) => {
          const cat = TASK_CATEGORY_CONFIG[task.category as TaskCategory];
          const overdue = isOverdue(task);
          const nextTask = idx > 0 && filteredTasks[idx - 1]?.status === 'DONE' && task.status === 'PENDING';

          return (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm cursor-pointer ${
                task.status === 'DONE' ? 'bg-green-50/50 border-green-100' :
                overdue ? 'bg-red-50/50 border-red-200 animate-pulse' :
                nextTask ? 'bg-blue-50/50 border-blue-200 ring-2 ring-blue-300' :
                'bg-card border-border'
              }`}
              onClick={() => {
                if (task.status === 'PENDING' || task.status === 'IN_PROGRESS') {
                  setTaskDialog(task);
                }
              }}
            >
              {/* Time */}
              <div className="w-16 text-center shrink-0">
                <span className={`text-sm font-mono font-semibold ${overdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {formatTime(task.scheduledTime)}
                </span>
              </div>

              {/* Status icon */}
              <div className="shrink-0">
                {STATUS_ICONS[task.status as TaskStatus]}
              </div>

              {/* Category icon */}
              <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat?.color + '20' }}>
                <span style={{ color: cat?.color }}>
                  {CATEGORY_ICONS[task.category as TaskCategory] ?? <FileText className="w-4 h-4" />}
                </span>
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${task.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`}>
                  {isAr ? (task.titleAr || task.title) : task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {isAr ? (task.descriptionAr || task.description) : task.description}
                  </p>
                )}
              </div>

              {/* Priority badge */}
              {task.priority !== 'ROUTINE' && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  task.priority === 'STAT' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {task.priority}
                </span>
              )}

              {/* Completed by */}
              {task.status === 'DONE' && task.completedByName && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {task.completedByName}
                </span>
              )}

              {/* Action */}
              {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {tr('لا توجد مهام', 'No tasks')}
          </div>
        )}
      </div>

      {/* Shift Sign-off */}
      {shifts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {shifts.map((shift: any) => {
            const isSigned = shift.status === 'SIGNED' || shift.status === 'COMPLETED';
            return (
              <div key={shift.id} className={`p-4 rounded-xl border ${isSigned ? 'bg-green-50 border-green-200' : 'bg-muted/50 border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">
                    <span className="inline-flex items-center gap-1">
                      {shift.shiftType === 'DAY' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      {shift.shiftType === 'DAY'
                        ? tr('الوردية الصباحية', 'Day Shift')
                        : tr('الوردية المسائية', 'Night Shift')}
                    </span>
                  </span>
                  {isSigned && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </div>
                {shift.nurseName && (
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {shift.nurseName}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {tr('المهام', 'Tasks')}: {shift.completedTasks ?? 0}/{shift.totalTasks ?? 0}
                </p>
                {!isSigned && (
                  <button
                    onClick={() => signOffShift(shift.id)}
                    className="mt-2 w-full px-3 py-1.5 text-xs font-semibold bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {tr('إنهاء وتسليم الوردية', 'Sign Off & Handover')}
                  </button>
                )}
                {isSigned && shift.signedAt && (
                  <p className="text-xs text-green-600 mt-1">
                    {tr('تم التسليم', 'Signed at')} {new Date(shift.signedAt).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task Executor Dialog */}
      <CarePathTaskExecutor
        task={taskDialog}
        open={!!taskDialog}
        onClose={() => setTaskDialog(null)}
        onComplete={(taskId, status, extra) => {
          updateTaskStatus(taskId, status as TaskStatus, extra);
          setTaskDialog(null);
        }}
        isAr={isAr}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-xl ${color}`}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}
