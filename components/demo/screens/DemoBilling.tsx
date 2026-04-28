'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_BILLING, DEMO_PATIENT_DETAIL } from '@/lib/demo/mockData';
import { Receipt, CreditCard, Building2 } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

export default function DemoBilling() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const subtotal = DEMO_BILLING.reduce((sum, item) => sum + item.total, 0);
  const tax = Math.round(subtotal * 0.15);
  const total = subtotal + tax;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('الفوترة', 'Billing')}</h1>
        <p className="text-sm text-muted-foreground">
          {tr(`فاتورة المريض: ${DEMO_PATIENT_DETAIL.nameAr}`, `Invoice for: ${DEMO_PATIENT_DETAIL.nameEn}`)}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { Icon: Receipt, ar: 'المجموع الفرعي', en: 'Subtotal', value: subtotal, color: '#1D4ED8' },
          { Icon: Building2, ar: 'ضريبة القيمة المضافة', en: 'VAT (15%)', value: tax, color: '#D97706' },
          { Icon: CreditCard, ar: 'الإجمالي', en: 'Total', value: total, color: '#059669' },
        ].map((card, i) => (
          <motion.div
            key={card.en}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease }}
            className="p-4 rounded-xl border border-border bg-card text-center"
          >
            <card.Icon className="w-5 h-5 mx-auto mb-2" style={{ color: card.color }} />
            <div className="text-lg font-bold text-foreground">{card.value.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{tr('ر.س', 'SAR')}</span></div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{tr(card.ar, card.en)}</div>
          </motion.div>
        ))}
      </div>

      {/* Invoice items */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_60px_80px_80px] gap-2 px-4 py-2.5 bg-muted/50 text-[11px] font-medium text-muted-foreground border-b border-border">
          <span>{tr('الوصف', 'Description')}</span>
          <span className="text-center">{tr('الكمية', 'Qty')}</span>
          <span className="text-center">{tr('سعر الوحدة', 'Unit Price')}</span>
          <span className="text-center">{tr('المجموع', 'Total')}</span>
        </div>

        {DEMO_BILLING.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease }}
            className="grid grid-cols-[1fr_60px_80px_80px] gap-2 px-4 py-3 border-b border-border last:border-b-0 items-center"
          >
            <div>
              <span className="text-sm font-medium text-foreground">{tr(item.descAr, item.descEn)}</span>
              <span className="text-[10px] text-muted-foreground ms-2">({tr(item.categoryAr, item.categoryEn)})</span>
            </div>
            <span className="text-sm text-center text-foreground">{item.qty}</span>
            <span className="text-sm text-center text-muted-foreground">{item.unitPrice}</span>
            <span className="text-sm text-center font-medium text-foreground">{item.total}</span>
          </motion.div>
        ))}

        {/* Totals */}
        <div className="px-4 py-3 bg-muted/30 border-t border-border space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{tr('المجموع الفرعي', 'Subtotal')}</span>
            <span className="text-foreground">{subtotal} {tr('ر.س', 'SAR')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{tr('ضريبة القيمة المضافة (15%)', 'VAT (15%)')}</span>
            <span className="text-foreground">{tax} {tr('ر.س', 'SAR')}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-border">
            <span className="text-foreground">{tr('الإجمالي', 'Total')}</span>
            <span style={{ color: '#059669' }}>{total} {tr('ر.س', 'SAR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
