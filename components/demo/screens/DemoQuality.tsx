'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_INCIDENTS, DEMO_QUALITY_KPIS } from '@/lib/demo/mockData';
import AnimatedCounter from '@/components/charts/AnimatedCounter';
import { ShieldCheck, AlertTriangle, Clock, SmilePlus, Droplets, RotateCcw } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const kpiConfig = [
  { key: 'totalIncidents', Icon: AlertTriangle, ar: 'إجمالي البلاغات', en: 'Total Incidents', color: '#EF4444' },
  { key: 'openIncidents', Icon: Clock, ar: 'بلاغات مفتوحة', en: 'Open Incidents', color: '#D97706' },
  { key: 'avgResolutionDays', Icon: RotateCcw, ar: 'متوسط الحل', en: 'Avg Resolution', color: '#1D4ED8', suffix: ' d' },
  { key: 'patientSatisfaction', Icon: SmilePlus, ar: 'رضا المرضى', en: 'Patient Satisfaction', color: '#059669', suffix: '%' },
  { key: 'handhygieneCompliance', Icon: Droplets, ar: 'نظافة اليدين', en: 'Hand Hygiene', color: '#0891B2', suffix: '%' },
  { key: 'readmissionRate', Icon: ShieldCheck, ar: 'معدل إعادة الدخول', en: 'Readmission Rate', color: '#7C3AED', suffix: '%' },
];

export default function DemoQuality() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('الجودة والسلامة', 'Quality & Safety')}</h1>
        <p className="text-sm text-muted-foreground">{tr('مؤشرات الجودة والبلاغات', 'Quality KPIs and incident reports')}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {kpiConfig.map((kpi, i) => (
          <motion.div
            key={kpi.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5, ease }}
            className="p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}14` }}>
                <kpi.Icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
              </div>
              <span className="text-[11px] text-muted-foreground">{tr(kpi.ar, kpi.en)}</span>
            </div>
            <div className="text-xl font-bold text-foreground">
              <AnimatedCounter target={DEMO_QUALITY_KPIS[kpi.key as keyof typeof DEMO_QUALITY_KPIS]} suffix={kpi.suffix || ''} duration={1} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Incidents */}
      <h2 className="text-sm font-semibold text-foreground mb-3">{tr('آخر البلاغات', 'Recent Incidents')}</h2>
      <div className="space-y-2">
        {DEMO_INCIDENTS.map((inc, i) => (
          <motion.div
            key={inc.id}
            initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease }}
            className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center gap-3 hover:border-amber-200 dark:hover:border-amber-800 transition-colors"
          >
            {/* Severity */}
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: inc.severityColor }} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-foreground">{tr(inc.titleAr, inc.titleEn)}</span>
                <span className="text-[10px] text-muted-foreground">{inc.id}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {tr(inc.categoryAr, inc.categoryEn)} · {tr(inc.departmentAr, inc.departmentEn)} · {inc.reportedDate}
              </div>
            </div>

            {/* Severity + Status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${inc.severityColor}18`, color: inc.severityColor }}>
                {tr(inc.severityAr, inc.severityEn)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${inc.statusColor}18`, color: inc.statusColor }}>
                {tr(inc.statusAr, inc.statusEn)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
