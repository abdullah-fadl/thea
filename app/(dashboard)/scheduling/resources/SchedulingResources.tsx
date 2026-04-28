'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((res) => res.json());

const AREA_KEYS = ['opd', 'er', 'ipd', 'or', 'radiology', 'lab'] as const;

const RESOURCE_TYPES = [
  'CLINIC_ROOM',
  'PROCEDURE_ROOM',
  'RADIOLOGY_ROOM',
  'LAB_STATION',
  'OR_ROOM',
  'CATH_LAB',
  'PHYSIO_ROOM',
  'BED',
  'EQUIPMENT',
  'STAFF_POOL',
  'PROVIDER',
];

export default function SchedulingResources() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/scheduling/resources');
  const { me } = useMe();
  const role = String(me?.user?.role || '').toLowerCase();
  const perms = me?.user?.permissions ?? [];
  const hasSchedulingAccess = perms.includes('admin.scheduling.view') || perms.includes('scheduling.view') || perms.includes('scheduling.availability.view');
  const canManage = hasSchedulingAccess || role.includes('admin') || role.includes('charge') || role.includes('ops') || role.includes('operations');

  const { data, mutate } = useSWR(hasPermission ? '/api/scheduling/resources' : null, fetcher);
  const items = Array.isArray(data?.items) ? data.items : [];
  const uniqueItems = useMemo(() => {
    const map = new Map<string, any>();
    items.forEach((item: any) => {
      const key = String(item?.id || item?.resourceId || '');
      if (!key) return;
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }, [items]);

  const enableClinicalRef = process.env.NEXT_PUBLIC_CLINICAL_INFRA_SCHEDULING_REF === '1';
  const { data: roomsData } = useSWR(enableClinicalRef ? '/api/clinical-infra/rooms' : null, fetcher);
  const { data: clinicsData } = useSWR(enableClinicalRef ? '/api/clinical-infra/clinics' : null, fetcher);
  const { data: specialtiesData } = useSWR(hasPermission ? '/api/specialties' : null, fetcher);
  const specialties = Array.isArray(specialtiesData?.items) ? specialtiesData.items : [];

  const [resourceType, setResourceType] = useState('CLINIC_ROOM');
  const [departmentKey, setDepartmentKey] = useState('opd');
  const [providerAreaKey, setProviderAreaKey] = useState<(typeof AREA_KEYS)[number]>('opd');
  const [displayName, setDisplayName] = useState('');
  const [tags, setTags] = useState('');
  const [resourceRefType, setResourceRefType] = useState<'room' | 'clinic'>('room');
  const [resourceRefId, setResourceRefId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providerSpecialtyCode, setProviderSpecialtyCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const providersUrl =
    resourceType === 'PROVIDER' && providerSpecialtyCode
      ? `/api/scheduling/available-providers?specialtyCode=${encodeURIComponent(providerSpecialtyCode)}`
      : resourceType === 'PROVIDER'
      ? '/api/scheduling/available-providers'
      : null;
  const { data: providersData } = useSWR(hasPermission && providersUrl ? providersUrl : null, fetcher);
  const providers = Array.isArray(providersData?.items) ? providersData.items : [];

  const rooms = Array.isArray(roomsData?.items) ? roomsData.items : [];
  const clinics = Array.isArray(clinicsData?.items) ? clinicsData.items : [];

  const sorted = useMemo(() => {
    return [...uniqueItems].sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
  }, [uniqueItems]);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission || !canManage) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">{tr('الوصول للجدولة مقيّد.', 'Scheduling access is restricted.')}</Card>
      </div>
    );
  }

  const onCreate = async () => {
    if (resourceType === 'PROVIDER' && !providerId) {
      toast({ title: tr('اختر مقدم خدمة', 'Select a provider') });
      return;
    }
    if (!displayName.trim() && resourceType !== 'PROVIDER') {
      toast({ title: tr('اسم العرض مطلوب', 'Missing display name') });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/scheduling/resources', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          departmentKey: resourceType === 'PROVIDER' ? providerAreaKey : departmentKey,
          displayName: resourceType === 'PROVIDER' ? '' : displayName.trim(),
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          ...(resourceType === 'PROVIDER' ? { providerId, resourceRef: { kind: 'provider', providerId } } : {}),
          ...(enableClinicalRef && resourceRefId
            ? { resourceRef: { type: resourceRefType, id: resourceRefId } }
            : {}),
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast({ title: payload?.error || tr('فشل الإنشاء', 'Failed to create') });
        return;
      }
      toast({ title: payload?.noOp ? tr('المورد موجود مسبقاً', 'Resource already exists') : tr('تم إنشاء المورد', 'Resource created') });
      setDisplayName('');
      setTags('');
      setResourceRefId('');
      setProviderId('');
      setProviderAreaKey('opd');
      setProviderSpecialtyCode('');
      mutate();
    } finally {
      setSubmitting(false);
    }
  };

  const onUpdate = async () => {
    if (!editingId) return;
    if (resourceType === 'PROVIDER' && !providerId) {
      toast({ title: tr('اختر مقدم خدمة', 'Select a provider') });
      return;
    }
    if (!displayName.trim() && resourceType !== 'PROVIDER') {
      toast({ title: tr('اسم العرض مطلوب', 'Missing display name') });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/scheduling/resources/${editingId}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          departmentKey: resourceType === 'PROVIDER' ? providerAreaKey : departmentKey,
          displayName: resourceType === 'PROVIDER' ? '' : displayName.trim(),
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          ...(resourceType === 'PROVIDER' ? { providerId, resourceRef: { kind: 'provider', providerId } } : {}),
          ...(enableClinicalRef && resourceRefId
            ? { resourceRef: { type: resourceRefType, id: resourceRefId } }
            : {}),
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast({ title: payload?.error || tr('فشل التحديث', 'Failed to update') });
        return;
      }
      toast({ title: payload?.noOp ? tr('لا توجد تغييرات', 'No changes') : tr('تم تحديث المورد', 'Resource updated') });
      setEditingId(null);
      setDisplayName('');
      setTags('');
      setResourceRefId('');
      setProviderId('');
      setProviderAreaKey('opd');
      setProviderSpecialtyCode('');
      setResourceType('CLINIC_ROOM');
      setDepartmentKey('opd');
      mutate();
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (resourceId: string) => {
    if (!confirm(tr('هل تريد حذف هذا المورد؟', 'Delete this resource?'))) return;
    const res = await fetch(`/api/scheduling/resources/${resourceId}/delete`, { credentials: 'include', method: 'POST' });
    const payload = await res.json();
    if (!res.ok) {
      toast({ title: payload?.error || tr('فشل الحذف', 'Failed to delete') });
      return;
    }
    toast({ title: tr('تم حذف المورد', 'Resource deleted') });
    if (editingId === resourceId) setEditingId(null);
    mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <Card className="rounded-2xl p-6 space-y-4">
        <div className="text-lg font-semibold">{tr('موارد الجدولة', 'Scheduling Resources')}</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{tr('نوع المورد', 'Resource Type')}</Label>
            <Select value={resourceType} onValueChange={setResourceType}>
              <SelectTrigger>
                <SelectValue placeholder={tr('اختر النوع', 'Select type')} />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tr('مفتاح القسم', 'Department Key')}</Label>
            <Input
              value={resourceType === 'PROVIDER' ? providerAreaKey : departmentKey}
              onChange={(e) =>
                resourceType === 'PROVIDER'
                  ? setProviderAreaKey(e.target.value as (typeof AREA_KEYS)[number])
                  : setDepartmentKey(e.target.value)
              }
              placeholder={tr('opd / or / lab / rad', 'opd / or / lab / rad')}
              disabled={resourceType === 'PROVIDER'}
            />
          </div>
          <div className="space-y-2">
            <Label>{tr('اسم العرض', 'Display Name')}</Label>
            <Input
              value={
                resourceType === 'PROVIDER'
                  ? (providers.find((p: any) => String(p.id) === String(providerId))?.displayName || '')
                  : displayName
              }
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={tr('غرفة 12', 'Room 12')}
              disabled={resourceType === 'PROVIDER'}
            />
          </div>
          {resourceType === 'PROVIDER' ? (
            <div className="space-y-2 md:col-span-2">
              <Label>{tr('المنطقة', 'Area')}</Label>
              <Select
                value={providerAreaKey}
                onValueChange={(v) => {
                  setProviderAreaKey(v as (typeof AREA_KEYS)[number]);
                  setProviderSpecialtyCode('');
                  setProviderId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر المنطقة أولاً', 'Select area first')} />
                </SelectTrigger>
                <SelectContent>
                  {AREA_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {resourceType === 'PROVIDER' ? (
            <div className="space-y-2 md:col-span-2">
              <Label>{tr('التخصص', 'Specialty')}</Label>
              <Select
                value={providerSpecialtyCode}
                onValueChange={(v) => {
                  setProviderSpecialtyCode(v);
                  setProviderId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر التخصص (عظام، عيون، إلخ)', 'Select specialty (ortho, ophtha, etc.)')} />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((sp: any) => {
                    const code = String(sp.code || sp.id || '').trim();
                    const label = sp.nameAr || sp.nameEn || sp.name || code;
                    if (!code) return null;
                    return (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                {tr('اختر التخصص ثم مقدم الخدمة.', 'Select specialty, then provider.')}
              </div>
            </div>
          ) : null}
          {resourceType === 'PROVIDER' ? (
            <div className="space-y-2 md:col-span-2">
              <Label>{tr('مقدم الخدمة', 'Provider')}</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      providers.length === 0
                        ? providerSpecialtyCode
                          ? tr('لا يوجد مقدمون لهذا التخصص', 'No providers for this specialty')
                          : tr('اختر التخصص لتصفية القائمة', 'Select specialty to filter')
                        : tr('اختر مقدم الخدمة', 'Select provider')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {providers
                    .slice()
                    .sort((a: any, b: any) => String(a.displayName || '').localeCompare(String(b.displayName || '')))
                    .map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.displayName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Provider schedules use Clinical Infra as displayName source-of-truth.
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>{tr('الوسوم (مفصولة بفاصلة)', 'Tags (comma separated)')}</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={tr('صباحي،عاجل', 'morning,urgent')} />
          </div>
          {enableClinicalRef ? (
            <>
              <div className="space-y-2">
                <Label>{tr('نوع مرجع البنية السريرية (اختياري)', 'Clinical Infra Ref Type (optional)')}</Label>
                <Select value={resourceRefType} onValueChange={(v) => setResourceRefType(v as 'room' | 'clinic')}>
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر نوع المرجع', 'Select ref type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="room">{tr('غرفة', 'Room')}</SelectItem>
                    <SelectItem value="clinic">{tr('عيادة', 'Clinic')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr('مرجع البنية السريرية (اختياري)', 'Clinical Infra Ref (optional)')}</Label>
                <Select value={resourceRefId} onValueChange={setResourceRefId}>
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر...', 'Select...')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(resourceRefType === 'room' ? rooms : clinics).map((x: any) => (
                      <SelectItem key={x.id} value={String(x.id)}>
                        {x.name || x.displayName || x.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onCreate} disabled={submitting || !!editingId}>
            {submitting ? tr('جارٍ الإنشاء...', 'Creating...') : tr('إنشاء مورد', 'Create Resource')}
          </Button>
          {editingId && (
            <>
              <Button onClick={onUpdate} disabled={submitting} variant="default">
                {submitting ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ التعديلات', 'Save Changes')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setResourceType('CLINIC_ROOM');
                  setDepartmentKey('opd');
                  setProviderAreaKey('opd');
                  setProviderSpecialtyCode('');
                  setDisplayName('');
                  setTags('');
                  setResourceRefId('');
                  setProviderId('');
                }}
              >
                {tr('إلغاء التعديل', 'Cancel Edit')}
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card className="rounded-2xl p-6">
        <div className="text-sm text-muted-foreground mb-3">{tr('الموارد', 'Resources')} ({sorted.length})</div>
        <div className="space-y-2">
          {sorted.map((item: any) => (
            <div
              key={String(item.id || item.resourceId)}
              className="flex items-center justify-between rounded-2xl border border-border px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{item.displayName}</div>
                <div className="text-muted-foreground">{item.resourceType} • {item.departmentKey}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">{item.status}</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(item.id);
                    setResourceType(item.resourceType || 'CLINIC_ROOM');
                    setDepartmentKey(item.departmentKey || 'opd');
                    setProviderAreaKey(item.departmentKey || 'opd');
                    setDisplayName(item.displayName || '');
                    setTags(Array.isArray(item.tags) ? item.tags.join(', ') : '');
                    if (item.resourceRef?.type) {
                      setResourceRefType(item.resourceRef.type);
                      setResourceRefId(item.resourceRef.id || '');
                    } else {
                      setResourceRefId('');
                    }
                    if (item.resourceRef?.providerId) {
                      setProviderId(item.resourceRef.providerId);
                    } else if (item.providerId) {
                      setProviderId(item.providerId);
                    } else {
                      setProviderId('');
                    }
                  }}
                >
                  {tr('تعديل', 'Edit')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(String(item.id || item.resourceId || ''))}
                >
                  {tr('حذف', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
          {!sorted.length && <div className="text-sm text-muted-foreground">{tr('لا توجد موارد بعد.', 'No resources yet.')}</div>}
        </div>
      </Card>
    </div>
  );
}
