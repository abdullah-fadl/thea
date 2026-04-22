'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function IncidentDetail() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { incidentId } = useParams();
  const { hasPermission, isLoading } = useRoutePermission('/quality/incidents');
  const [whatHappened, setWhatHappened] = useState('');
  const [why, setWhy] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, mutate } = useSWR(
    hasPermission && incidentId ? `/api/quality/incidents/${encodeURIComponent(String(incidentId))}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const incident = data?.incident || null;
  const rca = data?.rca || null;

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const submitRca = async () => {
    if (!incidentId) return;
    setBusy(true);
    try {
      await fetch(`/api/quality/incidents/${encodeURIComponent(String(incidentId))}/rca`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatHappened, why, correctiveAction }),
      });
      setWhatHappened('');
      setWhy('');
      setCorrectiveAction('');
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-4">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('تفاصيل الحادثة', 'Incident Details')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('سجل حادثة للقراءة فقط.', 'Read-only incident record.')}</p>
        </div>
        <div className="p-5 space-y-2 text-sm">
          <div className="flex items-center justify-between px-4 py-2 rounded-xl thea-hover-lift thea-transition-fast">
            <span className="font-medium">{tr('النوع', 'Type')}</span>
            <span>{incident?.type || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2 rounded-xl thea-hover-lift thea-transition-fast">
            <span className="font-medium">{tr('الشدة', 'Severity')}</span>
            <span>{incident?.severity || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2 rounded-xl thea-hover-lift thea-transition-fast">
            <span className="font-medium">{tr('الموقع', 'Location')}</span>
            <span>{incident?.location || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2 rounded-xl thea-hover-lift thea-transition-fast">
            <span className="font-medium">{tr('الحالة', 'Status')}</span>
            <span>{incident?.status || '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('تحليل السبب الجذري (RCA)', 'Root Cause Analysis (RCA)')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('قالب فقط.', 'Template-based only.')}</p>
        </div>
        <div className="p-5 space-y-3">
          {rca ? (
            <div className="space-y-2 text-sm">
              <div>
                <div className="font-medium">{tr('ماذا حدث', 'What happened')}</div>
                <div className="text-muted-foreground">{rca.whatHappened}</div>
              </div>
              <div>
                <div className="font-medium">{tr('لماذا', 'Why')}</div>
                <div className="text-muted-foreground">{rca.why}</div>
              </div>
              <div>
                <div className="font-medium">{tr('الإجراء التصحيحي', 'Corrective action')}</div>
                <div className="text-muted-foreground">{rca.correctiveAction}</div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1 md:col-span-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ماذا حدث', 'What happened')}</span>
                <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('لماذا', 'Why')}</span>
                <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={why} onChange={(e) => setWhy(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإجراء التصحيحي', 'Corrective action')}</span>
                <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <Button className="rounded-xl" onClick={submitRca} disabled={busy}>
                  {tr('حفظ التحليل', 'Save RCA')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
