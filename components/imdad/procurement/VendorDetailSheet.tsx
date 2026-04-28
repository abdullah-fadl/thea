'use client';

import { useLang } from '@/hooks/use-lang';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

interface VendorDetailSheetProps {
  vendor: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export function VendorDetailSheet({ vendor, open, onOpenChange, onRefresh }: VendorDetailSheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  if (!vendor) return null;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      CONDITIONAL: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      BLACKLISTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const fields = [
    { labelAr: 'الرمز', labelEn: 'Code', value: vendor.code },
    { labelAr: 'الاسم', labelEn: 'Name', value: language === 'ar' && vendor.nameAr ? vendor.nameAr : vendor.name },
    { labelAr: 'الدولة', labelEn: 'Country', value: vendor.country || '---' },
    { labelAr: 'المدينة', labelEn: 'City', value: vendor.city || '---' },
    { labelAr: 'النوع', labelEn: 'Type', value: vendor.type || vendor.vendorType || '---' },
    { labelAr: 'المستوى', labelEn: 'Tier', value: vendor.tier || vendor.vendorTier || '---' },
    { labelAr: 'شروط الدفع', labelEn: 'Payment Terms', value: vendor.paymentTerms || '---' },
    { labelAr: 'اسم المسؤول', labelEn: 'Contact', value: vendor.contactName || '---' },
    { labelAr: 'البريد الإلكتروني', labelEn: 'Email', value: vendor.contactEmail || vendor.email || '---' },
    { labelAr: 'الهاتف', labelEn: 'Phone', value: vendor.contactPhone || vendor.phone || '---' },
    { labelAr: 'السجل التجاري', labelEn: 'CR Number', value: vendor.crNumber || '---' },
    { labelAr: 'الرقم الضريبي', labelEn: 'VAT', value: vendor.vatNumber || '---' },
    { labelAr: 'IBAN', labelEn: 'IBAN', value: vendor.iban || '---' },
    { labelAr: 'الموقع', labelEn: 'Website', value: vendor.website || '---' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={language === 'ar' ? 'left' : 'right'} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{vendor.code}</span>
            <Badge className={statusBadge(vendor.status)}>{vendor.status?.replace(/_/g, ' ')}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {fields.map((f) => (
            <div key={f.labelEn} className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr(f.labelAr, f.labelEn)}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{f.value}</span>
            </div>
          ))}

          {vendor.notes && (
            <div className="pt-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr('ملاحظات', 'Notes')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{vendor.notes}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
