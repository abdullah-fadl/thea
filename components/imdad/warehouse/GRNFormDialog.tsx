'use client';

import { useState } from 'react';
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

interface GRNFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function GRNFormDialog({ open, onOpenChange, onSuccess }: GRNFormDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [form, setForm] = useState({
    purchaseOrderId: '',
    receivedAt: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/imdad/procurement/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      if (res.ok) {
        onOpenChange(false);
        setForm({ purchaseOrderId: '', receivedAt: new Date().toISOString().split('T')[0], notes: '' });
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
          <DialogTitle>{tr('إنشاء إذن استلام', 'Create Goods Receipt Note')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label>{tr('أمر الشراء', 'Purchase Order ID')}</Label>
            <Input
              value={form.purchaseOrderId}
              onChange={(e) => update('purchaseOrderId', e.target.value)}
              placeholder={tr('أدخل معرف أمر الشراء', 'Enter PO ID')}
            />
          </div>
          <div>
            <Label>{tr('تاريخ الاستلام', 'Received Date')}</Label>
            <Input type="date" value={form.receivedAt} onChange={(e) => update('receivedAt', e.target.value)} />
          </div>
          <div>
            <Label>{tr('ملاحظات', 'Notes')}</Label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder={tr('ملاحظات اختيارية...', 'Optional notes...')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('إلغاء', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء', 'Create')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
