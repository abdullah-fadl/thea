'use client';

import { useLang } from '@/hooks/use-lang';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart3, CheckCircle2, XCircle, Clock, FlaskConical, Stethoscope, AlertCircle } from 'lucide-react';
import { type ReactNode } from 'react';

interface OverviewTabProps {
  stats: any;
  analytics: any;
  visitTypeBreakdown: Record<string, number>;
  previousPeriod: any;
}

const VISIT_TYPE_COLORS: Record<string, string> = {
  FVC: '#3B82F6',
  FVB: '#8B5CF6',
  FVH: '#EC4899',
  FU: '#F59E0B',
  RV: '#10B981',
  REF: '#6366F1',
};

function TrendArrow({ current, previous, inverse }: { current: number; previous?: number; inverse?: boolean }) {
  if (previous == null || previous === 0) return null;
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  const isUp = diff > 0;
  const isGood = inverse ? !isUp : isUp;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

export default function OverviewTab({ stats, analytics, visitTypeBreakdown, previousPeriod }: OverviewTabProps) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const kpis: Array<{ label: string; value: string | number; icon: ReactNode; bg: string; borderColor: string; prevKey?: string; inverse?: boolean; unit?: string }> = [
    { label: tr('إجمالي الزيارات', 'Total Visits'), value: stats.totalVisits, icon: <BarChart3 className="w-4 h-4" />, bg: 'bg-blue-50', borderColor: 'border-blue-200', prevKey: 'totalVisits' },
    { label: tr('نسبة الحضور', 'Attendance Rate'), value: `${stats.attendanceRate || 0}%`, icon: <CheckCircle2 className="w-4 h-4" />, bg: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    { label: tr('نسبة عدم الحضور', 'No-Show Rate'), value: `${stats.noShowRate || 0}%`, icon: <XCircle className="w-4 h-4" />, bg: 'bg-red-50', borderColor: 'border-red-200', prevKey: 'noShowRate', inverse: true },
    { label: tr('متوسط وقت الانتظار', 'Avg Wait Time'), value: `${analytics?.waitTimeKPIs?.totalVisitTime?.avg || 0}`, unit: tr('دقيقة', 'min'), icon: <Clock className="w-4 h-4" />, bg: 'bg-amber-50', borderColor: 'border-amber-200' },
    { label: tr('نسبة الاستخدام', 'Utilization'), value: `${stats.avgUtilization}%`, icon: <TrendingUp className="w-4 h-4" />, bg: 'bg-indigo-50', borderColor: 'border-indigo-200', prevKey: 'avgUtilization' },
    { label: tr('نسبة الإلغاء', 'Cancellation Rate'), value: `${stats.cancellationRate || 0}%`, icon: <XCircle className="w-4 h-4" />, bg: 'bg-orange-50', borderColor: 'border-orange-200' },
    { label: tr('الإجراءات المنفذة', 'Procedures Done'), value: stats.proceduresDone || 0, icon: <FlaskConical className="w-4 h-4" />, bg: 'bg-purple-50', borderColor: 'border-purple-200', prevKey: 'proceduresDone' },
    { label: tr('متوسط وقت الاستشارة', 'Avg Consult Time'), value: `${stats.avgConsultTimeMin || 0}`, unit: tr('دقيقة', 'min'), icon: <Stethoscope className="w-4 h-4" />, bg: 'bg-teal-50', borderColor: 'border-teal-200' },
  ];

  // Pie chart data
  const pieData = Object.entries(visitTypeBreakdown || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: VISIT_TYPE_COLORS[name] || '#94A3B8' }));

  // Flow pipeline data
  const FLOW_LABELS: Record<string, { ar: string; en: string; color: string }> = {
    WAITING_NURSE: { ar: 'بانتظار التمريض', en: 'Waiting Nurse', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    IN_NURSING: { ar: 'في التمريض', en: 'In Nursing', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    READY_FOR_DOCTOR: { ar: 'جاهز للطبيب', en: 'Ready for Doctor', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    WAITING_DOCTOR: { ar: 'بانتظار الطبيب', en: 'Waiting Doctor', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    IN_DOCTOR: { ar: 'في الاستشارة', en: 'In Doctor', color: 'bg-violet-100 text-violet-800 border-violet-200' },
    COMPLETED: { ar: 'مكتمل', en: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  };

  const flowEntries = Object.entries(analytics?.flowDistribution || {})
    .filter(([key]) => FLOW_LABELS[key])
    .sort((a, b) => {
      const order = Object.keys(FLOW_LABELS);
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    });

  return (
    <div className="space-y-5">
      {/* Row 1: 8 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl border ${kpi.borderColor} p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-slate-500">{kpi.icon}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-slate-800">{kpi.value}</div>
              {kpi.unit && <span className="text-sm text-slate-400">{kpi.unit}</span>}
            </div>
            {kpi.prevKey && previousPeriod && (
              <div className="mt-1">
                <TrendArrow
                  current={typeof kpi.value === 'string' ? parseFloat(kpi.value) : kpi.value}
                  previous={previousPeriod[kpi.prevKey]}
                  inverse={kpi.inverse}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Row 2: Utilization bar + Visit type donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Utilization bar */}
        <div className="bg-card rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-800">{tr('استغلال العيادات الكلي', 'Overall Clinic Utilization')}</span>
            <span className="text-sm font-bold text-indigo-600">{stats.avgUtilization}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
              style={{ width: `${Math.min(stats.avgUtilization, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-400">
            <span>0%</span>
            <span>{tr('المستهدف: 85%', 'Target: 85%')}</span>
            <span>100%</span>
          </div>
          {/* Source breakdown mini cards */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-700">{stats.appointmentCount || 0}</div>
              <div className="text-[10px] text-blue-500">{tr('مواعيد', 'Appointments')}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-amber-700">{stats.walkinCount || 0}</div>
              <div className="text-[10px] text-amber-500">{tr('بدون موعد', 'Walk-ins')}</div>
            </div>
          </div>
        </div>

        {/* Visit type donut */}
        <div className="bg-card rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-800 mb-2">{tr('توزيع أنواع الزيارات', 'Visit Type Distribution')}</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value, name]} />
                <Legend
                  formatter={(value: string) => <span className="text-xs text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">
              {tr('لا توجد بيانات', 'No data')}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Live Flow Pipeline */}
      {flowEntries.length > 0 && (
        <div className="bg-card rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">{tr('خط سير المرضى الحالي', 'Live Patient Pipeline')}</div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {flowEntries.map(([state, count], idx) => {
              const info = FLOW_LABELS[state];
              if (!info) return null;
              return (
                <div key={state} className="flex items-center">
                  <div className={`${info.color} border rounded-lg px-3 py-2 min-w-[100px] text-center whitespace-nowrap`}>
                    <div className="text-lg font-bold">{count as number}</div>
                    <div className="text-[10px] font-medium">{language === 'ar' ? info.ar : info.en}</div>
                  </div>
                  {idx < flowEntries.length - 1 && (
                    <div className={`text-slate-300 mx-1 text-lg ${isRTL ? 'rotate-180' : ''}`}>→</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 4: Wait time analytics */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: tr('الانتظار → التمريض', 'Wait → Nurse'), data: analytics.waitTimeKPIs?.arrivalToNurse, icon: <Clock className="w-3.5 h-3.5 inline-block" /> },
            { label: tr('التمريض → الطبيب', 'Nurse → Doctor'), data: analytics.waitTimeKPIs?.nurseToDoctor, icon: <Clock className="w-3.5 h-3.5 inline-block" /> },
            { label: tr('إجمالي الزيارة', 'Total Visit'), data: analytics.waitTimeKPIs?.totalVisitTime, icon: <Clock className="w-3.5 h-3.5 inline-block" /> },
            { label: tr('حالات حرجة / عاجلة', 'Critical / Urgent'), data: null, icon: <AlertCircle className="w-3.5 h-3.5 inline-block text-red-500" />, special: true },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-xl border border-slate-200 p-4">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">{item.icon} {item.label}</div>
              {item.special ? (
                <>
                  <div className="text-2xl font-bold text-red-600 mt-1">
                    {analytics.criticalCount || 0} <span className="text-sm font-normal text-slate-400">/ {analytics.urgentCount || 0}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {tr(`نشط: ${analytics.active || 0} | مكتمل: ${analytics.completed || 0}`, `Active: ${analytics.active || 0} | Done: ${analytics.completed || 0}`)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-slate-800 mt-1">
                    {item.data?.avg || 0} <span className="text-sm font-normal text-slate-400">{tr('دقيقة', 'min')}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {tr(`الوسيط: ${item.data?.median || 0} دقيقة`, `Median: ${item.data?.median || 0} min`)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
