'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_IPD_EPISODES, DEMO_IPD_METRICS } from '@/lib/demo/mockData';
import AnimatedCounter from '@/components/charts/AnimatedCounter';
import { Bed, Users, ArrowDownToLine, ArrowUpFromLine, Clock, Activity } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const metricConfig = [
  { key: 'totalAdmitted', Icon: Users, ar: 'إجمالي المنومين', en: 'Total Admitted', color: '#1D4ED8' },
  { key: 'bedsOccupied', Icon: Bed, ar: 'أسرّة مشغولة', en: 'Beds Occupied', color: '#7C3AED', suffix: '/56' },
  { key: 'dischargeToday', Icon: ArrowUpFromLine, ar: 'خروج اليوم', en: 'Discharge Today', color: '#059669' },
  { key: 'pendingAdmit', Icon: ArrowDownToLine, ar: 'بانتظار الدخول', en: 'Pending Admit', color: '#D97706' },
  { key: 'avgLOS', Icon: Clock, ar: 'متوسط الإقامة', en: 'Avg LOS', color: '#0891B2', suffix: ' days' },
];

export default function DemoIPD() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const occupancyPct = Math.round((DEMO_IPD_METRICS.bedsOccupied / DEMO_IPD_METRICS.totalBeds) * 100);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('التنويم', 'Inpatient Department')}</h1>
        <p className="text-sm text-muted-foreground">{tr('إدارة المرضى المنومين والأسرّة', 'Manage admitted patients and beds')}</p>
      </div>

      {/* Metrics + Occupancy bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {metricConfig.map((m, i) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5, ease }}
            className="p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${m.color}14` }}>
                <m.Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
              </div>
              <span className="text-[11px] text-muted-foreground">{tr(m.ar, m.en)}</span>
            </div>
            <div className="text-xl font-bold text-foreground">
              <AnimatedCounter target={typeof DEMO_IPD_METRICS[m.key as keyof typeof DEMO_IPD_METRICS] === 'number' ? DEMO_IPD_METRICS[m.key as keyof typeof DEMO_IPD_METRICS] as number : 0} suffix={m.suffix || ''} duration={1} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Occupancy bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mb-6 p-4 rounded-xl border border-border bg-card"
      >
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground">{tr('إشغال الأسرّة', 'Bed Occupancy')}</span>
          <span className="font-semibold text-foreground">{occupancyPct}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${occupancyPct}%` }}
            transition={{ delay: 0.5, duration: 1, ease }}
            className="h-full rounded-full"
            style={{ background: occupancyPct > 85 ? '#EF4444' : '#1D4ED8' }}
          />
        </div>
      </motion.div>

      {/* Episodes */}
      <div className="space-y-2">
        {DEMO_IPD_EPISODES.map((ep, i) => (
          <motion.div
            key={ep.id}
            initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease }}
            className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center gap-3 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
          >
            {/* Bed badge */}
            <div className="w-14 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
              {ep.bed}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-foreground truncate">{tr(ep.nameAr, ep.nameEn)}</span>
                <span className="text-[10px] text-muted-foreground">{ep.mrn}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{tr(ep.wardAr, ep.wardEn)}</span>
                <span>·</span>
                <span>{tr(ep.diagnosisAr, ep.diagnosisEn)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {tr(ep.attendingAr, ep.attendingEn)} · {tr('دخول', 'Admit')}: {ep.admitDate}
              </div>
            </div>

            {/* Status */}
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium flex-shrink-0" style={{ background: `${ep.statusColor}18`, color: ep.statusColor }}>
              {tr(ep.statusAr, ep.statusEn)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
