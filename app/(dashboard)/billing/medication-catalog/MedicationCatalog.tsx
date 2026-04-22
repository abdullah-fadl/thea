'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
const ROUTE_OPTIONS = [
  { value: 'PO', label: 'PO' },
  { value: 'IV', label: 'IV' },
  { value: 'IM', label: 'IM' },
  { value: 'SC', label: 'SC' },
  { value: 'INH', label: 'Inhalation' },
  { value: 'LOCAL', label: 'Local' },
];
const STATUSES = ['ACTIVE', 'INACTIVE'];

export default function MedicationCatalog() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/charge-catalog');

  const [search, setSearch] = useState('');
  const searchParam = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const { data, mutate } = useSWR(
    hasPermission ? `/api/billing/medication-catalog${searchParam}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: chargeData, mutate: mutateCharges } = useSWR(
    hasPermission ? `/api/billing/charge-catalog?itemType=MEDICATION${searchParam ? `&${searchParam.slice(1)}` : ''}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  const chargeItems = Array.isArray(chargeData?.items) ? chargeData.items : [];

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

  const [genericName, setGenericName] = useState('');
  const [form, setForm] = useState('');
  const [strength, setStrength] = useState('');
  const [routes, setRoutes] = useState<string[]>(['PO']);
  const [chargeCode, setChargeCode] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [isControlled, setIsControlled] = useState(false);
  const [controlledClass, setControlledClass] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [bulkDefaults, setBulkDefaults] = useState({
    form: '',
    strength: '',
    routes: ['PO'] as string[],
    basePrice: '',
    isControlled: false,
    controlledClass: '',
  });
  const [bulkRows, setBulkRows] = useState<
    Array<{ genericName: string; strength: string; chargeCode: string; basePrice: string }>
  >([
    { genericName: '', strength: '', chargeCode: '', basePrice: '' },
  ]);

  const resetForm = () => {
    setGenericName('');
    setForm('');
    setStrength('');
    setRoutes(['PO']);
    setChargeCode('');
    setBasePrice('');
    setIsControlled(false);
    setControlledClass('');
    setStatus('ACTIVE');
    setBulkDefaults({
      form: '',
      strength: '',
      routes: ['PO'],
      basePrice: '',
      isControlled: false,
      controlledClass: '',
    });
    setBulkRows([{ genericName: '', strength: '', chargeCode: '', basePrice: '' }]);
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    setGenericName(item.genericName || item.chargeName || '');
    setForm(item.form || '');
    setStrength(item.strength || '');
    setRoutes(Array.isArray(item.routes) ? item.routes : ['PO']);
    setChargeCode(item.chargeCode || '');
    setIsControlled(Boolean(item.isControlled));
    setControlledClass(item.controlledClass || '');
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

  const createItem = async () => {
    setSaving(true);
    try {
      const payload = {
        genericName: genericName.trim(),
        form: form.trim(),
        strength: strength.trim(),
        routes,
        chargeCode: chargeCode.trim().toUpperCase(),
        basePrice: basePrice.trim(),
        isControlled,
        controlledClass: controlledClass.trim(),
      };
      const res = await fetch('/api/billing/medication-catalog', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to create medication');
      toast({ title: tr('\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062f\u0648\u0627\u0621', 'Medication created') });
      resetForm();
      setAddOpen(false);
      await Promise.all([mutate(), mutateCharges()]);
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async () => {
    if (!editTarget?.id) return;
    setSaving(true);
    try {
      const payload = {
        genericName: genericName.trim(),
        form: form.trim(),
        strength: strength.trim(),
        routes,
        chargeCode: chargeCode.trim().toUpperCase(),
        isControlled,
        controlledClass: controlledClass.trim(),
        status,
        adminCode: editAdminCode.trim(),
      };
      const res = await fetch(`/api/billing/medication-catalog/${editTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to update medication');
      toast({ title: json.noOp ? tr('لا توجد تغييرات', 'No changes') : tr('تم تحديث الدواء', 'Medication updated') });
      setEditOpen(false);
      await Promise.all([mutate(), mutateCharges()]);
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!deleteTarget?.id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/billing/medication-catalog', {
        credentials: 'include',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id, adminCode: deleteAdminCode.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to delete medication');
      toast({ title: tr('\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u062f\u0648\u0627\u0621', 'Medication deleted') });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await Promise.all([mutate(), mutateCharges()]);
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const disableItem = async () => {
    if (!disableTarget?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/billing/medication-catalog/${disableTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE', adminCode: disableAdminCode.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to disable medication');
      toast({ title: tr('\u062a\u0645 \u062a\u0639\u0637\u064a\u0644 \u0627\u0644\u062f\u0648\u0627\u0621', 'Medication disabled') });
      setDisableOpen(false);
      setDisableTarget(null);
      await Promise.all([mutate(), mutateCharges()]);
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const bulkImport = async () => {
    const rows = bulkRows.filter(
      (row) =>
        row.genericName.trim() &&
        (row.chargeCode.trim() || row.basePrice.trim() || bulkDefaults.basePrice.trim()) &&
        (row.strength.trim() || bulkDefaults.strength.trim())
    );
    if (!rows.length) return;
    setBulkSaving(true);
    try {
      const res = await fetch('/api/billing/medication-catalog/bulk', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map((row) => ({
            genericName: row.genericName.trim(),
            form: bulkDefaults.form.trim(),
            strength: row.strength.trim() || bulkDefaults.strength.trim(),
            routes: bulkDefaults.routes,
            chargeCode: row.chargeCode.trim().toUpperCase(),
            basePrice: row.basePrice.trim() || bulkDefaults.basePrice.trim(),
            isControlled: bulkDefaults.isControlled,
            controlledClass: bulkDefaults.controlledClass.trim(),
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Bulk import failed');
      toast({
        title: tr('اكتملت الإضافة المجمعة', 'Bulk import complete'),
        description: `${tr('تم إنشاء', 'Created')} ${json.createdCount || 0}, ${tr('أخطاء', 'errors')} ${json.errorCount || 0}`,
      });
      setBulkOpen(false);
      setBulkDefaults({
        form: '',
        strength: '',
        routes: ['PO'],
        basePrice: '',
        isControlled: false,
        controlledClass: '',
      });
      setBulkRows([{ genericName: '', strength: '', chargeCode: '', basePrice: '' }]);
      await Promise.all([mutate(), mutateCharges()]);
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  const rows = useMemo(() => {
    const byChargeId = new Map<string, any>(items.map((item: any) => [String(item.chargeCatalogId || ''), item]));
    const byChargeCode = new Map<string, any>(items.map((item: any) => [String(item.chargeCode || '').toUpperCase().trim(), item]));
    if (!chargeItems.length) return items;
    const merged = chargeItems.map((charge: any) => {
      const chargeId = String(charge.id || '').trim();
      const chargeCodeKey = String(charge.code || '').toUpperCase().trim();
      const linked = byChargeId.get(chargeId) || byChargeCode.get(chargeCodeKey);
      return {
        ...(linked ?? {}),
        chargeCatalogId: charge.id,
        chargeCode: charge.code,
        chargeName: charge.name,
        chargeStatus: charge.status,
      };
    });
    return merged;
  }, [items, chargeItems]);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('كتالوج الأدوية', 'Medication Catalog')}</h2>
          <p className="text-sm text-muted-foreground">{tr('دليل الأدوية v0.1', 'Formulary v0.1')}</p>
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
              <Button className="rounded-xl" onClick={() => { resetForm(); setAddOpen(true); }}>{tr('إضافة دواء', 'Add Medication')}</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
            <div className="grid grid-cols-8 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم العلمي', 'Generic Name')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشكل', 'Form')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التركيز', 'Strength')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('طرق الإعطاء', 'Routes')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز الرسوم', 'Charge Code')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مراقَب', 'Controlled')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
            </div>
            <div>
              {rows.length ? (
                rows.map((item: any, idx: number) => {
                  const medWithId = item.id ? item : items.find((m: any) =>
                    (m.chargeCatalogId && String(m.chargeCatalogId) === String(item.chargeCatalogId)) ||
                    (m.chargeCode && String(m.chargeCode || '').toUpperCase() === String(item.chargeCode || '').toUpperCase())
                  );
                  const actionableItem = medWithId || item;
                  return (
                  <div key={actionableItem.id || item.chargeCatalogId || item.chargeCode || `row-${idx}`} className="grid grid-cols-8 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast items-center">
                    <span className="text-sm text-foreground">{item.genericName || item.chargeName || '\u2014'}</span>
                    <span className="text-sm text-foreground">{item.form || '\u2014'}</span>
                    <span className="text-sm text-foreground">{item.strength || '\u2014'}</span>
                    <span className="text-sm text-foreground">{Array.isArray(item.routes) ? item.routes.join(', ') : '\u2014'}</span>
                    <span className="text-sm text-foreground">{item.chargeCode || '\u2014'}</span>
                    <span className="text-sm text-foreground">
                      {item.isControlled ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('مراقَب', 'CONTROLLED')}</span> : <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('لا', 'No')}</span>}
                    </span>
                    <span className="text-sm text-foreground">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{String(item.status || item.chargeStatus || 'ACTIVE')}</span>
                    </span>
                    <span className="text-sm text-foreground">
                      {actionableItem.id ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openEdit(actionableItem)}>
                            {tr('تعديل', 'Edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="rounded-xl"
                            onClick={() => openDisable(actionableItem)}
                            disabled={String(actionableItem.status || actionableItem.chargeStatus || '').toUpperCase() === 'INACTIVE'}
                          >
                            {tr('تعطيل', 'Disable')}
                          </Button>
                          <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => openDelete(actionableItem)}>
                            {tr('حذف', 'Delete')}
                          </Button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('لا توجد تفاصيل', 'No details')}</span>
                      )}
                    </span>
                  </div>
                ); })
              ) : (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  {tr('لم يتم العثور على أدوية.', 'No medications found.')}
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
            <DialogTitle>{tr('إضافة دواء', 'Add Medication')}</DialogTitle>
            <DialogDescription>{tr('إنشاء عنصر في دليل الأدوية.', 'Creates a formulary entry.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم العلمي', 'Generic Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={genericName} onChange={(e) => setGenericName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشكل', 'Form')}</span>
                <Input className="rounded-xl thea-input-focus" value={form} onChange={(e) => setForm(e.target.value)} placeholder="TAB / VIAL / AMP" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التركيز', 'Strength')}</span>
                <Input className="rounded-xl thea-input-focus" value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="500mg" />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('طرق الإعطاء', 'Routes')}</span>
              <div className="flex flex-wrap gap-3">
                {ROUTE_OPTIONS.map((route) => (
                  <label key={route.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={routes.includes(route.value)}
                      onCheckedChange={(value) => {
                        const checked = Boolean(value);
                        setRoutes((current) =>
                          checked
                            ? Array.from(new Set([...current, route.value]))
                            : current.filter((r) => r !== route.value)
                        );
                      }}
                    />
                    {route.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز الرسوم (اختياري)', 'Charge Code (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={chargeCode} onChange={(e) => setChargeCode(e.target.value)} placeholder="MED-0001" />
              <div className="text-xs text-muted-foreground">{tr('اختياري. إذا فارغ، السعر سينشئ الرسم.', 'Optional. If empty, price will create the charge.')}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
              <Input
                className="rounded-xl thea-input-focus"
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isControlled} onCheckedChange={(v) => setIsControlled(Boolean(v))} />
                {tr('مراقَب', 'Controlled')}
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفئة (اختياري)', 'Class (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={controlledClass} onChange={(e) => setControlledClass(e.target.value)} placeholder="NARCOTIC" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              className="rounded-xl"
              onClick={createItem}
              disabled={
                saving ||
                !genericName.trim() ||
                !form.trim() ||
                !strength.trim() ||
                !routes.length ||
                (!chargeCode.trim() && !basePrice.trim())
              }
            >
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعديل الدواء', 'Edit Medication')}</DialogTitle>
            <DialogDescription>{tr('رمز المسؤول مطلوب للتحديث.', 'Admin code required for updates.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم العلمي', 'Generic Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={genericName} onChange={(e) => setGenericName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشكل', 'Form')}</span>
                <Input className="rounded-xl thea-input-focus" value={form} onChange={(e) => setForm(e.target.value)} placeholder="TAB / VIAL / AMP" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التركيز', 'Strength')}</span>
                <Input className="rounded-xl thea-input-focus" value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="500mg" />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('طرق الإعطاء', 'Routes')}</span>
              <div className="flex flex-wrap gap-3">
                {ROUTE_OPTIONS.map((route) => (
                  <label key={route.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={routes.includes(route.value)}
                      onCheckedChange={(value) => {
                        const checked = Boolean(value);
                        setRoutes((current) =>
                          checked
                            ? Array.from(new Set([...current, route.value]))
                            : current.filter((r) => r !== route.value)
                        );
                      }}
                    />
                    {route.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز الرسوم (اختياري)', 'Charge Code (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={chargeCode} onChange={(e) => setChargeCode(e.target.value)} placeholder="MED-0001" />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isControlled} onCheckedChange={(v) => setIsControlled(Boolean(v))} />
                {tr('مراقَب', 'Controlled')}
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفئة (اختياري)', 'Class (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={controlledClass} onChange={(e) => setControlledClass(e.target.value)} placeholder="NARCOTIC" />
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
                !genericName.trim() ||
                !form.trim() ||
                !strength.trim() ||
                !routes.length
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
            <DialogTitle>{tr('تعطيل الدواء', 'Disable Medication')}</DialogTitle>
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
            <DialogTitle>{tr('حذف الدواء', 'Delete Medication')}</DialogTitle>
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
            <DialogTitle>{tr('إضافة أدوية مجمعة', 'Bulk Add Medications')}</DialogTitle>
            <DialogDescription>{tr('استخدم الإعدادات الافتراضية أعلاه، ثم أضف الصفوف أدناه.', 'Use defaults at the top, then add rows below.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="rounded-lg border p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشكل', 'Form')}</span>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={bulkDefaults.form}
                    onChange={(e) => setBulkDefaults((prev) => ({ ...prev, form: e.target.value }))}
                    placeholder="TAB / VIAL / AMP"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التركيز الافتراضي', 'Default Strength')}</span>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={bulkDefaults.strength}
                    onChange={(e) => setBulkDefaults((prev) => ({ ...prev, strength: e.target.value }))}
                    placeholder="500mg"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي الافتراضي', 'Default Base Price')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  type="number"
                  value={bulkDefaults.basePrice}
                  onChange={(e) => setBulkDefaults((prev) => ({ ...prev, basePrice: e.target.value }))}
                  placeholder="0.00"
                />
                <div className="text-xs text-muted-foreground">{tr('يستخدم عندما يكون رمز الرسوم فارغاً.', 'Used when Charge Code is empty.')}</div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('طرق الإعطاء', 'Routes')}</span>
                <div className="flex flex-wrap gap-3">
                  {ROUTE_OPTIONS.map((route) => (
                    <label key={route.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={bulkDefaults.routes.includes(route.value)}
                        onCheckedChange={(value) => {
                          const checked = Boolean(value);
                          setBulkDefaults((prev) => ({
                            ...prev,
                            routes: checked
                              ? Array.from(new Set([...prev.routes, route.value]))
                              : prev.routes.filter((r) => r !== route.value),
                          }));
                        }}
                      />
                      {route.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bulkDefaults.isControlled}
                    onCheckedChange={(v) => setBulkDefaults((prev) => ({ ...prev, isControlled: Boolean(v) }))}
                  />
                  Controlled
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفئة (اختياري)', 'Class (optional)')}</span>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={bulkDefaults.controlledClass}
                    onChange={(e) => setBulkDefaults((prev) => ({ ...prev, controlledClass: e.target.value }))}
                    placeholder="NARCOTIC"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الصفوف', 'Rows')}</span>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    setBulkRows((current) => [
                      ...current,
                      { genericName: '', strength: '', chargeCode: '', basePrice: '' },
                    ])
                  }
                >
                  {tr('إضافة صف', 'Add Row')}
                </Button>
              </div>
              <div className="space-y-3">
                {bulkRows.map((row, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-end">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم العلمي', 'Generic Name')}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={row.genericName}
                        onChange={(e) =>
                          setBulkRows((current) =>
                            current.map((r, i) => (i === index ? { ...r, genericName: e.target.value } : r))
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التركيز (اختياري)', 'Strength (optional)')}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={row.strength}
                        onChange={(e) =>
                          setBulkRows((current) =>
                            current.map((r, i) => (i === index ? { ...r, strength: e.target.value } : r))
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز الرسوم (اختياري)', 'Charge Code (optional)')}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={row.chargeCode}
                        onChange={(e) =>
                          setBulkRows((current) =>
                            current.map((r, i) => (i === index ? { ...r, chargeCode: e.target.value } : r))
                          )
                        }
                        placeholder="MED-0001"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        type="number"
                        value={row.basePrice}
                        onChange={(e) =>
                          setBulkRows((current) =>
                            current.map((r, i) => (i === index ? { ...r, basePrice: e.target.value } : r))
                          )
                        }
                        placeholder="0.00"
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
              onClick={bulkImport}
              disabled={
                bulkSaving ||
                !bulkDefaults.form.trim() ||
                !bulkDefaults.routes.length ||
                (!bulkDefaults.strength.trim() && bulkRows.some((row) => !row.strength.trim())) ||
                bulkRows.every(
                  (row) =>
                    !row.genericName.trim() ||
                    (!row.chargeCode.trim() && !row.basePrice.trim() && !bulkDefaults.basePrice.trim())
                )
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
