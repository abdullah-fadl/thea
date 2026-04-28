'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const TYPES = [
  { value: 'ALL', labelAr: 'الكل', labelEn: 'All' },
  { value: 'ORDER', labelAr: 'أمر غير دوائي', labelEn: 'Non-med order' },
  { value: 'ORDER_STATUS', labelAr: 'حالة أمر غير دوائي', labelEn: 'Non-med order status' },
  { value: 'VITALS', labelAr: 'العلامات الحيوية', labelEn: 'Vitals' },
  { value: 'NURSING_NOTE', labelAr: 'ملاحظة تمريض', labelEn: 'Nursing note' },
  { value: 'CARE_PLAN', labelAr: 'خطة رعاية', labelEn: 'Care plan' },
  { value: 'DOCTOR_PROGRESS', labelAr: 'تقدم الطبيب', labelEn: 'Doctor progress' },
  { value: 'NURSING_PROGRESS', labelAr: 'تقدم التمريض', labelEn: 'Nursing progress' },
  { value: 'MEDICATION', labelAr: 'دواء', labelEn: 'Medication' },
  { value: 'LOCATION', labelAr: 'الموقع', labelEn: 'Location' },
  { value: 'OWNERSHIP', labelAr: 'الملكية', labelEn: 'Ownership' },
] as const;

export default function IPDAudit(props: any) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { me } = useMe();
  const { hasPermission, isLoading } = useRoutePermission('/ipd/episode');

  const tenantId = String(me?.tenantId || '');
  const email = String(me?.user?.email || '');
  const role = String(me?.user?.role || '');
  const canAccess = canAccessChargeConsole({ email, tenantId, role });

  const episodeId = String(props?.params?.episodeId || '').trim();
  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

  const [type, setType] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ type: 'ALL', from: '', to: '' });
  const [selected, setSelected] = useState<any>(null);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidentStartedAt, setIncidentStartedAt] = useState('');
  const [incidentEndedAt, setIncidentEndedAt] = useState('');
  const [incidentNotes, setIncidentNotes] = useState('');
  const [savingIncident, setSavingIncident] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (applied.type && applied.type !== 'ALL') params.set('type', applied.type);
    if (applied.from) params.set('from', new Date(applied.from).toISOString());
    if (applied.to) params.set('to', new Date(applied.to).toISOString());
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [applied]);

  const canFetchEpisode = hasPermission && canAccess && episodeId;
  const { data: episodeData } = useSWR(
    canFetchEpisode ? `/api/ipd/episodes/${episodeId}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const episode = (episodeData as Record<string, unknown>)?.episode as Record<string, unknown> | null || null;
  const canFetchEpisodeDetails = canFetchEpisode && Boolean(episode);
  const { data: auditData, isLoading: loading } = useSWR(
    canFetchEpisodeDetails ? `/api/ipd/episodes/${episodeId}/audit${query}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: downtimeData, mutate: mutateDowntime } = useSWR(
    canFetchEpisodeDetails ? `/api/ipd/episodes/${episodeId}/downtime-incidents` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const items = Array.isArray((auditData as Record<string, unknown>)?.items) ? (auditData as Record<string, unknown>).items as Record<string, unknown>[] : [];
  const downtimeItems = Array.isArray((downtimeData as Record<string, unknown>)?.items) ? (downtimeData as Record<string, unknown>).items as Record<string, unknown>[] : [];
  const patient = (episode?.patient || {}) as Record<string, unknown>;
  const location = (episode?.location || {}) as Record<string, unknown>;
  const ownership = (episode?.ownership || {}) as Record<string, unknown>;
  const episodeIdShort = episodeId ? episodeId.slice(0, 8) : '—';
  const locationSummary = [location?.ward, location?.room, location?.bed].filter(Boolean).join(' / ') || '—';

  if (isLoading || loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
        {tr('جاري التحميل...', 'Loading...')}
      </div>
    );
  }

  if (!hasPermission || !canAccess) {
    return (
      <div className="p-6 text-sm text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
        {tr('محظور', 'Forbidden')}
      </div>
    );
  }

  const saveIncident = async () => {
    if (!incidentStartedAt) {
      toast({ title: tr('ناقص', 'Missing'), description: tr('وقت البدء مطلوب', 'Started at is required'), variant: 'destructive' as const });
      return;
    }
    setSavingIncident(true);
    try {
      const res = await fetch('/api/ipd/downtime-incidents', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          startedAt: new Date(incidentStartedAt).toISOString(),
          endedAt: incidentEndedAt ? new Date(incidentEndedAt).toISOString() : undefined,
          notes: incidentNotes.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add incident');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تمت إضافة حادثة التوقف.', 'Downtime incident added.') });
      setIncidentDialogOpen(false);
      setIncidentStartedAt('');
      setIncidentEndedAt('');
      setIncidentNotes('');
      await mutateDowntime();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSavingIncident(false);
    }
  };

  return (
    <div className="p-6 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-10 rounded-md border border-border bg-card/95 px-3 py-2 text-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-muted-foreground">{tr('المريض:', 'Patient:')}</span> {String(patient.fullName || '—')}
          </div>
          <div>
            <span className="text-muted-foreground">{tr('الحلقة:', 'Episode:')}</span> {episodeIdShort}
          </div>
          <div>
            <span className="text-muted-foreground">{tr('الموقع:', 'Location:')}</span> {locationSummary}
          </div>
          <div>
            <span className="text-muted-foreground">{tr('الطبيب المعالج:', 'Attending:')}</span> {String(ownership?.attendingPhysicianUserId || '—')}
          </div>
          <div>
            <span className="text-muted-foreground">{tr('الممرضة الرئيسية:', 'Primary Nurse:')}</span> {String(ownership?.primaryInpatientNurseUserId || '—')}
          </div>
        </div>
      </div>

      {/* Audit Review Card */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('مراجعة التدقيق', 'Audit Review')}</h2>
        <p className="text-sm text-muted-foreground">{tr('تسلسل زمني موحد للقراءة فقط', 'Read-only unified timeline')}</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {tr(t.labelAr, t.labelEn)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('من', 'From')}</span>
            <Input className="rounded-xl thea-input-focus" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إلى', 'To')}</span>
            <Input className="rounded-xl thea-input-focus" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => setApplied({ type, from, to })}
              className="w-full md:w-auto rounded-xl"
            >
              {tr('تطبيق', 'Apply')}
            </Button>
          </div>
        </div>

        {items.length ? (
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-5 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوقت', 'Time')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملخص', 'Summary')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المنفذ', 'Actor')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المصدر', 'Source')}</span>
            </div>
            {/* Table Body */}
            <div>
              {items.map((row: any, idx: number) => (
                <div
                  key={`${row.time}-${row.entityId}-${idx}`}
                  className="grid grid-cols-5 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <span className="text-sm text-foreground">{row.time ? new Date(row.time).toLocaleString() : '—'}</span>
                  <span className="text-sm text-foreground">
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{row.type}</span>
                  </span>
                  <span className="text-sm text-foreground">{row.label || '—'}</span>
                  <span className="text-sm text-foreground">{row.actorDisplay || '—'}</span>
                  <span className="text-sm text-muted-foreground text-xs">{row.source || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{tr('لا توجد صفوف تدقيق للفلتر الحالي.', 'No audit rows for current filter.')}</div>
        )}
      </div>

      {/* Downtime Incidents Card */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('حوادث التوقف', 'Downtime Incidents')}</h2>
        <p className="text-sm text-muted-foreground">{tr('سجل حوادث إضافة فقط', 'Append-only incident log')}</p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {downtimeItems.length ? `${downtimeItems.length} ${tr('حوادث', 'incidents')}` : tr('لم يتم تسجيل حوادث.', 'No incidents logged.')}
            </div>
            <Button variant="outline" className="rounded-xl" onClick={() => setIncidentDialogOpen(true)}>
              {tr('إضافة حادثة', 'Add Incident')}
            </Button>
          </div>

          {downtimeItems.length ? (
            <div>
              {/* Table Header */}
              <div className="grid grid-cols-4 gap-4 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('بدأ', 'Started')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('انتهى', 'Ended')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات', 'Notes')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('أنشئ بواسطة', 'Created By')}</span>
              </div>
              {/* Table Body */}
              <div>
                {downtimeItems.map((item: any) => (
                  <div key={item.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                    <span className="text-sm text-foreground">{item.startedAt ? new Date(item.startedAt).toLocaleString() : '—'}</span>
                    <span className="text-sm text-foreground">{item.endedAt ? new Date(item.endedAt).toLocaleString() : '—'}</span>
                    <span className="text-sm text-muted-foreground text-xs whitespace-pre-wrap">
                      {item.notes || '—'}
                    </span>
                    <span className="text-sm text-foreground">{item.creatorDisplay || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('التفاصيل', 'Details')}</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <div>
              <span className="text-muted-foreground">{tr('الوقت:', 'Time:')}</span>{' '}
              {selected?.time ? new Date(selected.time).toLocaleString() : '—'}
            </div>
            <div>
              <span className="text-muted-foreground">{tr('النوع:', 'Type:')}</span> {selected?.type || '—'}
            </div>
            <div>
              <span className="text-muted-foreground">{tr('الملخص:', 'Summary:')}</span> {selected?.label || '—'}
            </div>
            <div>
              <span className="text-muted-foreground">{tr('المنفذ:', 'Actor:')}</span> {selected?.actorDisplay || '—'}
            </div>
            <div>
              <span className="text-muted-foreground">{tr('المصدر:', 'Source:')}</span> {selected?.source || '—'}
            </div>
            <div className="whitespace-pre-wrap">
              <span className="text-muted-foreground">{tr('التفاصيل:', 'Details:')}</span> {selected?.details || '—'}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة حادثة توقف', 'Add Downtime Incident')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('وقت البدء', 'Started At')}</span>
              <Input
                className="rounded-xl thea-input-focus"
                type="datetime-local"
                value={incidentStartedAt}
                onChange={(e) => setIncidentStartedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('وقت الانتهاء (اختياري)', 'Ended At (optional)')}</span>
              <Input
                className="rounded-xl thea-input-focus"
                type="datetime-local"
                value={incidentEndedAt}
                onChange={(e) => setIncidentEndedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات (اختياري)', 'Notes (optional)')}</span>
              <Textarea
                className="rounded-xl thea-input-focus"
                value={incidentNotes}
                onChange={(e) => setIncidentNotes(e.target.value)}
                placeholder={tr('ملخص', 'Summary')}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setIncidentDialogOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button className="rounded-xl" onClick={saveIncident} disabled={savingIncident || !incidentStartedAt}>
                {tr('حفظ', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
