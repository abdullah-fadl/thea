'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_NURSING_TASKS } from '@/lib/demo/mockData';
import { Heart, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

export default function DemoNursing() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const done = DEMO_NURSING_TASKS.filter(t => t.statusEn === 'Done').length;
  const inProgress = DEMO_NURSING_TASKS.filter(t => t.statusEn === 'In Progress').length;
  const pending = DEMO_NURSING_TASKS.filter(t => t.statusEn === 'Pending').length;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('التمريض', 'Nursing')}</h1>
        <p className="text-sm text-muted-foreground">{tr('مهام التمريض وجدول الرعاية', 'Nursing tasks and care schedule')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: tr('مكتمل', 'Done'), count: done, color: '#059669', Icon: CheckCircle2 },
          { label: tr('قيد التنفيذ', 'In Progress'), count: inProgress, color: '#1D4ED8', Icon: Clock },
          { label: tr('معلق', 'Pending'), count: pending, color: '#D97706', Icon: AlertCircle },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5, ease }}
            className="p-4 rounded-xl border border-border bg-card text-center"
          >
            <s.Icon className="w-5 h-5 mx-auto mb-2" style={{ color: s.color }} />
            <div className="text-xl font-bold text-foreground">{s.count}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {DEMO_NURSING_TASKS.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease }}
            className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/30 transition-colors"
          >
            {/* Priority dot */}
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: task.priorityColor }} />

            {/* Bed */}
            <div className="w-14 text-center flex-shrink-0">
              <span className="text-xs font-bold text-foreground bg-muted px-2 py-1 rounded">{task.bed}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{tr(task.taskAr, task.taskEn)}</div>
              <div className="text-[11px] text-muted-foreground">{tr(task.patientAr, task.patientEn)}</div>
            </div>

            {/* Due + Status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                {task.dueTime}
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${task.statusColor}18`, color: task.statusColor }}>
                {tr(task.statusAr, task.statusEn)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
