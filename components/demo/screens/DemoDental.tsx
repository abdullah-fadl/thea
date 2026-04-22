'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_DENTAL_PATIENTS } from '@/lib/demo/mockData';
import { Smile, User } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

export default function DemoDental() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('طب الأسنان', 'Dental')}</h1>
        <p className="text-sm text-muted-foreground">{tr('مرضى وإجراءات طب الأسنان', 'Dental patients and procedures')}</p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['In Treatment', 'Completed', 'Waiting', 'Scheduled'].map((status) => {
          const count = DEMO_DENTAL_PATIENTS.filter(p => p.statusEn === status).length;
          const colors: Record<string, string> = { 'In Treatment': '#1D4ED8', Completed: '#059669', Waiting: '#D97706', Scheduled: '#7C3AED' };
          const arLabels: Record<string, string> = { 'In Treatment': 'في العلاج', Completed: 'مكتمل', Waiting: 'بانتظار', Scheduled: 'مجدول' };
          if (count === 0) return null;
          return (
            <div key={status} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: `${colors[status]}14`, color: colors[status] }}>
              {tr(arLabels[status], status)}: {count}
            </div>
          );
        })}
      </div>

      {/* Patients */}
      <div className="space-y-2">
        {DEMO_DENTAL_PATIENTS.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease }}
            className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center gap-3 hover:border-cyan-200 dark:hover:border-cyan-800 transition-colors"
          >
            {/* Icon */}
            <div className="w-10 h-10 rounded-full bg-cyan-50 dark:bg-cyan-950 flex items-center justify-center flex-shrink-0">
              <Smile className="w-5 h-5 text-cyan-600" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-foreground truncate">{tr(p.nameAr, p.nameEn)}</span>
                <span className="text-[10px] text-muted-foreground">{p.mrn}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {tr(p.procedureAr, p.procedureEn)} · {tr('أسنان', 'Teeth')}: {p.toothNumbers}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {tr(p.dentistAr, p.dentistEn)}
              </div>
            </div>

            {/* Status */}
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium flex-shrink-0" style={{ background: `${p.statusColor}18`, color: p.statusColor }}>
              {tr(p.statusAr, p.statusEn)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
