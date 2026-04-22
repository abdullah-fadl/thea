'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_APPOINTMENTS, DEMO_SCHEDULING_METRICS } from '@/lib/demo/mockData';
import AnimatedCounter from '@/components/charts/AnimatedCounter';
import { Calendar, CheckCircle2, Clock, UserX, Activity } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const metricConfig = [
  { key: 'totalToday', Icon: Calendar, ar: 'مواعيد اليوم', en: 'Today\'s Appointments', color: '#1D4ED8' },
  { key: 'confirmed', Icon: CheckCircle2, ar: 'مؤكد', en: 'Confirmed', color: '#059669' },
  { key: 'arrived', Icon: Activity, ar: 'وصل', en: 'Arrived', color: '#7C3AED' },
  { key: 'noShow', Icon: UserX, ar: 'لم يحضر', en: 'No Show', color: '#EF4444' },
];

export default function DemoScheduling() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('المواعيد', 'Scheduling')}</h1>
        <p className="text-sm text-muted-foreground">{tr('جدول المواعيد اليومي', 'Daily appointment schedule')}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
              <AnimatedCounter target={DEMO_SCHEDULING_METRICS[m.key as keyof typeof DEMO_SCHEDULING_METRICS]} duration={1} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {DEMO_APPOINTMENTS.map((apt, i) => (
          <motion.div
            key={apt.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease }}
            className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
          >
            {/* Time */}
            <div className="w-14 text-center flex-shrink-0">
              <span className="text-sm font-bold text-foreground">{apt.time}</span>
            </div>

            {/* Divider line */}
            <div className="w-px h-10 bg-border flex-shrink-0" />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-foreground truncate">{tr(apt.patientAr, apt.patientEn)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {tr(apt.doctorAr, apt.doctorEn)} · {tr(apt.departmentAr, apt.departmentEn)}
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                {tr(apt.typeAr, apt.typeEn)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${apt.statusColor}18`, color: apt.statusColor }}>
                {tr(apt.statusAr, apt.statusEn)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
