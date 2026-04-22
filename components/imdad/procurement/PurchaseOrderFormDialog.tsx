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

interface PurchaseOrderFormDialogProps {
  mode: 'create' | 'edit';
  po?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function PurchaseOrderFormDialog({
  mode,
  po,
  open,
  onOpenChange,
  onSuccess,
}: PurchaseOrderFormDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    poNumber: '',
    vendorId: '',
    currency: 'SAR',
    expectedDeliveryDate: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (po && isEdit) {
      setForm({
        poNumber: po.poNumber || '',
        vendorId: po.vendorId || po.vendor?.id || '',
        currency: po.currency || 'SAR',
        expectedDeliveryDate: (po.expectedDeliveryDate || po.expectedDelivery || '')?.split('T')[0] || '',
        notes: po.notes || '',
      });
    } else if (!isEdit) {
      setForm({ poNumber: '', vendorId: '', currency: 'SAR', expectedDeliveryDate: '', notes: '' });
    }
  }, [po, isEdit, open]);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/imdad/procurement/purchase-orders/${po.id || po._id}`
        : '/api/imdad/procurement/purchase-orders';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = { ...form };
      if (isEdit && po.version != null) body.version = po.version;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tr('تعديل أمر الشراء', 'Edit Purchase Order') : tr('أمر شراء جديد', 'New Purchase Order')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label>{tr('رقم أمر الشراء', 'PO Number')}</Label>
            <Input value={form.poNumber} onChange={(e) => update('poNumber', e.target.value)} placeholder="PO-2026-XXX" />
          </div>
          <div>
            <Label>{tr('معرف المورد', 'Vendor ID')}</Label>
            <Input value={form.vendorId} onChange={(e) => update('vendorId', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('العملة', 'Currency')}</Label>
              <Select value={form.currency} onValueChange={(v) => update('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">{tr('ريال سعودي', 'SAR')}</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('تاريخ التسليم المتوقع', 'Expected Delivery')}</Label>
              <Input type="date" value={form.expectedDeliveryDate} onChange={(e) => update('expectedDeliveryDate', e.target.value)} />
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
            {saving ? tr('جاري الحفظ...', 'Saving...') : isEdit ? tr('تحديث', 'Update') : tr('إنشاء', 'Create')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
