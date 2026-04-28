'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
const STATUSES = ['ACTIVE', 'INACTIVE'];

export default function PricingPackages() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/charge-catalog');
  const [search, setSearch] = useState('');
  const searchParam = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const { data, mutate } = useSWR(hasPermission ? `/api/catalogs/pricing-packages${searchParam}` : null, fetcher, {
    refreshInterval: 0,
  });
  const items = Array.isArray(data?.items) ? data.items : [];
  const rows = useMemo(() => items, [items]);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [disableTarget, setDisableTarget] = useState<any>(null);
  const [applyTarget, setApplyTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [editAdminCode, setEditAdminCode] = useState('');
  const [deleteAdminCode, setDeleteAdminCode] = useState('');
  const [disableAdminCode, setDisableAdminCode] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fixedPrice, setFixedPrice] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [encounterId, setEncounterId] = useState('');
  const [applyNote, setApplyNote] = useState('');
  const [applyRequestId, setApplyRequestId] = useState('');

  const resetForm = () => {
    setName('');
    setDescription('');
    setFixedPrice('');
    setStatus('ACTIVE');
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    setName(item.name || '');
    setDescription(item.description || '');
    setFixedPrice(String(item.fixedPrice ?? ''));
    setStatus(item.status || 'ACTIVE');
    setEditAdminCode('');
    setEditOpen(true);
  };

  const openDelete = (item: any) => {
    setDeleteTarget(item);
    setDeleteAdminCode('');
    setDeleteOpen(true);
  };

  const openDisable = (item: any) => {
    setDisableTarget(item);
    setDisableAdminCode('');
    setDisableOpen(true);
  };

  const openApply = (item: any) => {
    setApplyTarget(item);
    setEncounterId('');
    setApplyNote('');
    setApplyRequestId('');
    setApplyOpen(true);
  };

  const createPackage = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        fixedPrice: Number(fixedPrice),
        status,
        adminCode: editAdminCode.trim(),
      };
      const res = await fetch('/api/catalogs/pricing-packages', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create package');
      toast({ title: tr('تم إنشاء الباقة', 'Package created') });
      resetForm();
      setAddOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updatePackage = async () => {
    if (!editTarget?.id) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        fixedPrice: Number(fixedPrice),
        status,
      };
      const res = await fetch(`/api/catalogs/pricing-packages/${editTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update package');
      toast({ title: data.noOp ? tr('لا توجد تغييرات', 'No changes') : tr('تم تحديث الباقة', 'Package updated') });
      setEditOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deletePackage = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/catalogs/pricing-packages', {
        credentials: 'include',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id, adminCode: deleteAdminCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete package');
      toast({ title: tr('تم حذف الباقة', 'Package deleted') });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const disablePackage = async () => {
    if (!disableTarget?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/catalogs/pricing-packages/${disableTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE', adminCode: disableAdminCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to disable package');
      toast({ title: tr('تم تعطيل الباقة', 'Package disabled') });
      setDisableOpen(false);
      setDisableTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const applyPackage = async () => {
    if (!applyTarget?.id) return;
    setApplying(true);
    try {
      const payload = {
        packageId: applyTarget.id,
        encounterId: encounterId.trim(),
        requestId: applyRequestId.trim(),
        note: applyNote.trim(),
      };
      const res = await fetch('/api/catalogs/pricing-packages/apply', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to apply package');
      toast({ title: tr('تم تطبيق الباقة', 'Package applied') });
      setApplyOpen(false);
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('باقات التسعير', 'Pricing Packages')}</h2>
          <p className="text-sm text-muted-foreground">{tr('تطبيق يدوي، سعر ثابت، يتجاوز الرسوم.', 'Manual apply, fixed price, overrides charges.')}</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Input
              placeholder={tr('بحث بالرمز أو الاسم', 'Search by code or name')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs rounded-xl thea-input-focus"
            />
            <Button
              className="rounded-xl"
              onClick={() => {
                resetForm();
                setAddOpen(true);
              }}
            >
              {tr('إضافة باقة', 'Add Package')}
         </Button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
            <div className="grid grid-cols-[100px_1fr_120px_100px_minmax(280px,1fr)] gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الثابت', 'Fixed Price')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
            </div>
            <div className="space-y-1">
              {rows.length ? (
                rows.map((item: any) => (
                  <div key={item.id} className="grid grid-cols-[100px_1fr_120px_100px_minmax(280px,1fr)] gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast items-center">
                    <span className="text-sm text-foreground">{item.code}</span>
                    <span className="text-sm text-foreground">{item.name}</span>
                    <span className="text-sm text-foreground">{Number(item.fixedPrice).toFixed(2)}</span>
                    <span className="text-sm text-foreground">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                        {item.status}
                      </span>
                    </span>
                    <span className="text-sm text-foreground">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openApply(item)}>
                          {tr('تطبيق', 'Apply')}
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>
                          {tr('تعديل', 'Edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-xl"
                          onClick={() => openDisable(item)}
                          disabled={String(item.status || '').toUpperCase() === 'INACTIVE'}
                        >
                          {tr('تعطيل', 'Disable')}
                        </Button>
                        <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => openDelete(item)}>
                          {tr('حذف', 'Delete')}
                        </Button>
                      </div>
                    </span>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-[100px_1fr_120px_100px_minmax(280px,1fr)] gap-4 px-4 py-3 rounded-xl">
                  <span className="text-sm text-muted-foreground col-span-5">
                    {tr('لم يتم العثور على باقات.', 'No packages found.')}
                  </span>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة باقة تسعير', 'Add Pricing Package')}</DialogTitle>
            <DialogDescription>{tr('باقة بسعر ثابت تتجاوز الرسوم.', 'Fixed price override package.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوصف (اختياري)', 'Description (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الثابت', 'Fixed Price')}</span>
              <Input
                className="rounded-xl thea-input-focus"
                type="number"
                min="0"
                step="0.01"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('الحالة', 'Status')} />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button className="rounded-xl" onClick={createPackage} disabled={saving || !name.trim() || !fixedPrice.trim()}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعديل باقة التسعير', 'Edit Pricing Package')}</DialogTitle>
            <DialogDescription>{tr('باقة تطبيق يدوي.', 'Manual apply package.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوصف (اختياري)', 'Description (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الثابت', 'Fixed Price')}</span>
              <Input
                className="rounded-xl thea-input-focus"
                type="number"
                min="0"
                step="0.01"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('الحالة', 'Status')} />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
              <Input className="rounded-xl thea-input-focus" value={editAdminCode} onChange={(e) => setEditAdminCode(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button className="rounded-xl" onClick={updatePackage} disabled={saving || !editAdminCode.trim() || !name.trim() || !fixedPrice.trim()}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعطيل الباقة', 'Disable Package')}</DialogTitle>
            <DialogDescription>{tr('يتم تغيير الحالة إلى غير نشط. رمز المسؤول مطلوب.', 'Sets status to INACTIVE. Admin code required.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
            <Input className="rounded-xl thea-input-focus" value={disableAdminCode} onChange={(e) => setDisableAdminCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDisableOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button variant="secondary" className="rounded-xl" onClick={disablePackage} disabled={saving || !disableAdminCode.trim()}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تعطيل', 'Disable')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('حذف الباقة', 'Delete Package')}</DialogTitle>
            <DialogDescription>{tr('أدخل رمز الحذف للتأكيد.', 'Enter admin delete code to confirm.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
            <Input className="rounded-xl thea-input-focus" value={deleteAdminCode} onChange={(e) => setDeleteAdminCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={deletePackage} disabled={deleting || !deleteAdminCode.trim()}>
              {deleting ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تطبيق الباقة', 'Apply Package')}</DialogTitle>
            <DialogDescription>{tr('تطبيق يدوي بسعر ثابت.', 'Manual apply with fixed price override.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معرف الزيارة', 'Encounter ID')}</span>
              <Input className="rounded-xl thea-input-focus" value={encounterId} onChange={(e) => setEncounterId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معرف الطلب', 'Request ID')}</span>
              <Input className="rounded-xl thea-input-focus" value={applyRequestId} onChange={(e) => setApplyRequestId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظة (اختياري)', 'Note (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={applyNote} onChange={(e) => setApplyNote(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setApplyOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button className="rounded-xl" onClick={applyPackage} disabled={applying || !encounterId.trim() || !applyRequestId.trim()}>
              {applying ? tr('جاري التطبيق...', 'Applying...') : tr('تطبيق', 'Apply')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
