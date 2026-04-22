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

const SERVICE_TYPES = ['VISIT', 'BED_DAY', 'NURSING', 'CONSULTATION'];
const APPLICABILITY = ['ER', 'OPD', 'IPD', 'ICU', 'OR'];
const STATUSES = ['ACTIVE', 'INACTIVE'];
const DEPARTMENTS = ['ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER'];
const NONE_OPTION = '__NONE__';

export default function ServiceCatalog() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/service-catalog');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('ALL');
  const searchParams = new URLSearchParams();
  if (search.trim()) searchParams.set('search', search.trim());
  if (filterType !== 'ALL') searchParams.set('serviceType', filterType);
  if (filterSpecialty !== 'ALL') searchParams.set('specialtyCode', filterSpecialty);
  const searchParam = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const { data, mutate } = useSWR(hasPermission ? `/api/catalogs/services${searchParam}` : null, fetcher, {
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
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [serviceType, setServiceType] = useState('VISIT');
  const [description, setDescription] = useState('');
  const [departmentDomain, setDepartmentDomain] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [specialtyCode, setSpecialtyCode] = useState('');
  const [pricingConsultant, setPricingConsultant] = useState('');
  const [pricingSpecialist, setPricingSpecialist] = useState('');
  const [pricingResident, setPricingResident] = useState('');
  const [pricingDefault, setPricingDefault] = useState('');
  const [followUpFree, setFollowUpFree] = useState(true);
  const [followUpDays, setFollowUpDays] = useState('14');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [applicability, setApplicability] = useState<string[]>(['ER']);
  const [allowedForCash, setAllowedForCash] = useState(true);
  const [allowedForInsurance, setAllowedForInsurance] = useState(true);
  const [status, setStatus] = useState('ACTIVE');

  const [usageEncounterId, setUsageEncounterId] = useState('');
  const [usageNote, setUsageNote] = useState('');
  const [usageRequestId, setUsageRequestId] = useState('');

  const { data: specialtiesData } = useSWR(hasPermission ? '/api/specialties' : null, fetcher);
  const specialties = Array.isArray(specialtiesData?.items) ? specialtiesData.items : [];

  const isDev = process.env.NODE_ENV !== 'production';
  const generateRequestId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req-${Date.now()}`;

  const resetForm = () => {
    setName('');
    setNameAr('');
    setNameEn('');
    setServiceType('VISIT');
    setDescription('');
    setDepartmentDomain('');
    setBasePrice('');
    setSpecialtyCode('');
    setPricingConsultant('');
    setPricingSpecialist('');
    setPricingResident('');
    setPricingDefault('');
    setFollowUpFree(true);
    setFollowUpDays('14');
    setRequiresApproval(false);
    setApplicability(['ER']);
    setAllowedForCash(true);
    setAllowedForInsurance(true);
    setStatus('ACTIVE');
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    setName(item.name || '');
    setNameAr(item.nameAr || '');
    setNameEn(item.nameEn || '');
    setServiceType(item.serviceType || 'VISIT');
    setDescription(item.description || '');
    setDepartmentDomain(item.departmentDomain || '');
    setBasePrice(String(item.basePrice ?? ''));
    setSpecialtyCode(item.specialtyCode || '');
    setPricingConsultant(String(item.pricing?.consultant ?? ''));
    setPricingSpecialist(String(item.pricing?.specialist ?? ''));
    setPricingResident(String(item.pricing?.resident ?? ''));
    setPricingDefault(String(item.pricing?.default ?? ''));
    setFollowUpFree(item.rules?.followUpFree !== false);
    setFollowUpDays(String(item.rules?.followUpDays ?? 14));
    setRequiresApproval(Boolean(item.rules?.requiresApproval));
    setApplicability(Array.isArray(item.applicability) ? item.applicability : []);
    setAllowedForCash(Boolean(item.allowedForCash));
    setAllowedForInsurance(Boolean(item.allowedForInsurance));
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
    setUsageNote('');
    setUsageRequestId('');
    setUsageOpen(true);
  };

  const createService = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        serviceType,
        description: description.trim(),
        departmentDomain: departmentDomain || null,
        basePrice: Number(basePrice),
        specialtyCode: specialtyCode || null,
        applicability,
        allowedForCash,
        allowedForInsurance,
        status,
        adminCode: editAdminCode.trim(),
        pricing:
          serviceType === 'CONSULTATION'
            ? {
                consultant: Number(pricingConsultant || pricingDefault || basePrice),
                specialist: Number(pricingSpecialist || pricingDefault || basePrice),
                resident: Number(pricingResident || pricingDefault || basePrice),
                default: Number(pricingDefault || basePrice),
              }
            : undefined,
        rules:
          serviceType === 'CONSULTATION'
            ? {
                followUpFree,
                followUpDays: Number(followUpDays || 14),
                requiresApproval,
              }
            : undefined,
      };
      const res = await fetch('/api/catalogs/services', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create service');
      toast({ title: tr('تم إنشاء الخدمة', 'Service created') });
      resetForm();
      setAddOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const updateService = async () => {
    if (!editTarget?.id) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        serviceType,
        description: description.trim(),
        departmentDomain: departmentDomain || null,
        basePrice: Number(basePrice),
        specialtyCode: specialtyCode || null,
        applicability,
        allowedForCash,
        allowedForInsurance,
        status,
        pricing:
          serviceType === 'CONSULTATION'
            ? {
                consultant: Number(pricingConsultant || pricingDefault || basePrice),
                specialist: Number(pricingSpecialist || pricingDefault || basePrice),
                resident: Number(pricingResident || pricingDefault || basePrice),
                default: Number(pricingDefault || basePrice),
              }
            : undefined,
        rules:
          serviceType === 'CONSULTATION'
            ? {
                followUpFree,
                followUpDays: Number(followUpDays || 14),
                requiresApproval,
              }
            : undefined,
      };
      const res = await fetch(`/api/catalogs/services/${editTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update service');
      toast({ title: data.noOp ? tr('لا توجد تغييرات', 'No changes') : tr('تم تحديث الخدمة', 'Service updated') });
      setEditOpen(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const deleteService = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/catalogs/services', {
        credentials: 'include',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id, adminCode: deleteAdminCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete service');
      toast({ title: tr('تم حذف الخدمة', 'Service deleted') });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setDeleting(false);
    }
  };

  const disableService = async () => {
    if (!disableTarget?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/catalogs/services/${disableTarget.id}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE', adminCode: disableAdminCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to disable service');
      toast({ title: tr('تم تعطيل الخدمة', 'Service disabled') });
      setDisableOpen(false);
      setDisableTarget(null);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
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
        serviceCatalogId: usageTarget.id,
        encounterId: usageEncounterId.trim(),
        note: usageNote.trim(),
        requestId,
      };
      const res = await fetch('/api/catalogs/services/usage', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to log usage');
      toast({ title: data.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم تسجيل الاستخدام', 'Usage logged') });
      setUsageOpen(false);
      setUsageRequestId('');
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
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
          <h2 className="text-lg font-semibold text-foreground">{tr('كتالوج الخدمات', 'Service Catalog')}</h2>
          <p className="text-sm text-muted-foreground">{tr('خدمات الزيارة واليوم التنويمي والتمريض مع إنشاء رسوم تلقائي.', 'Visit, bed-day, and nursing services with auto charges.')}</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder={tr('ابحث بالكود أو الاسم', 'Search by code or name')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs rounded-xl thea-input-focus"
              />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[170px] rounded-xl">
                  <SelectValue placeholder={tr('نوع الخدمة', 'Service Type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tr('كل الأنواع', 'All types')}</SelectItem>
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
                <SelectTrigger className="w-[200px] rounded-xl">
                  <SelectValue placeholder={tr('التخصص', 'Specialty')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tr('كل التخصصات', 'All specialties')}</SelectItem>
                  {specialties.map((spec: any) => (
                    <SelectItem key={spec.id} value={spec.code || spec.id}>
                      {spec.name || spec.code || spec.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="rounded-xl"
              onClick={() => {
                resetForm();
                setAddOpen(true);
              }}
            >
              {tr('إضافة خدمة', 'Add Service')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
            <div className="grid grid-cols-7 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التخصص', 'Specialty')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرسوم', 'Charge')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
            </div>
            {rows.length ? (
            rows.map((item: any) => (
              <div key={item.id} className="grid grid-cols-7 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast items-center">
                <span className="text-sm text-foreground">{item.code}</span>
                <span className="text-sm text-foreground">
                  <div className="font-medium">{item.name}</div>
                  {(item.nameAr || item.nameEn) && (
                    <div className="text-xs text-muted-foreground">
                      {item.nameAr ? `AR: ${item.nameAr}` : ''}{' '}
                      {item.nameEn ? `EN: ${item.nameEn}` : ''}
                    </div>
                  )}
                </span>
                <span className="text-sm text-foreground">{item.serviceType}</span>
                <span className="text-sm text-foreground">{item.specialtyCode || '—'}</span>
                <span className="text-sm text-foreground">{item.chargeCode ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.chargeCode}</span> : '—'}</span>
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
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {tr('لا توجد خدمات.', 'No services found.')}
            </div>
          )}
          </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{tr('إضافة خدمة', 'Add Service')}</DialogTitle>
            <DialogDescription>{tr('يتم إنشاء رسم تلقائي لكل خدمة.', 'Auto charge is created for every service.')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم (عربي)', 'Name (Arabic)')}</span>
                <Input className="rounded-xl thea-input-focus" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم (إنجليزي)', 'Name (English)')}</span>
                <Input className="rounded-xl thea-input-focus" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الخدمة', 'Service Type')}</span>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('نوع الخدمة', 'Service Type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((value) => (
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
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التخصص (اختياري)', 'Specialty (optional)')}</span>
              <Select value={specialtyCode || NONE_OPTION} onValueChange={(value) => setSpecialtyCode(value === NONE_OPTION ? '' : value)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('التخصص (اختياري)', 'Specialty (optional)')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>{tr('لا يوجد', 'None')}</SelectItem>
                  {specialties.map((spec: any) => (
                    <SelectItem key={spec.id} value={spec.code || spec.id}>
                      {spec.name || spec.code || spec.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {serviceType === 'CONSULTATION' && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-700">{tr('تسعير الاستشارة', 'Consultation Pricing')}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الافتراضي', 'Default Price')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="0.01" value={pricingDefault} onChange={(e) => setPricingDefault(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سعر الاستشاري', 'Consultant Price')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="0.01" value={pricingConsultant} onChange={(e) => setPricingConsultant(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سعر الأخصائي', 'Specialist Price')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="0.01" value={pricingSpecialist} onChange={(e) => setPricingSpecialist(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سعر المقيم', 'Resident Price')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="0.01" value={pricingResident} onChange={(e) => setPricingResident(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={followUpFree} onCheckedChange={(v) => setFollowUpFree(Boolean(v))} />
                    {tr('المتابعة مجانية', 'Follow-up free')}
                  </label>
                  <div className="space-y-1 md:col-span-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('أيام المتابعة', 'Follow-up Days')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="1" value={followUpDays} onChange={(e) => setFollowUpDays(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={requiresApproval} onCheckedChange={(v) => setRequiresApproval(Boolean(v))} />
                    {tr('يتطلب موافقة', 'Requires approval')}
                  </label>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوصف (اختياري)', 'Description (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
              <Input className="rounded-xl thea-input-focus" value={editAdminCode} onChange={(e) => setEditAdminCode(e.target.value)} placeholder={tr('مطلوب للحفظ', 'Required to save')} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ينطبق على', 'Applicability')}</span>
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
                <Select value={departmentDomain || NONE_OPTION} onValueChange={(value) => setDepartmentDomain(value === NONE_OPTION ? '' : value)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('القسم (اختياري)', 'Department (optional)')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_OPTION}>{tr('لا يوجد', 'None')}</SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
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
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={allowedForCash} onCheckedChange={(v) => setAllowedForCash(Boolean(v))} />
                {tr('السداد النقدي مسموح', 'Cash Allowed')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={allowedForInsurance} onCheckedChange={(v) => setAllowedForInsurance(Boolean(v))} />
                {tr('التأمين مسموح', 'Insurance Allowed')}
              </label>
            </div>
          </div>
          <div className="flex flex-shrink-0 justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl" onClick={createService} disabled={saving || !name.trim() || !basePrice.trim() || applicability.length === 0}>
              {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{tr('تعديل الخدمة', 'Edit Service')}</DialogTitle>
            <DialogDescription>{tr('يتم عكس التحديثات إلى الرسم المرتبط.', 'Updates are mirrored to the linked charge.')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم (عربي)', 'Name (Arabic)')}</span>
                <Input className="rounded-xl thea-input-focus" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم (إنجليزي)', 'Name (English)')}</span>
                <Input className="rounded-xl thea-input-focus" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الخدمة', 'Service Type')}</span>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('نوع الخدمة', 'Service Type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الأساسي', 'Base Price')}</span>
                <Input className="rounded-xl thea-input-focus" type="number" min="0" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التخصص (اختياري)', 'Specialty (optional)')}</span>
              <Select value={specialtyCode || NONE_OPTION} onValueChange={(value) => setSpecialtyCode(value === NONE_OPTION ? '' : value)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('التخصص (اختياري)', 'Specialty (optional)')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>{tr('لا يوجد', 'None')}</SelectItem>
                  {specialties.map((spec: any) => (
                    <SelectItem key={spec.id} value={spec.code || spec.id}>{spec.name || spec.code || spec.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {serviceType === 'CONSULTATION' && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-700">{tr('تسعير الاستشارة', 'Consultation Pricing')}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر الافتراضي', 'Default Price')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="0.01" value={pricingDefault} onChange={(e) => setPricingDefault(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سعر الاستشاري', 'Consultant Price')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="0.01" value={pricingConsultant} onChange={(e) => setPricingConsultant(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سعر الأخصائي', 'Specialist Price')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="0.01" value={pricingSpecialist} onChange={(e) => setPricingSpecialist(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سعر المقيم', 'Resident Price')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="0.01" value={pricingResident} onChange={(e) => setPricingResident(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={followUpFree} onCheckedChange={(v) => setFollowUpFree(Boolean(v))} />
                    {tr('المتابعة مجانية', 'Follow-up free')}
                  </label>
                  <div className="space-y-1 md:col-span-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('أيام المتابعة', 'Follow-up Days')}</span>
                    <Input className="rounded-xl thea-input-focus" type="number" min="0" step="1" value={followUpDays} onChange={(e) => setFollowUpDays(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={requiresApproval} onCheckedChange={(v) => setRequiresApproval(Boolean(v))} />
                    {tr('يتطلب موافقة', 'Requires approval')}
                  </label>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوصف (اختياري)', 'Description (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
              <Input className="rounded-xl thea-input-focus" value={editAdminCode} onChange={(e) => setEditAdminCode(e.target.value)} placeholder={tr('مطلوب للحفظ', 'Required to save')} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ينطبق على', 'Applicability')}</span>
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
                <Select value={departmentDomain || NONE_OPTION} onValueChange={(value) => setDepartmentDomain(value === NONE_OPTION ? '' : value)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('القسم (اختياري)', 'Department (optional)')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_OPTION}>{tr('لا يوجد', 'None')}</SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
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
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={allowedForCash} onCheckedChange={(v) => setAllowedForCash(Boolean(v))} />
                {tr('السداد النقدي مسموح', 'Cash Allowed')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={allowedForInsurance} onCheckedChange={(v) => setAllowedForInsurance(Boolean(v))} />
                {tr('التأمين مسموح', 'Insurance Allowed')}
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
              <Input className="rounded-xl thea-input-focus" value={editAdminCode} onChange={(e) => setEditAdminCode(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-shrink-0 justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl" onClick={updateService} disabled={saving || !editAdminCode.trim() || !name.trim() || !basePrice.trim() || applicability.length === 0}>
              {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعطيل الخدمة', 'Disable Service')}</DialogTitle>
            <DialogDescription>{tr('يضبط الحالة إلى غير نشط. يتطلب رمز المسؤول.', 'Sets status to INACTIVE. Admin code required.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
            <Input className="rounded-xl thea-input-focus" value={disableAdminCode} onChange={(e) => setDisableAdminCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDisableOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button variant="secondary" className="rounded-xl" onClick={disableService} disabled={saving || !disableAdminCode.trim()}>
              {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تعطيل', 'Disable')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('حذف الخدمة', 'Delete Service')}</DialogTitle>
            <DialogDescription>{tr('أدخل رمز حذف المسؤول للتأكيد.', 'Enter admin delete code to confirm.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز المسؤول', 'Admin Code')}</span>
            <Input className="rounded-xl thea-input-focus" value={deleteAdminCode} onChange={(e) => setDeleteAdminCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button variant="destructive" className="rounded-xl" onClick={deleteService} disabled={deleting || !deleteAdminCode.trim()}>
              {deleting ? tr('جارٍ الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={usageOpen}
        onOpenChange={(open) => {
          if (!open) { setUsageRequestId(''); }
          setUsageOpen(open);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تسجيل الاستخدام', 'Log Usage')}</DialogTitle>
            <DialogDescription>{tr('حدث استخدام بإضافة فقط.', 'Append-only usage event.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معرّف الزيارة', 'Encounter ID')}</span>
              <Input className="rounded-xl thea-input-focus" value={usageEncounterId} onChange={(e) => setUsageEncounterId(e.target.value)} />
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
            <Button variant="outline" className="rounded-xl" onClick={() => setUsageOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl" onClick={logUsage} disabled={usageSaving || !usageEncounterId.trim()}>
              {usageSaving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل', 'Log')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
