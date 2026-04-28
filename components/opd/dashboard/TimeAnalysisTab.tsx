'use client';

import { useLang } from '@/hooks/use-lang';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Legend,
} from 'recharts';

interface TimeAnalysisTabProps {
  analytics: any;
}

const HOUR_LABELS: Record<string, { ar: string; en: string }> = {
  '0-6': { ar: '0-6', en: '0-6' },
  '6-7': { ar: '6-7', en: '6-7' },
  '7-8': { ar: '7-8', en: '7-8' },
  '8-12': { ar: '8-12', en: '8-12' },
  '12-16': { ar: '12-16', en: '12-16' },
  '16-20': { ar: '16-20', en: '16-20' },
  '20-24': { ar: '20-24', en: '20-24' },
};

export default function TimeAnalysisTab({ analytics }: TimeAnalysisTabProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const peakHours = (analytics?.peakHours || []).map((h: any) => ({
    hour: HOUR_LABELS[h.hour]?.[language === 'ar' ? 'ar' : 'en'] || h.hour,
    count: h.count,
  }));

  const waitDistribution = analytics?.waitDistribution || [];

  // Placeholder peak days (when we get multi-day data)
  const peakDays = [
    { day: tr('الأحد', 'Sunday'), visits: 0 },
    { day: tr('الاثنين', 'Monday'), visits: 0 },
    { day: tr('الثلاثاء', 'Tuesday'), visits: 0 },
    { day: tr('الأربعاء', 'Wednesday'), visits: 0 },
    { day: tr('الخميس', 'Thursday'), visits: 0 },
  ];

  return (
    <div className="space-y-5">
      {/* Peak Hours */}
      <div className="bg-card rounded-xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-800 mb-3">{tr('توزيع المرضى حسب الفترة', 'Patient Distribution by Time Period')}</div>
        {peakHours.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} name={tr('المرضى', 'Patients')} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">
            {tr('لا توجد بيانات للفترات الزمنية', 'No time period data available')}
          </div>
        )}
      </div>

      {/* Wait Time Distribution */}
      <div className="bg-card rounded-xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-800 mb-3">{tr('توزيع أوقات الانتظار (دقائق)', 'Wait Time Distribution (minutes)')}</div>
        {waitDistribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={waitDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <ReferenceLine x="30-60" stroke="#EF4444" strokeDasharray="5 5" label={{ value: tr('معيار ADA\'A', 'ADA\'A Benchmark'), position: 'top', fontSize: 10, fill: '#EF4444' }} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name={tr('المرضى', 'Patients')} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">
            {tr('لا توجد بيانات لأوقات الانتظار', 'No wait time data available')}
          </div>
        )}
      </div>

      {/* Wait Time Summary Cards */}
      {analytics?.waitTimeKPIs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: tr('الانتظار → التمريض', 'Wait → Nurse'), data: analytics.waitTimeKPIs.arrivalToNurse, color: 'border-blue-200 bg-blue-50' },
            { label: tr('التمريض → الطبيب', 'Nurse → Doctor'), data: analytics.waitTimeKPIs.nurseToDoctor, color: 'border-amber-200 bg-amber-50' },
            { label: tr('وقت الاستشارة', 'Consult Time'), data: analytics.waitTimeKPIs.consultTime, color: 'border-purple-200 bg-purple-50' },
            { label: tr('إجمالي الزيارة', 'Total Visit'), data: analytics.waitTimeKPIs.totalVisitTime, color: 'border-indigo-200 bg-indigo-50' },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl border ${item.color} p-4`}>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">{item.label}</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {item.data?.avg || 0} <span className="text-sm font-normal text-slate-400">{tr('دقيقة', 'min')}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {tr(`الوسيط: ${item.data?.median || 0} دقيقة`, `Median: ${item.data?.median || 0} min`)}
                {' | '}{item.data?.count || 0} {tr('قياس', 'samples')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Peak Days placeholder */}
      <div className="bg-card rounded-xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-800 mb-3">{tr('أيام الذروة (يتطلب بيانات أسبوعية)', 'Peak Days (requires weekly data)')}</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={peakDays}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
            <Bar dataKey="visits" fill="#6366F1" radius={[4, 4, 0, 0]} name={tr('الزيارات', 'Visits')} />
          </BarChart>
        </ResponsiveContainer>
        <div className="text-xs text-slate-400 text-center mt-2">
          {tr('اختر فترة أسبوعية أو شهرية لعرض بيانات أيام الذروة', 'Select a weekly or monthly period to see peak day data')}
        </div>
      </div>
    </div>
  );
}
