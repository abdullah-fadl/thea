'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import { useConfirm } from '@/components/ui/confirm-modal';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((res) => res.json());

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const DAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

function buildTime(hour: string, minute: string) {
  return `${hour}:${minute}`;
}

function splitTime(value: string) {
  const parts = String(value || '').split(':');
  const hour = parts[0]?.padStart(2, '0') || '00';
  const minute = parts[1]?.padStart(2, '0') || '00';
  return { hour, minute };
}

function buildMinuteOptions(step: number) {
  const size = Number(step || 15);
  const safeStep = size > 0 && size <= 60 ? size : 15;
  const options: string[] = [];
  for (let i = 0; i < 60; i += safeStep) {
    options.push(String(i).padStart(2, '0'));
  }
  return options;
}

export default function SchedulingTemplates() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { confirm } = useConfirm();
  const { hasPermission, isLoading } = useRoutePermission('/scheduling/templates');
  const { me } = useMe();
  const role = String(me?.user?.role || '').toLowerCase();
  const perms = me?.user?.permissions ?? [];
  const hasSchedulingAccess = perms.includes('admin.scheduling.view') || perms.includes('scheduling.view') || perms.includes('scheduling.availability.view');
  const canManage = hasSchedulingAccess || role.includes('admin') || role.includes('charge') || role.includes('ops') || role.includes('operations');

  const [specialtyCode, setSpecialtyCode] = useState('');
  const { data: specialtiesData } = useSWR(hasPermission ? '/api/specialties' : null, fetcher);
  const specialties = Array.isArray(specialtiesData?.items)
    ? specialtiesData.items
    : Array.isArray(specialtiesData?.specialties)
    ? specialtiesData.specialties
    : [];

  const { data: providersData } = useSWR(
    hasPermission && specialtyCode
      ? `/api/scheduling/available-providers?specialtyCode=${encodeURIComponent(specialtyCode)}`
      : null,
    fetcher
  );
  const providers = Array.isArray(providersData?.items) ? providersData.items : [];
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [ensuringResource, setEnsuringResource] = useState(false);
  const { data, mutate } = useSWR(resourceId ? `/api/scheduling/templates?resourceId=${resourceId}` : null, fetcher);
  const items = Array.isArray(data?.items) ? data.items : [];

  const [timezone, setTimezone] = useState('Asia/Riyadh');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [slotMinutes, setSlotMinutes] = useState(15);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [submitting, setSubmitting] = useState(false);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [purgingSlots, setPurgingSlots] = useState(false);
  const [purgingAllSlots, setPurgingAllSlots] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }, [items]);

  const ensureProviderResource = async (providerId: string) => {
    if (!providerId) return;
    setEnsuringResource(true);
    try {
      const res = await fetch('/api/scheduling/resources', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: 'PROVIDER',
          departmentKey: 'opd',
          providerId,
          resourceRef: { kind: 'provider', providerId },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: payload?.error || tr('فشل تهيئة المورد', 'Failed to setup resource'),
          variant: 'destructive',
        });
        return;
      }
      const rid = payload?.resource?.id;
      if (rid) setResourceId(rid);
    } finally {
      setEnsuringResource(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission || !canManage) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">{tr('الوصول للجدولة مقيّد.', 'Scheduling access is restricted.')}</Card>
      </div>
    );
  }

  const generateSlots = async () => {
    if (!resourceId) return;
    const fromDate = effectiveFrom || todayIso();
    const toDateRaw = effectiveTo || addDays(fromDate, 30);
    const toDate = toDateRaw < fromDate ? fromDate : toDateRaw;
    setGeneratingSlots(true);
    try {
      toast({ title: tr('جارٍ توليد المواعيد…', 'Generating slots…') });
      const res = await fetch('/api/scheduling/slots/generate', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId, fromDate, toDate }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: payload?.error || tr('فشل توليد المواعيد', 'Failed to generate slots'),
          description: payload?.details ? String(payload.details) : undefined,
        });
        return;
      }
      const datesWith = Array.isArray(payload?.datesWithSlots) ? payload.datesWithSlots : [];
      const datesSkipped = Array.isArray(payload?.datesSkipped) ? payload.datesSkipped : [];
      let desc =
        language === 'ar'
          ? `تم التوليد: ${payload?.generatedCount ?? 0} • بدون تغيير: ${payload?.noOpCount ?? 0}`
          : `Generated: ${payload?.generatedCount ?? 0} • No-op: ${payload?.noOpCount ?? 0}`;
      if (datesWith.length > 0) {
        desc += language === 'ar' ? ` • الأيام: ${datesWith.join(', ')}` : ` • Days: ${datesWith.join(', ')}`;
      }
      if (datesSkipped.length > 0) {
        desc +=
          language === 'ar'
            ? `\n${tr('تم تخطي (غير مضمّنة في القالب):', 'Skipped (not in template):')} ${datesSkipped.join(', ')}`
            : `\nSkipped (not in template): ${datesSkipped.join(', ')}`;
      }
      toast({
        title: tr('تم توليد المواعيد', 'Slots generated'),
        description: desc,
      });
    } catch (err: any) {
      toast({ title: tr('فشل توليد المواعيد', 'Failed to generate slots'), description: String(err?.message || err || '') || undefined });
    } finally {
      setGeneratingSlots(false);
    }
  };

  const clearOpenSlots = async () => {
    if (!resourceId) return;
    const fromDate = effectiveFrom || todayIso();
    const toDateRaw = effectiveTo || addDays(fromDate, 30);
    const toDate = toDateRaw < fromDate ? fromDate : toDateRaw;
    if (!(await confirm(tr(`سيتم حذف جميع المواعيد الفاضية (OPEN) من ${fromDate} إلى ${toDate}. هل أنت متأكد؟`, `All open (OPEN) slots from ${fromDate} to ${toDate} will be deleted. Are you sure?`)))) return;

    setPurgingSlots(true);
    try {
      toast({ title: tr('جارٍ مسح المواعيد المفتوحة…', 'Clearing open slots…') });
      const res = await fetch('/api/scheduling/slots/purge', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId, fromDate, toDate, mode: 'OPEN_ONLY' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: payload?.error || tr('فشل مسح المواعيد', 'Failed to clear slots') });
        return;
      }
      toast({
        title: tr('تم مسح المواعيد المفتوحة', 'Open slots cleared'),
        description: language === 'ar' ? `المحذوف: ${payload?.deletedCount ?? 0}` : `Deleted: ${payload?.deletedCount ?? 0}`,
      });
    } catch (err: any) {
      toast({ title: tr('فشل مسح المواعيد', 'Failed to clear slots'), description: String(err?.message || err || '') || undefined });
    } finally {
      setPurgingSlots(false);
    }
  };

  const clearAllSlots = async () => {
    if (!resourceId) return;
    const fromDate = effectiveFrom || todayIso();
    const toDateRaw = effectiveTo || addDays(fromDate, 30);
    const toDate = toDateRaw < fromDate ? fromDate : toDateRaw;
    if (
      !(await confirm(
        tr(`تحذير: سيتم حذف كل الـslots (حتى المحجوز) من ${fromDate} إلى ${toDate}.\n\nسيتم أيضاً إلغاء الحجوزات المرتبطة.\n\nهل أنت متأكد؟`, `Warning: ALL slots (including booked) from ${fromDate} to ${toDate} will be deleted.\n\nAssociated bookings will also be cancelled.\n\nAre you sure?`)
      ))
    )
      return;

    setPurgingAllSlots(true);
    try {
      toast({ title: tr('جارٍ حذف كل المواعيد…', 'Purging ALL slots…') });
      const res = await fetch('/api/scheduling/slots/purge', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId, fromDate, toDate, mode: 'ALL' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: payload?.error || tr('فشل حذف المواعيد', 'Failed to purge slots') });
        return;
      }
      toast({
        title: tr('تم حذف المواعيد', 'Slots purged'),
        description:
          language === 'ar'
            ? `المواعيد المحذوفة: ${payload?.deletedSlots ?? 0} • الحجوزات الملغاة: ${payload?.cancelledBookings ?? 0}`
            : `Deleted slots: ${payload?.deletedSlots ?? 0} • Cancelled bookings: ${payload?.cancelledBookings ?? 0}`,
      });
    } catch (err: any) {
      toast({ title: tr('فشل حذف المواعيد', 'Failed to purge slots'), description: String(err?.message || err || '') || undefined });
    } finally {
      setPurgingAllSlots(false);
    }
  };

  const onCreate = async () => {
    if (!resourceId) {
      toast({ title: tr('اختر مورداً أولاً', 'Select a resource first') });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/scheduling/templates', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId,
          timezone: timezone || 'Asia/Riyadh',
          daysOfWeek: Array.isArray(daysOfWeek) && daysOfWeek.length > 0 ? daysOfWeek : [1, 2, 3, 4, 5],
          startTime: startTime || '08:00',
          endTime: endTime || '16:00',
          slotMinutes: Math.max(1, Number(slotMinutes) || 15),
          effectiveFrom: effectiveFrom || todayIso(),
          effectiveTo: effectiveTo || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        const msg = payload?.missing?.length
          ? tr(`حقول مطلوبة: ${payload.missing.join(', ')}`, `Missing: ${payload.missing.join(', ')}`)
          : payload?.invalid?.length
          ? tr(`حقول غير صالحة: ${payload.invalid.join(', ')}`, `Invalid: ${payload.invalid.join(', ')}`)
          : payload?.error || tr('فشل الإنشاء', 'Failed to create');
        toast({ title: msg });
        return;
      }
      toast({
        title: payload?.noOp ? tr('القالب موجود مسبقاً', 'Template already exists') : tr('تم إنشاء القالب', 'Template created'),
        description: tr('اضغط «توليد المواعيد» لتوليد الفتحات.', 'Click "Generate Slots" to generate slots.'),
      });
      mutate();
    } finally {
      setSubmitting(false);
    }
  };

  const onUpdate = async () => {
    if (!editingId) return;
    if (!resourceId) {
      toast({ title: tr('اختر مورداً أولاً', 'Select a resource first') });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/scheduling/templates/${editingId}/update`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId,
          timezone,
          daysOfWeek,
          startTime,
          endTime,
          slotMinutes,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          status: 'ACTIVE',
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast({ title: payload?.error || tr('فشل التحديث', 'Failed to update') });
        return;
      }
      toast({
        title: payload?.noOp ? tr('لا توجد تغييرات', 'No changes') : tr('تم تحديث القالب', 'Template updated'),
        description: tr('اضغط «توليد المواعيد» لتحديث الفتحات إن لزم.', 'Click "Generate Slots" to refresh slots if needed.'),
      });
      setEditingId(null);
      mutate();
    } finally {
      setSubmitting(false);
    }
  };

  const onArchive = async (templateId: string) => {
    const res = await fetch(`/api/scheduling/templates/${templateId}/archive`, { credentials: 'include', method: 'POST' });
    const payload = await res.json();
    if (!res.ok) {
      toast({ title: payload?.error || tr('فشل الأرشفة', 'Failed to archive') });
      return;
    }
    toast({ title: payload?.noOp ? tr('مؤرشف مسبقاً', 'Already archived') : tr('تمت الأرشفة', 'Archived') });
    mutate();
  };

  const onDelete = async (templateId: string) => {
    if (!(await confirm(tr('هل تريد حذف هذا القالب؟', 'Delete this template?')))) return;
    const res = await fetch(`/api/scheduling/templates/${templateId}/delete`, { credentials: 'include', method: 'POST' });
    const payload = await res.json();
    if (!res.ok) {
      toast({ title: payload?.error || tr('فشل الحذف', 'Failed to delete') });
      return;
    }
    toast({ title: payload?.noOp ? tr('محذوف مسبقاً', 'Already deleted') : tr('تم الحذف', 'Deleted') });
    if (editingId === templateId) setEditingId(null);
    mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <Card className="rounded-2xl p-6 space-y-4">
        <div className="text-lg font-semibold">{tr('قوالب الجدولة', 'Scheduling Templates')}</div>
        <div className="space-y-2">
          <Label>{tr('التخصص', 'Specialty')}</Label>
          <Select
            value={specialtyCode}
            onValueChange={(value) => {
              setSpecialtyCode(value);
              setSelectedProviderId('');
              setResourceId('');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={tr('اختر التخصص', 'Select specialty')} />
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
        </div>
        <div className="space-y-2">
          <Label>{tr('المورد', 'Resource')}</Label>
          <Select
            value={selectedProviderId}
            onValueChange={(v) => {
              setSelectedProviderId(v);
              ensureProviderResource(v);
            }}
            disabled={!specialtyCode || ensuringResource}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !specialtyCode
                    ? tr('اختر التخصص أولاً', 'Select specialty first')
                    : ensuringResource
                    ? tr('جاري التحميل...', 'Loading...')
                    : providers.length === 0
                    ? tr('لا يوجد أطباء في هذا التخصص—أضف الطبيب من Clinical Infra أولاً', 'No doctors in this specialty—add the doctor from Clinical Infra first')
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
                    {p.displayName || p.id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {specialtyCode && providers.length === 0 && !ensuringResource && (
            <p className="text-xs text-muted-foreground mt-1">
              {tr('أضف الطبيب أولاً من ', 'Add the doctor first from ')}
              <Link href="/admin/clinical-infra/providers" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                {tr('Clinical Infra → Providers', 'Clinical Infra → Providers')}
              </Link>
              {tr(' ثم عيّن له التخصص في التعيينات.', ' and assign the specialty in assignments.')}
            </p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{tr('المنطقة الزمنية', 'Timezone')}</Label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tr('دقائق الموعد', 'Slot Minutes')}</Label>
            <Input type="number" value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label>{tr('وقت البداية', 'Start Time')}</Label>
            <div className="flex items-center gap-2">
              <Select
                value={splitTime(startTime).hour}
                onValueChange={(hour) => setStartTime(buildTime(hour, splitTime(startTime).minute))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }).map((_, idx) => {
                    const value = String(idx).padStart(2, '0');
                    return (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <span className="text-slate-500">:</span>
              <Select
                value={splitTime(startTime).minute}
                onValueChange={(minute) => setStartTime(buildTime(splitTime(startTime).hour, minute))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {buildMinuteOptions(slotMinutes).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{tr('وقت النهاية', 'End Time')}</Label>
            <div className="flex items-center gap-2">
              <Select
                value={splitTime(endTime).hour}
                onValueChange={(hour) => setEndTime(buildTime(hour, splitTime(endTime).minute))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }).map((_, idx) => {
                    const value = String(idx).padStart(2, '0');
                    return (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <span className="text-slate-500">:</span>
              <Select
                value={splitTime(endTime).minute}
                onValueChange={(minute) => setEndTime(buildTime(splitTime(endTime).hour, minute))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {buildMinuteOptions(slotMinutes).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{tr('ساري من', 'Effective From')}</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tr('ساري حتى (اختياري)', 'Effective To (optional)')}</Label>
            <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{tr('أيام الأسبوع', 'Days of Week')}</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const selected = daysOfWeek.includes(d.value);
              return (
                <Button
                  key={d.value}
                  variant="outline"
                  onClick={() =>
                    setDaysOfWeek((prev) =>
                      prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value]
                    )
                  }
                  className={
                    selected
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'opacity-40 hover:opacity-60'
                  }
                >
                  {d.label}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onCreate} disabled={submitting}>
            {submitting ? tr('جارٍ الإنشاء...', 'Creating...') : tr('إنشاء قالب', 'Create Template')}
          </Button>
          <Button onClick={generateSlots} disabled={submitting || generatingSlots || purgingSlots || purgingAllSlots || !resourceId} variant="outline">
            {generatingSlots ? tr('جارٍ التوليد…', 'Generating…') : tr('توليد المواعيد', 'Generate Slots')}
          </Button>
          <Button onClick={clearOpenSlots} disabled={submitting || generatingSlots || purgingSlots || purgingAllSlots || !resourceId} variant="outline">
            {purgingSlots ? tr('جارٍ المسح…', 'Clearing…') : tr('مسح المواعيد المفتوحة', 'Clear Open Slots')}
          </Button>
          <Button onClick={clearAllSlots} disabled={submitting || generatingSlots || purgingSlots || purgingAllSlots || !resourceId} variant="destructive">
            {purgingAllSlots ? tr('جارٍ الحذف…', 'Purging…') : tr('حذف كل المواعيد', 'Purge ALL Slots')}
          </Button>
        </div>
        {editingId && (
          <div className="flex items-center gap-2">
            <Button onClick={onUpdate} disabled={submitting} variant="default">
              {submitting ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ التعديلات', 'Save Changes')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setTimezone('Asia/Riyadh');
                setStartTime('08:00');
                setEndTime('16:00');
                setSlotMinutes(15);
                setEffectiveFrom(todayIso());
                setEffectiveTo('');
                setDaysOfWeek([1, 2, 3, 4, 5]);
              }}
            >
              {tr('إلغاء التعديل', 'Cancel Edit')}
            </Button>
          </div>
        )}
      </Card>

      <Card className="rounded-2xl p-6">
        <div className="text-sm text-muted-foreground mb-3">{tr('القوالب', 'Templates')} ({sorted.length})</div>
        <div className="space-y-2">
          {sorted.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{item.startTime} - {item.endTime} • {item.slotMinutes}m</div>
                <div className="text-muted-foreground">{tr('الأيام:', 'Days:')} {(item.daysOfWeek || []).join(', ')} • {item.status}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingId(item.id);
                    setResourceId(item.resourceId || resourceId);
                    setTimezone(item.timezone || 'UTC');
                    setStartTime(item.startTime || '08:00');
                    setEndTime(item.endTime || '16:00');
                    setSlotMinutes(Number(item.slotMinutes || 15));
                    setEffectiveFrom(item.effectiveFrom || '');
                    setEffectiveTo(item.effectiveTo || '');
                    setDaysOfWeek(Array.isArray(item.daysOfWeek) ? item.daysOfWeek : []);
                  }}
                >
                  {tr('تعديل', 'Edit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onArchive(item.id)}
                  disabled={item.status === 'ARCHIVED'}
                >
                  {tr('أرشفة', 'Archive')}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)}>
                  {tr('حذف', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
          {!sorted.length && <div className="text-sm text-muted-foreground">{tr('لا توجد قوالب بعد.', 'No templates yet.')}</div>}
        </div>
      </Card>
    </div>
  );
}
