'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_POLICIES } from '@/lib/demo/mockData';
import { FileText, Calendar, CheckCircle2, AlertCircle, PenSquare, Shield } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const statusIcons: Record<string, typeof CheckCircle2> = {
  Active: CheckCircle2,
  'Under Review': AlertCircle,
  Draft: PenSquare,
};

export default function DemoSAM() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const active = DEMO_POLICIES.filter(p => p.statusEn === 'Active').length;
  const review = DEMO_POLICIES.filter(p => p.statusEn === 'Under Review').length;
  const draft = DEMO_POLICIES.filter(p => p.statusEn === 'Draft').length;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('إدارة السياسات', 'Policy Management (SAM)')}</h1>
        <p className="text-sm text-muted-foreground">{tr('السياسات والبروتوكولات الطبية', 'Medical policies and protocols')}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: tr('نشط', 'Active'), count: active, color: '#059669', Icon: CheckCircle2 },
          { label: tr('قيد المراجعة', 'Under Review'), count: review, color: '#D97706', Icon: AlertCircle },
          { label: tr('مسودة', 'Draft'), count: draft, color: '#7C3AED', Icon: PenSquare },
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

      {/* Policies */}
      <div className="space-y-2">
        {DEMO_POLICIES.map((pol, i) => (
          <motion.div
            key={pol.id}
            initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease }}
            className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center gap-3 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
          >
            {/* Icon */}
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-foreground">{tr(pol.titleAr, pol.titleEn)}</span>
                <span className="text-[10px] text-muted-foreground">{tr(pol.versionAr, pol.versionEn)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {tr(pol.categoryAr, pol.categoryEn)}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {tr('آخر مراجعة', 'Last Review')}: {pol.lastReview}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {tr('المراجعة القادمة', 'Next Review')}: {pol.nextReview}
                </span>
              </div>
            </div>

            {/* Status */}
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium flex-shrink-0" style={{ background: `${pol.statusColor}18`, color: pol.statusColor }}>
              {tr(pol.statusAr, pol.statusEn)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
