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

interface InspectionDetailSheetProps {
  inspectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (inspection: any) => void;
  onStatusChange?: () => void;
}

export default function InspectionDetailSheet({
  inspectionId,
  open,
  onOpenChange,
  onEdit,
  onStatusChange,
}: InspectionDetailSheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inspectionId || !open) return;
    setLoading(true);
    fetch(`/api/imdad/quality/inspections/${inspectionId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json) setData(json.data || json); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [inspectionId, open]);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      PASSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      SCHEDULED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      CONDITIONAL_PASS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      ON_HOLD: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    };
    return map[s] || 'bg-gray-100 text-gray-800';
  };

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      INCOMING: tr('وارد', 'Incoming'),
      IN_PROCESS: tr('أثناء العملية', 'In-Process'),
      OUTGOING: tr('صادر', 'Outgoing'),
      RANDOM: tr('عشوائي', 'Random'),
      COMPLAINT_DRIVEN: tr('شكوى', 'Complaint-Driven'),
      PERIODIC: tr('دوري', 'Periodic'),
      RECALL: tr('استرجاع', 'Recall'),
    };
    return map[t] || t;
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
            {loading ? tr('جاري التحميل...', 'Loading...') : data?.inspectionNumber || '---'}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">{tr('جاري التحميل...', 'Loading...')}</div>
        ) : data ? (
          <div className="mt-6 space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex gap-2 mb-4">
              <Badge className={statusColor(data.status)}>{data.status?.replace(/_/g, ' ')}</Badge>
              {data.overallResult && (
                <Badge variant="outline">{data.overallResult}</Badge>
              )}
            </div>

            {[
              { labelAr: 'رقم الفحص', labelEn: 'Inspection #', value: data.inspectionNumber },
              { labelAr: 'النوع', labelEn: 'Type', value: typeLabel(data.inspectionType) },
              { labelAr: 'نوع المرجع', labelEn: 'Ref. Type', value: data.referenceType || '---' },
              { labelAr: 'رقم المرجع', labelEn: 'Ref. Number', value: data.referenceNumber || '---' },
              { labelAr: 'الصنف', labelEn: 'Item', value: data.itemName || '---' },
              { labelAr: 'الفاحص', labelEn: 'Inspector', value: data.inspectorName || '---' },
              { labelAr: 'التاريخ المجدول', labelEn: 'Scheduled', value: formatDate(data.scheduledDate) },
              { labelAr: 'تاريخ الإنشاء', labelEn: 'Created', value: formatDate(data.createdAt) },
            ].map((f) => (
              <div key={f.labelEn} className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{tr(f.labelAr, f.labelEn)}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{f.value}</span>
              </div>
            ))}

            {/* Checklist items if present */}
            {data.checklistItems && data.checklistItems.length > 0 && (
              <div className="pt-4">
                <h4 className="text-sm font-semibold mb-2">{tr('قائمة الفحص', 'Checklist')}</h4>
                <div className="space-y-1">
                  {data.checklistItems.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={`w-2 h-2 rounded-full ${item.passed ? 'bg-green-500' : item.passed === false ? 'bg-red-500' : 'bg-gray-300'}`} />
                      <span className="text-gray-700 dark:text-gray-300">{item.description || item.name || `Item ${i + 1}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              {onEdit && (
                <Button variant="outline" onClick={() => onEdit(data)}>
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
