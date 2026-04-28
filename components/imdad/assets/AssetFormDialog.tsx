'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/hooks/use-lang';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS = ['IN_SERVICE', 'OUT_OF_SERVICE', 'UNDER_MAINTENANCE', 'CALIBRATION_DUE', 'CONDEMNED', 'DISPOSED', 'IN_STORAGE', 'TRANSFERRED'] as const;
const CATEGORY_OPTIONS = ['MEDICAL_EQUIPMENT', 'IT_EQUIPMENT', 'FURNITURE', 'VEHICLE', 'BUILDING', 'INSTRUMENT', 'OTHER'] as const;
const CRITICALITY_OPTIONS = ['HIGH', 'MEDIUM', 'LOW'] as const;

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: any;
  onSuccess?: () => void;
}

export function AssetFormDialog({ open, onOpenChange, asset, onSuccess }: AssetFormDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isEdit = !!asset;

  const [form, setForm] = useState({
    assetTag: '',
    assetName: '',
    assetNameAr: '',
    assetCategory: 'MEDICAL_EQUIPMENT',
    status: 'IN_SERVICE',
    serialNumber: '',
    manufacturer: '',
    model: '',
    criticalityLevel: 'MEDIUM',
    purchasePrice: '',
    purchaseDate: '',
    warrantyExpiry: '',
    location: '',
    department: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (asset) {
      setForm({
        assetTag: asset.assetTag || '',
        assetName: asset.assetName || '',
        assetNameAr: asset.assetNameAr || '',
        assetCategory: asset.assetCategory || 'MEDICAL_EQUIPMENT',
        status: asset.status || 'IN_SERVICE',
        serialNumber: asset.serialNumber || '',
        manufacturer: asset.manufacturer || '',
        model: asset.model || '',
        criticalityLevel: asset.criticalityLevel || 'MEDIUM',
        purchasePrice: asset.purchasePrice?.toString() || '',
        purchaseDate: asset.purchaseDate?.split('T')[0] || '',
        warrantyExpiry: asset.warrantyExpiry?.split('T')[0] || '',
        location: asset.location || '',
        department: asset.department || '',
        notes: asset.notes || '',
      });
    } else {
      setForm({
        assetTag: '',
        assetName: '',
        assetNameAr: '',
        assetCategory: 'MEDICAL_EQUIPMENT',
        status: 'IN_SERVICE',
        serialNumber: '',
        manufacturer: '',
        model: '',
        criticalityLevel: 'MEDIUM',
        purchasePrice: '',
        purchaseDate: '',
        warrantyExpiry: '',
        location: '',
        department: '',
        notes: '',
      });
    }
  }, [asset, open]);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/imdad/assets/register/${asset.id}`
        : '/api/imdad/assets/register';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = { ...form };
      if (body.purchasePrice) body.purchasePrice = parseFloat(body.purchasePrice);
      if (isEdit && asset.version != null) body.version = asset.version;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      if (res.ok) {
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const categoryLabel = (c: string) => {
    const map: Record<string, string> = {
      MEDICAL_EQUIPMENT: tr('معدات طبية', 'Medical Equipment'),
      IT_EQUIPMENT: tr('معدات تقنية', 'IT Equipment'),
      FURNITURE: tr('أثاث', 'Furniture'),
      VEHICLE: tr('مركبة', 'Vehicle'),
      BUILDING: tr('مبنى', 'Building'),
      INSTRUMENT: tr('أداة', 'Instrument'),
      OTHER: tr('أخرى', 'Other'),
    };
    return map[c] || c;
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      IN_SERVICE: tr('في الخدمة', 'In Service'),
      OUT_OF_SERVICE: tr('خارج الخدمة', 'Out of Service'),
      UNDER_MAINTENANCE: tr('تحت الصيانة', 'Under Maintenance'),
      CALIBRATION_DUE: tr('معايرة مستحقة', 'Calibration Due'),
      CONDEMNED: tr('محكوم عليه', 'Condemned'),
      DISPOSED: tr('تم التخلص', 'Disposed'),
      IN_STORAGE: tr('في المخزن', 'In Storage'),
      TRANSFERRED: tr('محول', 'Transferred'),
    };
    return map[s] || s;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tr('تعديل الأصل', 'Edit Asset') : tr('تسجيل أصل جديد', 'Register New Asset')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('رمز الأصل', 'Asset Tag')}</Label>
              <Input value={form.assetTag} onChange={(e) => update('assetTag', e.target.value)} />
            </div>
            <div>
              <Label>{tr('الرقم التسلسلي', 'Serial Number')}</Label>
              <Input value={form.serialNumber} onChange={(e) => update('serialNumber', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('اسم الأصل (EN)', 'Asset Name (EN)')}</Label>
              <Input value={form.assetName} onChange={(e) => update('assetName', e.target.value)} />
            </div>
            <div>
              <Label>{tr('اسم الأصل (AR)', 'Asset Name (AR)')}</Label>
              <Input value={form.assetNameAr} onChange={(e) => update('assetNameAr', e.target.value)} dir="rtl" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{tr('الفئة', 'Category')}</Label>
              <Select value={form.assetCategory} onValueChange={(v) => update('assetCategory', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('الحالة', 'Status')}</Label>
              <Select value={form.status} onValueChange={(v) => update('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('الأهمية', 'Criticality')}</Label>
              <Select value={form.criticalityLevel} onValueChange={(v) => update('criticalityLevel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRITICALITY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('الشركة المصنعة', 'Manufacturer')}</Label>
              <Input value={form.manufacturer} onChange={(e) => update('manufacturer', e.target.value)} />
            </div>
            <div>
              <Label>{tr('الموديل', 'Model')}</Label>
              <Input value={form.model} onChange={(e) => update('model', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{tr('سعر الشراء', 'Purchase Price')}</Label>
              <Input type="number" value={form.purchasePrice} onChange={(e) => update('purchasePrice', e.target.value)} />
            </div>
            <div>
              <Label>{tr('تاريخ الشراء', 'Purchase Date')}</Label>
              <Input type="date" value={form.purchaseDate} onChange={(e) => update('purchaseDate', e.target.value)} />
            </div>
            <div>
              <Label>{tr('انتهاء الضمان', 'Warranty Expiry')}</Label>
              <Input type="date" value={form.warrantyExpiry} onChange={(e) => update('warrantyExpiry', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('الموقع', 'Location')}</Label>
              <Input value={form.location} onChange={(e) => update('location', e.target.value)} />
            </div>
            <div>
              <Label>{tr('القسم', 'Department')}</Label>
              <Input value={form.department} onChange={(e) => update('department', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{tr('ملاحظات', 'Notes')}</Label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('إلغاء', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? tr('جاري الحفظ...', 'Saving...')
              : isEdit
                ? tr('تحديث', 'Update')
                : tr('تسجيل', 'Register')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
