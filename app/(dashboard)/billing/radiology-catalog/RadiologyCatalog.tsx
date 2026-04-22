'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
const UNIT_TYPES = ['PER_TEST', 'PER_VISIT', 'PER_PROCEDURE', 'PER_DAY', 'PER_DOSE'];
const APPLICABILITY = ['ER', 'OPD', 'IPD', 'ICU', 'OR'];
const STATUSES = ['ACTIVE', 'INACTIVE'];

export default function RadiologyCatalog() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/charge-catalog');
  const [search, setSearch] = useState('');
  const query = `?itemType=IMAGING${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`;
  const { data, mutate } = useSWR(
    hasPermission ? `/api/billing/charge-catalog${query}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  const rows = useMemo(() => items, [items]);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [disableTarget, setDisableTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [editAdminCode, setEditAdminCode] = useState('');
  const [deleteAdminCode, setDeleteAdminCode] = useState('');
  const [disableAdminCode, setDisableAdminCode] = useState('');
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState('PER_TEST');
  const [basePrice, setBasePrice] = useState('');
  const [applicability, setApplicability] = useState<string[]>(['ER']);
  const [allowedForCash, setAllowedForCash] = useState(true);
  const [allowedForInsurance, setAllowedForInsurance] = useState(true);
  const [status, setStatus] = useState('ACTIVE');
  const [radModality, setRadModality] = useState('');
  const [radBodySite, setRadBodySite] = useState('');
  const [radContrastRequired, setRadContrastRequired] = useState(false);
  const [bulkDefaults, setBulkDefaults] = useState({
    unitType: 'PER_TEST',
    applicability: ['ER'] as string[],
    allowedForCash: true,
    allowedForInsurance: true,
    status: 'ACTIVE',
    radModality: '',
    radBodySite: '',
    radContrastRequired: false,
  });
  const [bulkRows, setBulkRows] = useState<Array<{ name: string; basePrice: string }>>([{ name: '', basePrice: '' }]);

  const resetForm = () => {
    setName('');
    setUnitType('PER_TEST');
    setBasePrice('');
    setApplicability(['ER']);
    setAllowedForCash(true);
    setAllowedForInsurance(true);
    setStatus('ACTIVE');
    setRadModality('');
    setRadBodySite('');
    setRadContrastRequired(false);
    setBulkDefaults({
      unitType: 'PER_TEST',
      applicability: ['ER'],
      allowedForCash: true,
      allowedForInsurance: true,
      status: 'ACTIVE',
      radModality: '',
      radBodySite: '',
      radContrastRequired: false,
    });
    setBulkRows([{ name: '', basePrice: '' }]);
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    setName(item.name || '');
    setUnitType(item.unitType || 'PER_TEST');
    setBasePrice(String(item.basePrice ?? ''));
    setApplicability(Array.isArray(item.applicability) ? item.applicability : ['ER']);
    setAllowedForCash(Boolean(item.allowedForCash));
    setAllowedForInsurance(Boolean(item.allowedForInsurance));
    setStatus(item.status || 'ACTIVE');
    setRadModality(item.radModality || '');
    setRadBodySite(item.radBodySite || '');
    setRadContrastRequired(Boolean(item.radContrastRequired));
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

  const createItem = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        itemType: 'IMAGING',
        departmentDomain: 'RAD',
        unitType,
        basePrice: Number(basePrice),
        applicability,
        allowedForCash,
        allowedForInsurance,
        status,
        radModality,
        radBodySite,
        radContrastRequired,
      };
      const res = await fetch('/api/billing/charge-catalog', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to create radiology item');
      toast({ title: tr('\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0639\u0646\u0635\u0631 \u0627\u0644\u0623\u0634\u0639\u0629', 'Radiology item created') });
      resetForm();
      setAddOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('\u062E\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062A \u0627\u0644\u0639\u0645\u0644\u064A\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async () => {
    if (!editTarget?.id) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        departmentDomain: 'RAD',
        unitType,
        basePrice: Number(basePrice),
        applicability,
        allowedForCash,
        allowedForInsurance,
        status,
        radModality,
        radBodySite,
        radContrastRequired,
        adminCode: editAdminCode.trim(),
      };
      const res = await fetch(`/api/billing/charge-catalog/${editTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to update radiology item');
      toast({ title: json.noOp ? tr('لا توجد تغييرات', 'No changes') : tr('تم تحديث عنصر الأشعة', 'Radiology item updated') });
      setEditOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('\u062E\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062A \u0627\u0644\u0639\u0645\u0644\u064A\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!deleteTarget?.id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/billing/charge-catalog', {
        credentials: 'include',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [deleteTarget.id], adminCode: deleteAdminCode.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to delete radiology item');
      toast({ title: tr('\u062A\u0645 \u062D\u0630\u0641 \u0639\u0646\u0635\u0631 \u0627\u0644\u0623\u0634\u0639\u0629', 'Radiology item deleted') });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('\u062E\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062A \u0627\u0644\u0639\u0645\u0644\u064A\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const disableItem = async () => {
    if (!disableTarget?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/billing/charge-catalog/${disableTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE', adminCode: disableAdminCode.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to disable radiology item');
      toast({ title: tr('\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u0639\u0646\u0635\u0631 \u0627\u0644\u0623\u0634\u0639\u0629', 'Radiology item disabled') });
      setDisableOpen(false);
      setDisableTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('\u062E\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062A \u0627\u0644\u0639\u0645\u0644\u064A\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const createBulkItems = async () => {
    const rows = bulkRows.filter((row) => row.name.trim() && String(row.basePrice).trim());
    if (!rows.length) return;
    setBulkSaving(true);
    try {
      const res = await fetch('/api/billing/charge-catalog/bulk', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map((row) => ({
            name: row.name.trim(),
            basePrice: Number(row.basePrice),
            itemType: 'IMAGING',
            departmentDomain: 'RAD',
            unitType: bulkDefaults.unitType,
            applicability: bulkDefaults.applicability,
            allowedForCash: bulkDefaults.allowedForCash,
            allowedForInsurance: bulkDefaults.allowedForInsurance,
            status: bulkDefaults.status,
            radModality: bulkDefaults.radModality,
            radBodySite: bulkDefaults.radBodySite,
            radContrastRequired: bulkDefaults.radContrastRequired,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bulk import failed');
      toast({
        title: tr('اكتملت الإضافة المجمعة', 'Bulk import complete'),
        description: `${tr('تم الإنشاء', 'Created')} ${data.createdCount || 0}, ${tr('أخطاء', 'errors')} ${data.errorCount || 0}`,
      });
      setBulkOpen(false);
      setBulkDefaults({
        unitType: 'PER_TEST',
        applicability: ['ER'],
        allowedForCash: true,
        allowedForInsurance: true,
        status: 'ACTIVE',
        radModality: '',
        radBodySite: '',
        radContrastRequired: false,
      });
      setBulkRows([{ name: '', basePrice: '' }]);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('\u062E\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062A \u0627\u0644\u0639\u0645\u0644\u064A\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setBulkSaving(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('كتالوج الأشعة', 'Radiology Catalog')}</h2>
          <p className="text-sm text-muted-foreground">{tr('عناصر كتالوج الرسوم لدراسات التصوير.', 'Charge catalog items for imaging studies.')}</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Input
              placeholder={tr('بحث بالرمز أو الاسم', 'Search by code or name')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs rounded-xl thea-input-focus"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setBulkOpen(true)}>
                {tr('إضافة مجمعة', 'Bulk Add')}
              </Button>
              <Button
                className="rounded-xl"
                onClick={() => {
                  resetForm();
                  setAddOpen(true);
                }}
              >
                {tr('إضافة عنصر أشعة', 'Add Radiology Item')}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
            <div className="grid grid-cols-8 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الوحدة', 'Unit Type')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجهاز', 'Modality')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('منطقة الجسم', 'Body Site')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
            </div>
            <div className="space-y-1">
              {rows.length ? (
                rows.map((item: any) => (
                  <div key={item.id} className="grid grid-cols-8 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast items-center">
                    <span className="text-sm text-foreground">{item.code}</span>
                    <span className="text-sm text-foreground">{item.name}</span>
                    <span className="text-sm text-foreground">{item.unitType}</span>
                    <span className="text-sm text-foreground">{Number(item.basePrice).toFixed(2)}</span>
                    <span className="text-sm text-foreground">{item.radModality || '\u2014'}</span>
                    <span className="text-sm text-foreground">{item.radBodySite || '\u2014'}</span>
                    <span className="text-sm text-foreground">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status}</span>
                    </span>
                    <span className="text-sm text-foreground">
                      <div className="flex gap-2">
                        <Button className="rounded-xl" size="sm" variant="outline" onClick={() => openEdit(item)}>
                          {tr('تعديل', 'Edit')}
                        </Button>
                        <Button
                          className="rounded-xl"
                          size="sm"
                          variant="secondary"
                          onClick={() => openDisable(item)}
                          disabled={String(item.status || '').toUpperCase() === 'INACTIVE'}
                        >
                          {tr('تعطيل', 'Disable')}
                        </Button>
                        <Button className="rounded-xl" size="sm" variant="destructive" onClick={() => openDelete(item)}>
                          {tr('حذف', 'Delete')}
                        </Button>
                      </div>
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-muted-foreground">{tr('لم يتم العثور على عناصر أشعة.', 'No radiology items found.')}</div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة عنصر أشعة', 'Add Radiology Item')}</DialogTitle>
            <DialogDescription>{tr('إنشاء عنصر كتالوج رسوم للتصوير.', 'Creates a charge catalog entry for imaging.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الوحدة', 'Unit Type')}</span>
                <Select value={unitType} onValueChange={setUnitType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('اختر نوع الوحدة', 'Select unit type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  type="number"
                  min="0"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجهاز (اختياري)', 'Modality (optional)')}</span>
                <Input className="rounded-xl thea-input-focus" value={radModality} onChange={(e) => setRadModality(e.target.value)} placeholder="CT / MRI" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('منطقة الجسم (اختياري)', 'Body Site (optional)')}</span>
                <Input className="rounded-xl thea-input-focus" value={radBodySite} onChange={(e) => setRadBodySite(e.target.value)} placeholder="Head" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={radContrastRequired}
                  onCheckedChange={(v) => setRadContrastRequired(Boolean(v))}
                />
                {tr('مطلوب مادة تباين', 'Contrast Required')}
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('قابلية التطبيق', 'Applicability')}</span>
              <div className="flex flex-wrap gap-3">
                {APPLICABILITY.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={applicability.includes(value)}
                      onCheckedChange={(checked) => {
                        setApplicability((current) =>
                          checked ? Array.from(new Set([...current, value])) : current.filter((v) => v !== value)
                        );
                      }}
                    />
                    {value}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={allowedForCash} onCheckedChange={(v) => setAllowedForCash(Boolean(v))} />
                {tr('مسموح بالنقد', 'Cash Allowed')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={allowedForInsurance} onCheckedChange={(v) => setAllowedForInsurance(Boolean(v))} />
                {tr('مسموح بالتأمين', 'Insurance Allowed')}
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select status" />
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
            <Button
              className="rounded-xl"
              onClick={createItem}
              disabled={saving || !name.trim() || !basePrice.trim() || applicability.length === 0}
            >
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعديل عنصر أشعة', 'Edit Radiology Item')}</DialogTitle>
            <DialogDescription>{tr('رمز المسؤول مطلوب للتحديثات.', 'Admin code required for updates.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الوحدة', 'Unit Type')}</span>
                <Select value={unitType} onValueChange={setUnitType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('اختر نوع الوحدة', 'Select unit type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
                <Input className="rounded-xl thea-input-focus" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('قابلية التطبيق', 'Applicability')}</span>
              <div className="flex flex-wrap gap-3">
                {APPLICABILITY.map((app) => (
                  <label key={app} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={applicability.includes(app)}
                      onCheckedChange={(value) => {
                        const checked = Boolean(value);
                        setApplicability((current) =>
                          checked ? Array.from(new Set([...current, app])) : current.filter((x) => x !== app)
                        );
                      }}
                    />
                    {app}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={allowedForCash} onCheckedChange={(value) => setAllowedForCash(Boolean(value))} />
                {tr('مسموح بالنقد', 'Cash Allowed')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allowedForInsurance}
                  onCheckedChange={(value) => setAllowedForInsurance(Boolean(value))}
                />
                {tr('مسموح بالتأمين', 'Insurance Allowed')}
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('الحالة', 'Status')} />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجهاز', 'Modality')}</span>
                <Input className="rounded-xl thea-input-focus" value={radModality} onChange={(e) => setRadModality(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('منطقة الجسم', 'Body Site')}</span>
                <Input className="rounded-xl thea-input-focus" value={radBodySite} onChange={(e) => setRadBodySite(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox checked={radContrastRequired} onCheckedChange={(v) => setRadContrastRequired(Boolean(v))} />
              Contrast Required
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
            <Button
              className="rounded-xl"
              onClick={updateItem}
              disabled={
                saving ||
                !editAdminCode.trim() ||
                !name.trim() ||
                !unitType ||
                !String(basePrice).trim() ||
                !applicability.length
              }
            >
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تحديث', 'Update')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعطيل عنصر أشعة', 'Disable Radiology Item')}</DialogTitle>
            <DialogDescription>{tr('يتم تغيير الحالة إلى غير نشط. رمز المسؤول مطلوب.', 'Sets status to INACTIVE. Admin code required.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Code</span>
            <Input className="rounded-xl thea-input-focus" value={disableAdminCode} onChange={(e) => setDisableAdminCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDisableOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button variant="secondary" className="rounded-xl" onClick={disableItem} disabled={saving || !disableAdminCode.trim()}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تعطيل', 'Disable')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('حذف عنصر أشعة', 'Delete Radiology Item')}</DialogTitle>
            <DialogDescription>{tr('أدخل رمز الحذف للتأكيد.', 'Enter admin delete code to confirm.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Code</span>
            <Input className="rounded-xl thea-input-focus" value={deleteAdminCode} onChange={(e) => setDeleteAdminCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={deleteItem} disabled={saving || !deleteAdminCode.trim()}>
              {saving ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة مجمعة لعناصر الأشعة', 'Bulk Add Radiology Items')}</DialogTitle>
            <DialogDescription>{tr('استخدم الإعدادات الافتراضية أعلاه، ثم أضف الصفوف أدناه.', 'Use defaults at the top, then add rows below.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="rounded-lg border p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الوحدة', 'Unit Type')}</span>
                  <Select
                    value={bulkDefaults.unitType}
                    onValueChange={(value) => setBulkDefaults((prev) => ({ ...prev, unitType: value }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={tr('اختر نوع الوحدة', 'Select unit type')} />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                  <Select
                    value={bulkDefaults.status}
                    onValueChange={(value) => setBulkDefaults((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={tr('اختر الحالة', 'Select status')} />
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
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('قابلية التطبيق', 'Applicability')}</span>
                <div className="flex flex-wrap gap-3">
                  {APPLICABILITY.map((value) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={bulkDefaults.applicability.includes(value)}
                        onCheckedChange={(checked) => {
                          setBulkDefaults((prev) => ({
                            ...prev,
                            applicability: checked
                              ? Array.from(new Set([...prev.applicability, value]))
                              : prev.applicability.filter((v) => v !== value),
                          }));
                        }}
                      />
                      {value}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bulkDefaults.allowedForCash}
                    onCheckedChange={(v) => setBulkDefaults((prev) => ({ ...prev, allowedForCash: Boolean(v) }))}
                  />
                  {tr('مسموح بالنقد', 'Cash Allowed')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bulkDefaults.allowedForInsurance}
                    onCheckedChange={(v) =>
                      setBulkDefaults((prev) => ({ ...prev, allowedForInsurance: Boolean(v) }))
                    }
                  />
                  {tr('مسموح بالتأمين', 'Insurance Allowed')}
                </label>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجهاز (اختياري)', 'Modality (optional)')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={bulkDefaults.radModality}
                  onChange={(e) => setBulkDefaults((prev) => ({ ...prev, radModality: e.target.value }))}
                  placeholder="CT / MRI"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('منطقة الجسم (اختياري)', 'Body Site (optional)')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={bulkDefaults.radBodySite}
                  onChange={(e) => setBulkDefaults((prev) => ({ ...prev, radBodySite: e.target.value }))}
                  placeholder="Head"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={bulkDefaults.radContrastRequired}
                  onCheckedChange={(v) =>
                    setBulkDefaults((prev) => ({ ...prev, radContrastRequired: Boolean(v) }))
                  }
                />
                {tr('مطلوب مادة تباين', 'Contrast Required')}
              </label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الصفوف', 'Rows')}</span>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setBulkRows((current) => [...current, { name: '', basePrice: '' }])}
                >
                  {tr('إضافة صف', 'Add Row')}
                </Button>
              </div>
              <div className="space-y-3">
                {bulkRows.map((row, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1.5fr_1fr_auto] items-end">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={row.name}
                        onChange={(e) =>
                          setBulkRows((current) =>
                            current.map((r, i) => (i === index ? { ...r, name: e.target.value } : r))
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.basePrice}
                        onChange={(e) =>
                          setBulkRows((current) =>
                            current.map((r, i) => (i === index ? { ...r, basePrice: e.target.value } : r))
                          )
                        }
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setBulkRows((current) => current.filter((_, i) => i !== index))}
                      disabled={bulkRows.length === 1}
                    >
                      {tr('إزالة', 'Remove')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setBulkOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              className="rounded-xl"
              onClick={createBulkItems}
              disabled={
                bulkSaving ||
                !bulkDefaults.applicability.length ||
                bulkRows.every((row) => !row.name.trim() || !row.basePrice.trim())
              }
            >
              {bulkSaving ? tr('جاري الاستيراد...', 'Importing...') : tr('استيراد', 'Import')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
