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

const TYPE_OPTIONS = ['PHARMACEUTICAL', 'MEDICAL_SUPPLY', 'EQUIPMENT', 'CONSUMABLE', 'REAGENT', 'IMPLANT', 'OTHER'] as const;

interface ItemFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
  onSuccess?: () => void;
}

export function ItemFormDialog({ mode, open, onOpenChange, item, onSuccess }: ItemFormDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    code: '',
    name: '',
    nameAr: '',
    itemType: 'CONSUMABLE',
    category: '',
    uom: 'EA',
    standardCost: '',
    description: '',
    descriptionAr: '',
    reorderPoint: '',
    reorderQuantity: '',
    storageConditions: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item && isEdit) {
      setForm({
        code: item.code || '',
        name: item.name || '',
        nameAr: item.nameAr || '',
        itemType: item.itemType || 'CONSUMABLE',
        category: item.category || '',
        uom: item.uom || 'EA',
        standardCost: item.standardCost?.toString() || '',
        description: item.description || '',
        descriptionAr: item.descriptionAr || '',
        reorderPoint: item.reorderPoint?.toString() || '',
        reorderQuantity: item.reorderQuantity?.toString() || '',
        storageConditions: item.storageConditions || '',
      });
    } else if (!isEdit) {
      setForm({
        code: '',
        name: '',
        nameAr: '',
        itemType: 'CONSUMABLE',
        category: '',
        uom: 'EA',
        standardCost: '',
        description: '',
        descriptionAr: '',
        reorderPoint: '',
        reorderQuantity: '',
        storageConditions: '',
      });
    }
  }, [item, isEdit, open]);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = isEdit ? `/api/imdad/inventory/items/${item.id}` : '/api/imdad/inventory/items';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = { ...form };
      if (body.standardCost) body.standardCost = parseFloat(body.standardCost);
      if (body.reorderPoint) body.reorderPoint = parseInt(body.reorderPoint);
      if (body.reorderQuantity) body.reorderQuantity = parseInt(body.reorderQuantity);
      if (isEdit && item.version != null) body.version = item.version;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tr('تعديل الصنف', 'Edit Item') : tr('إضافة صنف جديد', 'Add New Item')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('الرمز', 'Code')}</Label>
              <Input value={form.code} onChange={(e) => update('code', e.target.value)} />
            </div>
            <div>
              <Label>{tr('النوع', 'Type')}</Label>
              <Select value={form.itemType} onValueChange={(v) => update('itemType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('الاسم (EN)', 'Name (EN)')}</Label>
              <Input value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div>
              <Label>{tr('الاسم (AR)', 'Name (AR)')}</Label>
              <Input value={form.nameAr} onChange={(e) => update('nameAr', e.target.value)} dir="rtl" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{tr('الفئة', 'Category')}</Label>
              <Input value={form.category} onChange={(e) => update('category', e.target.value)} />
            </div>
            <div>
              <Label>{tr('وحدة القياس', 'UOM')}</Label>
              <Input value={form.uom} onChange={(e) => update('uom', e.target.value)} />
            </div>
            <div>
              <Label>{tr('تكلفة الوحدة', 'Unit Cost')}</Label>
              <Input type="number" step="0.01" value={form.standardCost} onChange={(e) => update('standardCost', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('نقطة إعادة الطلب', 'Reorder Point')}</Label>
              <Input type="number" value={form.reorderPoint} onChange={(e) => update('reorderPoint', e.target.value)} />
            </div>
            <div>
              <Label>{tr('كمية إعادة الطلب', 'Reorder Quantity')}</Label>
              <Input type="number" value={form.reorderQuantity} onChange={(e) => update('reorderQuantity', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{tr('ظروف التخزين', 'Storage Conditions')}</Label>
            <Input value={form.storageConditions} onChange={(e) => update('storageConditions', e.target.value)} />
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
