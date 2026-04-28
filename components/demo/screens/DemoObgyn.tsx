'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_OBGYN_PATIENTS } from '@/lib/demo/mockData';
import { Baby, Heart, AlertTriangle, Shield } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const riskConfig: Record<string, { ar: string; en: string; color: string; bg: string; Icon: typeof Shield }> = {
  low: { ar: 'منخفض', en: 'Low', color: '#059669', bg: '#ECFDF5', Icon: Shield },
  moderate: { ar: 'متوسط', en: 'Moderate', color: '#D97706', bg: '#FFFBEB', Icon: AlertTriangle },
  high: { ar: 'عالي', en: 'High', color: '#DC2626', bg: '#FEE2E2', Icon: AlertTriangle },
};

export default function DemoObgyn() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('النساء والولادة', 'OB/GYN')}</h1>
        <p className="text-sm text-muted-foreground">{tr('متابعة الحمل والمرضى النسائية', 'Antenatal and gynecology care')}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { Icon: Baby, ar: 'متابعة حمل', en: 'Antenatal', count: DEMO_OBGYN_PATIENTS.filter(p => p.gestationalWeeks !== null).length, color: '#E11D48' },
          { Icon: Heart, ar: 'نسائية', en: 'Gynecology', count: DEMO_OBGYN_PATIENTS.filter(p => p.gestationalWeeks === null).length, color: '#7C3AED' },
          { Icon: AlertTriangle, ar: 'عالي الخطورة', en: 'High Risk', count: DEMO_OBGYN_PATIENTS.filter(p => p.riskLevel === 'high').length, color: '#DC2626' },
          { Icon: Shield, ar: 'في الولادة', en: 'In Labor', count: DEMO_OBGYN_PATIENTS.filter(p => p.statusEn === 'In Labor').length, color: '#D97706' },
        ].map((s, i) => (
          <motion.div
            key={s.en}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5, ease }}
            className="p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}14` }}>
                <s.Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              </div>
              <span className="text-[11px] text-muted-foreground">{tr(s.ar, s.en)}</span>
            </div>
            <div className="text-xl font-bold text-foreground">{s.count}</div>
          </motion.div>
        ))}
      </div>

      {/* Patients */}
      <div className="space-y-2">
        {DEMO_OBGYN_PATIENTS.map((p, i) => {
          const risk = riskConfig[p.riskLevel];
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease }}
              className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center gap-3 hover:border-pink-200 dark:hover:border-pink-800 transition-colors"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-950 flex items-center justify-center flex-shrink-0">
                {p.gestationalWeeks ? <Baby className="w-5 h-5 text-pink-600" /> : <Heart className="w-5 h-5 text-purple-600" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground truncate">{tr(p.nameAr, p.nameEn)}</span>
                  <span className="text-[10px] text-muted-foreground">{p.mrn} · {p.age}{tr('س', 'y')}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {tr(p.typeAr, p.typeEn)}
                  {p.gestationalWeeks && <> · {p.gestationalWeeks} {tr('أسبوع', 'weeks')}</>}
                  {' · '}{tr(p.doctorAr, p.doctorEn)}
                </div>
              </div>

              {/* Risk + Status */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: risk.bg, color: risk.color }}>
                  {tr(risk.ar, risk.en)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${p.statusColor}18`, color: p.statusColor }}>
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
