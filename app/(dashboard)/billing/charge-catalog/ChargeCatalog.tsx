'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const DEPARTMENTS = ['ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER'];
const ITEM_TYPES = ['VISIT', 'LAB_TEST', 'IMAGING', 'PROCEDURE', 'MEDICATION', 'BED', 'SUPPLY', 'SERVICE'];
const APPLICABILITY = ['ER', 'OPD', 'IPD', 'ICU', 'OR'];
const UNIT_TYPES = ['PER_VISIT', 'PER_TEST', 'PER_DAY', 'PER_PROCEDURE', 'PER_DOSE'];
const STATUSES = ['ACTIVE', 'INACTIVE'];
const NONE_OPTION = '__NONE__';

export default function ChargeCatalog() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/charge-catalog');

  const [search, setSearch] = useState('');
  const [controlledOnly, setControlledOnly] = useState(false);
  const searchParams = new URLSearchParams();
  if (search.trim()) searchParams.set('search', search.trim());
  if (controlledOnly) searchParams.set('controlledOnly', 'true');
  const searchParam = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const { data, mutate } = useSWR(
    hasPermission ? `/api/billing/charge-catalog${searchParam}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: medicationData } = useSWR(
    hasPermission ? '/api/billing/medication-catalog' : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  const medicationItems = Array.isArray(medicationData?.items) ? medicationData.items : [];

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableTarget, setDisableTarget] = useState<any>(null);
  const [adminCode, setAdminCode] = useState('');
  const [editAdminCode, setEditAdminCode] = useState('');
  const [disableAdminCode, setDisableAdminCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [selectedMedicationId, setSelectedMedicationId] = useState('');
  const [departmentDomain, setDepartmentDomain] = useState('');
  const [itemType, setItemType] = useState('VISIT');
  const [applicability, setApplicability] = useState<string[]>(['ER']);
  const [unitType, setUnitType] = useState('PER_VISIT');
  const [basePrice, setBasePrice] = useState('');
  const [allowedForCash, setAllowedForCash] = useState(true);
  const [allowedForInsurance, setAllowedForInsurance] = useState(true);
  const [status, setStatus] = useState('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDefaults, setBulkDefaults] = useState({
    itemType: 'VISIT',
    departmentDomain: '',
    unitType: 'PER_VISIT',
    applicability: ['ER'] as string[],
    allowedForCash: true,
    allowedForInsurance: true,
    status: 'ACTIVE',
  });
  const [bulkRows, setBulkRows] = useState<Array<{ name: string; basePrice: string }>>([
    { name: '', basePrice: '' },
  ]);

  const resetAddForm = () => {
    setName('');
    setSelectedMedicationId('');
    setDepartmentDomain('');
    setItemType('VISIT');
    setApplicability(['ER']);
    setUnitType('PER_VISIT');
    setBasePrice('');
    setAllowedForCash(true);
    setAllowedForInsurance(true);
    setStatus('ACTIVE');
    setBulkDefaults({
      itemType: 'VISIT',
      departmentDomain: '',
      unitType: 'PER_VISIT',
      applicability: ['ER'],
      allowedForCash: true,
      allowedForInsurance: true,
      status: 'ACTIVE',
    });
    setBulkRows([{ name: '', basePrice: '' }]);
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    setName(item.name || '');
    setSelectedMedicationId('');
    setBasePrice(String(item.basePrice ?? ''));
    setAllowedForCash(Boolean(item.allowedForCash));
    setAllowedForInsurance(Boolean(item.allowedForInsurance));
    setStatus(item.status || 'ACTIVE');
    setDepartmentDomain(item.departmentDomain || '');
    setApplicability(Array.isArray(item.applicability) ? item.applicability : []);
    setEditAdminCode('');
    setEditOpen(true);
  };

  const openDelete = (item: any) => {
    setDeleteTarget(item);
    setAdminCode('');
    setDeleteOpen(true);
  };

  const openDisable = (item: any) => {
    setDisableTarget(item);
    setDisableAdminCode('');
    setDisableOpen(true);
  };

  const openBulkDelete = () => {
    setDeleteTarget(null);
    setAdminCode('');
    setDeleteOpen(true);
  };

  const createCharge = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        itemType,
        departmentDomain: departmentDomain || null,
        applicability,
        unitType,
        basePrice: Number(basePrice),
        allowedForCash,
        allowedForInsurance,
        status,
      };
      const res = await fetch('/api/billing/charge-catalog', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create charge');
      toast({ title: tr('تم إنشاء الرسوم', 'Charge created') });
      resetAddForm();
      setAddOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateCharge = async () => {
    if (!editTarget?.id) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        basePrice: Number(basePrice),
        allowedForCash,
        allowedForInsurance,
        status,
        departmentDomain: departmentDomain || null,
        applicability,
        adminCode: editAdminCode.trim(),
      };
      const res = await fetch(`/api/billing/charge-catalog/${editTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update charge');
      toast({ title: data.noOp ? tr('لا توجد تغييرات', 'No changes') : tr('تم تحديث الرسوم', 'Charge updated') });
      setEditOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteCharge = async () => {
    const ids = deleteTarget?.id ? [deleteTarget.id] : selectedIds;
    if (!ids.length) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/billing/charge-catalog', {
        credentials: 'include',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, adminCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete charge');
      toast({ title: tr('تم حذف الرسوم', 'Charges deleted'), description: language === 'ar' ? `تم حذف ${data.deletedCount || ids.length}` : `Deleted ${data.deletedCount || ids.length}` });
      setDeleteOpen(false);
      setDeleteTarget(null);
      setSelectedIds([]);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const disableCharge = async () => {
    if (!disableTarget?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/billing/charge-catalog/${disableTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE', adminCode: disableAdminCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to disable charge');
      toast({ title: tr('تم تعطيل الرسوم', 'Charge disabled') });
      setDisableOpen(false);
      setDisableTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const createBulkCharges = async () => {
    const rows = bulkRows.filter((r) => r.name.trim() && String(r.basePrice).trim());
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
            itemType: bulkDefaults.itemType,
            departmentDomain: bulkDefaults.departmentDomain || null,
            unitType: bulkDefaults.unitType,
            applicability: bulkDefaults.applicability,
            allowedForCash: bulkDefaults.allowedForCash,
            allowedForInsurance: bulkDefaults.allowedForInsurance,
            status: bulkDefaults.status,
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
        itemType: 'VISIT',
        departmentDomain: '',
        unitType: 'PER_VISIT',
        applicability: ['ER'],
        allowedForCash: true,
        allowedForInsurance: true,
        status: 'ACTIVE',
      });
      setBulkRows([{ name: '', basePrice: '' }]);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  const rows = useMemo(() => items, [items]);
  const medicationOptions = useMemo(
    () =>
      medicationItems.map((item: any) => ({
        id: item.id,
        label: [item.genericName, item.strength, item.form].filter(Boolean).join(' '),
      })),
    [medicationItems]
  );

  useEffect(() => {
    if (editTarget?.itemType === 'MEDICATION') {
      const match = medicationOptions.find((option) => option.label === editTarget?.name);
      setSelectedMedicationId(match?.id || '');
      return;
    }
    if (editTarget) {
      setSelectedMedicationId('');
    }
  }, [editTarget, medicationOptions]);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('كتالوج الرسوم', 'Charge Catalog')}</h2>
          <p className="text-sm text-muted-foreground">{tr('البيانات الرئيسية فقط — بدون منطق الفوترة.', 'Master data only — no billing logic.')}</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <Input
                placeholder={tr('بحث بالرمز أو الاسم', 'Search by code or name')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs rounded-xl thea-input-focus"
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={controlledOnly} onCheckedChange={(value) => setControlledOnly(Boolean(value))} />
                {tr('المراقَبة فقط', 'Controlled only')}
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setBulkOpen(true)}>
                {tr('إضافة مجمعة', 'Bulk Add')}
              </Button>
              <Button className="rounded-xl" onClick={() => { resetAddForm(); setAddOpen(true); }}>{tr('إضافة رسوم', 'Add Charge')}</Button>
            </div>
          </div>

          {/* Grid Header */}
          <div className="grid grid-cols-13 gap-4 px-4 py-2">
            <span className="flex items-center">
              <Checkbox
                checked={rows.length > 0 && selectedIds.length === rows.length}
                onCheckedChange={(value) => {
                  const checked = Boolean(value);
                  setSelectedIds(checked ? rows.map((r: any) => r.id) : []);
                }}
              />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('قابلية التطبيق', 'Applicability')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الوحدة', 'Unit Type')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نقد', 'Cash')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تأمين', 'Insurance')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مراقَب', 'Controlled')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
            <span />
          </div>

          {/* Grid Rows */}
          <div className="space-y-1">
            {rows.length ? (
              rows.map((item: any) => (
                <div key={item.id} className="grid grid-cols-13 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast items-center">
                  <span>
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={(value) => {
                        const checked = Boolean(value);
                        setSelectedIds((current) =>
                          checked ? Array.from(new Set([...current, item.id])) : current.filter((id) => id !== item.id)
                        );
                      }}
                    />
                  </span>
                  <span className="text-sm text-foreground">{item.code}</span>
                  <span className="text-sm text-foreground">{item.name}</span>
                  <span className="text-sm text-foreground">{item.itemType || '—'}</span>
                  <span className="text-sm text-foreground">{Array.isArray(item.applicability) ? item.applicability.join(', ') : '—'}</span>
                  <span className="text-sm text-foreground">{item.departmentDomain || '—'}</span>
                  <span className="text-sm text-foreground">{item.unitType}</span>
                  <span className="text-sm text-foreground">{Number(item.basePrice).toFixed(2)}</span>
                  <span className="text-sm text-foreground">{item.allowedForCash ? tr('نعم', 'Yes') : tr('لا', 'No')}</span>
                  <span className="text-sm text-foreground">{item.allowedForInsurance ? tr('نعم', 'Yes') : tr('لا', 'No')}</span>
                  <span>
                    {Array.isArray(item.flags) && item.flags.includes('CONTROLLED') ? (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('مراقَب', 'CONTROLLED')}</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('لا', 'No')}</span>
                    )}
                  </span>
                  <span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status}</span>
                  </span>
                  <span>
                    <div className="flex gap-2">
                      {item.itemType === 'MEDICATION' && item.code ? (
                        <Button size="sm" variant="outline" className="rounded-xl" asChild>
                          <Link href={`/billing/medication-catalog?search=${encodeURIComponent(item.code)}`}>
                            {tr('فتح الدواء', 'Open Medication')}
                          </Link>
                        </Button>
                      ) : null}
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
              <div className="px-4 py-6 text-sm text-muted-foreground">
                {tr('لم يتم العثور على رسوم.', 'No charges found.')}
              </div>
            )}
          </div>

          {selectedIds.length ? (
            <div className="flex justify-end">
              <Button variant="destructive" className="rounded-xl" onClick={openBulkDelete}>
                {tr(`حذف المحدد (${selectedIds.length})`, `Delete Selected (${selectedIds.length})`)}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة رسوم', 'Add Charge')}</DialogTitle>
            <DialogDescription>{tr('تعريف عنصر كتالوج.', 'Define a catalog item.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{tr('يتم إنشاء الرمز تلقائياً.', 'Code is generated automatically.')}</div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={itemType === 'MEDICATION'}
                className="rounded-xl thea-input-focus"
              />
            </div>
            {itemType === 'MEDICATION' ? (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدواء', 'Medication')}</span>
                <Select
                  value={selectedMedicationId}
                  onValueChange={(value) => {
                    setSelectedMedicationId(value);
                    const selected = medicationOptions.find((option) => option.id === value);
                    if (selected) {
                      setName(selected.label);
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('اختر الدواء', 'Select medication')} />
                  </SelectTrigger>
                  <SelectContent>
                    {medicationOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع العنصر', 'Item Type')}</span>
                <Select value={itemType} onValueChange={setItemType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('نوع العنصر', 'Item Type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الوحدة', 'Unit Type')}</span>
                <Select value={unitType} onValueChange={setUnitType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('نوع الوحدة', 'Unit Type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
              <Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="rounded-xl thea-input-focus" />
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
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              className="rounded-xl"
              onClick={createCharge}
              disabled={saving || !name.trim() || applicability.length === 0 || (itemType === 'MEDICATION' && !selectedMedicationId)}
            >
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة مجمعة للرسوم', 'Bulk Add Charges')}</DialogTitle>
            <DialogDescription>
              {tr('عيّن الإعدادات الافتراضية مرة واحدة، ثم أضف صفوفًا بالاسم والسعر الأساسي.', 'Set defaults once, then add rows with Name and Base Price.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-2 max-h-[60vh]">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع العنصر', 'Item Type')}</span>
                <Select
                  value={bulkDefaults.itemType}
                  onValueChange={(value) => setBulkDefaults((s) => ({ ...s, itemType: value }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('نوع العنصر', 'Item Type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم (اختياري)', 'Department (optional)')}</span>
                <Select
                  value={bulkDefaults.departmentDomain || NONE_OPTION}
                  onValueChange={(value) =>
                    setBulkDefaults((s) => ({ ...s, departmentDomain: value === NONE_OPTION ? '' : value }))
                  }
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
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الوحدة', 'Unit Type')}</span>
                <Select
                  value={bulkDefaults.unitType}
                  onValueChange={(value) => setBulkDefaults((s) => ({ ...s, unitType: value }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('نوع الوحدة', 'Unit Type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                <Select
                  value={bulkDefaults.status}
                  onValueChange={(value) => setBulkDefaults((s) => ({ ...s, status: value }))}
                >
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
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('قابلية التطبيق', 'Applicability')}</span>
              <div className="flex flex-wrap gap-3">
                {APPLICABILITY.map((app) => (
                  <label key={app} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={bulkDefaults.applicability.includes(app)}
                      onCheckedChange={(value) => {
                        const checked = Boolean(value);
                        setBulkDefaults((current) => ({
                          ...current,
                          applicability: checked
                            ? Array.from(new Set([...current.applicability, app]))
                            : current.applicability.filter((x) => x !== app),
                        }));
                      }}
                    />
                    {app}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={bulkDefaults.allowedForCash}
                  onCheckedChange={(value) => setBulkDefaults((s) => ({ ...s, allowedForCash: Boolean(value) }))}
                />
                {tr('مسموح بالنقد', 'Cash Allowed')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={bulkDefaults.allowedForInsurance}
                  onCheckedChange={(value) => setBulkDefaults((s) => ({ ...s, allowedForInsurance: Boolean(value) }))}
                />
                {tr('مسموح بالتأمين', 'Insurance Allowed')}
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العناصر', 'Items')}</span>
              <div className="space-y-2">
                {bulkRows.map((row, idx) => (
                  <div key={idx} className="grid gap-2 md:grid-cols-[1fr_180px_auto] items-center">
                    <Input
                      placeholder={tr('الاسم', 'Name')}
                      value={row.name}
                      onChange={(e) =>
                        setBulkRows((current) =>
                          current.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                        )
                      }
                      className="rounded-xl thea-input-focus"
                    />
                    <Input
                      type="number"
                      placeholder={tr('السعر الأساسي', 'Base Price')}
                      value={row.basePrice}
                      onChange={(e) =>
                        setBulkRows((current) =>
                          current.map((r, i) => (i === idx ? { ...r, basePrice: e.target.value } : r))
                        )
                      }
                      className="rounded-xl thea-input-focus"
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setBulkRows((current) => current.filter((_, i) => i !== idx))}
                      disabled={bulkRows.length <= 1}
                    >
                      {tr('إزالة', 'Remove')}
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setBulkRows((current) => [...current, { name: '', basePrice: '' }])}
              >
                {tr('إضافة عنصر', 'Add Item')}
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" className="rounded-xl" onClick={() => setBulkOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              className="rounded-xl"
              onClick={createBulkCharges}
              disabled={bulkSaving || bulkRows.every((row) => !row.name.trim() || !String(row.basePrice).trim())}
            >
              {bulkSaving ? tr('جاري الاستيراد...', 'Importing...') : tr('استيراد', 'Import')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('حذف رسوم', 'Delete Charge')}</DialogTitle>
            <DialogDescription>
              {deleteTarget?.id
                ? tr('أدخل رمز الحذف للتأكيد.', 'Enter admin delete code to confirm.')
                : tr(`أدخل رمز الحذف لحذف ${selectedIds.length} عنصر(عناصر).`, `Enter admin delete code to delete ${selectedIds.length} item(s).`)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
            <Input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} className="rounded-xl thea-input-focus" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={deleteCharge} disabled={deleting || !adminCode.trim()}>
              {deleting ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعطيل رسوم', 'Disable Charge')}</DialogTitle>
            <DialogDescription>
              {tr('سيتم تغيير الحالة إلى غير نشط. أدخل رمز المسؤول للتأكيد.', 'This will set the status to INACTIVE. Enter admin delete code to confirm.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
            <Input value={disableAdminCode} onChange={(e) => setDisableAdminCode(e.target.value)} className="rounded-xl thea-input-focus" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDisableOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={disableCharge}
              disabled={saving || !disableAdminCode.trim()}
            >
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تعطيل', 'Disable')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعديل رسوم', 'Edit Charge')}</DialogTitle>
            <DialogDescription>{tr('يمكن تغيير الحقول المسموح بها فقط.', 'Only allowed fields can change.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={editTarget?.itemType === 'MEDICATION'}
                className="rounded-xl thea-input-focus"
              />
            </div>
            {editTarget?.itemType === 'MEDICATION' ? (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدواء', 'Medication')}</span>
                <Select
                  value={selectedMedicationId}
                  onValueChange={(value) => {
                    setSelectedMedicationId(value);
                    const selected = medicationOptions.find((option) => option.id === value);
                    if (selected) {
                      setName(selected.label);
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('اختر الدواء', 'Select medication')} />
                  </SelectTrigger>
                  <SelectContent>
                    {medicationOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
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
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
              <Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="rounded-xl thea-input-focus" />
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
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
              <Input value={editAdminCode} onChange={(e) => setEditAdminCode(e.target.value)} className="rounded-xl thea-input-focus" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button className="rounded-xl" onClick={updateCharge} disabled={saving || !editAdminCode.trim()}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تحديث', 'Update')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
