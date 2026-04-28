'use client';

import { useLang } from '@/hooks/use-lang';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface ItemDetailDrawerProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemDetailDrawer({ item, open, onOpenChange }: ItemDetailDrawerProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isRtl = language === 'ar';

  if (!item) return null;

  const onHand = item.onHand ?? item.quantityOnHand ?? 0;
  const available = item.available ?? item.quantityAvailable ?? 0;
  const reorder = item.reorderPoint ?? 10;
  const stockLevel = onHand <= 0 ? 'critical' : onHand <= reorder ? 'warning' : 'good';

  const statusColors = {
    critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
    warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    good: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  };
  const sc = statusColors[stockLevel];

  const fields = [
    { labelAr: 'الاسم', labelEn: 'Name', value: isRtl && item.nameAr ? item.nameAr : item.name || '---' },
    { labelAr: 'SKU', labelEn: 'SKU', value: item.sku || '---' },
    { labelAr: 'بالمخزن', labelEn: 'On Hand', value: String(onHand) },
    { labelAr: 'متاح', labelEn: 'Available', value: String(available) },
    { labelAr: 'نقطة إعادة الطلب', labelEn: 'Reorder Point', value: String(reorder) },
    { labelAr: 'الموقع', labelEn: 'Location', value: item.location ?? item.warehouseName ?? '---' },
    { labelAr: 'المورد', labelEn: 'Vendor', value: item.vendorName ?? '---' },
    { labelAr: 'آخر استلام', labelEn: 'Last Received', value: item.lastReceivedDate ? new Date(item.lastReceivedDate).toLocaleDateString() : '---' },
    { labelAr: 'وحدة القياس', labelEn: 'UOM', value: item.uom ?? '---' },
    { labelAr: 'تكلفة الوحدة', labelEn: 'Unit Cost', value: item.unitCost ? `${Number(item.unitCost).toFixed(2)} SAR` : '---' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRtl ? 'left' : 'right'}
        className="w-full sm:max-w-md bg-[#0a1628] border-white/10 text-white"
      >
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-3">
            <span>{isRtl && item.nameAr ? item.nameAr : item.name || 'Item'}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${sc.bg} ${sc.text} ${sc.border}`}>
              {stockLevel === 'critical' ? tr('حرج', 'Critical')
                : stockLevel === 'warning' ? tr('منخفض', 'Low')
                : tr('جيد', 'Good')}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
          {fields.map((f) => (
            <div key={f.labelEn} className="flex justify-between border-b border-white/[0.06] pb-2">
              <span className="text-sm text-white/40">{tr(f.labelAr, f.labelEn)}</span>
              <span className="text-sm font-medium text-white/80">{f.value}</span>
            </div>
          ))}

          {/* Stock level bar */}
          <div className="pt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/30">{tr('مستوى المخزون', 'Stock Level')}</span>
              <span className="text-xs text-white/50">{onHand} / {reorder * 3}</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((onHand / (reorder * 3)) * 100, 100)}%`,
                  backgroundColor: stockLevel === 'critical' ? '#ef4444' : stockLevel === 'warning' ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
