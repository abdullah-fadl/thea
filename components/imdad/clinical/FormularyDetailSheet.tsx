'use client';

import { useLang } from '@/hooks/use-lang';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

interface FormularyDetailSheetProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function FormularyDetailSheet({ item, open, onOpenChange, onUpdated }: FormularyDetailSheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  if (!item) return null;

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      RESTRICTED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      NON_FORMULARY: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      DISCONTINUED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      PENDING_REVIEW: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    };
    return map[s] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (d?: string) => {
    if (!d) return '---';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const boolLabel = (v: boolean | undefined) =>
    v ? tr('نعم', 'Yes') : tr('لا', 'No');

  const fields = [
    { labelAr: 'رمز الصنف', labelEn: 'Item Code', value: item.itemCode },
    { labelAr: 'اسم الصنف', labelEn: 'Item Name', value: item.itemName || '---' },
    { labelAr: 'الاسم العلمي', labelEn: 'Generic Name', value: language === 'ar' && item.genericNameAr ? item.genericNameAr : item.genericName || '---' },
    { labelAr: 'الفئة العلاجية', labelEn: 'Therapeutic Class', value: item.therapeuticClass || '---' },
    { labelAr: 'فئة القائمة', labelEn: 'Category', value: item.formularyCategory || '---' },
    { labelAr: 'خاضع للرقابة', labelEn: 'Controlled', value: boolLabel(item.isControlled) },
    { labelAr: 'تغطية التأمين', labelEn: 'Insurance Covered', value: boolLabel(item.insuranceCovered) },
    { labelAr: 'يتطلب موافقة', labelEn: 'Requires Approval', value: boolLabel(item.requiresApproval) },
    { labelAr: 'مستوى الموافقة', labelEn: 'Approval Level', value: item.approvalLevel || '---' },
    { labelAr: 'الجرعة اليومية القصوى', labelEn: 'Max Daily Dose', value: item.maxDailyDose || '---' },
    { labelAr: 'أقصى كمية طلب', labelEn: 'Max Order Qty', value: item.maxOrderQty || '---' },
    { labelAr: 'سعر الوحدة', labelEn: 'Unit Price', value: item.unitPrice ? `${Number(item.unitPrice).toFixed(2)} SAR` : '---' },
    { labelAr: 'آخر مراجعة', labelEn: 'Last Review', value: formatDate(item.lastReviewDate) },
    { labelAr: 'المراجعة القادمة', labelEn: 'Next Review', value: formatDate(item.nextReviewDate) },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={language === 'ar' ? 'left' : 'right'} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{item.itemCode}</span>
            <Badge className={statusColor(item.formularyStatus)}>
              {item.formularyStatus?.replace(/_/g, ' ')}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {fields.map((f) => (
            <div key={f.labelEn} className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr(f.labelAr, f.labelEn)}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{f.value}</span>
            </div>
          ))}

          {item.indications && (
            <div className="pt-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr('دواعي الاستعمال', 'Indications')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{item.indications}</p>
            </div>
          )}

          {item.contraindications && (
            <div className="pt-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr('موانع الاستعمال', 'Contraindications')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{item.contraindications}</p>
            </div>
          )}

          {item.storageInstructions && (
            <div className="pt-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr('ظروف التخزين', 'Storage Instructions')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{item.storageInstructions}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
