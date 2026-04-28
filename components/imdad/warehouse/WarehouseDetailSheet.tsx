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
import { Pencil, Trash2 } from 'lucide-react';

interface WarehouseDetailSheetProps {
  warehouseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (warehouse: any) => void;
  onDeleted?: () => void;
}

export function WarehouseDetailSheet({
  warehouseId,
  open,
  onOpenChange,
  onEdit,
  onDeleted,
}: WarehouseDetailSheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!warehouseId || !open) return;
    setLoading(true);
    fetch(`/api/imdad/warehouse/warehouses/${warehouseId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json) setData(json.data || json); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [warehouseId, open]);

  const handleDelete = async () => {
    if (!warehouseId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/imdad/warehouse/warehouses/${warehouseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        onOpenChange(false);
        onDeleted?.();
      }
    } catch (err) {
      console.error(err);
    }
    setDeleting(false);
  };

  const facilityLabel = (t: string) => {
    const map: Record<string, string> = {
      CENTRAL: tr('مركزي', 'Central'),
      SATELLITE: tr('فرعي', 'Satellite'),
      DISTRIBUTION: tr('توزيع', 'Distribution'),
      PHARMACY: tr('صيدلية', 'Pharmacy'),
    };
    return map[t] || t;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={language === 'ar' ? 'left' : 'right'} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {loading ? tr('جاري التحميل...', 'Loading...') : data?.warehouseCode || '---'}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">{tr('جاري التحميل...', 'Loading...')}</div>
        ) : data ? (
          <div className="mt-6 space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="mb-4">
              <Badge className={data.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}>
                {data.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
              </Badge>
            </div>

            {[
              { labelAr: 'الرمز', labelEn: 'Code', value: data.warehouseCode },
              { labelAr: 'الاسم', labelEn: 'Name', value: language === 'ar' && data.warehouseNameAr ? data.warehouseNameAr : data.warehouseName },
              { labelAr: 'النوع', labelEn: 'Type', value: facilityLabel(data.facilityType) },
              { labelAr: 'المدينة', labelEn: 'City', value: data.city || '---' },
              { labelAr: 'العنوان', labelEn: 'Address', value: data.address || '---' },
              { labelAr: 'إجمالي الصناديق', labelEn: 'Total Bins', value: String(data.totalBins ?? 0) },
              { labelAr: 'الصناديق المستخدمة', labelEn: 'Used Bins', value: String(data.usedBins ?? 0) },
              { labelAr: 'تحكم بدرجة الحرارة', labelEn: 'Temp. Controlled', value: data.temperatureControlled ? tr('نعم', 'Yes') : tr('لا', 'No') },
            ].map((f) => (
              <div key={f.labelEn} className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{tr(f.labelAr, f.labelEn)}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{f.value}</span>
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              {onEdit && (
                <Button variant="outline" onClick={() => onEdit(data)}>
                  <Pencil className="h-4 w-4 me-2" />
                  {tr('تعديل', 'Edit')}
                </Button>
              )}
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="h-4 w-4 me-2" />
                {deleting ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-gray-500">{tr('لا توجد بيانات', 'No data')}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
