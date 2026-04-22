'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_ER_PATIENTS, DEMO_ER_METRICS } from '@/lib/demo/mockData';
import AnimatedCounter from '@/components/charts/AnimatedCounter';
import { Siren, Clock, Bed, AlertTriangle, Users, Activity, Heart, ShieldAlert } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const triageColors: Record<number, { label: string; labelAr: string; color: string; bg: string }> = {
  1: { label: 'Resuscitation', labelAr: 'إنعاش', color: '#DC2626', bg: '#FEE2E2' },
  2: { label: 'Emergent', labelAr: 'طارئ', color: '#EF4444', bg: '#FEF2F2' },
  3: { label: 'Urgent', labelAr: 'عاجل', color: '#D97706', bg: '#FFFBEB' },
  4: { label: 'Less Urgent', labelAr: 'أقل إلحاحاً', color: '#059669', bg: '#ECFDF5' },
  5: { label: 'Non-Urgent', labelAr: 'غير طارئ', color: '#2563EB', bg: '#EFF6FF' },
};

const metricConfig = [
  { key: 'totalToday', Icon: Siren, ar: 'إجمالي اليوم', en: 'Total Today', color: '#EF4444' },
  { key: 'waitingTriage', Icon: Clock, ar: 'بانتظار الفرز', en: 'Waiting Triage', color: '#D97706' },
  { key: 'inTreatment', Icon: Activity, ar: 'قيد العلاج', en: 'In Treatment', color: '#1D4ED8' },
  { key: 'pendingAdmit', Icon: Bed, ar: 'بانتظار التنويم', en: 'Pending Admit', color: '#7C3AED' },
  { key: 'discharged', Icon: Users, ar: 'تم الخروج', en: 'Discharged', color: '#059669' },
  { key: 'avgDoorToDoc', Icon: Clock, ar: 'متوسط الباب للطبيب', en: 'Avg Door-to-Doc', color: '#0891B2', suffix: ' min' },
  { key: 'bedUtilization', Icon: Bed, ar: 'إشغال الأسرّة', en: 'Bed Utilization', color: '#6366F1', suffix: '%' },
  { key: 'criticalAlerts', Icon: ShieldAlert, ar: 'تنبيهات حرجة', en: 'Critical Alerts', color: '#DC2626' },
];

export default function DemoER() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('قسم الطوارئ', 'Emergency Department')}</h1>
        <p className="text-sm text-muted-foreground">{tr('المتابعة اللحظية لقسم الطوارئ', 'Real-time ER monitoring')}</p>
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
              <AnimatedCounter target={DEMO_ER_METRICS[m.key as keyof typeof DEMO_ER_METRICS]} suffix={m.suffix || ''} duration={1} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ER Board */}
      <div className="space-y-2">
        {DEMO_ER_PATIENTS.map((p, i) => {
          const triage = triageColors[p.triageLevel];
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease }}
              className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center gap-3 hover:border-red-200 dark:hover:border-red-800 transition-colors"
            >
              {/* Triage level */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: triage.bg, color: triage.color }}>
                {p.triageLevel}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground truncate">{tr(p.nameAr, p.nameEn)}</span>
                  <span className="text-[10px] text-muted-foreground">{p.mrn}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{p.age}{tr('س', 'y')} {p.gender}</span>
                </div>
                <p className="text-xs text-muted-foreground">{tr(p.chiefComplaintAr, p.chiefComplaintEn)}</p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <span className="text-[10px] text-muted-foreground">{p.bedId}</span>
                <span className="text-[10px] text-muted-foreground">{p.arrivalTime}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: triage.bg, color: triage.color }}>
                  {tr(triage.labelAr, triage.label)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800" style={{ color: p.statusColor }}>
                  {tr(p.statusAr, p.statusEn)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
