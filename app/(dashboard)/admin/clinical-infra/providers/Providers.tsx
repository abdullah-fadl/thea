'use client';

import { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Search } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = async (url: string) => {
  const r = await fetch(url, { credentials: 'include' });
  const json = await r.json().catch(() => ({}));
  return { ...json, _status: r.status };
};

const QUICK_LINKS = [
  { href: '/admin/clinical-infra/facilities', label: 'Facilities' },
  { href: '/admin/clinical-infra/units', label: 'Clinical Units' },
  { href: '/admin/clinical-infra/floors', label: 'Floors' },
  { href: '/admin/clinical-infra/rooms', label: 'Rooms' },
  { href: '/admin/clinical-infra/beds', label: 'Beds' },
  { href: '/admin/clinical-infra/specialties', label: 'Specialties' },
  { href: '/admin/clinical-infra/clinics', label: 'Clinics' },
  { href: '/admin/clinical-infra/providers', label: 'Providers' },
];

const NONE_OPTION = '__NONE__';

function splitCsv(value: string) {
  return value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

const PROVIDERS_TEMPLATE = [
  'displayName,staffId,licenseNumber,email,employmentType,units,specialties,roomIds,canPrescribe,canRequestImaging,canPerformProcedures,procedureCategories',
  'Dr Ahmed Ali,1001,SCFHS123,a@h.com,FULL_TIME,OPD,Ophthalmology,OPD-OPHTH-EXAM-01|OPD-OPHTH-OCT-01,TRUE,TRUE,FALSE,',
].join('\n');

export default function Providers() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('__all__');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const summaryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (specialtyFilter && specialtyFilter !== '__all__') params.set('specialtyId', specialtyFilter);
    const qs = params.toString();
    return qs ? `/api/clinical-infra/providers/summary?${qs}` : '/api/clinical-infra/providers/summary';
  }, [debouncedSearch, specialtyFilter]);
  const { data, mutate } = useSWR(summaryUrl, fetcher);
  const providers = Array.isArray(data?.items) ? data.items : [];
  const status = Number(data?._status || 0);

  const { data: unitsData } = useSWR('/api/clinical-infra/units', fetcher);
  const { data: roomsData } = useSWR('/api/clinical-infra/rooms', fetcher);
  const { data: specsData } = useSWR('/api/clinical-infra/specialties', fetcher);
  const { data: consultServicesData } = useSWR('/api/catalogs/services?serviceType=CONSULTATION', fetcher);
  const units = Array.isArray(unitsData?.items) ? unitsData.items : [];
  const rooms = Array.isArray(roomsData?.items) ? roomsData.items : [];
  const specs = Array.isArray(specsData?.items) ? specsData.items : [];
  const consultationServices = Array.isArray(consultServicesData?.items) ? consultServicesData.items : [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ displayName: '', email: '', staffId: '', employmentType: 'FULL_TIME' });
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [priv, setPriv] = useState<any>({
    canPrescribe: false,
    canOrderNarcotics: false,
    canRequestImaging: false,
    canPerformProcedures: false,
    procedureCategories: '',
  });
  const [assign, setAssign] = useState<any>({
    licenseNumber: '',
    unitIds: [] as string[],
    specialtyIds: [] as string[],
    roomIds: [] as string[],
    scopeUnitIds: [] as string[],
    consultationServiceCode: '',
    level: 'CONSULTANT',
  });
  const selectedUnitValue = (assign.unitIds || [])[assign.unitIds.length - 1] || '';
  const selectedSpecialtyValue = (assign.specialtyIds || [])[assign.specialtyIds.length - 1] || '';
  const selectedRoomValue = (assign.roomIds || [])[assign.roomIds.length - 1] || '';
  const selectedScopeUnitValue = (assign.scopeUnitIds || [])[assign.scopeUnitIds.length - 1] || '';
  const formatSelected = (names: string[], emptyLabel: string) => {
    if (!names.length) return emptyLabel;
    if (names.length === 1) return names[0];
    return `${names[0]} +${names.length - 1}`;
  };
  const selectedUnitNames = (assign.unitIds || [])
    .map((id: string) => units.find((u: any) => String(u.id) === String(id))?.name || id)
    .filter(Boolean);
  const selectedSpecialtyNames = (assign.specialtyIds || [])
    .map((id: string) => specs.find((s: any) => String(s.id) === String(id))?.name || id)
    .filter(Boolean);
  const selectedRoomNames = (assign.roomIds || [])
    .map((id: string) => rooms.find((r: any) => String(r.id) === String(id))?.name || id)
    .filter(Boolean);
  const selectedScopeUnitNames = (assign.scopeUnitIds || [])
    .map((id: string) => units.find((u: any) => String(u.id) === String(id))?.name || id)
    .filter(Boolean);
  const getQuickLinkLabel = (label: string) => {
    if (label === 'Facilities') return tr('المنشآت', 'Facilities');
    if (label === 'Clinical Units') return tr('الوحدات السريرية', 'Clinical Units');
    if (label === 'Floors') return tr('الطوابق', 'Floors');
    if (label === 'Rooms') return tr('الغرف', 'Rooms');
    if (label === 'Beds') return tr('الأسرّة', 'Beds');
    if (label === 'Specialties') return tr('التخصصات', 'Specialties');
    if (label === 'Clinics') return tr('العيادات', 'Clinics');
    return tr('مقدمو الخدمة', 'Providers');
  };

  const selectedSpecialtyCodes = useMemo(() => {
    const selectedIds = new Set((assign.specialtyIds || []).map((id: string) => String(id)));
    return specs
      .filter((sp: any) => selectedIds.has(String(sp.id)))
      .map((sp: any) => String(sp.code || sp.id));
  }, [assign.specialtyIds, specs]);

  const filteredConsultationServices = useMemo(() => consultationServices, [consultationServices]);

  const sorted = useMemo(() => {
    return [...providers].sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
  }, [providers]);

  const loadDetail = async (providerId: string) => {
    const [p1, p2] = await Promise.all([
      fetch(`/api/clinical-infra/providers/${providerId}/privileges`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/clinical-infra/providers/${providerId}/assignments`, { credentials: 'include' }).then((r) => r.json()),
    ]);
    setPriv({
      canPrescribe: Boolean(p1?.item?.canPrescribe),
      canOrderNarcotics: Boolean(p1?.item?.canOrderNarcotics),
      canRequestImaging: Boolean(p1?.item?.canRequestImaging),
      canPerformProcedures: Boolean(p1?.item?.canPerformProcedures),
      procedureCategories: Array.isArray(p1?.item?.procedureCategories) ? p1.item.procedureCategories.join(', ') : '',
    });
    setAssign({
      licenseNumber: String(p2?.profile?.licenseNumber || ''),
      unitIds: Array.isArray(p2?.profile?.unitIds) ? p2.profile.unitIds : [],
      specialtyIds: Array.isArray(p2?.profile?.specialtyIds) ? p2.profile.specialtyIds : [],
      roomIds: Array.isArray(p2?.roomAssignments?.roomIds) ? p2.roomAssignments.roomIds : [],
      scopeUnitIds: Array.isArray(p2?.unitScopes?.unitIds) ? p2.unitScopes.unitIds : [],
      consultationServiceCode: String(p2?.profile?.consultationServiceCode || ''),
      level: String(p2?.profile?.level || 'CONSULTANT'),
    });
  };

  const startCreate = () => {
    setEditing(null);
    setForm({ displayName: '', email: '', staffId: '', employmentType: 'FULL_TIME' });
    setPriv({
      canPrescribe: false,
      canOrderNarcotics: false,
      canRequestImaging: false,
      canPerformProcedures: false,
      procedureCategories: '',
    });
    setAssign({
      licenseNumber: '',
      unitIds: [],
      specialtyIds: [],
      roomIds: [],
      scopeUnitIds: [],
      consultationServiceCode: '',
      level: 'CONSULTANT',
    });
    setOpen(true);
  };

  const startEdit = async (item: any) => {
    setEditing(item);
    setForm({
      displayName: item.displayName || '',
      email: item.email || '',
      staffId: item.staffId || '',
      employmentType: item.employmentType || 'FULL_TIME',
    });
    await loadDetail(String(item.id));
    setOpen(true);
  };

  const saveProvider = async () => {
    setBusy(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { ...form, id: editing.id } : { ...form };
      const res = await fetch('/api/clinical-infra/providers', {
        credentials: 'include',
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          payload?.error === 'DUPLICATE_EMAIL' || payload?.error === 'DUPLICATE_VALUE'
            ? tr('البريد الإلكتروني مستخدم لمقدم خدمة آخر. استخدم بريداً مختلفاً أو اترك الحقل فارغاً.', 'Email is already used by another provider. Use a different email or leave it empty.')
            : payload?.message || payload?.error || tr('فشل حفظ مقدم الخدمة', 'Failed to save provider');
        alert(msg);
        return;
      }

      const providerId = String((payload?.item?.id || payload?.resource?.id || payload?.provider?.id || editing?.id || '')).trim();
      const finalId = providerId || String(editing?.id || '');
      if (finalId) {
        const privRes = await fetch(`/api/clinical-infra/providers/${finalId}/privileges`, {
          credentials: 'include',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...priv,
            procedureCategories: splitCsv(String(priv.procedureCategories || '')),
          }),
        });
        if (!privRes.ok) {
          const err = await privRes.json().catch(() => ({}));
          alert(err?.error || tr('فشل حفظ الصلاحيات', 'Failed to save privileges'));
          return;
        }

        const assignRes = await fetch(`/api/clinical-infra/providers/${finalId}/assignments`, {
          credentials: 'include',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            licenseNumber: assign.licenseNumber,
            unitIds: assign.unitIds,
            specialtyIds: assign.specialtyIds,
            roomIds: assign.roomIds,
            scopeUnitIds: assign.scopeUnitIds,
            consultationServiceCode: assign.consultationServiceCode,
            level: assign.level,
          }),
        });
        const assignPayload = await assignRes.json().catch(() => ({}));
        if (!assignRes.ok) {
          const detail = assignPayload?.details ? ` (${assignPayload.details})` : '';
          const step = assignPayload?.step ? ` [${assignPayload.step}]` : '';
          alert(`${assignPayload?.error || tr('فشل حفظ التعيينات', 'Failed to save assignments')}${step}${detail}`);
          return;
        }
        if (assignPayload?.profile || assignPayload?.roomAssignments || assignPayload?.unitScopes) {
          setAssign({
            licenseNumber: String(assignPayload?.profile?.licenseNumber || ''),
            unitIds: Array.isArray(assignPayload?.profile?.unitIds) ? assignPayload.profile.unitIds : [],
            specialtyIds: Array.isArray(assignPayload?.profile?.specialtyIds) ? assignPayload.profile.specialtyIds : [],
            roomIds: Array.isArray(assignPayload?.roomAssignments?.roomIds) ? assignPayload.roomAssignments.roomIds : [],
            scopeUnitIds: Array.isArray(assignPayload?.unitScopes?.unitIds) ? assignPayload.unitScopes.unitIds : [],
            consultationServiceCode: String(assignPayload?.profile?.consultationServiceCode || ''),
            level: String(assignPayload?.profile?.level || 'CONSULTANT'),
          });
        }
      }

      setOpen(false);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm(tr('أرشفة مقدم الخدمة هذا؟', 'Archive this provider?'))) return;
    const res = await fetch('/api/clinical-infra/providers', {
      credentials: 'include',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) mutate();
  };

  const deleteProvider = (id: string) => {
    setDeleteId(id);
    setDeleteCode('');
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const adminCode = String(deleteCode || '').trim();
    if (!adminCode) {
      setDeleteError(tr('رمز حذف المسؤول مطلوب.', 'Admin delete code is required.'));
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/clinical-infra/providers', {
        credentials: 'include',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-delete-code': adminCode },
        body: JSON.stringify({ id: deleteId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(payload?.error || tr('فشل حذف مقدم الخدمة', 'Failed to delete provider'));
        return;
      }
      setDeleteOpen(false);
      setDeleteId(null);
      setDeleteCode('');
      mutate();
    } finally {
      setDeleteBusy(false);
    }
  };

  const copyInternalId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // ignore copy failures
    }
  };

  const uploadCsv = async () => {
    if (!uploadFile) {
      setUploadError('Please select a CSV file.');
      return;
    }
    setUploadBusy(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await fetch('/api/admin/clinical-infra/providers/bulk', {
        credentials: 'include',
        method: 'POST',
        body: formData,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = payload?.details ? ` (${payload.details})` : '';
        setUploadError(`${payload?.error || 'Upload failed.'}${detail}`);
        return;
      }
      setUploadResult(payload);
      mutate();
    } finally {
      setUploadBusy(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([PROVIDERS_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'providers_template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-4">
      {status === 403 ? (
        <div className="rounded-2xl bg-card border border-destructive/40 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('غير مسموح', 'Forbidden')}</h2>
          <p className="text-sm text-muted-foreground">
            {tr('هذا القسم مقيّد لمستخدمي المستأجر من نوع admin/dev فقط.', 'This section is restricted to admin/dev tenant users.')}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {QUICK_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Button key={link.href} asChild size="sm" variant={isActive ? 'secondary' : 'outline'} className="rounded-xl">
              <Link href={link.href} aria-current={isActive ? 'page' : undefined}>
                {getQuickLinkLabel(link.label)}
              </Link>
            </Button>
          );
        })}
      </div>
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{tr('مقدمو الخدمة', 'Providers')}</h2>
          <Button className="rounded-xl" onClick={startCreate}>{tr('إنشاء', 'Create')}</Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={tr('بحث بالاسم أو الرقم أو الكود...', 'Search by name, ID or code...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-10 rounded-xl thea-input-focus"
            />
          </div>
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-[220px] rounded-xl thea-input-focus">
              <SelectValue placeholder={tr('كل التخصصات', 'All specialties')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{tr('كل التخصصات', 'All specialties')}</SelectItem>
              {specs.map((sp: any) => (
                <SelectItem key={sp.id} value={String(sp.id)}>
                  {language === 'ar' ? sp.nameAr || sp.name : sp.name || sp.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="rounded-xl border border-border p-3 space-y-2 text-sm">
            <div className="font-medium text-foreground">{tr('رفع جماعي (CSV)', 'Bulk Upload (CSV)')}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="rounded-xl thea-input-focus"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <Button variant="outline" className="rounded-xl" onClick={downloadTemplate}>
                {tr('تنزيل القالب', 'Download Template')}
              </Button>
              <Button className="rounded-xl" onClick={uploadCsv} disabled={uploadBusy || !uploadFile}>
                {uploadBusy ? tr('جارٍ الرفع...', 'Uploading...') : tr('رفع CSV', 'Upload CSV')}
              </Button>
            </div>
            {uploadError ? <div className="text-xs text-destructive">{uploadError}</div> : null}
            {uploadResult ? (
              <div className="rounded-xl border border-border bg-muted/40 p-2 text-xs">
                <div>
                  {tr('تم الإنشاء', 'created')}: {uploadResult.created || 0} • {tr('تم التحديث', 'updated')}: {uploadResult.updated || 0} • {tr('فشل', 'failed')}:{' '}
                  {uploadResult.failed || 0}
                </div>
                {Array.isArray(uploadResult.errors) && uploadResult.errors.length ? (
                  <div className="mt-2 space-y-1">
                    {(uploadResult.errors || []).slice(0, 20).map((err: any, idx: number) => (
                      <div key={`${err?.row}-${idx}`}>
                        {tr('الصف', 'row')} {err?.row}: {err?.reason || tr('صف غير صالح', 'Invalid row')}
                      </div>
                    ))}
                    {uploadResult.errors.length > 20 ? (
                      <div>+{uploadResult.errors.length - 20} {tr('أخطاء إضافية', 'more errors')}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {sorted.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm thea-hover-lift thea-transition-fast">
              <div>
                <div className="font-medium text-foreground">{p.displayName}</div>
                <div className="text-muted-foreground">
                  {p.shortCode ? `providerCode=${p.shortCode} • ` : ''}
                  {p.email ? `${p.email} • ` : ''}
                  {p.staffId ? `${p.staffId} • ` : ''}
                  {Array.isArray(p.profile?.unitIds) && p.profile.unitIds.length
                    ? `unit=${p.profile.unitIds
                        .map((id: string) => units.find((u: any) => String(u.id) === String(id))?.name || id)
                        .join(', ')} • `
                    : ''}
                  {Array.isArray(p.profile?.specialtyIds) && p.profile.specialtyIds.length
                    ? `specialty=${p.profile.specialtyIds
                        .map((id: string) => specs.find((s: any) => String(s.id) === String(id))?.name || id)
                        .join(', ')} • `
                    : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => copyInternalId(String(p.id))}
                  title={tr('نسخ المعرّف الداخلي', 'Copy internal ID')}
                  aria-label={tr('نسخ المعرّف الداخلي', 'Copy internal ID')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {copiedId === String(p.id) ? <span className="text-xs text-muted-foreground">{tr('تم النسخ', 'Copied')}</span> : null}
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startEdit(p)}>
                  {tr('تعديل', 'Edit')}
                </Button>
                <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => archive(String(p.id))} disabled={!!p.isArchived}>
                  {tr('أرشفة', 'Archive')}
                </Button>
                <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => deleteProvider(String(p.id))}>
                  {tr('حذف', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
          {!sorted.length ? <div className="text-sm text-muted-foreground">{tr('لا يوجد مقدمو خدمة.', 'No providers.')}</div> : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{editing ? tr('تعديل مقدم الخدمة', 'Edit Provider') : tr('إنشاء مقدم خدمة', 'Create Provider')}</DialogTitle>
            <DialogDescription className="sr-only">
              {editing ? tr('تحديث ملف مقدم الخدمة وتعييناته.', 'Update provider profile and assignments.') : tr('إنشاء مقدم خدمة وتعيين الوحدات والغرف والنطاقات.', 'Create a provider and assign units, rooms, and scopes.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2 overflow-y-auto px-6 pb-4">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('اسم العرض', 'Display Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={form.displayName} onChange={(e) => setForm((s: any) => ({ ...s, displayName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البريد الإلكتروني (اختياري)', 'Email (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={form.email} onChange={(e) => setForm((s: any) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم الموظف (اختياري)', 'Staff ID (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={form.staffId} onChange={(e) => setForm((s: any) => ({ ...s, staffId: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع التوظيف', 'Employment Type')}</span>
              <Select
                value={form.employmentType || 'FULL_TIME'}
                onValueChange={(v) => setForm((s: any) => ({ ...s, employmentType: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر نوع التوظيف', 'Select employment type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">{tr('دوام كامل', 'Full-time')}</SelectItem>
                  <SelectItem value="PART_TIME">{tr('دوام جزئي', 'Part-time')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم الترخيص (اختياري)', 'License Number (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={assign.licenseNumber} onChange={(e) => setAssign((s: any) => ({ ...s, licenseNumber: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مستوى الطبيب', 'Doctor Level')}</span>
              <Select value={assign.level || 'CONSULTANT'} onValueChange={(v) => setAssign((s: any) => ({ ...s, level: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر المستوى', 'Select level')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSULTANT">استشاري / Consultant</SelectItem>
                  <SelectItem value="SPECIALIST">أخصائي / Specialist</SelectItem>
                  <SelectItem value="RESIDENT">مقيم / Resident</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('كود خدمة الاستشارة', 'Consultation Service Code')}</span>
              <Select
                value={assign.consultationServiceCode || NONE_OPTION}
                onValueChange={(v) =>
                  setAssign((s: any) => ({ ...s, consultationServiceCode: v === NONE_OPTION ? '' : v }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر الكود (اختياري)', 'Select code (optional)')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>{tr('لا يوجد', 'None')}</SelectItem>
                  {filteredConsultationServices.map((service: any) => (
                    <SelectItem key={service.id} value={service.code}>
                      {service.code} - {service.nameAr || service.nameEn || service.name || service.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('وحدات الملف', 'Profile Units')}</span>
              <Select
                value={selectedUnitValue}
                onValueChange={(v) => setAssign((s: any) => ({ ...s, unitIds: Array.from(new Set([...(s.unitIds || []), v])) }))}
              >
                <SelectTrigger className="rounded-xl">
                  <span className="truncate">
                    {formatSelected(selectedUnitNames, tr('إضافة وحدة...', 'Add unit...'))}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {units.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التخصصات', 'Specialties')}</span>
              <Select
                value={selectedSpecialtyValue}
                onValueChange={(v) => setAssign((s: any) => ({ ...s, specialtyIds: Array.from(new Set([...(s.specialtyIds || []), v])) }))}
              >
                <SelectTrigger className="rounded-xl">
                  <span className="truncate">
                    {formatSelected(selectedSpecialtyNames, tr('إضافة تخصص...', 'Add specialty...'))}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {specs.map((sp: any) => (
                    <SelectItem key={sp.id} value={String(sp.id)}>
                      {sp.name || sp.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تعيينات الغرف', 'Room Assignments')}</span>
              <Select
                value={selectedRoomValue}
                onValueChange={(v) => setAssign((s: any) => ({ ...s, roomIds: Array.from(new Set([...(s.roomIds || []), v])) }))}
                disabled={!(assign.unitIds || []).length}
              >
                <SelectTrigger className="rounded-xl">
                  <span className="truncate">
                    {formatSelected(
                      selectedRoomNames,
                      (assign.unitIds || []).length ? tr('إضافة غرفة...', 'Add room...') : tr('اختر وحدة الملف أولاً', 'Select profile unit first')
                    )}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {rooms
                    .filter((r: any) => !(assign.unitIds || []).length || (assign.unitIds || []).includes(String(r.unitId)))
                    .map((r: any) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name || r.id}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نطاقات الوحدات', 'Unit Scopes')}</span>
              <Select
                value={selectedScopeUnitValue}
                onValueChange={(v) => setAssign((s: any) => ({ ...s, scopeUnitIds: Array.from(new Set([...(s.scopeUnitIds || []), v])) }))}
              >
                <SelectTrigger className="rounded-xl">
                  <span className="truncate">
                    {formatSelected(selectedScopeUnitNames, tr('إضافة وحدة نطاق...', 'Add scoped unit...'))}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {units.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-6 space-y-4 mt-2 mx-6">
            <h2 className="text-lg font-semibold text-foreground text-base">{tr('الصلاحيات', 'Privileges')}</h2>
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={!!priv.canPrescribe} onCheckedChange={(v) => setPriv((s: any) => ({ ...s, canPrescribe: !!v }))} />
                canPrescribe
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={!!priv.canOrderNarcotics} onCheckedChange={(v) => setPriv((s: any) => ({ ...s, canOrderNarcotics: !!v }))} />
                canOrderNarcotics
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={!!priv.canRequestImaging} onCheckedChange={(v) => setPriv((s: any) => ({ ...s, canRequestImaging: !!v }))} />
                canRequestImaging
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={!!priv.canPerformProcedures} onCheckedChange={(v) => setPriv((s: any) => ({ ...s, canPerformProcedures: !!v }))} />
                canPerformProcedures
              </label>
              <div className="space-y-2 md:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('فئات الإجراءات (مفصولة بفاصلة)', 'Procedure categories (comma separated)')}</span>
                <Input className="rounded-xl thea-input-focus" value={priv.procedureCategories} onChange={(e) => setPriv((s: any) => ({ ...s, procedureCategories: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6">
            <Button className="rounded-xl" onClick={saveProvider} disabled={busy}>
              {busy ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('حذف مقدم الخدمة', 'Delete provider')}</DialogTitle>
            <DialogDescription className="sr-only">
              {tr('تأكيد حذف مقدم الخدمة برمز المسؤول.', 'Confirm provider deletion with admin code.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{tr('هذا الإجراء نهائي. أدخل رمز حذف المسؤول للمتابعة.', 'This action is permanent. Enter admin delete code to proceed.')}</p>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز حذف المسؤول', 'Admin delete code')}</span>
              <Input
                className="rounded-xl thea-input-focus"
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value)}
                placeholder={tr('أدخل الرمز', 'Enter code')}
                type="password"
                autoFocus
              />
              {deleteError ? <div className="text-xs text-destructive">{deleteError}</div> : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? tr('جارٍ الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
