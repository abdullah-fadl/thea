'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_KPIS, DEMO_CHART_VISITS } from '@/lib/demo/mockData';
import AnimatedCounter from '@/components/charts/AnimatedCounter';
import AnimatedAreaChart from '@/components/charts/AnimatedAreaChart';
import { Activity, Users, Clock, Bed, Siren, FlaskConical, Pill, TrendingUp } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const kpiConfig = [
  { key: 'totalVisits', Icon: Activity, ar: 'الزيارات', en: 'Total Visits', color: '#1D4ED8' },
  { key: 'activePatients', Icon: Users, ar: 'المرضى النشطين', en: 'Active Patients', color: '#059669' },
  { key: 'avgWaitTime', Icon: Clock, ar: 'متوسط الانتظار', en: 'Avg Wait', color: '#D97706', suffix: ' min' },
  { key: 'bedOccupancy', Icon: Bed, ar: 'إشغال الأسرّة', en: 'Bed Occupancy', color: '#7C3AED', suffix: '%' },
  { key: 'erVisits', Icon: Siren, ar: 'زيارات الطوارئ', en: 'ER Visits', color: '#EF4444' },
  { key: 'labTests', Icon: FlaskConical, ar: 'فحوصات المختبر', en: 'Lab Tests', color: '#0891B2' },
  { key: 'prescriptions', Icon: Pill, ar: 'الوصفات', en: 'Prescriptions', color: '#059669' },
  { key: 'orOperations', Icon: TrendingUp, ar: 'العمليات', en: 'Operations', color: '#6366F1' },
];

export default function DemoDashboard() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('لوحة المعلومات', 'Dashboard')}</h1>
        <p className="text-sm text-muted-foreground">{tr('نظرة عامة لحظية على المنشأة', 'Real-time facility overview')}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpiConfig.map((kpi, i) => (
          <motion.div
            key={kpi.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5, ease }}
            className="p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}14` }}>
                <kpi.Icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
              </div>
              <span className="text-[11px] text-muted-foreground">{tr(kpi.ar, kpi.en)}</span>
            </div>
            <div className="text-xl font-bold text-foreground">
              <AnimatedCounter target={DEMO_KPIS[kpi.key as keyof typeof DEMO_KPIS]} suffix={kpi.suffix || ''} duration={1.2} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5, ease }}
        className="p-5 rounded-xl border border-border bg-card"
      >
        <h3 className="text-sm font-semibold text-foreground mb-1">{tr('الزيارات - آخر ٧ أيام', 'Visits — Last 7 Days')}</h3>
        <p className="text-xs text-muted-foreground mb-4">{tr('عدد الزيارات اليومي', 'Daily visit count')}</p>
        <AnimatedAreaChart data={DEMO_CHART_VISITS} color="#1D4ED8" height={200} />
      </motion.div>
    </div>
  );
}
