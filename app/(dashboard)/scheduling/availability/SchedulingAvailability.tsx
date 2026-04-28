'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { useLang } from '@/hooks/use-lang';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Ban,
  Unlock,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

type TimeSpan = { startTime: string; endTime: string; reason?: string | null };

type Override = {
  id: string;
  tenantId: string;
  resourceId: string;
  date: string;
  blocks?: TimeSpan[] | null;
  opens?: TimeSpan[] | null;
  createdAt?: string;
  updatedAt?: string;
};

const SCHEDULING_PERMISSIONS = [
  'admin.scheduling.view',
  'scheduling.view',
  'scheduling.availability.view',
];

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayDate(): string {
  return toDateOnly(new Date());
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return toDateOnly(dt);
}

function isHHMM(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function compareHHMM(a: string, b: string): number {
  return a.localeCompare(b);
}

const emptySpan = (): TimeSpan => ({ startTime: '', endTime: '', reason: '' });

export default function SchedulingAvailability() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/scheduling/availability');
  const { me } = useMe();
  const role = String(me?.user?.role || '').toLowerCase();
  const perms = me?.user?.permissions ?? [];
  const canManage =
    perms.some((p: string) => SCHEDULING_PERMISSIONS.includes(p)) ||
    role === 'thea-owner' ||
    role.includes('admin') ||
    role.includes('charge') ||
    role.includes('ops') ||
    role.includes('operations') ||
    role.includes('staff');

  const resourcesUrl = hasPermission ? '/api/scheduling/resources' : null;
  const { data: resourcesData, isValidating: resourcesValidating } = useSWR(resourcesUrl, fetcher);
  const resources = useMemo(() => {
    const items = Array.isArray(resourcesData?.items) ? resourcesData.items : [];
    return items.slice().sort((a: any, b: any) =>
      String(a.displayName || '').localeCompare(String(b.displayName || '')),
    );
  }, [resourcesData]);

  const [resourceId, setResourceId] = useState<string>('');
  const [from, setFrom] = useState<string>(todayDate());
  const [to, setTo] = useState<string>(addDays(todayDate(), 30));
  const [editDate, setEditDate] = useState<string>(todayDate());
  const [blocks, setBlocks] = useState<TimeSpan[]>([emptySpan()]);
  const [opens, setOpens] = useState<TimeSpan[]>([]);
  const [saving, setSaving] = useState(false);

  // auto-pick first resource once loaded
  useEffect(() => {
    if (!resourceId && resources.length > 0) {
      setResourceId(String(resources[0].id));
    }
  }, [resources, resourceId]);

  const overridesUrl = useMemo(() => {
    if (!hasPermission || !resourceId) return null;
    const params = new URLSearchParams({ resourceId, from, to });
    return `/api/scheduling/overrides?${params.toString()}`;
  }, [hasPermission, resourceId, from, to]);

  const { data: overridesData, mutate: refetchOverrides, isValidating: overridesValidating } =
    useSWR(overridesUrl, fetcher);
  const overrides: Override[] = useMemo(
    () => (Array.isArray(overridesData?.items) ? overridesData.items : []),
    [overridesData],
  );

  // when editDate or resourceId or list changes, populate the editor with what's saved
  useEffect(() => {
    if (!resourceId || !editDate) return;
    const existing = overrides.find((o) => o.date === editDate);
    if (existing) {
      const b = Array.isArray(existing.blocks) ? existing.blocks : [];
      const o = Array.isArray(existing.opens) ? existing.opens : [];
      setBlocks(b.length ? b.map((x) => ({ ...x, reason: x.reason ?? '' })) : []);
      setOpens(o.length ? o.map((x) => ({ ...x, reason: x.reason ?? '' })) : []);
    } else {
      setBlocks([]);
      setOpens([]);
    }
  }, [editDate, resourceId, overrides]);

  const updateSpan = (
    list: TimeSpan[],
    setter: (next: TimeSpan[]) => void,
    idx: number,
    patch: Partial<TimeSpan>,
  ) => {
    const next = list.slice();
    next[idx] = { ...next[idx], ...patch };
    setter(next);
  };

  const removeSpan = (list: TimeSpan[], setter: (next: TimeSpan[]) => void, idx: number) => {
    const next = list.slice();
    next.splice(idx, 1);
    setter(next);
  };

  const validate = (): { ok: true } | { ok: false; reason: string } => {
    const checkList = (list: TimeSpan[], label: string): string | null => {
      for (let i = 0; i < list.length; i += 1) {
        const span = list[i];
        if (!isHHMM(span.startTime)) return tr(`صيغة وقت بدء غير صحيحة في ${label}`, `Invalid start time in ${label}`);
        if (!isHHMM(span.endTime)) return tr(`صيغة وقت انتهاء غير صحيحة في ${label}`, `Invalid end time in ${label}`);
        if (compareHHMM(span.startTime, span.endTime) >= 0)
          return tr(`يجب أن يكون البدء قبل الانتهاء في ${label}`, `Start must be before end in ${label}`);
      }
      return null;
    };
    const blockErr = checkList(blocks, tr('الفترات المغلقة', 'Block windows'));
    if (blockErr) return { ok: false, reason: blockErr };
    const openErr = checkList(opens, tr('الفترات المفتوحة', 'Open windows'));
    if (openErr) return { ok: false, reason: openErr };
    if (blocks.length === 0 && opens.length === 0) {
      return { ok: false, reason: tr('أضف فترة واحدة على الأقل قبل الحفظ.', 'Add at least one window before saving.') };
    }
    return { ok: true };
  };

  const onSave = async () => {
    if (!resourceId) {
      toast({ title: tr('اختر مورداً', 'Select a resource') });
      return;
    }
    if (!editDate) {
      toast({ title: tr('اختر تاريخاً', 'Select a date') });
      return;
    }
    const v = validate();
    if (v.ok === false) {
      toast({ title: tr('بيانات غير صالحة', 'Invalid data'), description: v.reason, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        resourceId,
        date: editDate,
        blocks: blocks.map((b) => ({
          startTime: b.startTime,
          endTime: b.endTime,
          reason: (b.reason || '').trim() || null,
        })),
        opens: opens.map((o) => ({
          startTime: o.startTime,
          endTime: o.endTime,
          reason: (o.reason || '').trim() || null,
        })),
      };
      const res = await fetch('/api/scheduling/overrides', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'save-failed');
      }
      toast({ title: tr('تم حفظ التوفر', 'Availability saved') });
      refetchOverrides();
    } catch (err: any) {
      toast({
        title: tr('تعذّر الحفظ', 'Save failed'),
        description: String(err?.message || err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const onClearDate = async () => {
    if (!resourceId || !editDate) return;
    if (!window.confirm(tr('مسح كل التجاوزات لهذا التاريخ؟', 'Clear all overrides for this date?'))) return;
    setSaving(true);
    try {
      const res = await fetch('/api/scheduling/overrides', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId, date: editDate, blocks: [], opens: [] }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'clear-failed');
      }
      setBlocks([]);
      setOpens([]);
      toast({ title: tr('تم المسح', 'Cleared') });
      refetchOverrides();
    } catch (err: any) {
      toast({
        title: tr('تعذّر المسح', 'Clear failed'),
        description: String(err?.message || err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          {tr('الوصول لإدارة التوفر مقيّد.', 'Availability access is restricted.')}
        </Card>
      </div>
    );
  }
  if (!canManage) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          {tr('لا توجد صلاحية لإدارة توفر الموارد.', 'You do not have permission to manage availability.')}
        </Card>
      </div>
    );
  }

  const selectedResource = resources.find((r: any) => String(r.id) === resourceId);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="container mx-auto p-4 md:p-6 max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            {tr('إدارة التوفر', 'Availability Management')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr(
              'تجاوزات التوفر للموارد لكل يوم — افتح أو احجب فترات معينة.',
              'Per-day availability overrides for scheduling resources — open or block specific windows.',
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchOverrides()}
          disabled={overridesValidating}
        >
          <RefreshCw className={`h-4 w-4 ${overridesValidating ? 'animate-spin' : ''}`} />
          <span className="ml-2">{tr('تحديث', 'Refresh')}</span>
        </Button>
      </div>

      <Card className="rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{tr('المورد', 'Resource')}</Label>
            <Select value={resourceId} onValueChange={setResourceId} disabled={resourcesValidating || resources.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={tr('اختر مورداً', 'Select a resource')} />
              </SelectTrigger>
              <SelectContent>
                {resources.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.displayName || r.nameEn || r.nameAr || r.id}
                    {r.resourceType ? ` · ${r.resourceType}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedResource?.departmentKey && (
              <div className="text-[11px] text-muted-foreground mt-1">
                {tr('القسم', 'Department')}: {selectedResource.departmentKey}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">{tr('من', 'From')}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr('إلى', 'To')}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              {tr('التجاوزات الحالية', 'Existing Overrides')}
              <span className="text-muted-foreground font-normal ms-2">({overrides.length})</span>
            </div>
          </div>
          {overrides.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {overridesValidating
                ? tr('جاري التحميل...', 'Loading...')
                : tr('لا توجد تجاوزات في هذه الفترة.', 'No overrides in this range.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="text-start px-4 py-3">{tr('التاريخ', 'Date')}</th>
                    <th className="text-start px-4 py-3">{tr('فترات الحجب', 'Blocks')}</th>
                    <th className="text-start px-4 py-3">{tr('فترات الفتح', 'Opens')}</th>
                    <th className="text-end px-4 py-3">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((o) => {
                      const blockCount = (o.blocks || []).length;
                      const openCount = (o.opens || []).length;
                      return (
                        <tr key={o.id || `${o.resourceId}-${o.date}`} className="border-t border-border">
                          <td className="px-4 py-3 font-mono">{o.date}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs text-rose-700">
                              <Ban className="h-3 w-3" />
                              {blockCount}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                              <Unlock className="h-3 w-3" />
                              {openCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditDate(o.date)}
                            >
                              {tr('تعديل', 'Edit')}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="editDate" className="text-xs">{tr('تاريخ التحرير', 'Edit Date')}</Label>
              <Input
                id="editDate"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={onSave} disabled={saving || !resourceId}>
                <Save className="h-4 w-4" />
                <span className="ml-2">{saving ? tr('...جارٍ الحفظ', 'Saving...') : tr('حفظ', 'Save')}</span>
              </Button>
              <Button variant="ghost" onClick={onClearDate} disabled={saving || !resourceId}>
                {tr('مسح', 'Clear')}
              </Button>
            </div>
          </div>

          <SpanList
            title={tr('فترات الحجب (Blocks)', 'Block Windows')}
            description={tr('فترات لا يمكن فيها الحجز.', 'Times when bookings cannot be made.')}
            list={blocks}
            tone="block"
            language={language as 'ar' | 'en'}
            onAdd={() => setBlocks([...blocks, emptySpan()])}
            onRemove={(idx) => removeSpan(blocks, setBlocks, idx)}
            onChange={(idx, patch) => updateSpan(blocks, setBlocks, idx, patch)}
          />

          <SpanList
            title={tr('فترات الفتح (Opens)', 'Open Windows')}
            description={tr(
              'فتح وقت إضافي خارج القالب الافتراضي للمورد.',
              'Open additional time on top of the resource default template.',
            )}
            list={opens}
            tone="open"
            language={language as 'ar' | 'en'}
            onAdd={() => setOpens([...opens, emptySpan()])}
            onRemove={(idx) => removeSpan(opens, setOpens, idx)}
            onChange={(idx, patch) => updateSpan(opens, setOpens, idx, patch)}
          />
        </Card>
      </div>
    </div>
  );
}

function SpanList({
  title,
  description,
  list,
  tone,
  language,
  onAdd,
  onRemove,
  onChange,
}: {
  title: string;
  description: string;
  list: TimeSpan[];
  tone: 'block' | 'open';
  language: 'ar' | 'en';
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onChange: (idx: number, patch: Partial<TimeSpan>) => void;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const Icon = tone === 'block' ? Ban : Unlock;
  const accent =
    tone === 'block' ? 'text-rose-700' : 'text-emerald-700';
  return (
    <div className="border border-border rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className={`text-sm font-semibold flex items-center gap-1.5 ${accent}`}>
            <Icon className="h-4 w-4" />
            {title}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          <span className="ml-1">{tr('إضافة', 'Add')}</span>
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          {tr('لا توجد فترات.', 'No windows.')}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((span, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <Label className="text-[11px] text-muted-foreground">{tr('من', 'From')}</Label>
                <Input
                  type="time"
                  value={span.startTime}
                  onChange={(e) => onChange(idx, { startTime: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-[11px] text-muted-foreground">{tr('إلى', 'To')}</Label>
                <Input
                  type="time"
                  value={span.endTime}
                  onChange={(e) => onChange(idx, { endTime: e.target.value })}
                />
              </div>
              <div className="col-span-5">
                <Label className="text-[11px] text-muted-foreground">{tr('السبب', 'Reason')}</Label>
                <Input
                  value={span.reason || ''}
                  onChange={(e) => onChange(idx, { reason: e.target.value })}
                  placeholder={tr('اختياري', 'Optional')}
                />
              </div>
              <div className="col-span-1 text-end">
                <Button variant="ghost" size="sm" onClick={() => onRemove(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
