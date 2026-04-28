'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import { DEMO_ORDERS } from '@/lib/demo/mockData';
import { FlaskConical, Scan, Pill, Stethoscope, ClipboardList } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const typeIcons: Record<string, typeof FlaskConical> = {
  Lab: FlaskConical,
  Radiology: Scan,
  Medication: Pill,
  Consult: Stethoscope,
};

export default function DemoOrders() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{tr('الطلبات', 'Orders')}</h1>
        <p className="text-sm text-muted-foreground">{tr('طلبات المريض الحالية', 'Current patient orders')}</p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
          {tr('الكل', 'All')}: {DEMO_ORDERS.length}
        </div>
        <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
          {tr('مكتمل', 'Completed')}: {DEMO_ORDERS.filter(o => o.statusEn === 'Completed' || o.statusEn === 'Dispensed').length}
        </div>
        <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
          {tr('قيد التنفيذ', 'Pending')}: {DEMO_ORDERS.filter(o => o.statusEn !== 'Completed' && o.statusEn !== 'Dispensed').length}
        </div>
      </div>

      {/* Order list */}
      <div className="space-y-2">
        {DEMO_ORDERS.map((order, i) => {
          const Icon = typeIcons[order.typeEn] || ClipboardList;
          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease }}
              className="p-4 rounded-xl border border-border bg-card flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {tr(order.descriptionAr, order.descriptionEn)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {order.id} · {tr(order.typeAr, order.typeEn)}
                  {order.priority !== 'routine' && (
                    <span className="ms-1 text-red-600 dark:text-red-400 font-medium">
                      ({tr(order.priority === 'urgent' ? 'عاجل' : 'فوري', order.priority.toUpperCase())})
                    </span>
                  )}
                </div>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-medium flex-shrink-0"
                style={{ background: `${order.statusColor}14`, color: order.statusColor }}
              >
                {tr(order.statusAr, order.statusEn)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
