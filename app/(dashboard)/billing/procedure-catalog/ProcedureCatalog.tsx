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

const DEPARTMENTS = ['ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER'];
const APPLICABILITY = ['ER', 'OPD', 'IPD', 'ICU', 'OR'];
const UNIT_TYPES = ['PER_PROCEDURE', 'PER_VISIT', 'PER_TEST', 'PER_DAY', 'PER_DOSE'];
const STATUSES = ['ACTIVE', 'INACTIVE'];
const NONE_OPTION = '__NONE__';

export default function ProcedureCatalog() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/charge-catalog');

  const [search, setSearch] = useState('');
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  query.set('itemType', 'PROCEDURE');
  const searchParam = query.toString() ? `?${query.toString()}` : '';
  const { data, mutate } = useSWR(hasPermission ? `/api/billing/charge-catalog${searchParam}` : null, fetcher, {
    refreshInterval: 0,
  });
  const items = Array.isArray(data?.items) ? data.items : [];

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [disableTarget, setDisableTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [editAdminCode, setEditAdminCode] = useState('');
  const [disableAdminCode, setDisableAdminCode] = useState('');

  const [name, setName] = useState('');
  const [departmentDomain, setDepartmentDomain] = useState('');
  const [unitType, setUnitType] = useState('PER_PROCEDURE');
  const [basePrice, setBasePrice] = useState('');
  const [applicability, setApplicability] = useState<string[]>(['OR']);
  const [allowedForCash, setAllowedForCash] = useState(true);
  const [allowedForInsurance, setAllowedForInsurance] = useState(true);
  const [status, setStatus] = useState('ACTIVE');

  const [bulkDefaults, setBulkDefaults] = useState({
    departmentDomain: '',
    unitType: 'PER_PROCEDURE',
    applicability: ['OR'] as string[],
    allowedForCash: true,
    allowedForInsurance: true,
    status: 'ACTIVE',
  });
  const [bulkRows, setBulkRows] = useState<Array<{ name: string; basePrice: string }>>([{ name: '', basePrice: '' }]);

  const resetForm = () => {
    setName('');
    setDepartmentDomain('');
    setUnitType('PER_PROCEDURE');
    setBasePrice('');
    setApplicability(['OR']);
    setAllowedForCash(true);
    setAllowedForInsurance(true);
    setStatus('ACTIVE');
    setBulkDefaults({
      departmentDomain: '',
      unitType: 'PER_PROCEDURE',
      applicability: ['OR'],
      allowedForCash: true,
      allowedForInsurance: true,
      status: 'ACTIVE',
    });
    setBulkRows([{ name: '', basePrice: '' }]);
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    setName(item.name || '');
    setBasePrice(String(item.basePrice ?? ''));
    setAllowedForCash(Boolean(item.allowedForCash));
    setAllowedForInsurance(Boolean(item.allowedForInsurance));
    setStatus(item.status || 'ACTIVE');
    setDepartmentDomain(item.departmentDomain || '');
    setApplicability(Array.isArray(item.applicability) ? item.applicability : []);
    setUnitType(item.unitType || 'PER_PROCEDURE');
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

  const createProcedure = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        itemType: 'PROCEDURE',
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
      if (!res.ok) throw new Error(data.error || 'Failed to create procedure');
      toast({ title: tr('تم إنشاء الإجراء', 'Procedure created') });
      resetForm();
      setAddOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateProcedure = async () => {
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
      if (!res.ok) throw new Error(data.error || 'Failed to update procedure');
      toast({ title: data.noOp ? tr('لا توجد تغييرات', 'No changes') : tr('تم تحديث الإجراء', 'Procedure updated') });
      setEditOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteProcedure = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/billing/charge-catalog', {
        credentials: 'include',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id, adminCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete procedure');
      toast({ title: tr('تم حذف الإجراء', 'Procedure deleted') });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const disableProcedure = async () => {
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
      if (!res.ok) throw new Error(data.error || 'Failed to disable procedure');
      toast({ title: tr('تم تعطيل الإجراء', 'Procedure disabled') });
      setDisableOpen(false);
      setDisableTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const createBulkProcedures = async () => {
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
            itemType: 'PROCEDURE',
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
        description: `${tr('تم إنشاء', 'Created')} ${data.createdCount || 0}, ${tr('أخطاء', 'errors')} ${data.errorCount || 0}`,
      });
      setBulkOpen(false);
      setBulkDefaults({
        departmentDomain: '',
        unitType: 'PER_PROCEDURE',
        applicability: ['OR'],
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

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('كتالوج الإجراءات', 'Procedure Catalog')}</h2>
          <p className="text-sm text-muted-foreground">{tr('عناصر كتالوج الرسوم للإجراءات.', 'Charge catalog items for procedures.')}</p>
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
                {tr('إضافة إجراء', 'Add Procedure')}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
            <div className="grid grid-cols-9 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الوحدة', 'Unit Type')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نقدي', 'Cash')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تأمين', 'Insurance')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
            </div>
            {rows.length ? (
              rows.map((item: any) => (
                <div key={item.id} className="grid grid-cols-9 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast items-center">
                  <span className="text-sm text-foreground">{item.code}</span>
                  <span className="text-sm text-foreground">{item.name}</span>
                  <span className="text-sm text-foreground">{item.departmentDomain || '\u2014'}</span>
                  <span className="text-sm text-foreground">{item.unitType}</span>
                  <span className="text-sm text-foreground">{Number(item.basePrice).toFixed(2)}</span>
                  <span className="text-sm text-foreground">{item.allowedForCash ? tr('نعم', 'Yes') : tr('لا', 'No')}</span>
                  <span className="text-sm text-foreground">{item.allowedForInsurance ? tr('نعم', 'Yes') : tr('لا', 'No')}</span>
                  <span className="text-sm text-foreground">
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status}</span>
                  </span>
                  <span className="text-sm text-foreground">
                    <div className="flex gap-2">
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
                {tr('لم يتم العثور على إجراءات.', 'No procedures found.')}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة إجراء', 'Add Procedure')}</DialogTitle>
            <DialogDescription>{tr('يتم إنشاء الرمز تلقائياً (PRC-0001).', 'Code is generated automatically (PRC-0001).')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
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
              <Input className="rounded-xl thea-input-focus" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
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
                  <SelectValue placeholder="Status" />
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
            <Button className="rounded-xl" onClick={createProcedure} disabled={saving || !name.trim() || applicability.length === 0}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعديل الإجراء', 'Edit Procedure')}</DialogTitle>
            <DialogDescription>{tr('تعديل البيانات الوصفية فقط.', 'Adjust metadata only.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
              <Input className="rounded-xl thea-input-focus" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Department (optional)</span>
              <Select
                value={departmentDomain || NONE_OPTION}
                onValueChange={(value) => setDepartmentDomain(value === NONE_OPTION ? '' : value)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Department (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>None</SelectItem>
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
                  <SelectValue placeholder="Status" />
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
              onClick={updateProcedure}
              disabled={saving || !editAdminCode.trim() || !name.trim() || applicability.length === 0}
            >
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة إجراءات مجمعة', 'Bulk Add Procedures')}</DialogTitle>
            <DialogDescription>{tr('استخدم الإعدادات الافتراضية أعلاه، ثم أضف الصفوف أدناه.', 'Use defaults at the top, then add rows below.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="rounded-lg border p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم (اختياري)', 'Department (optional)')}</span>
                  <Select
                    value={bulkDefaults.departmentDomain || NONE_OPTION}
                    onValueChange={(value) =>
                      setBulkDefaults((prev) => ({ ...prev, departmentDomain: value === NONE_OPTION ? '' : value }))
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
                    onValueChange={(value) => setBulkDefaults((prev) => ({ ...prev, unitType: value }))}
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
                    onCheckedChange={(value) => setBulkDefaults((prev) => ({ ...prev, allowedForCash: Boolean(value) }))}
                  />
                  {tr('مسموح بالنقد', 'Cash Allowed')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bulkDefaults.allowedForInsurance}
                    onCheckedChange={(value) =>
                      setBulkDefaults((prev) => ({ ...prev, allowedForInsurance: Boolean(value) }))
                    }
                  />
                  {tr('مسموح بالتأمين', 'Insurance Allowed')}
                </label>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                <Select
                  value={bulkDefaults.status}
                  onValueChange={(value) => setBulkDefaults((prev) => ({ ...prev, status: value }))}
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
              onClick={createBulkProcedures}
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

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعطيل الإجراء', 'Disable Procedure')}</DialogTitle>
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
            <Button variant="secondary" className="rounded-xl" onClick={disableProcedure} disabled={saving || !disableAdminCode.trim()}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تعطيل', 'Disable')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('حذف الإجراء', 'Delete Procedure')}</DialogTitle>
            <DialogDescription>{tr('أدخل رمز الحذف للتأكيد.', 'Enter admin delete code to confirm.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
              <Input className="rounded-xl thea-input-focus" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={deleteProcedure} disabled={deleting || !adminCode.trim()}>
              {deleting ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
