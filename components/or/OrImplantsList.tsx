'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Wrench } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface OrImplantsListProps {
  caseId: string;
}

interface Implant {
  id: string;
  itemName: string;
  manufacturer: string | null;
  lotNumber: string | null;
  serialNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  site: string | null;
  createdAt: string;
}

interface NewImplantForm {
  itemName: string;
  manufacturer: string;
  lotNumber: string;
  serialNumber: string;
  expiryDate: string;
  quantity: string;
  site: string;
}

const EMPTY_FORM: NewImplantForm = {
  itemName: '',
  manufacturer: '',
  lotNumber: '',
  serialNumber: '',
  expiryDate: '',
  quantity: '1',
  site: '',
};

export default function OrImplantsList({ caseId }: OrImplantsListProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const { data, mutate, isLoading } = useSWR(
    caseId ? `/api/or/cases/${caseId}/implants` : null,
    fetcher,
  );

  const implants: Implant[] = Array.isArray(data?.implants) ? data.implants : [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewImplantForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const setField = (key: keyof NewImplantForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.itemName.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('اسم المستلزم مطلوب', 'Item name is required'),
        variant: 'destructive' as const,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/implants`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: form.itemName.trim(),
          manufacturer: form.manufacturer.trim() || null,
          lotNumber: form.lotNumber.trim() || null,
          serialNumber: form.serialNumber.trim() || null,
          expiryDate: form.expiryDate || null,
          quantity: Number(form.quantity) || 1,
          site: form.site.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Save failed'));

      toast({
        title: tr('تمت الإضافة', 'Implant Added'),
        description: tr('تم تسجيل المستلزم الجراحي', 'Surgical implant recorded'),
      });
      resetForm();
      await mutate();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message,
        variant: 'destructive' as const,
      });
    } finally {
      setSaving(false);
    }
  };

  // Flag implants near expiry (within 30 days) or already expired
  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 30) return 'near';
    return 'ok';
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {tr('جارٍ التحميل...', 'Loading...')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">{tr('المستلزمات الجراحية', 'Surgical Implants')}</CardTitle>
            <CardDescription>
              {tr('تتبع المستلزمات وأرقام الدفعات والمسلسلة', 'Implant tracking with lot and serial numbers')}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant={showForm ? 'outline' : 'default'}
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
          >
            {showForm ? tr('إلغاء', 'Cancel') : `+ ${tr('إضافة مستلزم', 'Add Implant')}`}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add implant form */}
        {showForm && (
          <div className="p-4 border rounded-xl bg-muted/30 space-y-4">
            <p className="text-sm font-medium text-foreground">
              {tr('بيانات المستلزم الجراحي', 'Implant Details')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-foreground">
                  {tr('اسم المستلزم *', 'Item Name *')}
                </Label>
                <Input
                  value={form.itemName}
                  onChange={(e) => setField('itemName', e.target.value)}
                  placeholder={tr('مثل: بالون قلبي، لوح عظم...', 'e.g. Cardiac stent, Bone plate...')}
                  className="thea-input-focus"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('الشركة المصنعة', 'Manufacturer')}</Label>
                <Input
                  value={form.manufacturer}
                  onChange={(e) => setField('manufacturer', e.target.value)}
                  placeholder={tr('مثل: Medtronic', 'e.g. Medtronic')}
                  className="thea-input-focus"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('رقم الدفعة (Lot)', 'Lot Number')}</Label>
                <Input
                  value={form.lotNumber}
                  onChange={(e) => setField('lotNumber', e.target.value)}
                  placeholder="e.g. LOT-2024-001"
                  className="thea-input-focus"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('الرقم المسلسل', 'Serial Number')}</Label>
                <Input
                  value={form.serialNumber}
                  onChange={(e) => setField('serialNumber', e.target.value)}
                  placeholder="e.g. SN-123456"
                  className="thea-input-focus"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('تاريخ الانتهاء', 'Expiry Date')}</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setField('expiryDate', e.target.value)}
                  className="thea-input-focus"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('الكمية', 'Quantity')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setField('quantity', e.target.value)}
                  className="thea-input-focus"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-foreground">{tr('موضع الزرع', 'Implant Site')}</Label>
                <Input
                  value={form.site}
                  onChange={(e) => setField('site', e.target.value)}
                  placeholder={tr('مثل: الركبة اليسرى، الورك الأيمن...', 'e.g. Left knee, Right hip...')}
                  className="thea-input-focus"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={saving || !form.itemName.trim()}>
                {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل المستلزم', 'Record Implant')}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                {tr('إلغاء', 'Cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Implants table */}
        {implants.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('الاسم', 'Item Name')}</TableHead>
                <TableHead>{tr('الشركة', 'Manufacturer')}</TableHead>
                <TableHead>{tr('رقم الدفعة', 'Lot #')}</TableHead>
                <TableHead>{tr('الرقم المسلسل', 'Serial #')}</TableHead>
                <TableHead>{tr('الانتهاء', 'Expiry')}</TableHead>
                <TableHead>{tr('الكمية', 'Qty')}</TableHead>
                <TableHead>{tr('الموضع', 'Site')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {implants.map((implant) => {
                const expiryStatus = getExpiryStatus(implant.expiryDate);
                return (
                  <TableRow key={implant.id}>
                    <TableCell className="font-medium text-foreground">{implant.itemName}</TableCell>
                    <TableCell className="text-muted-foreground">{implant.manufacturer || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{implant.lotNumber || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{implant.serialNumber || '—'}</TableCell>
                    <TableCell>
                      {implant.expiryDate ? (
                        <span
                          className={
                            expiryStatus === 'expired'
                              ? 'text-red-600 font-medium'
                              : expiryStatus === 'near'
                              ? 'text-amber-600 font-medium'
                              : 'text-foreground'
                          }
                        >
                          {new Date(implant.expiryDate).toLocaleDateString()}
                          {expiryStatus === 'expired' && (
                            <Badge variant="destructive" className="ms-1 text-xs">
                              {tr('منتهي', 'Expired')}
                            </Badge>
                          )}
                          {expiryStatus === 'near' && (
                            <Badge variant="outline" className="ms-1 text-xs text-amber-700 border-amber-400">
                              {tr('قريب الانتهاء', 'Near Expiry')}
                            </Badge>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{implant.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{implant.site || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="py-12 text-center space-y-2">
            <Wrench className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-foreground">
              {tr('لا توجد مستلزمات', 'No implants recorded')}
            </p>
            <p className="text-xs text-muted-foreground">
              {tr('أضف المستلزمات الجراحية المستخدمة في هذه العملية', 'Add surgical implants used in this procedure')}
            </p>
          </div>
        )}

        {implants.length > 0 && (
          <p className="text-xs text-muted-foreground text-end">
            {implants.length} {tr('مستلزم مسجل', implants.length === 1 ? 'implant recorded' : 'implants recorded')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
