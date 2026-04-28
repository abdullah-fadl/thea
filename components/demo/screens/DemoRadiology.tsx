'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_RAD_STUDIES } from '@/lib/demo/mockData';
import { ScanLine, Clock, MonitorSmartphone } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const modalityIcons: Record<string, string> = {
  'X-Ray': '🦴',
  'CT Scan': '🧠',
  'MRI': '🧲',
  'Ultrasound': '📡',
};

export default function DemoRadiology() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('الأشعة', 'Radiology')}</h1>
        <p className="text-sm text-muted-foreground">{tr('قائمة الدراسات والتقارير الإشعاعية', 'Studies worklist and reports')}</p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['Completed', 'In Progress', 'Scheduled', 'Awaiting Report'].map((status) => {
          const count = DEMO_RAD_STUDIES.filter(s => s.statusEn === status).length;
          const colors: Record<string, string> = { Completed: '#059669', 'In Progress': '#1D4ED8', Scheduled: '#D97706', 'Awaiting Report': '#7C3AED' };
          const labelsAr: Record<string, string> = { Completed: 'مكتمل', 'In Progress': 'قيد التنفيذ', Scheduled: 'مجدول', 'Awaiting Report': 'بانتظار التقرير' };
          return (
            <div key={status} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: `${colors[status]}14`, color: colors[status] }}>
              {tr(labelsAr[status], status)}: {count}
            </div>
          );
        })}
      </div>

      {/* Studies */}
      <div className="space-y-2">
        {DEMO_RAD_STUDIES.map((study, i) => (
          <motion.div
            key={study.id}
            initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease }}
            className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center gap-3 hover:border-purple-200 dark:hover:border-purple-800 transition-colors"
          >
            {/* Modality icon */}
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg flex-shrink-0">
              {modalityIcons[study.modalityEn] || '📋'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-foreground">{tr(study.modalityAr, study.modalityEn)}</span>
                <span className="text-[10px] text-muted-foreground">— {tr(study.bodyPartAr, study.bodyPartEn)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {tr(study.patientAr, study.patientEn)} · {study.mrn}
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                {study.requestedTime}
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${study.priorityColor}14`, color: study.priorityColor }}>
                {tr(study.priorityAr, study.priorityEn)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${study.statusColor}18`, color: study.statusColor }}>
                {tr(study.statusAr, study.statusEn)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
