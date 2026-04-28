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

const STATUS_OPTIONS = ['ACTIVE', 'RESTRICTED', 'NON_FORMULARY', 'DISCONTINUED', 'PENDING_REVIEW'] as const;
const CATEGORY_OPTIONS = ['GENERAL', 'ANTIBIOTIC', 'ANALGESIC', 'CARDIAC', 'ENDOCRINE', 'ONCOLOGY', 'PSYCHIATRIC', 'OTHER'] as const;

interface FormularyFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
  onSuccess?: () => void;
}

export function FormularyFormDialog({ mode, open, onOpenChange, item, onSuccess }: FormularyFormDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    itemCode: '',
    itemName: '',
    genericName: '',
    genericNameAr: '',
    formularyStatus: 'ACTIVE',
    therapeuticClass: '',
    formularyCategory: 'GENERAL',
    isControlled: false,
    insuranceCovered: false,
    requiresApproval: false,
    approvalLevel: '',
    maxDailyDose: '',
    maxOrderQty: '',
    unitPrice: '',
    indications: '',
    contraindications: '',
    storageInstructions: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item && isEdit) {
      setForm({
        itemCode: item.itemCode || '',
        itemName: item.itemName || '',
        genericName: item.genericName || '',
        genericNameAr: item.genericNameAr || '',
        formularyStatus: item.formularyStatus || 'ACTIVE',
        therapeuticClass: item.therapeuticClass || '',
        formularyCategory: item.formularyCategory || 'GENERAL',
        isControlled: item.isControlled || false,
        insuranceCovered: item.insuranceCovered || false,
        requiresApproval: item.requiresApproval || false,
        approvalLevel: item.approvalLevel || '',
        maxDailyDose: item.maxDailyDose || '',
        maxOrderQty: item.maxOrderQty || '',
        unitPrice: item.unitPrice?.toString() || '',
        indications: item.indications || '',
        contraindications: item.contraindications || '',
        storageInstructions: item.storageInstructions || '',
      });
    } else if (!isEdit) {
      setForm({
        itemCode: '', itemName: '', genericName: '', genericNameAr: '',
        formularyStatus: 'ACTIVE', therapeuticClass: '', formularyCategory: 'GENERAL',
        isControlled: false, insuranceCovered: false, requiresApproval: false,
        approvalLevel: '', maxDailyDose: '', maxOrderQty: '', unitPrice: '',
        indications: '', contraindications: '', storageInstructions: '',
      });
    }
  }, [item, isEdit, open]);

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/imdad/clinical/formulary/${item.id}`
        : '/api/imdad/clinical/formulary';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = { ...form };
      if (body.unitPrice) body.unitPrice = parseFloat(body.unitPrice);
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

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: tr('فعال', 'Active'),
      RESTRICTED: tr('مقيد', 'Restricted'),
      NON_FORMULARY: tr('خارج القائمة', 'Non-Formulary'),
      DISCONTINUED: tr('متوقف', 'Discontinued'),
      PENDING_REVIEW: tr('قيد المراجعة', 'Pending Review'),
    };
    return map[s] || s;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tr('تعديل صنف القائمة', 'Edit Formulary Item') : tr('إضافة صنف للقائمة', 'Add Formulary Item')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('رمز الصنف', 'Item Code')}</Label>
              <Input value={form.itemCode} onChange={(e) => update('itemCode', e.target.value)} />
            </div>
            <div>
              <Label>{tr('اسم الصنف', 'Item Name')}</Label>
              <Input value={form.itemName} onChange={(e) => update('itemName', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('الاسم العلمي (EN)', 'Generic Name (EN)')}</Label>
              <Input value={form.genericName} onChange={(e) => update('genericName', e.target.value)} />
            </div>
            <div>
              <Label>{tr('الاسم العلمي (AR)', 'Generic Name (AR)')}</Label>
              <Input value={form.genericNameAr} onChange={(e) => update('genericNameAr', e.target.value)} dir="rtl" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{tr('الحالة', 'Status')}</Label>
              <Select value={form.formularyStatus} onValueChange={(v) => update('formularyStatus', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('الفئة العلاجية', 'Therapeutic Class')}</Label>
              <Input value={form.therapeuticClass} onChange={(e) => update('therapeuticClass', e.target.value)} />
            </div>
            <div>
              <Label>{tr('سعر الوحدة', 'Unit Price')}</Label>
              <Input type="number" step="0.01" value={form.unitPrice} onChange={(e) => update('unitPrice', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('الجرعة اليومية القصوى', 'Max Daily Dose')}</Label>
              <Input value={form.maxDailyDose} onChange={(e) => update('maxDailyDose', e.target.value)} />
            </div>
            <div>
              <Label>{tr('أقصى كمية طلب', 'Max Order Qty')}</Label>
              <Input value={form.maxOrderQty} onChange={(e) => update('maxOrderQty', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isControlled} onChange={(e) => update('isControlled', e.target.checked)} className="rounded" />
              {tr('خاضع للرقابة', 'Controlled')}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.insuranceCovered} onChange={(e) => update('insuranceCovered', e.target.checked)} className="rounded" />
              {tr('مغطى بالتأمين', 'Insurance Covered')}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.requiresApproval} onChange={(e) => update('requiresApproval', e.target.checked)} className="rounded" />
              {tr('يتطلب موافقة', 'Requires Approval')}
            </label>
          </div>

          <div>
            <Label>{tr('دواعي الاستعمال', 'Indications')}</Label>
            <textarea
              value={form.indications}
              onChange={(e) => update('indications', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <Label>{tr('ظروف التخزين', 'Storage Instructions')}</Label>
            <Input value={form.storageInstructions} onChange={(e) => update('storageInstructions', e.target.value)} />
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
