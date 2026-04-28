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

interface GRNDetailSheetProps {
  grnId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

export default function GRNDetailSheet({ grnId, open, onOpenChange, onStatusChange }: GRNDetailSheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [grn, setGrn] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!grnId || !open) return;
    setLoading(true);
    fetch(`/api/imdad/procurement/grn/${grnId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json) setGrn(json.data || json); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [grnId, open]);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      PENDING_QC: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      RECEIVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      ACCEPTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return map[s] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (d?: string) => {
    if (!d) return '---';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={language === 'ar' ? 'left' : 'right'} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {loading ? tr('جاري التحميل...', 'Loading...') : grn?.grnNumber || '---'}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">{tr('جاري التحميل...', 'Loading...')}</div>
        ) : grn ? (
          <div className="mt-6 space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="mb-4">
              <Badge className={statusColor(grn.status)}>{grn.status?.replace(/_/g, ' ')}</Badge>
            </div>

            {[
              { labelAr: 'رقم الإذن', labelEn: 'GRN Number', value: grn.grnNumber },
              { labelAr: 'أمر الشراء', labelEn: 'PO Number', value: grn.purchaseOrder?.poNumber || '---' },
              { labelAr: 'حالة الجودة', labelEn: 'Quality Status', value: grn.qualityStatus || '---' },
              { labelAr: 'تاريخ الاستلام', labelEn: 'Received Date', value: formatDate(grn.receivedAt) },
              { labelAr: 'تاريخ الإنشاء', labelEn: 'Created', value: formatDate(grn.createdAt) },
              { labelAr: 'عدد البنود', labelEn: 'Lines', value: String(grn.lines?.length || 0) },
            ].map((f) => (
              <div key={f.labelEn} className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{tr(f.labelAr, f.labelEn)}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{f.value}</span>
              </div>
            ))}

            {grn.lines && grn.lines.length > 0 && (
              <div className="pt-4">
                <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">
                  {tr('البنود', 'Lines')}
                </h4>
                <div className="space-y-2">
                  {grn.lines.map((line: any, i: number) => (
                    <div key={i} className="rounded-lg border p-2 text-sm dark:border-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">{line.itemName || `Line ${i + 1}`}</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {tr('الكمية', 'Qty')}: {line.receivedQuantity ?? line.quantity ?? '---'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-gray-500">{tr('لا توجد بيانات', 'No data')}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
