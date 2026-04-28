'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_PATIENT_DETAIL } from '@/lib/demo/mockData';
import { User, Heart, Thermometer, Droplets, Wind, AlertTriangle } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

export default function DemoPatientRecord() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const p = DEMO_PATIENT_DETAIL;

  const vitals = [
    { ar: 'ضغط الدم', en: 'Blood Pressure', value: p.vitals.bp, unit: 'mmHg', Icon: Heart, color: '#EF4444' },
    { ar: 'نبض القلب', en: 'Heart Rate', value: p.vitals.hr, unit: 'bpm', Icon: Heart, color: '#F97316' },
    { ar: 'الحرارة', en: 'Temperature', value: p.vitals.temp, unit: '°C', Icon: Thermometer, color: '#D97706' },
    { ar: 'تشبع الأكسجين', en: 'SpO2', value: p.vitals.spo2, unit: '%', Icon: Droplets, color: '#1D4ED8' },
    { ar: 'معدل التنفس', en: 'Resp. Rate', value: p.vitals.rr, unit: '/min', Icon: Wind, color: '#059669' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Patient header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="p-5 rounded-xl border border-border bg-card mb-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
            <User className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{tr(p.nameAr, p.nameEn)}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
              <span>{p.mrn}</span>
              <span>·</span>
              <span>{tr(`${p.age} سنة`, `${p.age} years`)}</span>
              <span>·</span>
              <span>{tr(p.gender === 'M' ? 'ذكر' : 'أنثى', p.gender === 'M' ? 'Male' : 'Female')}</span>
              <span>·</span>
              <span className="font-medium text-red-600">{p.bloodType}</span>
            </div>
          </div>
        </div>

        {/* Allergy alert */}
        {p.allergies.length > 0 && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-700 dark:text-red-300 font-medium">
              {tr('حساسية', 'Allergy')}: {p.allergies.map(a => tr(a.ar, a.en)).join(', ')}
            </span>
          </div>
        )}
      </motion.div>

      {/* Vitals */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">{tr('العلامات الحيوية', 'Vital Signs')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {vitals.map((v, i) => (
            <motion.div
              key={v.en}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease }}
              className="p-3 rounded-xl border border-border bg-card text-center"
            >
              <v.Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: v.color }} />
              <div className="text-lg font-bold text-foreground">{v.value}</div>
              <div className="text-[10px] text-muted-foreground">{v.unit}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{tr(v.ar, v.en)}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Diagnoses */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4, ease }}
        className="p-4 rounded-xl border border-border bg-card"
      >
        <h2 className="text-sm font-semibold text-foreground mb-3">{tr('التشخيصات', 'Diagnoses')}</h2>
        <div className="space-y-2">
          {(language === 'ar' ? p.diagnosesAr : p.diagnosesEn).map((dx, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-foreground">
              <span className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {i + 1}
              </span>
              {dx}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
