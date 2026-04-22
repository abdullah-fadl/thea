'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_PRESCRIPTIONS, DEMO_PHARMACY_METRICS } from '@/lib/demo/mockData';
import AnimatedCounter from '@/components/charts/AnimatedCounter';
import { Pill, Clock, CheckCircle2, AlertTriangle, ClipboardList } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const metricConfig = [
  { key: 'pendingOrders', Icon: Clock, ar: 'طلبات معلقة', en: 'Pending Orders', color: '#D97706' },
  { key: 'dispensedToday', Icon: CheckCircle2, ar: 'تم صرفها اليوم', en: 'Dispensed Today', color: '#059669' },
  { key: 'underReview', Icon: ClipboardList, ar: 'قيد المراجعة', en: 'Under Review', color: '#7C3AED' },
  { key: 'lowStockAlerts', Icon: AlertTriangle, ar: 'تنبيهات نقص', en: 'Low Stock Alerts', color: '#EF4444' },
];

export default function DemoPharmacy() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('الصيدلية', 'Pharmacy')}</h1>
        <p className="text-sm text-muted-foreground">{tr('صرف الأدوية وإدارة المخزون', 'Dispensing and inventory management')}</p>
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
              <AnimatedCounter target={DEMO_PHARMACY_METRICS[m.key as keyof typeof DEMO_PHARMACY_METRICS]} duration={1} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Prescriptions */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_80px_80px_100px] gap-2 px-4 py-2.5 bg-muted/50 text-[11px] font-medium text-muted-foreground border-b border-border hidden sm:grid">
          <span>{tr('الدواء', 'Medication')}</span>
          <span className="text-center">{tr('الجرعة', 'Dose')}</span>
          <span className="text-center">{tr('الطريق', 'Route')}</span>
          <span className="text-center">{tr('الكمية', 'Qty')}</span>
          <span className="text-center">{tr('الحالة', 'Status')}</span>
        </div>

        {DEMO_PRESCRIPTIONS.map((rx, i) => (
          <motion.div
            key={rx.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease }}
            className="grid grid-cols-1 sm:grid-cols-[1fr_120px_80px_80px_100px] gap-2 px-4 py-3 border-b border-border last:border-b-0 items-center hover:bg-muted/30 transition-colors"
          >
            <div>
              <div className="flex items-center gap-2">
                <Pill className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">{tr(rx.medicationAr, rx.medicationEn)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 ps-5">
                {tr(rx.patientAr, rx.patientEn)} · {rx.mrn}
              </div>
            </div>
            <div className="text-xs text-center text-muted-foreground">
              {rx.dose} · {tr(rx.frequencyAr, rx.frequencyEn)}
            </div>
            <span className="text-xs text-center text-muted-foreground">{rx.route}</span>
            <span className="text-xs text-center font-medium text-foreground">{rx.qty}</span>
            <div className="flex justify-center">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${rx.statusColor}18`, color: rx.statusColor }}>
                {tr(rx.statusAr, rx.statusEn)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
