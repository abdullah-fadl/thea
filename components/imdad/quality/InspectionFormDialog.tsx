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

const TYPE_OPTIONS = ['INCOMING', 'IN_PROCESS', 'OUTGOING', 'RANDOM', 'COMPLAINT_DRIVEN', 'PERIODIC', 'RECALL'] as const;

interface InspectionFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection?: any;
  onSuccess?: () => void;
}

export default function InspectionFormDialog({
  mode,
  open,
  onOpenChange,
  inspection,
  onSuccess,
}: InspectionFormDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    inspectionType: 'INCOMING',
    referenceType: '',
    referenceNumber: '',
    itemName: '',
    inspectorName: '',
    scheduledDate: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (inspection && isEdit) {
      setForm({
        inspectionType: inspection.inspectionType || 'INCOMING',
        referenceType: inspection.referenceType || '',
        referenceNumber: inspection.referenceNumber || '',
        itemName: inspection.itemName || '',
        inspectorName: inspection.inspectorName || '',
        scheduledDate: (inspection.scheduledDate || '')?.split('T')[0] || '',
        notes: inspection.notes || '',
      });
    } else if (!isEdit) {
      setForm({
        inspectionType: 'INCOMING', referenceType: '', referenceNumber: '',
        itemName: '', inspectorName: '', scheduledDate: '', notes: '',
      });
    }
  }, [inspection, isEdit, open]);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/imdad/quality/inspections/${inspection.id || inspection._id}`
        : '/api/imdad/quality/inspections';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = { ...form };
      if (isEdit && inspection.version != null) body.version = inspection.version;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tr('تعديل الفحص', 'Edit Inspection') : tr('إنشاء فحص جديد', 'Create Inspection')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label>{tr('نوع الفحص', 'Inspection Type')}</Label>
            <Select value={form.inspectionType} onValueChange={(v) => update('inspectionType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('نوع المرجع', 'Reference Type')}</Label>
              <Input value={form.referenceType} onChange={(e) => update('referenceType', e.target.value)} placeholder="GRN / PO" />
            </div>
            <div>
              <Label>{tr('رقم المرجع', 'Reference Number')}</Label>
              <Input value={form.referenceNumber} onChange={(e) => update('referenceNumber', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{tr('اسم الصنف', 'Item Name')}</Label>
            <Input value={form.itemName} onChange={(e) => update('itemName', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('اسم الفاحص', 'Inspector Name')}</Label>
              <Input value={form.inspectorName} onChange={(e) => update('inspectorName', e.target.value)} />
            </div>
            <div>
              <Label>{tr('التاريخ المجدول', 'Scheduled Date')}</Label>
              <Input type="date" value={form.scheduledDate} onChange={(e) => update('scheduledDate', e.target.value)} />
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
