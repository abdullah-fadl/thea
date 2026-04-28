'use client';

// =============================================================================
// OR Utilization Analytics — Full dashboard with KPIs, daily view, room
// comparison, trends, and case details.
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Activity,
  BarChart3,
  Clock,
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Timer,
  Zap,
  ListChecks,
  ArrowUpDown,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function utilizationColor(pct: number | null | undefined): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 75) return 'text-green-600 dark:text-green-400';
  if (pct >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function utilizationBg(pct: number | null | undefined): string {
  if (pct == null) return 'bg-muted';
  if (pct >= 75) return 'bg-green-50 dark:bg-green-900/20';
  if (pct >= 50) return 'bg-yellow-50 dark:bg-yellow-900/20';
  return 'bg-red-50 dark:bg-red-900/20';
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

type TabKey = 'daily' | 'rooms' | 'trends' | 'details';

interface TabDef {
  key: TabKey;
  ar: string;
  en: string;
}

const TABS: TabDef[] = [
  { key: 'daily',   ar: 'العرض اليومي',     en: 'Daily View' },
  { key: 'rooms',   ar: 'مقارنة الغرف',     en: 'Room Comparison' },
  { key: 'trends',  ar: 'الاتجاهات',        en: 'Trends' },
  { key: 'details', ar: 'تفاصيل الحالات',   en: 'Case Details' },
];

// =============================================================================
// Main Component
// =============================================================================

export default function OrUtilization() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  // Date range
  const [startDate, setStartDate] = useState(thirtyDaysAgo());
  const [endDate, setEndDate] = useState(today());
  const [roomFilter, setRoomFilter] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('daily');
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateDate, setGenerateDate] = useState(today());
  const [generateRoom, setGenerateRoom] = useState('');
  const [generating, setGenerating] = useState(false);

  // Fetch data with summary
  const queryParams = new URLSearchParams({
    summary: 'true',
    startDate,
    endDate,
    ...(roomFilter ? { roomName: roomFilter } : {}),
  });

  const { data, mutate, isLoading } = useSWR(`/api/or/utilization?${queryParams}`, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });

  const summaryData = data?.summary || null;
  const roomBreakdown: any[] = data?.roomBreakdown || [];
  const snapshots: any[] = data?.snapshots || [];

  // Get unique room names from snapshots
  const roomNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of snapshots) {
      if (s.roomName) names.add(s.roomName);
    }
    return Array.from(names).sort();
  }, [snapshots]);

  // Group snapshots by date for daily view
  const dailyGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const snap of snapshots) {
      const dateKey = snap.snapshotDate ? snap.snapshotDate.slice(0, 10) : 'unknown';
      const list = map.get(dateKey) || [];
      list.push(snap);
      map.set(dateKey, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, snaps]) => ({ date, snapshots: snaps }));
  }, [snapshots]);

  // Weekly trend data
  const weeklyTrends = useMemo(() => {
    const weekMap = new Map<string, { utilSum: number; count: number; cases: number }>();
    for (const snap of snapshots) {
      const d = new Date(snap.snapshotDate);
      // ISO week start (Monday)
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      const weekKey = monday.toISOString().slice(0, 10);
      const existing = weekMap.get(weekKey) || { utilSum: 0, count: 0, cases: 0 };
      existing.utilSum += snap.utilizationPct ?? 0;
      existing.count++;
      existing.cases += snap.casesCompleted ?? 0;
      weekMap.set(weekKey, existing);
    }
    return Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, data]) => ({
        weekStart,
        avgUtilization: Math.round((data.utilSum / data.count) * 10) / 10,
        totalCases: data.cases,
      }));
  }, [snapshots]);

  // Generate snapshot handler
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/or/utilization', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: generateDate, roomName: generateRoom || undefined }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ title: tr('خطأ', 'Error'), description: result.error || tr('حدث خطأ', 'An error occurred'), variant: 'destructive' });
      } else {
        const count = result.snapshots?.length || 0;
        toast({ title: tr('تم بنجاح', 'Success'), description: tr(`تم إنشاء ${count} لقطة`, `Generated ${count} snapshot(s)`) });
        setGenerateDialogOpen(false);
        mutate();
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل الاتصال', 'Connection failed'), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [generateDate, generateRoom, toast, tr, mutate]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            {tr('تحليلات استخدام غرف العمليات', 'OR Utilization Analytics')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('مراقبة أداء واستخدام غرف العمليات', 'Monitor OR performance and utilization metrics')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="ml-1">{tr('تحديث', 'Refresh')}</span>
          </Button>
          <Button size="sm" onClick={() => setGenerateDialogOpen(true)}>
            <Zap className="h-4 w-4" />
            <span className="ml-1">{tr('إنشاء لقطة', 'Generate Snapshot')}</span>
          </Button>
        </div>
      </div>

      {/* Date range & room filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{tr('من تاريخ', 'Start Date')}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{tr('إلى تاريخ', 'End Date')}</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{tr('الغرفة', 'Room')}</Label>
              <Select value={roomFilter} onValueChange={v => setRoomFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={tr('جميع الغرف', 'All Rooms')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{tr('جميع الغرف', 'All Rooms')}</SelectItem>
                  {roomNames.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          icon={<Activity className="h-5 w-5" />}
          label={tr('متوسط الاستخدام', 'Avg Utilization')}
          value={summaryData ? `${summaryData.avgUtilization}%` : '---'}
          valueClass={utilizationColor(summaryData?.avgUtilization)}
          bgClass={utilizationBg(summaryData?.avgUtilization)}
        />
        <KPICard
          icon={<ListChecks className="h-5 w-5" />}
          label={tr('إجمالي الحالات', 'Total Cases')}
          value={summaryData?.totalCasesCompleted ?? '---'}
          valueClass="text-blue-600 dark:text-blue-400"
          bgClass="bg-blue-50 dark:bg-blue-900/20"
        />
        <KPICard
          icon={<Timer className="h-5 w-5" />}
          label={tr('متوسط التبديل', 'Avg Turnover')}
          value={summaryData ? `${summaryData.avgTurnoverMinutes} ${tr('د', 'min')}` : '---'}
          valueClass="text-purple-600 dark:text-purple-400"
          bgClass="bg-purple-50 dark:bg-purple-900/20"
        />
        <KPICard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={tr('أول حالة بالموعد', 'First Case On-Time')}
          value={summaryData ? `${summaryData.firstCaseOnTimeRate}%` : '---'}
          valueClass="text-teal-600 dark:text-teal-400"
          bgClass="bg-teal-50 dark:bg-teal-900/20"
        />
        <KPICard
          icon={<XCircle className="h-5 w-5" />}
          label={tr('حالات ملغاة', 'Cancelled Cases')}
          value={summaryData?.totalCasesCancelled ?? '---'}
          valueClass="text-red-600 dark:text-red-400"
          bgClass="bg-red-50 dark:bg-red-900/20"
        />
        <KPICard
          icon={<Clock className="h-5 w-5" />}
          label={tr('وقت إضافي', 'Total Overtime')}
          value={summaryData ? `${Math.round((summaryData.totalOvertime || 0) / 60 * 10) / 10} ${tr('ساعة', 'hrs')}` : '---'}
          valueClass="text-amber-600 dark:text-amber-400"
          bgClass="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {tr(tab.ar, tab.en)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'daily' && (
        <DailyViewTab
          dailyGroups={dailyGroups}
          tr={tr}
          onSelectSnapshot={setSelectedSnapshot}
          setActiveTab={setActiveTab}
        />
      )}

      {activeTab === 'rooms' && (
        <RoomComparisonTab roomBreakdown={roomBreakdown} tr={tr} />
      )}

      {activeTab === 'trends' && (
        <TrendsTab
          weeklyTrends={weeklyTrends}
          roomBreakdown={roomBreakdown}
          summaryData={summaryData}
          tr={tr}
        />
      )}

      {activeTab === 'details' && (
        <CaseDetailsTab selectedSnapshot={selectedSnapshot} snapshots={snapshots} tr={tr} onSelectSnapshot={setSelectedSnapshot} />
      )}

      {/* Empty state */}
      {!isLoading && snapshots.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {tr('لا توجد بيانات استخدام لهذه الفترة. قم بإنشاء لقطة للبدء.', 'No utilization data for this period. Generate a snapshot to get started.')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Generate snapshot dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('إنشاء لقطة استخدام', 'Generate Utilization Snapshot')}</DialogTitle>
            <DialogDescription>
              {tr('حساب مقاييس الاستخدام من بيانات حالات العمليات لتاريخ محدد', 'Compute utilization metrics from OR case data for a specific date')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{tr('التاريخ', 'Date')}</Label>
              <Input type="date" value={generateDate} onChange={e => setGenerateDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr('الغرفة (اختياري - جميع الغرف إذا فارغ)', 'Room (optional - all rooms if empty)')}</Label>
              <Input value={generateRoom} onChange={e => setGenerateRoom(e.target.value)} placeholder={tr('مثال: غرفة العمليات 1', 'e.g. Theater 1')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !generateDate}>
              {generating ? tr('جاري الإنشاء...', 'Generating...') : tr('إنشاء', 'Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// KPI Card
// =============================================================================

function KPICard({
  icon,
  label,
  value,
  valueClass,
  bgClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueClass: string;
  bgClass: string;
}) {
  return (
    <Card className={bgClass}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium truncate">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Daily View Tab
// =============================================================================

function DailyViewTab({
  dailyGroups,
  tr,
  onSelectSnapshot,
  setActiveTab,
}: {
  dailyGroups: { date: string; snapshots: any[] }[];
  tr: (ar: string, en: string) => string;
  onSelectSnapshot: (snap: any) => void;
  setActiveTab: (tab: TabKey) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{tr('العرض اليومي', 'Daily View')}</CardTitle>
        <CardDescription>{tr('بيانات الاستخدام حسب اليوم والغرفة', 'Utilization data by day and room')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">{tr('التاريخ', 'Date')}</TableHead>
                <TableHead>{tr('الغرفة', 'Room')}</TableHead>
                <TableHead className="text-center">{tr('حالات', 'Cases')}</TableHead>
                <TableHead className="text-center">{tr('الاستخدام %', 'Utilization %')}</TableHead>
                <TableHead className="text-center">{tr('محجوز (د)', 'Booked (min)')}</TableHead>
                <TableHead className="text-center">{tr('فعلي (د)', 'Actual (min)')}</TableHead>
                <TableHead className="text-center">{tr('تبديل (د)', 'Turnover (min)')}</TableHead>
                <TableHead className="text-center">{tr('تأخير (د)', 'Delay (min)')}</TableHead>
                <TableHead className="text-center">{tr('إضافي (د)', 'Overtime (min)')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {tr('لا توجد بيانات', 'No data available')}
                  </TableCell>
                </TableRow>
              )}
              {dailyGroups.map(group =>
                group.snapshots.map((snap, idx) => (
                  <TableRow
                    key={snap.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      onSelectSnapshot(snap);
                      setActiveTab('details');
                    }}
                  >
                    <TableCell className="font-medium">{idx === 0 ? fmtDate(group.date) : ''}</TableCell>
                    <TableCell>{snap.roomName || '---'}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{snap.casesCompleted}</span>
                      <span className="text-muted-foreground text-xs">/{snap.casesScheduled}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${utilizationColor(snap.utilizationPct)}`}>
                        {snap.utilizationPct != null ? `${snap.utilizationPct}%` : '---'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{snap.bookedMinutes}</TableCell>
                    <TableCell className="text-center">{snap.actualMinutes}</TableCell>
                    <TableCell className="text-center">
                      {snap.avgTurnoverMinutes != null ? snap.avgTurnoverMinutes : '---'}
                    </TableCell>
                    <TableCell className="text-center">
                      {snap.delayMinutes > 0 ? (
                        <span className="text-amber-600">{snap.delayMinutes}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {snap.overtime > 0 ? (
                        <span className="text-red-600">{snap.overtime}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Room Comparison Tab
// =============================================================================

function RoomComparisonTab({
  roomBreakdown,
  tr,
}: {
  roomBreakdown: any[];
  tr: (ar: string, en: string) => string;
}) {
  const maxUtil = Math.max(...roomBreakdown.map(r => r.avgUtilization || 0), 1);

  return (
    <div className="space-y-6">
      {/* Bar chart visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('مقارنة استخدام الغرف', 'Room Utilization Comparison')}</CardTitle>
          <CardDescription>{tr('متوسط نسبة الاستخدام لكل غرفة', 'Average utilization percentage per room')}</CardDescription>
        </CardHeader>
        <CardContent>
          {roomBreakdown.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{tr('لا توجد بيانات', 'No data available')}</p>
          ) : (
            <div className="space-y-3">
              {roomBreakdown.map(room => (
                <div key={room.roomName} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-28 truncate">{room.roomName}</span>
                  <div className="flex-1 h-8 bg-muted rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        room.avgUtilization >= 75
                          ? 'bg-green-500'
                          : room.avgUtilization >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, (room.avgUtilization / maxUtil) * 100)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                      {room.avgUtilization}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room data table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('جدول مقارنة الغرف', 'Room Comparison Table')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('الغرفة', 'Room')}</TableHead>
                  <TableHead className="text-center">{tr('متوسط الاستخدام', 'Avg Utilization')}</TableHead>
                  <TableHead className="text-center">{tr('إجمالي الحالات', 'Total Cases')}</TableHead>
                  <TableHead className="text-center">{tr('متوسط التبديل', 'Avg Turnover')}</TableHead>
                  <TableHead className="text-center">{tr('نسبة بالموعد', 'On-Time Rate')}</TableHead>
                  <TableHead className="text-center">{tr('نسبة الإلغاء', 'Cancellation Rate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomBreakdown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {tr('لا توجد بيانات', 'No data available')}
                    </TableCell>
                  </TableRow>
                )}
                {roomBreakdown.map(room => (
                  <TableRow key={room.roomName}>
                    <TableCell className="font-medium">{room.roomName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={utilizationColor(room.avgUtilization)}>
                        {room.avgUtilization}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{room.totalCases}</TableCell>
                    <TableCell className="text-center">
                      {room.avgTurnover > 0 ? `${room.avgTurnover} ${tr('د', 'min')}` : '---'}
                    </TableCell>
                    <TableCell className="text-center">
                      {room.onTimeRate > 0 ? (
                        <span className={room.onTimeRate >= 80 ? 'text-green-600' : 'text-amber-600'}>
                          {room.onTimeRate}%
                        </span>
                      ) : '---'}
                    </TableCell>
                    <TableCell className="text-center">
                      {room.cancellationRate > 0 ? (
                        <span className={room.cancellationRate > 10 ? 'text-red-600' : 'text-muted-foreground'}>
                          {room.cancellationRate}%
                        </span>
                      ) : (
                        <span className="text-green-600">0%</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Trends Tab
// =============================================================================

function TrendsTab({
  weeklyTrends,
  roomBreakdown,
  summaryData,
  tr,
}: {
  weeklyTrends: { weekStart: string; avgUtilization: number; totalCases: number }[];
  roomBreakdown: any[];
  summaryData: any;
  tr: (ar: string, en: string) => string;
}) {
  // Top performing / underutilized rooms
  const sorted = [...roomBreakdown].sort((a, b) => b.avgUtilization - a.avgUtilization);
  const topRooms = sorted.slice(0, 3);
  const bottomRooms = sorted.length > 3 ? sorted.slice(-3).reverse() : [];

  return (
    <div className="space-y-6">
      {/* Weekly trend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {tr('الاتجاه الأسبوعي', 'Weekly Trend')}
          </CardTitle>
          <CardDescription>{tr('متوسط الاستخدام الأسبوعي عبر الفترة', 'Weekly average utilization across the period')}</CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyTrends.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{tr('لا توجد بيانات كافية', 'Not enough data')}</p>
          ) : (
            <div className="space-y-3">
              {/* Chart visualization using bars */}
              <div className="flex items-end gap-2 h-48 border-b pb-2">
                {weeklyTrends.map(week => {
                  const barHeight = Math.max(4, (week.avgUtilization / 100) * 100);
                  return (
                    <div key={week.weekStart} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-medium">{week.avgUtilization}%</span>
                      <div
                        className={`w-full max-w-[40px] rounded-t transition-all ${
                          week.avgUtilization >= 75
                            ? 'bg-green-500'
                            : week.avgUtilization >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {weeklyTrends.map(week => (
                  <div key={week.weekStart} className="flex-1 text-center">
                    <span className="text-[10px] text-muted-foreground">{fmtDate(week.weekStart)}</span>
                  </div>
                ))}
              </div>
              {/* Table view */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('بداية الأسبوع', 'Week Start')}</TableHead>
                    <TableHead className="text-center">{tr('متوسط الاستخدام', 'Avg Utilization')}</TableHead>
                    <TableHead className="text-center">{tr('حالات مكتملة', 'Cases Completed')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyTrends.map(week => (
                    <TableRow key={week.weekStart}>
                      <TableCell className="font-medium">{fmtDate(week.weekStart)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold ${utilizationColor(week.avgUtilization)}`}>{week.avgUtilization}%</span>
                      </TableCell>
                      <TableCell className="text-center">{week.totalCases}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room performance ranking */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top rooms */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {tr('أفضل الغرف أداءً', 'Top Performing Rooms')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRooms.length === 0 ? (
              <p className="text-muted-foreground text-sm">{tr('لا توجد بيانات', 'No data')}</p>
            ) : (
              <div className="space-y-3">
                {topRooms.map((room, idx) => (
                  <div key={room.roomName} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">#{idx + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{room.roomName}</p>
                      <p className="text-xs text-muted-foreground">
                        {room.totalCases} {tr('حالة', 'cases')}
                      </p>
                    </div>
                    <Badge className={`${utilizationBg(room.avgUtilization)} ${utilizationColor(room.avgUtilization)} border-0`}>
                      {room.avgUtilization}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Underutilized rooms */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {tr('غرف تحتاج تحسين', 'Underutilized Rooms')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bottomRooms.length === 0 ? (
              <p className="text-muted-foreground text-sm">{tr('لا توجد بيانات كافية', 'Not enough data')}</p>
            ) : (
              <div className="space-y-3">
                {bottomRooms.map(room => (
                  <div key={room.roomName} className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{room.roomName}</p>
                      <p className="text-xs text-muted-foreground">
                        {room.totalCases} {tr('حالة', 'cases')}
                      </p>
                    </div>
                    <Badge className={`${utilizationBg(room.avgUtilization)} ${utilizationColor(room.avgUtilization)} border-0`}>
                      {room.avgUtilization}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Period summary */}
      {summaryData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('ملخص الفترة', 'Period Summary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{tr('إجمالي اللقطات', 'Total Snapshots')}</p>
                <p className="text-lg font-bold">{summaryData.snapshotCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{tr('حالات مجدولة', 'Scheduled Cases')}</p>
                <p className="text-lg font-bold">{summaryData.totalCasesScheduled}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{tr('إجمالي التأخير', 'Total Delay')}</p>
                <p className="text-lg font-bold">{summaryData.totalDelayMinutes} {tr('دقيقة', 'min')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{tr('غرف مراقبة', 'Rooms Tracked')}</p>
                <p className="text-lg font-bold">{roomBreakdown.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// Case Details Tab
// =============================================================================

function CaseDetailsTab({
  selectedSnapshot,
  snapshots,
  tr,
  onSelectSnapshot,
}: {
  selectedSnapshot: any;
  snapshots: any[];
  tr: (ar: string, en: string) => string;
  onSelectSnapshot: (snap: any) => void;
}) {
  const details: any[] = selectedSnapshot?.details || [];

  return (
    <div className="space-y-4">
      {/* Snapshot selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{tr('اختر لقطة لعرض التفاصيل', 'Select a snapshot to view details')}</Label>
            <Select
              value={selectedSnapshot?.id || ''}
              onValueChange={id => {
                const snap = snapshots.find(s => s.id === id);
                if (snap) onSelectSnapshot(snap);
              }}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={tr('اختر لقطة', 'Select a snapshot')} />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {fmtDate(s.snapshotDate)} — {s.roomName} ({s.utilizationPct != null ? `${s.utilizationPct}%` : '---'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Snapshot summary */}
      {selectedSnapshot && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {fmtDate(selectedSnapshot.snapshotDate)} — {selectedSnapshot.roomName}
            </CardTitle>
            <CardDescription>
              {tr('استخدام', 'Utilization')}: <span className={`font-bold ${utilizationColor(selectedSnapshot.utilizationPct)}`}>{selectedSnapshot.utilizationPct}%</span>
              {' | '}
              {tr('حالات', 'Cases')}: {selectedSnapshot.casesCompleted}/{selectedSnapshot.casesScheduled}
              {' | '}
              {tr('تبديل', 'Turnover')}: {selectedSnapshot.avgTurnoverMinutes ?? '---'} {tr('د', 'min')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{tr('محجوز', 'Booked')}</p>
                <p className="font-bold">{selectedSnapshot.bookedMinutes} {tr('د', 'min')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{tr('فعلي', 'Actual')}</p>
                <p className="font-bold">{selectedSnapshot.actualMinutes} {tr('د', 'min')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{tr('أول حالة بالموعد', 'First Case On-Time')}</p>
                <p className="font-bold">
                  {selectedSnapshot.firstCaseOnTime == null ? '---' : selectedSnapshot.firstCaseOnTime ? (
                    <span className="text-green-600">{tr('نعم', 'Yes')}</span>
                  ) : (
                    <span className="text-red-600">{tr('لا', 'No')}</span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{tr('ملغاة', 'Cancelled')}</p>
                <p className="font-bold">{selectedSnapshot.casesCancelled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Case details table */}
      {details.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('تفاصيل الحالات', 'Case Details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('الإجراء', 'Procedure')}</TableHead>
                    <TableHead>{tr('الجراح', 'Surgeon')}</TableHead>
                    <TableHead className="text-center">{tr('الموعد المحدد', 'Scheduled')}</TableHead>
                    <TableHead className="text-center">{tr('البداية الفعلية', 'Actual Start')}</TableHead>
                    <TableHead className="text-center">{tr('النهاية الفعلية', 'Actual End')}</TableHead>
                    <TableHead className="text-center">{tr('المدة (د)', 'Duration (min)')}</TableHead>
                    <TableHead className="text-center">{tr('الحالة', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((detail: any, idx: number) => (
                    <TableRow key={detail.caseId || idx}>
                      <TableCell className="font-medium">{detail.procedure || '---'}</TableCell>
                      <TableCell>{detail.surgeon || '---'}</TableCell>
                      <TableCell className="text-center">{fmtTime(detail.scheduledStart)}</TableCell>
                      <TableCell className="text-center">{fmtTime(detail.actualStart)}</TableCell>
                      <TableCell className="text-center">{fmtTime(detail.actualEnd)}</TableCell>
                      <TableCell className="text-center font-medium">{detail.durationMin || '---'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={
                          detail.status === 'COMPLETED' ? 'text-green-600 border-green-200' :
                          detail.status === 'CANCELLED' ? 'text-red-600 border-red-200' :
                          detail.status === 'IN_PROGRESS' ? 'text-amber-600 border-amber-200' :
                          'text-blue-600 border-blue-200'
                        }>
                          {detail.status === 'COMPLETED' ? tr('مكتملة', 'Completed') :
                           detail.status === 'CANCELLED' ? tr('ملغاة', 'Cancelled') :
                           detail.status === 'IN_PROGRESS' ? tr('جارية', 'In Progress') :
                           tr('مجدولة', 'Scheduled')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!selectedSnapshot && (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {tr('اختر لقطة من العرض اليومي أو من القائمة أعلاه لعرض تفاصيل الحالات', 'Select a snapshot from the daily view or the list above to view case details')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
