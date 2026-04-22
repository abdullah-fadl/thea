'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Incidents() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/quality/incidents');

  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('LOW');
  const [location, setLocation] = useState('');
  const [encounterCoreId, setEncounterCoreId] = useState('');
  const [episodeId, setEpisodeId] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, mutate } = useSWR(hasPermission ? '/api/quality/incidents' : null, fetcher, { refreshInterval: 0 });
  const items = Array.isArray(data?.items) ? data.items : [];

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const createIncident = async () => {
    setBusy(true);
    try {
      await fetch('/api/quality/incidents', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          severity,
          location,
          encounterCoreId: encounterCoreId.trim(),
          episodeId: episodeId.trim(),
          description,
        }),
      });
      setType('');
      setLocation('');
      setEncounterCoreId('');
      setEpisodeId('');
      setDescription('');
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (incidentId: string, nextStatus: string) => {
    setBusy(true);
    try {
      await fetch(`/api/quality/incidents/${encodeURIComponent(incidentId)}/status`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-4">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('الإبلاغ عن الحوادث', 'Incident Reporting')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('تسجيل ومتابعة حوادث الجودة.', 'Log and track quality incidents.')}</p>
        </div>
        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
              <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={type} onChange={(e) => setType(e.target.value)} placeholder={tr('خطأ دوائي', 'Medication error')} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشدة', 'Severity')}</span>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('الشدة', 'Severity')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">{tr('منخفض', 'Low')}</SelectItem>
                  <SelectItem value="MEDIUM">{tr('متوسط', 'Medium')}</SelectItem>
                  <SelectItem value="HIGH">{tr('مرتفع', 'High')}</SelectItem>
                  <SelectItem value="CRITICAL">{tr('حرج', 'Critical')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الموقع', 'Location')}</span>
              <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={tr('الطوارئ - سرير 3', 'ER - Bed 3')} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معرف اللقاء (اختياري)', 'Encounter Core ID (optional)')}</span>
              <Input
                className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast"
                value={encounterCoreId}
                onChange={(e) => setEncounterCoreId(e.target.value)}
                placeholder="encounterCoreId"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معرف الحلقة (اختياري)', 'Episode ID (optional)')}</span>
              <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} placeholder="episodeId" />
            </div>
            <div className="space-y-1 md:col-span-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوصف', 'Description')}</span>
              <Input
                className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tr('وصف مختصر', 'Brief description')}
              />
            </div>
            <div className="md:col-span-3">
              <Button className="rounded-xl" onClick={createIncident} disabled={busy}>
                {tr('إنشاء حادثة', 'Create Incident')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('الحوادث', 'Incidents')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('مفتوح ← مراجَع ← مغلق', 'Open \u2192 Reviewed \u2192 Closed')}</p>
        </div>
        <div className="p-5">
          {/* Header row */}
          <div className="grid grid-cols-5 gap-4 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشدة', 'Severity')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الموقع', 'Location')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإجراءات', 'Actions')}</span>
          </div>
          {/* Body rows */}
          {items.length ? (
            items.map((item: any) => (
              <div key={item.id} className="grid grid-cols-5 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                <span className="text-sm text-foreground">{item.type}</span>
                <span className="text-sm text-foreground">
                  <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">{item.severity}</span>
                </span>
                <span className="text-sm text-foreground">{item.location}</span>
                <span className="text-sm text-foreground">
                  <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 bg-muted text-muted-foreground">{item.status}</span>
                </span>
                <span className="text-sm text-foreground space-x-2">
                  <Button className="rounded-xl" asChild size="sm" variant="outline">
                    <Link href={`/quality/incidents/${encodeURIComponent(item.id)}`}>{tr('فتح', 'Open')}</Link>
                  </Button>
                  {item.status === 'OPEN' ? (
                    <Button className="rounded-xl" size="sm" variant="outline" onClick={() => updateStatus(item.id, 'REVIEWED')} disabled={busy}>
                      {tr('مراجعة', 'Review')}
                    </Button>
                  ) : null}
                  {item.status === 'REVIEWED' ? (
                    <Button className="rounded-xl" size="sm" variant="outline" onClick={() => updateStatus(item.id, 'CLOSED')} disabled={busy}>
                      {tr('إغلاق', 'Close')}
                    </Button>
                  ) : null}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {tr('لم يتم تسجيل حوادث.', 'No incidents recorded.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
