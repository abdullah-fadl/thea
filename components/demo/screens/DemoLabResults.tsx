'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_LAB_RESULTS } from '@/lib/demo/mockData';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const statusDisplay: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  normal: { ar: 'طبيعي', en: 'Normal', color: '#059669', bg: '#ECFDF5' },
  high: { ar: 'مرتفع', en: 'High', color: '#EF4444', bg: '#FEF2F2' },
  low: { ar: 'منخفض', en: 'Low', color: '#D97706', bg: '#FFFBEB' },
  critical: { ar: 'حرج', en: 'Critical', color: '#DC2626', bg: '#FEE2E2' },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 24;
  const w = 60;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DemoLabResults() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('نتائج المختبر', 'Lab Results')}</h1>
        <p className="text-sm text-muted-foreground">{tr('آخر نتائج الفحوصات المخبرية', 'Latest laboratory test results')}</p>
      </div>

      {/* Results table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_60px_80px_60px_80px] gap-2 px-4 py-2.5 bg-muted/50 text-[11px] font-medium text-muted-foreground border-b border-border">
          <span>{tr('الفحص', 'Test')}</span>
          <span className="text-center">{tr('النتيجة', 'Result')}</span>
          <span className="text-center">{tr('الوحدة', 'Unit')}</span>
          <span className="text-center">{tr('المرجعي', 'Reference')}</span>
          <span className="text-center">{tr('الاتجاه', 'Trend')}</span>
          <span className="text-center">{tr('الحالة', 'Status')}</span>
        </div>

        {/* Rows */}
        {DEMO_LAB_RESULTS.map((result, i) => {
          const st = statusDisplay[result.status];
          return (
            <motion.div
              key={result.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease }}
              className="grid grid-cols-[1fr_80px_60px_80px_60px_80px] gap-2 px-4 py-3 border-b border-border last:border-b-0 items-center hover:bg-muted/30 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{tr(result.testAr, result.testEn)}</span>
              <span className={`text-sm text-center font-semibold ${result.status !== 'normal' ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                {result.value}
              </span>
              <span className="text-[11px] text-muted-foreground text-center">{result.unit}</span>
              <span className="text-[11px] text-muted-foreground text-center">{result.refRange}</span>
              <div className="flex justify-center">
                <MiniSparkline data={result.sparkData} color={st.color} />
              </div>
              <div className="flex justify-center">
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
