'use client';

import { useLang } from '@/hooks/use-lang';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface AssetDetail {
  id: string;
  assetTag: string;
  assetName?: string;
  assetNameAr?: string;
  assetCategory: string;
  status: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  criticalityLevel?: string;
  currentBookValue?: number | string;
  purchaseDate?: string;
  purchasePrice?: number | string;
  warrantyExpiry?: string;
  location?: string;
  department?: string;
  assignedTo?: string;
  notes?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  depreciationMethod?: string;
  usefulLifeYears?: number;
  salvageValue?: number | string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface AssetDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetDetail | null;
  onEdit?: (asset: AssetDetail) => void;
  onDelete?: () => void;
}

export function AssetDetailSheet({
  open,
  onOpenChange,
  asset,
  onEdit,
  onDelete,
}: AssetDetailSheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [deleting, setDeleting] = useState(false);

  const formatCurrency = (val: number | string | undefined | null) => {
    if (val == null || val === '') return '---';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(n)) return '---';
    return new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
    }).format(n);
  };

  const formatDate = (d?: string) => {
    if (!d) return '---';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    IN_SERVICE: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: tr('في الخدمة', 'In Service') },
    OUT_OF_SERVICE: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: tr('خارج الخدمة', 'Out of Service') },
    UNDER_MAINTENANCE: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: tr('تحت الصيانة', 'Under Maintenance') },
    CALIBRATION_DUE: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: tr('معايرة مستحقة', 'Calibration Due') },
    CONDEMNED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('محكوم عليه', 'Condemned') },
    DISPOSED: { color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400', label: tr('تم التخلص', 'Disposed') },
    IN_STORAGE: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: tr('في المخزن', 'In Storage') },
    TRANSFERRED: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', label: tr('محول', 'Transferred') },
  };

  const handleDelete = async () => {
    if (!asset) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/imdad/assets/register/${asset.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        onOpenChange(false);
        onDelete?.();
      }
    } catch (err) {
      console.error(err);
    }
    setDeleting(false);
  };

  if (!asset) return null;

  const sc = statusConfig[asset.status] || { color: 'bg-gray-100 text-gray-800', label: asset.status };

  const fields: Array<{ labelAr: string; labelEn: string; value: string }> = [
    { labelAr: 'رمز الأصل', labelEn: 'Asset Tag', value: asset.assetTag },
    { labelAr: 'اسم الأصل', labelEn: 'Asset Name', value: asset.assetName || '---' },
    { labelAr: 'اسم الأصل بالعربية', labelEn: 'Asset Name (AR)', value: asset.assetNameAr || '---' },
    { labelAr: 'الفئة', labelEn: 'Category', value: asset.assetCategory },
    { labelAr: 'الرقم التسلسلي', labelEn: 'Serial Number', value: asset.serialNumber || '---' },
    { labelAr: 'الشركة المصنعة', labelEn: 'Manufacturer', value: asset.manufacturer || '---' },
    { labelAr: 'الموديل', labelEn: 'Model', value: asset.model || '---' },
    { labelAr: 'مستوى الأهمية', labelEn: 'Criticality', value: asset.criticalityLevel || '---' },
    { labelAr: 'سعر الشراء', labelEn: 'Purchase Price', value: formatCurrency(asset.purchasePrice) },
    { labelAr: 'القيمة الدفترية', labelEn: 'Book Value', value: formatCurrency(asset.currentBookValue) },
    { labelAr: 'تاريخ الشراء', labelEn: 'Purchase Date', value: formatDate(asset.purchaseDate) },
    { labelAr: 'انتهاء الضمان', labelEn: 'Warranty Expiry', value: formatDate(asset.warrantyExpiry) },
    { labelAr: 'الموقع', labelEn: 'Location', value: asset.location || '---' },
    { labelAr: 'القسم', labelEn: 'Department', value: asset.department || '---' },
    { labelAr: 'المسؤول', labelEn: 'Assigned To', value: asset.assignedTo || '---' },
    { labelAr: 'آخر صيانة', labelEn: 'Last Maintenance', value: formatDate(asset.lastMaintenanceDate) },
    { labelAr: 'الصيانة القادمة', labelEn: 'Next Maintenance', value: formatDate(asset.nextMaintenanceDate) },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={language === 'ar' ? 'left' : 'right'} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{asset.assetTag}</span>
            <Badge className={sc.color}>{sc.label}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {fields.map((f) => (
            <div key={f.labelEn} className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr(f.labelAr, f.labelEn)}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{f.value}</span>
            </div>
          ))}

          {asset.notes && (
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr('ملاحظات', 'Notes')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{asset.notes}</p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            {onEdit && (
              <Button variant="outline" onClick={() => onEdit(asset)}>
                <Pencil className="h-4 w-4 me-2" />
                {tr('تعديل', 'Edit')}
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 me-2" />
              {deleting ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
