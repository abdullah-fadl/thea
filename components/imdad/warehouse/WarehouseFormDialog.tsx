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

const FACILITY_TYPES = ['CENTRAL', 'SATELLITE', 'DISTRIBUTION', 'PHARMACY'] as const;

interface WarehouseFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: any;
  onSuccess?: () => void;
}

export function WarehouseFormDialog({ mode, open, onOpenChange, warehouse, onSuccess }: WarehouseFormDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    warehouseCode: '',
    warehouseName: '',
    warehouseNameAr: '',
    facilityType: 'CENTRAL',
    city: '',
    address: '',
    totalBins: '',
    isActive: true,
    temperatureControlled: false,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (warehouse && isEdit) {
      setForm({
        warehouseCode: warehouse.warehouseCode || '',
        warehouseName: warehouse.warehouseName || '',
        warehouseNameAr: warehouse.warehouseNameAr || '',
        facilityType: warehouse.facilityType || 'CENTRAL',
        city: warehouse.city || '',
        address: warehouse.address || '',
        totalBins: warehouse.totalBins?.toString() || '',
        isActive: warehouse.isActive !== false,
        temperatureControlled: warehouse.temperatureControlled || false,
        notes: warehouse.notes || '',
      });
    } else if (!isEdit) {
      setForm({
        warehouseCode: '', warehouseName: '', warehouseNameAr: '', facilityType: 'CENTRAL',
        city: '', address: '', totalBins: '', isActive: true, temperatureControlled: false, notes: '',
      });
    }
  }, [warehouse, isEdit, open]);

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/imdad/warehouse/warehouses/${warehouse.id}`
        : '/api/imdad/warehouse/warehouses';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = { ...form };
      if (body.totalBins) body.totalBins = parseInt(body.totalBins);
      if (isEdit && warehouse.version != null) body.version = warehouse.version;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tr('تعديل المستودع', 'Edit Warehouse') : tr('إضافة مستودع', 'Add Warehouse')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('الرمز', 'Code')}</Label>
              <Input value={form.warehouseCode} onChange={(e) => update('warehouseCode', e.target.value)} />
            </div>
            <div>
              <Label>{tr('النوع', 'Type')}</Label>
              <Select value={form.facilityType} onValueChange={(v) => update('facilityType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FACILITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{facilityLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('الاسم (EN)', 'Name (EN)')}</Label>
              <Input value={form.warehouseName} onChange={(e) => update('warehouseName', e.target.value)} />
            </div>
            <div>
              <Label>{tr('الاسم (AR)', 'Name (AR)')}</Label>
              <Input value={form.warehouseNameAr} onChange={(e) => update('warehouseNameAr', e.target.value)} dir="rtl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('المدينة', 'City')}</Label>
              <Input value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
            <div>
              <Label>{tr('إجمالي الصناديق', 'Total Bins')}</Label>
              <Input type="number" value={form.totalBins} onChange={(e) => update('totalBins', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{tr('العنوان', 'Address')}</Label>
            <Input value={form.address} onChange={(e) => update('address', e.target.value)} />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => update('isActive', e.target.checked)}
                className="rounded"
              />
              {tr('نشط', 'Active')}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.temperatureControlled}
                onChange={(e) => update('temperatureControlled', e.target.checked)}
                className="rounded"
              />
              {tr('تحكم بدرجة الحرارة', 'Temperature Controlled')}
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('إلغاء', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? tr('جاري الحفظ...', 'Saving...') : isEdit ? tr('تحديث', 'Update') : tr('إضافة', 'Add')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
