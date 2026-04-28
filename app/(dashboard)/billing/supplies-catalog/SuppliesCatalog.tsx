'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const UNIT_TYPES = ['PER_VISIT', 'PER_TEST', 'PER_DAY', 'PER_PROCEDURE', 'PER_DOSE'];
const APPLICABILITY = ['ER', 'OPD', 'IPD', 'ICU', 'OR'];
const STATUSES = ['ACTIVE', 'INACTIVE'];
const DEPARTMENTS = ['ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER'];
const NONE_OPTION = '__NONE__';

export default function SuppliesCatalog() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/charge-catalog');
  const [search, setSearch] = useState('');
  const searchParam = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const { data, mutate } = useSWR(hasPermission ? `/api/catalogs/supplies${searchParam}` : null, fetcher, {
    refreshInterval: 0,
  });
  const items = Array.isArray(data?.items) ? data.items : [];
  const rows = useMemo(() => items, [items]);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [disableTarget, setDisableTarget] = useState<any>(null);
  const [usageTarget, setUsageTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [usageSaving, setUsageSaving] = useState(false);
  const [editAdminCode, setEditAdminCode] = useState('');
  const [deleteAdminCode, setDeleteAdminCode] = useState('');
  const [disableAdminCode, setDisableAdminCode] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [usageUnit, setUsageUnit] = useState('');
  const [description, setDescription] = useState('');
  const [generateCharge, setGenerateCharge] = useState(false);
  const [chargeCode, setChargeCode] = useState('');
  const [departmentDomain, setDepartmentDomain] = useState('');
  const [unitType, setUnitType] = useState('PER_VISIT');
  const [basePrice, setBasePrice] = useState('');
  const [applicability, setApplicability] = useState<string[]>(['ER']);
  const [allowedForCash, setAllowedForCash] = useState(true);
  const [allowedForInsurance, setAllowedForInsurance] = useState(true);
  const [status, setStatus] = useState('ACTIVE');

  const [usageEncounterId, setUsageEncounterId] = useState('');
  const [usageQuantity, setUsageQuantity] = useState('1');
  const [usageNote, setUsageNote] = useState('');
  const [usageRequestId, setUsageRequestId] = useState('');

  const isDev = process.env.NODE_ENV !== 'production';
  const generateRequestId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req-${Date.now()}`;

  const resetForm = () => {
    setName('');
    setCategory('');
    setUsageUnit('');
    setDescription('');
    setGenerateCharge(false);
    setChargeCode('');
    setDepartmentDomain('');
    setUnitType('PER_VISIT');
    setBasePrice('');
    setApplicability(['ER']);
    setAllowedForCash(true);
    setAllowedForInsurance(true);
    setStatus('ACTIVE');
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    setName(item.name || '');
    setCategory(item.category || '');
    setUsageUnit(item.usageUnit || '');
    setDescription(item.description || '');
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

  const openUsage = (item: any) => {
    setUsageTarget(item);
    setUsageEncounterId('');
    setUsageQuantity('1');
    setUsageNote('');
    setUsageRequestId('');
    setUsageOpen(true);
  };

  const createSupply = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        usageUnit: usageUnit.trim(),
        description: description.trim(),
        generateCharge,
        chargeCode: chargeCode.trim().toUpperCase(),
        departmentDomain: departmentDomain || null,
        unitType,
        basePrice: Number(basePrice),
        applicability,
        allowedForCash,
        allowedForInsurance,
        status,
      };
      const res = await fetch('/api/catalogs/supplies', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create supply');
      toast({ title: tr('\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0633\u062a\u0644\u0632\u0645', 'Supply created') });
      resetForm();
      setAddOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const updateSupply = async () => {
    if (!editTarget?.id) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        usageUnit: usageUnit.trim(),
        description: description.trim(),
        status,
        adminCode: editAdminCode.trim(),
      };
      const res = await fetch(`/api/catalogs/supplies/${editTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update supply');
      toast({ title: data.noOp ? tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u063a\u064a\u064a\u0631\u0627\u062a', 'No changes') : tr('\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0645\u0633\u062a\u0644\u0632\u0645', 'Supply updated') });
      setEditOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const deleteSupply = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/catalogs/supplies', {
        credentials: 'include',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id, adminCode: deleteAdminCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete supply');
      toast({ title: tr('\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u0645\u0633\u062a\u0644\u0632\u0645', 'Supply deleted') });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setDeleting(false);
    }
  };

  const disableSupply = async () => {
    if (!disableTarget?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/catalogs/supplies/${disableTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE', adminCode: disableAdminCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to disable supply');
      toast({ title: tr('\u062a\u0645 \u062a\u0639\u0637\u064a\u0644 \u0627\u0644\u0645\u0633\u062a\u0644\u0632\u0645', 'Supply disabled') });
      setDisableOpen(false);
      setDisableTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const logUsage = async () => {
    if (!usageTarget?.id) return;
    setUsageSaving(true);
    const requestId = usageRequestId || generateRequestId();
    if (!usageRequestId) {
      setUsageRequestId(requestId);
    }
    try {
      const payload = {
        supplyCatalogId: usageTarget.id,
        encounterId: usageEncounterId.trim(),
        quantity: Number(usageQuantity),
        note: usageNote.trim(),
        requestId,
      };
      const res = await fetch('/api/catalogs/supplies/usage', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to log usage');
      toast({ title: data.noOp ? tr('\u0644\u0627 \u064a\u0648\u062c\u062f \u062a\u063a\u064a\u064a\u0631', 'No change') : tr('\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645', 'Usage logged') });
      setUsageOpen(false);
      setUsageRequestId('');
    } catch (err: any) {
      toast({ title: tr('\u062e\u0637\u0623', 'Error'), description: err?.message || tr('\u0641\u0634\u0644\u062a \u0627\u0644\u0639\u0645\u0644\u064a\u0629', 'Failed'), variant: 'destructive' as const });
    } finally {
      setUsageSaving(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('كتالوج المستلزمات', 'Supplies Catalog')}</h2>
          <p className="text-sm text-muted-foreground">{tr('تتبع الاستخدام مع إنشاء رسوم اختياري.', 'Usage tracking with optional charge generation.')}</p>
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
              {tr('إضافة مستلزم', 'Add Supply')}
            </Button>
          </div>
          {/* Table header */}
          <div className="overflow-x-auto">
          <div className="min-w-[800px]">
          <div className="grid grid-cols-7 gap-4 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفئة', 'Category')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوحدة', 'Unit')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرسوم', 'Charge')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
          </div>
          {/* Table rows */}
          {rows.length ? (
            rows.map((item: any) => (
              <div key={item.id} className="grid grid-cols-7 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast items-center">
                <span className="text-sm text-foreground">{item.code}</span>
                <span className="text-sm text-foreground">{item.name}</span>
                <span className="text-sm text-foreground">{item.category || '\u2014'}</span>
                <span className="text-sm text-foreground">{item.usageUnit || '\u2014'}</span>
                <span className="text-sm text-foreground">{item.chargeCode ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.chargeCode}</span> : '\u2014'}</span>
                <span className="text-sm text-foreground">
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status || 'ACTIVE'}</span>
                </span>
                <span className="text-sm text-foreground">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openUsage(item)}>
                      {tr('تسجيل استخدام', 'Log Usage')}
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
            <div className="px-4 py-6 text-sm text-muted-foreground">{tr('لم يتم العثور على مستلزمات.', 'No supplies found.')}</div>
          )}
          </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة مستلزم', 'Add Supply')}</DialogTitle>
            <DialogDescription>{tr('تتبع الاستخدام فقط؛ إنشاء الرسوم اختياري.', 'Usage tracking only; charge generation optional.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفئة (اختياري)', 'Category (optional)')}</span>
                <Input className="rounded-xl thea-input-focus" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('وحدة الاستخدام (اختياري)', 'Usage Unit (optional)')}</span>
                <Input className="rounded-xl thea-input-focus" value={usageUnit} onChange={(e) => setUsageUnit(e.target.value)} placeholder="Pack / Piece" />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوصف (اختياري)', 'Description (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={generateCharge} onCheckedChange={(v) => setGenerateCharge(Boolean(v))} />
                {tr('إنشاء رسوم', 'Generate Charge')}
              </label>
            </div>
            {!generateCharge ? (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز الرسوم (اختياري)', 'Charge Code (optional)')}</span>
                <Input className="rounded-xl thea-input-focus" value={chargeCode} onChange={(e) => setChargeCode(e.target.value)} placeholder="SUP-0001" />
              </div>
            ) : null}
            {generateCharge ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الوحدة', 'Unit Type')}</span>
                    <Select value={unitType} onValueChange={setUnitType}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={tr('نوع الوحدة', 'Unit Type')} />
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
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم (اختياري)', 'Department (optional)')}</span>
                    <Select
                      value={departmentDomain || NONE_OPTION}
                      onValueChange={(value) => setDepartmentDomain(value === NONE_OPTION ? '' : value)}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={tr('القسم (اختياري)', 'Department (optional)')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_OPTION}>{tr('بدون', 'None')}</SelectItem>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={allowedForCash} onCheckedChange={(v) => setAllowedForCash(Boolean(v))} />
                    {tr('مسموح بالنقد', 'Cash Allowed')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={allowedForInsurance}
                      onCheckedChange={(v) => setAllowedForInsurance(Boolean(v))}
                    />
                    {tr('مسموح بالتأمين', 'Insurance Allowed')}
                  </label>
                </div>
              </>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              className="rounded-xl"
              onClick={createSupply}
              disabled={saving || !name.trim() || (generateCharge && (!basePrice.trim() || !applicability.length))}
            >
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعديل مستلزم', 'Edit Supply')}</DialogTitle>
            <DialogDescription>{tr('الحقول السريرية فقط (الرسوم غير قابلة للتعديل هنا).', 'Clinical fields only (charge not editable here).')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفئة (اختياري)', 'Category (optional)')}</span>
                <Input className="rounded-xl thea-input-focus" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('وحدة الاستخدام (اختياري)', 'Usage Unit (optional)')}</span>
                <Input className="rounded-xl thea-input-focus" value={usageUnit} onChange={(e) => setUsageUnit(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوصف (اختياري)', 'Description (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={description} onChange={(e) => setDescription(e.target.value)} />
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
            <Button className="rounded-xl" onClick={updateSupply} disabled={saving || !editAdminCode.trim() || !name.trim()}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعطيل مستلزم', 'Disable Supply')}</DialogTitle>
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
            <Button variant="secondary" className="rounded-xl" onClick={disableSupply} disabled={saving || !disableAdminCode.trim()}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تعطيل', 'Disable')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('حذف مستلزم', 'Delete Supply')}</DialogTitle>
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
            <Button variant="destructive" className="rounded-xl" onClick={deleteSupply} disabled={deleting || !deleteAdminCode.trim()}>
              {deleting ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={usageOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUsageRequestId('');
          }
          setUsageOpen(open);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تسجيل استخدام', 'Log Usage')}</DialogTitle>
            <DialogDescription>{tr('حدث استخدام للإلحاق فقط.', 'Append-only usage event.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معرف الزيارة', 'Encounter ID')}</span>
              <Input className="rounded-xl thea-input-focus" value={usageEncounterId} onChange={(e) => setUsageEncounterId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الكمية', 'Quantity')}</span>
              <Input
                className="rounded-xl thea-input-focus"
                type="number"
                min="1"
                step="1"
                value={usageQuantity}
                onChange={(e) => setUsageQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظة (اختياري)', 'Note (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={usageNote} onChange={(e) => setUsageNote(e.target.value)} />
            </div>
            {isDev ? (
              <div className="text-xs text-muted-foreground">requestId: {usageRequestId}</div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setUsageOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              className="rounded-xl"
              onClick={logUsage}
              disabled={usageSaving || !usageEncounterId.trim() || !usageQuantity.trim()}
            >
              {usageSaving ? tr('جاري الحفظ...', 'Saving...') : tr('تسجيل', 'Log')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
