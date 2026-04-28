'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_OR_CASES } from '@/lib/demo/mockData';
import { Scissors, Clock, User } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

export default function DemoOR() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('غرف العمليات', 'Operating Rooms')}</h1>
        <p className="text-sm text-muted-foreground">{tr('جدول العمليات الجراحية', 'Surgical schedule board')}</p>
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['Completed', 'In Progress', 'Scheduled'].map((status) => {
          const count = DEMO_OR_CASES.filter(c => c.statusEn === status).length;
          const colors: Record<string, string> = { Completed: '#059669', 'In Progress': '#1D4ED8', Scheduled: '#D97706' };
          const arLabels: Record<string, string> = { Completed: 'مكتمل', 'In Progress': 'قيد التنفيذ', Scheduled: 'مجدول' };
          return (
            <div key={status} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: `${colors[status]}14`, color: colors[status] }}>
              {tr(arLabels[status], status)}: {count}
            </div>
          );
        })}
      </div>

      {/* Cases timeline */}
      <div className="space-y-3">
        {DEMO_OR_CASES.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease }}
            className="p-4 rounded-xl border border-border bg-card hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Room + Time */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-muted flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">{c.room}</span>
                  <span className="text-xs font-bold text-foreground">{c.scheduledTime}</span>
                </div>
              </div>

              {/* Procedure info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{tr(c.procedureAr, c.procedureEn)}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {tr(c.patientAr, c.patientEn)} ({c.mrn})
                  </span>
                  <span>·</span>
                  <span>{tr(c.surgeonAr, c.surgeonEn)}</span>
                </div>
              </div>

              {/* Duration + Status */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {c.durationMin} {tr('دقيقة', 'min')}
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: `${c.statusColor}18`, color: c.statusColor }}>
                  {tr(c.statusAr, c.statusEn)}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
