'use client';
// =============================================================================
// OPD Analytics Extended — Wait Times, Throughput, Doctor Productivity
// Supplements the existing /api/opd/analytics route with 3 new sub-routes
// =============================================================================
import { useLang } from '@/hooks/use-lang';
import useSWR from 'swr';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, TrendingUp, Users, Activity } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

interface BarProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  color?: string;
}

function Bar({ value, max, label, sublabel, color = 'bg-primary' }: BarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-full flex items-end h-20 bg-muted/30 rounded-t">
        <div className={`w-full ${color} rounded-t transition-all`} style={{ height: `${pct}%` }} />
      </div>
      <span className="text-xs text-center text-muted-foreground leading-tight">{label}</span>
      {sublabel !== undefined && (
        <span className="text-xs font-bold text-foreground">{sublabel}</span>
      )}
    </div>
  );
}

export function OPDAnalyticsExtended() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [period, setPeriod] = useState('30');

  const { data: waitData } = useSWR(
    `/api/opd/analytics/wait-times?days=${period}`,
    fetcher,
  );
  const { data: prodData } = useSWR(
    `/api/opd/analytics/doctor-productivity?days=${period}`,
    fetcher,
  );
  const { data: throughData } = useSWR(
    `/api/opd/analytics/throughput?days=${period}`,
    fetcher,
  );

  const byDow: { day: number; total: number; completed: number }[] =
    throughData?.byDayOfWeek ?? [];
  const maxDow = Math.max(...byDow.map((d) => d.total), 1);

  const byHour: { hour: number; total: number }[] = throughData?.byHour ?? [];
  const maxHour = Math.max(...byHour.map((h) => h.total), 1);
  const peakHours = byHour
    .filter((h) => h.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((h) => h.hour);

  const waitDist: Record<string, number> = waitData?.distribution ?? {};
  const maxWaitBucket = Math.max(...Object.values(waitDist), 1);

  const doctors: {
    doctorId: string;
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    completionRate: number;
    noShowRate: number;
  }[] = prodData?.doctors ?? [];

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header + Period Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          {tr('تحليلات متقدمة للعيادات الخارجية', 'Advanced OPD Analytics')}
        </h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{tr('آخر 7 أيام', 'Last 7 Days')}</SelectItem>
            <SelectItem value="30">{tr('آخر 30 يومًا', 'Last 30 Days')}</SelectItem>
            <SelectItem value="90">{tr('آخر 90 يومًا', 'Last 90 Days')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {tr('متوسط وقت الانتظار', 'Avg Wait Time')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {waitData?.avgWaitMinutes ?? '—'}
              <span className="text-base font-normal text-muted-foreground">
                {' '}
                {tr('د', 'min')}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              P90: {waitData?.p90WaitMinutes ?? '—'} {tr('د', 'min')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {tr('إجمالي الحجوزات', 'Total Bookings')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{throughData?.totalBookings ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tr('خلال', 'over')} {period} {tr('يومًا', 'days')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {tr('أعلى الأطباء إنتاجية', 'Top Doctor')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-bold truncate">
              {doctors[0]?.doctorId
                ? `...${doctors[0].doctorId.slice(-6)}`
                : tr('—', '—')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {doctors[0]?.total ?? 0} {tr('حجز', 'bookings')} ·{' '}
              {doctors[0]?.completionRate ?? 0}% {tr('إتمام', 'completion')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {tr('ساعة الذروة', 'Peak Hour')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {peakHours[0] != null ? `${peakHours[0]}:00` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="wait-times">
        <TabsList>
          <TabsTrigger value="wait-times">
            {tr('أوقات الانتظار', 'Wait Times')}
          </TabsTrigger>
          <TabsTrigger value="throughput">
            {tr('إنتاجية المرضى', 'Throughput')}
          </TabsTrigger>
          <TabsTrigger value="doctors">
            {tr('الأطباء', 'Doctors')}
          </TabsTrigger>
          <TabsTrigger value="clinics">
            {tr('العيادات', 'Clinics')}
          </TabsTrigger>
        </TabsList>

        {/* Wait Times Tab */}
        <TabsContent value="wait-times">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr('توزيع وقت الانتظار (بالدقائق)', 'Wait Time Distribution (minutes)')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(waitDist).map(([bucket, count]) => (
                  <div key={bucket} className="text-center">
                    <div className="h-24 flex items-end justify-center">
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all"
                        style={{
                          height: `${maxWaitBucket > 0 ? (Number(count) / maxWaitBucket) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {bucket} {tr('د', 'm')}
                    </div>
                    <div className="text-sm font-bold">{String(count)}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                {tr('تم تحليل', 'Analyzed')} {waitData?.analyzedEncounters ?? 0}{' '}
                {tr('من', 'of')} {waitData?.totalEncounters ?? 0}{' '}
                {tr('لقاء', 'encounters')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Throughput Tab */}
        <TabsContent value="throughput">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {tr('حسب يوم الأسبوع', 'By Day of Week')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1">
                  {byDow.map((d, i) => (
                    <Bar
                      key={i}
                      value={d.total}
                      max={maxDow}
                      label={language === 'ar' ? DAYS_AR[i] : DAYS_EN[i]}
                      sublabel={String(d.total)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {tr('حسب الساعة', 'By Hour of Day')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-8 gap-0.5">
                  {byHour.slice(6, 22).map((h) => (
                    <Bar
                      key={h.hour}
                      value={h.total}
                      max={maxHour}
                      label={String(h.hour)}
                      color={peakHours.includes(h.hour) ? 'bg-orange-500' : 'bg-primary'}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {tr('يُظهر ساعات 6 صباحًا - 10 مساءً', 'Showing 06:00 - 22:00')}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Doctors Tab */}
        <TabsContent value="doctors">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr('إنتاجية الأطباء', 'Doctor Productivity')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-start font-medium">
                      {tr('معرف الطبيب', 'Doctor ID')}
                    </th>
                    <th className="p-3 text-end font-medium">
                      {tr('الإجمالي', 'Total')}
                    </th>
                    <th className="p-3 text-end font-medium">
                      {tr('مكتمل', 'Done')}
                    </th>
                    <th className="p-3 text-end font-medium">
                      {tr('لم يحضر', 'No-Show')}
                    </th>
                    <th className="p-3 text-end font-medium">
                      {tr('نسبة الإتمام', 'Completion')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        {tr('لا توجد بيانات', 'No data available')}
                      </td>
                    </tr>
                  ) : (
                    doctors.slice(0, 20).map((d) => (
                      <tr key={d.doctorId} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">
                          ...{d.doctorId.slice(-8)}
                        </td>
                        <td className="p-3 text-end font-medium">{d.total}</td>
                        <td className="p-3 text-end text-green-600">{d.completed}</td>
                        <td className="p-3 text-end text-orange-600">{d.noShow}</td>
                        <td className="p-3 text-end">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              d.completionRate >= 80
                                ? 'bg-green-100 text-green-800'
                                : d.completionRate >= 60
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {d.completionRate}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clinics Tab */}
        <TabsContent value="clinics">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr('أعلى العيادات نشاطًا', 'Top Clinics by Activity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(throughData?.byClinic ?? []).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {tr('لا توجد بيانات', 'No data available')}
                </p>
              ) : (
                <div className="space-y-3">
                  {(
                    throughData?.byClinic as { clinic: string; count: number }[] ?? []
                  ).map((c) => {
                    const maxClinic =
                      (throughData?.byClinic as { clinic: string; count: number }[])?.[0]?.count ??
                      1;
                    return (
                      <div key={c.clinic}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium truncate">{c.clinic}</span>
                          <span className="text-muted-foreground shrink-0 ms-2">
                            {c.count} {tr('حجز', 'bookings')}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${(c.count / maxClinic) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
