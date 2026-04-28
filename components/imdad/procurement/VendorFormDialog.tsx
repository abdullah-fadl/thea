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

interface VendorFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: any;
  onSuccess?: () => void;
}

export function VendorFormDialog({ mode, open, onOpenChange, vendor, onSuccess }: VendorFormDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    code: '',
    name: '',
    nameAr: '',
    country: 'SA',
    city: '',
    type: 'GENERAL',
    vendorTier: 'APPROVED',
    paymentTerms: 'NET_30',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    taxId: '',
    crNumber: '',
    vatNumber: '',
    iban: '',
    website: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vendor && isEdit) {
      setForm({
        code: vendor.code || '',
        name: vendor.name || '',
        nameAr: vendor.nameAr || '',
        country: vendor.country || 'SA',
        city: vendor.city || '',
        type: vendor.type || vendor.vendorType || 'GENERAL',
        vendorTier: vendor.tier || vendor.vendorTier || 'APPROVED',
        paymentTerms: vendor.paymentTerms || 'NET_30',
        contactName: vendor.contactName || '',
        contactEmail: vendor.contactEmail || vendor.email || '',
        contactPhone: vendor.contactPhone || vendor.phone || '',
        taxId: vendor.taxId || '',
        crNumber: vendor.crNumber || '',
        vatNumber: vendor.vatNumber || '',
        iban: vendor.iban || '',
        website: vendor.website || '',
        notes: vendor.notes || '',
      });
    } else if (!isEdit) {
      setForm({
        code: '', name: '', nameAr: '', country: 'SA', city: '', type: 'GENERAL',
        vendorTier: 'APPROVED', paymentTerms: 'NET_30', contactName: '', contactEmail: '',
        contactPhone: '', taxId: '', crNumber: '', vatNumber: '', iban: '', website: '', notes: '',
      });
    }
  }, [vendor, isEdit, open]);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/imdad/procurement/vendors/${vendor.id || vendor._id}`
        : '/api/imdad/procurement/vendors';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = { ...form };
      if (isEdit && vendor.version != null) body.version = vendor.version;

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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tr('تعديل المورد', 'Edit Vendor') : tr('إضافة مورد جديد', 'Add New Vendor')}
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
              <Select value={form.type} onValueChange={(v) => update('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['PHARMACEUTICAL', 'MEDICAL_DEVICE', 'SURGICAL', 'GENERAL', 'SERVICE'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
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
              <Label>{tr('الدولة', 'Country')}</Label>
              <Input value={form.country} onChange={(e) => update('country', e.target.value)} />
            </div>
            <div>
              <Label>{tr('المدينة', 'City')}</Label>
              <Input value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
            <div>
              <Label>{tr('المستوى', 'Tier')}</Label>
              <Select value={form.vendorTier} onValueChange={(v) => update('vendorTier', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['PREFERRED', 'APPROVED', 'CONDITIONAL', 'PROBATION', 'SUSPENDED'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{tr('اسم المسؤول', 'Contact Name')}</Label>
              <Input value={form.contactName} onChange={(e) => update('contactName', e.target.value)} />
            </div>
            <div>
              <Label>{tr('البريد الإلكتروني', 'Email')}</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} />
            </div>
            <div>
              <Label>{tr('الهاتف', 'Phone')}</Label>
              <Input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{tr('شروط الدفع', 'Payment Terms')}</Label>
              <Select value={form.paymentTerms} onValueChange={(v) => update('paymentTerms', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['IMMEDIATE', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90'].map((t) => (
                    <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('الموقع الإلكتروني', 'Website')}</Label>
              <Input value={form.website} onChange={(e) => update('website', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{tr('السجل التجاري', 'CR Number')}</Label>
              <Input value={form.crNumber} onChange={(e) => update('crNumber', e.target.value)} />
            </div>
            <div>
              <Label>{tr('الرقم الضريبي', 'VAT Number')}</Label>
              <Input value={form.vatNumber} onChange={(e) => update('vatNumber', e.target.value)} />
            </div>
            <div>
              <Label>IBAN</Label>
              <Input value={form.iban} onChange={(e) => update('iban', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{tr('ملاحظات', 'Notes')}</Label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
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
