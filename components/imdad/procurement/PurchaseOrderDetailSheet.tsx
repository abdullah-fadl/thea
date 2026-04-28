'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/hooks/use-lang';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

interface PurchaseOrderDetailSheetProps {
  poId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (po: any) => void;
  onStatusChange?: () => void;
}

export default function PurchaseOrderDetailSheet({
  poId,
  open,
  onOpenChange,
  onEdit,
  onStatusChange,
}: PurchaseOrderDetailSheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!poId || !open) return;
    setLoading(true);
    fetch(`/api/imdad/procurement/purchase-orders/${poId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json) setPo(json.data || json); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [poId, open]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      RECEIVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      CLOSED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (d?: string) => {
    if (!d) return '---';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const formatCurrency = (val: number | undefined) => {
    if (val == null) return '---';
    return new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency', currency: po?.currency || 'SAR',
    }).format(val);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={language === 'ar' ? 'left' : 'right'} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {loading ? tr('جاري التحميل...', 'Loading...') : po?.poNumber || '---'}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">{tr('جاري التحميل...', 'Loading...')}</div>
        ) : po ? (
          <div className="mt-6 space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-2 mb-4">
              <Badge className={statusBadge(po.status)}>{po.status?.replace(/_/g, ' ')}</Badge>
            </div>

            {[
              { labelAr: 'رقم أمر الشراء', labelEn: 'PO Number', value: po.poNumber },
              { labelAr: 'المورد', labelEn: 'Vendor', value: po.vendor?.name || po.vendorName || '---' },
              { labelAr: 'المبلغ الإجمالي', labelEn: 'Total Amount', value: formatCurrency(po.totalAmount) },
              { labelAr: 'العملة', labelEn: 'Currency', value: po.currency || '---' },
              { labelAr: 'تاريخ الطلب', labelEn: 'Order Date', value: formatDate(po.orderDate || po.createdAt) },
              { labelAr: 'التسليم المتوقع', labelEn: 'Expected Delivery', value: formatDate(po.expectedDeliveryDate || po.expectedDelivery) },
            ].map((f) => (
              <div key={f.labelEn} className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{tr(f.labelAr, f.labelEn)}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{f.value}</span>
              </div>
            ))}

            {/* Lines */}
            {po.lines && po.lines.length > 0 && (
              <div className="pt-4">
                <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">
                  {tr('البنود', 'Lines')} ({po.lines.length})
                </h4>
                <div className="space-y-2">
                  {po.lines.map((line: any, i: number) => (
                    <div key={i} className="rounded-lg border p-2 text-sm dark:border-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">{line.itemName || line.description || `Line ${i + 1}`}</span>
                        <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(line.totalPrice || line.amount)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{tr('الكمية', 'Qty')}: {line.quantity ?? '---'}</span>
                        <span>{tr('سعر الوحدة', 'Unit')}: {formatCurrency(line.unitPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              {onEdit && (
                <Button variant="outline" onClick={() => onEdit(po)}>
                  <Pencil className="h-4 w-4 me-2" />
                  {tr('تعديل', 'Edit')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-gray-500">{tr('لا توجد بيانات', 'No data')}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
