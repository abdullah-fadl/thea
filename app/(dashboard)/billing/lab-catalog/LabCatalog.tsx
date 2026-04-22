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

export default function LabCatalog() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/charge-catalog');
  const [search, setSearch] = useState('');
  const query = `?itemType=LAB_TEST${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`;
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
  const [labSpecimen, setLabSpecimen] = useState('');
  const [labMethod, setLabMethod] = useState('');
  const [labPrepNotes, setLabPrepNotes] = useState('');
  const [bulkDefaults, setBulkDefaults] = useState({
    unitType: 'PER_TEST',
    applicability: ['ER'] as string[],
    allowedForCash: true,
    allowedForInsurance: true,
    status: 'ACTIVE',
    labSpecimen: '',
    labMethod: '',
    labPrepNotes: '',
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
    setLabSpecimen('');
    setLabMethod('');
    setLabPrepNotes('');
    setBulkDefaults({
      unitType: 'PER_TEST',
      applicability: ['ER'],
      allowedForCash: true,
      allowedForInsurance: true,
      status: 'ACTIVE',
      labSpecimen: '',
      labMethod: '',
      labPrepNotes: '',
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
    setLabSpecimen(item.labSpecimen || '');
    setLabMethod(item.labMethod || '');
    setLabPrepNotes(item.labPrepNotes || '');
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
        itemType: 'LAB_TEST',
        departmentDomain: 'LAB',
        unitType,
        basePrice: Number(basePrice),
        applicability,
        allowedForCash,
        allowedForInsurance,
        status,
        labSpecimen,
        labMethod,
        labPrepNotes,
      };
      const res = await fetch('/api/billing/charge-catalog', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to create lab item');
      toast({ title: tr('تم إنشاء عنصر المختبر', 'Lab item created') });
      resetForm();
      setAddOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
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
        departmentDomain: 'LAB',
        unitType,
        basePrice: Number(basePrice),
        applicability,
        allowedForCash,
        allowedForInsurance,
        status,
        labSpecimen,
        labMethod,
        labPrepNotes,
        adminCode: editAdminCode.trim(),
      };
      const res = await fetch(`/api/billing/charge-catalog/${editTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to update lab item');
      toast({ title: json.noOp ? 'No changes' : 'Lab item updated' });
      setEditOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
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
      if (!res.ok) throw new Error(json.error || 'Failed to delete lab item');
      toast({ title: tr('تم حذف عنصر المختبر', 'Lab item deleted') });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
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
      if (!res.ok) throw new Error(json.error || 'Failed to disable lab item');
      toast({ title: tr('تم تعطيل عنصر المختبر', 'Lab item disabled') });
      setDisableOpen(false);
      setDisableTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
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
            itemType: 'LAB_TEST',
            departmentDomain: 'LAB',
            unitType: bulkDefaults.unitType,
            applicability: bulkDefaults.applicability,
            allowedForCash: bulkDefaults.allowedForCash,
            allowedForInsurance: bulkDefaults.allowedForInsurance,
            status: bulkDefaults.status,
            labSpecimen: bulkDefaults.labSpecimen,
            labMethod: bulkDefaults.labMethod,
            labPrepNotes: bulkDefaults.labPrepNotes,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bulk import failed');
      toast({
        title: 'Bulk import complete',
        description: `Created ${data.createdCount || 0}, errors ${data.errorCount || 0}`,
      });
      setBulkOpen(false);
      setBulkDefaults({
        unitType: 'PER_TEST',
        applicability: ['ER'],
        allowedForCash: true,
        allowedForInsurance: true,
        status: 'ACTIVE',
        labSpecimen: '',
        labMethod: '',
        labPrepNotes: '',
      });
      setBulkRows([{ name: '', basePrice: '' }]);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
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
          <h2 className="text-lg font-semibold text-foreground">Lab Catalog</h2>
          <p className="text-sm text-muted-foreground">Charge catalog items for laboratory tests.</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Input
              placeholder="Search by code or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs rounded-xl thea-input-focus"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setBulkOpen(true)}>
                Bulk Add
              </Button>
              <Button
                className="rounded-xl"
                onClick={() => {
                  resetForm();
                  setAddOpen(true);
                }}
              >
                Add Lab Item
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
            <div className="grid grid-cols-8 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Type</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base Price</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Specimen</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Method</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
            </div>
            <div>
              {rows.length ? (
                rows.map((item: any) => (
                  <div key={item.id} className="grid grid-cols-8 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast items-center">
                    <span className="text-sm text-foreground">{item.code}</span>
                    <span className="text-sm text-foreground">{item.name}</span>
                    <span className="text-sm text-foreground">{item.unitType}</span>
                    <span className="text-sm text-foreground">{Number(item.basePrice).toFixed(2)}</span>
                    <span className="text-sm text-foreground">{item.labSpecimen || '—'}</span>
                    <span className="text-sm text-foreground">{item.labMethod || '—'}</span>
                    <span className="text-sm text-foreground">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status}</span>
                    </span>
                    <span className="text-sm text-foreground">
                      <div className="flex gap-2">
                        <Button className="rounded-xl" size="sm" variant="outline" onClick={() => openEdit(item)}>
                          Edit
                        </Button>
                        <Button
                          className="rounded-xl"
                          size="sm"
                          variant="secondary"
                          onClick={() => openDisable(item)}
                          disabled={String(item.status || '').toUpperCase() === 'INACTIVE'}
                        >
                          Disable
                        </Button>
                        <Button className="rounded-xl" size="sm" variant="destructive" onClick={() => openDelete(item)}>
                          Delete
                        </Button>
                      </div>
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-muted-foreground">No lab items found.</div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Lab Item</DialogTitle>
            <DialogDescription>Creates a charge catalog entry for labs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Type</span>
                <Select value={unitType} onValueChange={setUnitType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select unit type" />
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
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base Price</span>
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
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Specimen (optional)</span>
                <Input className="rounded-xl thea-input-focus" value={labSpecimen} onChange={(e) => setLabSpecimen(e.target.value)} placeholder="Blood" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Method (optional)</span>
                <Input className="rounded-xl thea-input-focus" value={labMethod} onChange={(e) => setLabMethod(e.target.value)} placeholder="ELISA" />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prep Notes (optional)</span>
              <Input className="rounded-xl thea-input-focus" value={labPrepNotes} onChange={(e) => setLabPrepNotes(e.target.value)} placeholder="Fasting 8 hours" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Applicability</span>
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
                Cash Allowed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={allowedForInsurance} onCheckedChange={(v) => setAllowedForInsurance(Boolean(v))} />
                Insurance Allowed
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
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
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={createItem}
              disabled={saving || !name.trim() || !basePrice.trim() || applicability.length === 0}
            >
              {saving ? 'Saving...' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lab Item</DialogTitle>
            <DialogDescription>Admin code required for updates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Type</span>
                <Select value={unitType} onValueChange={setUnitType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select unit type" />
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
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base Price</span>
                <Input className="rounded-xl thea-input-focus" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Applicability</span>
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
                Cash Allowed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allowedForInsurance}
                  onCheckedChange={(value) => setAllowedForInsurance(Boolean(value))}
                />
                Insurance Allowed
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
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
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Specimen</span>
                <Input className="rounded-xl thea-input-focus" value={labSpecimen} onChange={(e) => setLabSpecimen(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Method</span>
                <Input className="rounded-xl thea-input-focus" value={labMethod} onChange={(e) => setLabMethod(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prep Notes</span>
              <Input className="rounded-xl thea-input-focus" value={labPrepNotes} onChange={(e) => setLabPrepNotes(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Code</span>
              <Input className="rounded-xl thea-input-focus" value={editAdminCode} onChange={(e) => setEditAdminCode(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>
              Cancel
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
              {saving ? 'Saving...' : 'Update'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Disable Lab Item</DialogTitle>
            <DialogDescription>Sets status to INACTIVE. Admin code required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Code</span>
            <Input className="rounded-xl thea-input-focus" value={disableAdminCode} onChange={(e) => setDisableAdminCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDisableOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" className="rounded-xl" onClick={disableItem} disabled={saving || !disableAdminCode.trim()}>
              {saving ? 'Saving...' : 'Disable'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Lab Item</DialogTitle>
            <DialogDescription>Enter admin delete code to confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Code</span>
            <Input className="rounded-xl thea-input-focus" value={deleteAdminCode} onChange={(e) => setDeleteAdminCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={deleteItem} disabled={saving || !deleteAdminCode.trim()}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Add Lab Items</DialogTitle>
            <DialogDescription>Use defaults at the top, then add rows below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="rounded-lg border p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Type</span>
                  <Select
                    value={bulkDefaults.unitType}
                    onValueChange={(value) => setBulkDefaults((prev) => ({ ...prev, unitType: value }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select unit type" />
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
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
                  <Select
                    value={bulkDefaults.status}
                    onValueChange={(value) => setBulkDefaults((prev) => ({ ...prev, status: value }))}
                  >
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
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Applicability</span>
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
                  Cash Allowed
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bulkDefaults.allowedForInsurance}
                    onCheckedChange={(v) =>
                      setBulkDefaults((prev) => ({ ...prev, allowedForInsurance: Boolean(v) }))
                    }
                  />
                  Insurance Allowed
                </label>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Specimen (optional)</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={bulkDefaults.labSpecimen}
                  onChange={(e) => setBulkDefaults((prev) => ({ ...prev, labSpecimen: e.target.value }))}
                  placeholder="Blood"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Method (optional)</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={bulkDefaults.labMethod}
                  onChange={(e) => setBulkDefaults((prev) => ({ ...prev, labMethod: e.target.value }))}
                  placeholder="ELISA"
                />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prep Notes (optional)</span>
              <Input
                className="rounded-xl thea-input-focus"
                value={bulkDefaults.labPrepNotes}
                onChange={(e) => setBulkDefaults((prev) => ({ ...prev, labPrepNotes: e.target.value }))}
                placeholder="Fasting 8 hours"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rows</span>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setBulkRows((current) => [...current, { name: '', basePrice: '' }])}
                >
                  Add Row
                </Button>
              </div>
              <div className="space-y-3">
                {bulkRows.map((row, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1.5fr_1fr_auto] items-end">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
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
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base Price</span>
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
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setBulkOpen(false)}>
              Cancel
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
              {bulkSaving ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
