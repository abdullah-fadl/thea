'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Heart,
  Activity,
  AlertTriangle,
  Clock,
  Users,
  Stethoscope,
  Bed,
  RefreshCw,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

type Assignment = {
  id: string;
  nurseId: string;
  nurseName?: string;
  employeeId?: string;
  position?: string;
  isTeamLeader?: boolean;
  isChargeNurse?: boolean;
  totalWeeklyHours?: number;
  targetWeeklyHours?: number;
  overtimeHours?: number;
  undertimeHours?: number;
  assignments?: Record<string, any> | null;
  weekStartDate?: string;
  weekEndDate?: string;
};

type Metrics = {
  totalNursesOnDuty: number;
  patientNurseRatio: string;
  completedTasks: number;
  pendingTasks: number;
  criticalAlerts: number;
  avgResponseTime: string;
};

const SHIFT_OPTIONS = [
  { value: 'ALL', ar: 'كل الورديات', en: 'All Shifts' },
  { value: 'DAY', ar: 'النهار', en: 'Day' },
  { value: 'EVENING', ar: 'المساء', en: 'Evening' },
  { value: 'NIGHT', ar: 'الليل', en: 'Night' },
];

const DEPARTMENT_OPTIONS = [
  { value: 'all', ar: 'كل الأقسام', en: 'All Departments' },
  { value: 'opd', ar: 'العيادات الخارجية', en: 'OPD' },
  { value: 'er', ar: 'الطوارئ', en: 'ER' },
  { value: 'ipd', ar: 'الداخلي', en: 'IPD' },
  { value: 'icu', ar: 'العناية المركزة', en: 'ICU' },
  { value: 'or', ar: 'العمليات', en: 'OR' },
];

function todayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STATIONS = [
  { href: '/opd/nurse-station', icon: Stethoscope, ar: 'محطة العيادات', en: 'OPD Station' },
  { href: '/er/nurse-station', icon: AlertTriangle, ar: 'محطة الطوارئ', en: 'ER Station' },
  { href: '/ipd/nurse-station', icon: Bed, ar: 'محطة الداخلي', en: 'IPD Station' },
  { href: '/icu/nurse-station', icon: Activity, ar: 'محطة العناية', en: 'ICU Station' },
  { href: '/or/nurse-station', icon: Heart, ar: 'محطة العمليات', en: 'OR Station' },
];

const QUICK_LINKS = [
  { href: '/tasks', icon: ListChecks, ar: 'مهامي', en: 'My Tasks' },
  { href: '/handover', icon: CheckCircle2, ar: 'التسليمات', en: 'Handovers' },
  { href: '/handoff', icon: Users, ar: 'الاستلام', en: 'Handoff' },
];

export default function NursingOperations() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/nursing/operations');

  const [shift, setShift] = useState('ALL');
  const [department, setDepartment] = useState('all');
  const [date, setDate] = useState(todayDate());

  const apiUrl = useMemo(() => {
    if (!hasPermission) return null;
    const params = new URLSearchParams({ shift, department, date });
    return `/api/nursing/operations?${params.toString()}`;
  }, [hasPermission, shift, department, date]);

  const { data, mutate, isValidating } = useSWR(apiUrl, fetcher);
  const assignments: Assignment[] = Array.isArray(data?.assignments) ? data.assignments : [];
  const metrics: Metrics = data?.metrics || {
    totalNursesOnDuty: 0,
    patientNurseRatio: '0:0',
    completedTasks: 0,
    pendingTasks: 0,
    criticalAlerts: 0,
    avgResponseTime: '0 min',
  };

  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          {tr('الوصول مقيّد.', 'Access restricted.')}
        </Card>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="container mx-auto p-4 md:p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            {tr('عمليات التمريض', 'Nursing Operations')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr(
              'لوحة الورديات التمريضية: التكليفات، المهام، والتنقل لمحطات الأقسام.',
              'Nursing shift overview: assignments, tasks, and quick navigation to department stations.',
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
          <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
          <span className="ml-2">{tr('تحديث', 'Refresh')}</span>
        </Button>
      </div>

      <Card className="rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{tr('الوردية', 'Shift')}</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHIFT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{tr(s.ar, s.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('القسم', 'Department')}</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENT_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{tr(d.ar, d.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('التاريخ', 'Date')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile icon={Users} label={tr('الممرضات في الخدمة', 'On Duty')} value={metrics.totalNursesOnDuty} accent="text-emerald-700" />
        <MetricTile icon={Heart} label={tr('نسبة المرضى/الممرضات', 'Patient/Nurse')} value={metrics.patientNurseRatio} accent="text-sky-700" />
        <MetricTile icon={CheckCircle2} label={tr('المهام المنجزة', 'Completed')} value={metrics.completedTasks} accent="text-emerald-700" />
        <MetricTile icon={Clock} label={tr('قيد الانتظار', 'Pending')} value={metrics.pendingTasks} accent="text-amber-700" />
        <MetricTile icon={AlertTriangle} label={tr('تنبيهات حرجة', 'Critical Alerts')} value={metrics.criticalAlerts} accent="text-rose-700" />
        <MetricTile icon={Activity} label={tr('متوسط الاستجابة', 'Avg Response')} value={metrics.avgResponseTime} accent="text-slate-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="rounded-2xl p-4 lg:col-span-1">
          <div className="text-sm font-semibold mb-3">{tr('محطات التمريض', 'Nursing Stations')}</div>
          <div className="grid grid-cols-1 gap-2">
            {STATIONS.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className="rounded-xl border border-border px-4 py-3 thea-hover-lift flex items-center gap-3"
                >
                  <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium">{tr(s.ar, s.en)}</span>
                </Link>
              );
            })}
          </div>

          <div className="text-sm font-semibold mt-5 mb-3">{tr('روابط سريعة', 'Quick Links')}</div>
          <div className="grid grid-cols-1 gap-2">
            {QUICK_LINKS.map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="rounded-xl border border-border px-4 py-3 thea-hover-lift flex items-center gap-3"
                >
                  <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium">{tr(q.ar, q.en)}</span>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-2xl overflow-hidden lg:col-span-2">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold">
              {tr('تكليفات الوردية', 'Shift Assignments')}
              <span className="text-muted-foreground font-normal ms-2">({assignments.length})</span>
            </div>
          </div>
          {assignments.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {isValidating
                ? tr('جاري التحميل...', 'Loading...')
                : tr('لا توجد تكليفات للوردية والتاريخ المحدد.', 'No assignments for the selected shift and date.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="text-start px-4 py-3">{tr('الممرضة', 'Nurse')}</th>
                    <th className="text-start px-4 py-3">{tr('الوظيفة', 'Position')}</th>
                    <th className="text-start px-4 py-3">{tr('الدور', 'Role')}</th>
                    <th className="text-end px-4 py-3">{tr('ساعات', 'Hours')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const total = a.totalWeeklyHours ?? 0;
                    const target = a.targetWeeklyHours ?? 0;
                    const overtime = a.overtimeHours ?? 0;
                    return (
                      <tr key={a.id} className="border-t border-border thea-hover-lift">
                        <td className="px-4 py-3">
                          <div className="font-medium">{a.nurseName || a.nurseId}</div>
                          {a.employeeId && (
                            <div className="text-xs text-muted-foreground">{a.employeeId}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{a.position || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {a.isChargeNurse && (
                              <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-200">
                                {tr('مسؤول', 'Charge')}
                              </span>
                            )}
                            {a.isTeamLeader && (
                              <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2 py-0.5 bg-sky-100 text-sky-700 border border-sky-200">
                                {tr('قائد فريق', 'Team Lead')}
                              </span>
                            )}
                            {!a.isChargeNurse && !a.isTeamLeader && (
                              <span className="text-xs text-muted-foreground">{tr('عضو', 'Member')}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-end font-mono text-xs">
                          {total} / {target}
                          {overtime > 0 && (
                            <span className="ms-2 text-rose-700">+{overtime}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className={`text-2xl font-extrabold mt-1 ${accent}`}>{value}</div>
    </Card>
  );
}
