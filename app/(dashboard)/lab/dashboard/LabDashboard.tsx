'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  Timer,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { formatTAT } from '@/lib/lab/tatTracking';
import { TUBE_COLORS, type TubeColor } from '@/lib/lab/panels';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type Period = 'today' | 'week' | 'month';

export default function LabDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [period, setPeriod] = useState<Period>('today');

  const { data: tatData } = useSWR(
    `/api/lab/tat-metrics?period=${period}&targetMinutes=90`,
    fetcher,
    { refreshInterval: 30000 },
  );

  const { data: worklistData } = useSWR('/api/lab/worklist', fetcher, {
    refreshInterval: 15000,
  });

  const { data: qcData } = useSWR('/api/lab/qc?limit=5', fetcher);

  const metrics = tatData?.metrics;
  const worklist = worklistData?.tests ?? [];

  const pendingCount = worklist.filter((t: any) => t.status === 'ORDERED' || t.status === 'ACCEPTED').length;
  const inProgressCount = worklist.filter((t: any) => t.status === 'IN_PROGRESS' || t.status === 'RECEIVED').length;
  const completedCount = worklist.filter((t: any) => t.status === 'COMPLETED' || t.status === 'VERIFIED').length;
  const statOrders = worklist.filter((t: any) => t.priority === 'STAT' || t.priority === 'URGENT');

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('لوحة المختبر', 'Lab Dashboard')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{tr('نظرة عامة على عمليات المختبر', 'Overview of laboratory operations')}</p>
          </div>
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {(['today', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'today' ? tr('اليوم', 'Today') : p === 'week' ? tr('الأسبوع', 'Week') : tr('الشهر', 'Month')}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            icon={<FlaskConical className="w-5 h-5" />}
            label={tr('الطلبات المعلقة', 'Pending Orders')}
            value={pendingCount}
            color="text-yellow-600"
            bg="bg-yellow-50"
          />
          <KPICard
            icon={<Activity className="w-5 h-5" />}
            label={tr('قيد الفحص', 'In Progress')}
            value={inProgressCount}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <KPICard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label={tr('مكتمل', 'Completed')}
            value={completedCount}
            color="text-green-600"
            bg="bg-green-50"
          />
          <KPICard
            icon={<AlertTriangle className="w-5 h-5" />}
            label={tr('طلبات عاجلة', 'STAT Orders')}
            value={statOrders.length}
            color="text-red-600"
            bg="bg-red-50"
          />
        </div>

        {/* TAT Metrics + QC Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* TAT Summary */}
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Timer className="w-5 h-5 text-blue-600" />
              <span>{tr('زمن الاستجابة (TAT)', 'Turnaround Time (TAT)')}</span>
            </h2>

            {metrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <TATStat label={tr('متوسط TAT', 'Average TAT')} value={formatTAT(metrics.averageTAT)} />
                  <TATStat label={tr('الوسيط TAT', 'Median TAT')} value={formatTAT(metrics.medianTAT)} />
                  <TATStat label={tr('المئين 90', '90th Percentile')} value={formatTAT(metrics.p90TAT)} />
                  <TATStat
                    label={tr('ضمن الهدف', 'Within Target')}
                    value={`${metrics.withinTargetPercent}%`}
                    highlight={metrics.withinTargetPercent >= 80}
                  />
                </div>

                {/* Phase breakdown */}
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">{tr('تفاصيل المراحل', 'Phase Breakdown')}</p>
                  <div className="flex gap-2">
                    <PhaseBar
                      label={tr('طلب \u2192 تجميع', 'Order \u2192 Collect')}
                      value={metrics.breakdown.avgOrderToCollect}
                      max={metrics.averageTAT || 1}
                      color="bg-yellow-400"
                    />
                    <PhaseBar
                      label={tr('تجميع \u2192 استلام', 'Collect \u2192 Receive')}
                      value={metrics.breakdown.avgCollectToReceive}
                      max={metrics.averageTAT || 1}
                      color="bg-blue-400"
                    />
                    <PhaseBar
                      label={tr('استلام \u2192 نتيجة', 'Receive \u2192 Result')}
                      value={metrics.breakdown.avgReceiveToResult}
                      max={metrics.averageTAT || 1}
                      color="bg-green-400"
                    />
                    <PhaseBar
                      label={tr('نتيجة \u2192 تحقق', 'Result \u2192 Verify')}
                      value={metrics.breakdown.avgResultToVerify}
                      max={metrics.averageTAT || 1}
                      color="bg-purple-400"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{tr('جاري التحميل...', 'Loading...')}</p>
            )}
          </div>

          {/* Recent QC */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <span>{tr('مراقبة الجودة (QC)', 'Quality Control (QC)')}</span>
            </h2>

            {qcData?.results?.length > 0 ? (
              <div className="space-y-2">
                {qcData.results.slice(0, 5).map((qc: any, i: number) => (
                  <div key={qc.id || i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <span className="font-medium text-sm text-foreground">{qc.analyteCode}</span>
                      <span className="text-xs text-muted-foreground ml-2">L{qc.level}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">z={Number(qc.zScore).toFixed(2)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          qc.status === 'pass'
                            ? 'bg-green-100 text-green-700'
                            : qc.status === 'warning'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {qc.status === 'pass' ? tr('نجاح', 'Pass') : qc.status === 'warning' ? tr('تحذير', 'Warning') : tr('رفض', 'Fail')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{tr('لا توجد بيانات QC', 'No QC data')}</p>
            )}
          </div>
        </div>

        {/* STAT Worklist */}
        {statOrders.length > 0 && (
          <div className="bg-card rounded-2xl border border-red-200 p-5 mb-6">
            <h2 className="font-bold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>{tr('طلبات عاجلة (STAT)', 'STAT Orders')}</span>
            </h2>
            <div className="space-y-2">
              {statOrders.map((order: any) => (
                <div
                  key={order.id || order.orderId}
                  className="flex items-center justify-between py-2 px-3 bg-red-50 rounded-xl"
                >
                  <div>
                    <span className="font-medium text-foreground text-sm">{order.patientName}</span>
                    <span className="text-xs text-muted-foreground mx-2">{order.mrn}</span>
                    <span className="text-xs font-medium text-red-600">{order.testCode || order.testName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {order.orderedAt ? new Date(order.orderedAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '\u2014'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Worklist */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>{tr('قائمة العمل الحديثة', 'Recent Worklist')}</span>
            </h2>
          </div>
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground" style={{ textAlign: language === 'ar' ? 'right' : 'left' }}>{tr('المريض', 'Patient')}</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground" style={{ textAlign: language === 'ar' ? 'right' : 'left' }}>{tr('الفحص', 'Test')}</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground" style={{ textAlign: language === 'ar' ? 'right' : 'left' }}>{tr('الأولوية', 'Priority')}</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground" style={{ textAlign: language === 'ar' ? 'right' : 'left' }}>{tr('الحالة', 'Status')}</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground" style={{ textAlign: language === 'ar' ? 'right' : 'left' }}>{tr('الوقت', 'Time')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {worklist.slice(0, 20).map((item: any) => (
                <tr key={item.id || item.orderId} className="thea-hover-lift">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground text-sm">{item.patientName}</div>
                    <div className="text-xs text-muted-foreground">{item.mrn}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.testName || item.testCode}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.priority === 'STAT' || item.priority === 'URGENT'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {item.priority || 'ROUTINE'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'COMPLETED' || item.status === 'VERIFIED'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {item.orderedAt ? new Date(item.orderedAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '\u2014'}
                  </td>
                </tr>
              ))}
              {worklist.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {tr('لا توجد طلبات', 'No orders')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${bg} ${color}`}>{icon}</div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function TATStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${highlight ? 'text-green-600' : 'text-foreground'}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function PhaseBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex-1">
      <div className="text-[10px] text-muted-foreground mb-1 truncate">{label}</div>
      <div className="h-6 bg-muted rounded-lg overflow-hidden relative">
        <div className={`h-full ${color} rounded-lg transition-all`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
          {formatTAT(value)}
        </span>
      </div>
    </div>
  );
}
