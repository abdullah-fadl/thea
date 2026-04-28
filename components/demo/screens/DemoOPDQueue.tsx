'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_PATIENTS } from '@/lib/demo/mockData';
import { Clock, User } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const statusConfig: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  WAITING_DOCTOR: { ar: 'بانتظار الطبيب', en: 'Waiting Doctor', color: '#D97706', bg: '#FFFBEB' },
  READY_FOR_DOCTOR: { ar: 'جاهز', en: 'Ready', color: '#059669', bg: '#ECFDF5' },
  IN_DOCTOR: { ar: 'في الكشف', en: 'In Exam', color: '#1D4ED8', bg: '#EEF2FF' },
  IN_NURSING: { ar: 'في التمريض', en: 'In Nursing', color: '#2563EB', bg: '#EFF6FF' },
  WAITING_NURSE: { ar: 'بانتظار التمريض', en: 'Waiting Nurse', color: '#D97706', bg: '#FFFBEB' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed', color: '#94A3B8', bg: '#F1F5F9' },
};

const visitTypeConfig: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  new: { ar: 'جديد', en: 'New', color: '#059669', bg: '#ECFDF5' },
  fu: { ar: 'مراجعة', en: 'Follow-up', color: '#2563EB', bg: '#EEF2FF' },
  urg: { ar: 'طارئ', en: 'Urgent', color: '#EF4444', bg: '#FEF2F2' },
};

export default function DemoOPDQueue() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('قائمة المرضى', 'OPD Patient Queue')}</h1>
        <p className="text-sm text-muted-foreground">{tr('المرضى الحاليين في العيادات الخارجية', 'Current outpatient queue')}</p>
      </div>

      {/* Pipeline */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const count = DEMO_PATIENTS.filter(p => p.status === key).length;
          return (
            <div key={key} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: cfg.bg, color: cfg.color }}>
              {tr(cfg.ar, cfg.en)}: {count}
            </div>
          );
        })}
      </div>

      {/* Patient list */}
      <div className="space-y-2">
        {DEMO_PATIENTS.map((patient, i) => {
          const st = statusConfig[patient.status] || statusConfig.COMPLETED;
          const vt = visitTypeConfig[patient.visitType] || visitTypeConfig.fu;
          return (
            <motion.div
              key={patient.id}
              initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease }}
              className="p-4 rounded-xl border border-border bg-card flex items-center gap-4 hover:border-blue-200 dark:hover:border-blue-800 transition-colors cursor-pointer"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {tr(patient.nameAr, patient.nameEn)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{patient.mrn}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{tr(patient.departmentAr, patient.departmentEn)}</span>
                  <span>·</span>
                  <span>{tr(patient.doctorAr, patient.doctorEn)}</span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {patient.waitMinutes > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {patient.waitMinutes}m
                  </div>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: vt.bg, color: vt.color }}>
                  {tr(vt.ar, vt.en)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: st.bg, color: st.color }}>
                  {tr(st.ar, st.en)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
