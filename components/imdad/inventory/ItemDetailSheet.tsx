'use client';

import { useLang } from '@/hooks/use-lang';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

interface ItemDetailSheetProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function ItemDetailSheet({ item, open, onOpenChange, onUpdated }: ItemDetailSheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  if (!item) return null;

  const statusBadgeColor = (s: string) => {
    switch (s) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'INACTIVE': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'DISCONTINUED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: tr('نشط', 'Active'),
      INACTIVE: tr('غير نشط', 'Inactive'),
      DISCONTINUED: tr('متوقف', 'Discontinued'),
      PENDING_APPROVAL: tr('بانتظار الموافقة', 'Pending Approval'),
    };
    return map[s] || s;
  };

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      PHARMACEUTICAL: tr('أدوية', 'Pharmaceutical'),
      MEDICAL_SUPPLY: tr('مستلزمات طبية', 'Medical Supply'),
      EQUIPMENT: tr('أجهزة', 'Equipment'),
      CONSUMABLE: tr('مواد استهلاكية', 'Consumable'),
      REAGENT: tr('كواشف', 'Reagent'),
      IMPLANT: tr('زراعات', 'Implant'),
      OTHER: tr('أخرى', 'Other'),
    };
    return map[t] || t;
  };

  const fields = [
    { labelAr: 'الرمز', labelEn: 'Code', value: item.code },
    { labelAr: 'الاسم', labelEn: 'Name', value: language === 'ar' && item.nameAr ? item.nameAr : item.name },
    { labelAr: 'النوع', labelEn: 'Type', value: typeLabel(item.itemType) },
    { labelAr: 'الفئة', labelEn: 'Category', value: item.category || '---' },
    { labelAr: 'وحدة القياس', labelEn: 'UOM', value: item.uom || '---' },
    { labelAr: 'تكلفة الوحدة', labelEn: 'Unit Cost', value: item.standardCost != null ? `${Number(item.standardCost).toFixed(2)} SAR` : '---' },
    { labelAr: 'نقطة إعادة الطلب', labelEn: 'Reorder Point', value: item.reorderPoint ?? '---' },
    { labelAr: 'كمية إعادة الطلب', labelEn: 'Reorder Qty', value: item.reorderQuantity ?? '---' },
    { labelAr: 'ظروف التخزين', labelEn: 'Storage', value: item.storageConditions || '---' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={language === 'ar' ? 'left' : 'right'} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{item.code}</span>
            <Badge className={statusBadgeColor(item.status)}>{statusLabel(item.status)}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {fields.map((f) => (
            <div key={f.labelEn} className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr(f.labelAr, f.labelEn)}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{String(f.value)}</span>
            </div>
          ))}

          {item.description && (
            <div className="pt-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr('الوصف', 'Description')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                {language === 'ar' && item.descriptionAr ? item.descriptionAr : item.description}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
