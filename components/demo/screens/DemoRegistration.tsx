'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_REGISTRATION_STATS, DEMO_PATIENTS } from '@/lib/demo/mockData';
import AnimatedCounter from '@/components/charts/AnimatedCounter';
import { UserPlus, Users, RotateCcw, ShieldCheck, Clock } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const metricConfig = [
  { key: 'registeredToday', Icon: Users, ar: 'مسجلين اليوم', en: 'Registered Today', color: '#1D4ED8' },
  { key: 'newPatients', Icon: UserPlus, ar: 'مرضى جدد', en: 'New Patients', color: '#059669' },
  { key: 'returningPatients', Icon: RotateCcw, ar: 'مرضى مراجعين', en: 'Returning', color: '#7C3AED' },
  { key: 'pendingInsurance', Icon: ShieldCheck, ar: 'بانتظار التأمين', en: 'Pending Insurance', color: '#D97706' },
  { key: 'avgRegistrationTime', Icon: Clock, ar: 'متوسط التسجيل', en: 'Avg Registration', color: '#0891B2', suffix: ' min' },
];

export default function DemoRegistration() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('التسجيل', 'Registration')}</h1>
        <p className="text-sm text-muted-foreground">{tr('تسجيل المرضى والتحقق من التأمين', 'Patient registration and insurance verification')}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
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
              <AnimatedCounter target={DEMO_REGISTRATION_STATS[m.key as keyof typeof DEMO_REGISTRATION_STATS]} suffix={m.suffix || ''} duration={1} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Sample registration form preview */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease }}
        className="p-5 rounded-xl border border-border bg-card"
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">{tr('نموذج التسجيل', 'Registration Form')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { ar: 'الاسم الكامل', en: 'Full Name', placeholder: tr('محمد أحمد الشمري', 'Mohammed A. Al-Shamri') },
            { ar: 'رقم الهوية', en: 'National ID', placeholder: '1234567890' },
            { ar: 'تاريخ الميلاد', en: 'Date of Birth', placeholder: '1991-05-15' },
            { ar: 'رقم الجوال', en: 'Phone Number', placeholder: '+966 551234567' },
            { ar: 'الجنسية', en: 'Nationality', placeholder: tr('سعودي', 'Saudi') },
            { ar: 'فصيلة الدم', en: 'Blood Type', placeholder: 'A+' },
            { ar: 'شركة التأمين', en: 'Insurance Company', placeholder: tr('بوبا', 'Bupa') },
            { ar: 'رقم البوليصة', en: 'Policy Number', placeholder: 'INS-2026-001' },
          ].map((field, i) => (
            <div key={i}>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">{tr(field.ar, field.en)}</label>
              <div className="h-9 px-3 rounded-lg border border-border bg-muted/50 flex items-center text-sm text-muted-foreground">
                {field.placeholder}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium flex items-center">
            {tr('تسجيل', 'Register')}
          </div>
          <div className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground flex items-center">
            {tr('إلغاء', 'Cancel')}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
