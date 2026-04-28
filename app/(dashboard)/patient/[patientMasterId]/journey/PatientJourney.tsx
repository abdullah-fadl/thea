'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const SECTION_LABELS: Record<string, string> = {
  er: 'ER',
  opd: 'OPD',
  ipd: 'IPD',
  note: 'Clinical Notes',
  order: 'Orders',
  result: 'Results',
  discharge: 'Discharge',
  death: 'Death',
  billing: 'Billing',
  registration: 'Registration',
};

export default function PatientJourney({ params }: { params: { patientMasterId: string } }) {
  const { isRTL } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/patient');
  const patientMasterId = String(params.patientMasterId || '');

  const { data } = useSWR(
    hasPermission && patientMasterId ? `/api/patient-journey/${encodeURIComponent(patientMasterId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const summary = data?.summary || {};

  const sections = useMemo(() => {
    const bucket: Record<string, any[]> = {};
    timeline.forEach((item: any) => {
      const key = item.type || 'other';
      if (!bucket[key]) bucket[key] = [];
      bucket[key].push(item);
    });
    return bucket;
  }, [timeline]);

  const orderedSections = ['registration', 'er', 'opd', 'ipd', 'note', 'order', 'discharge', 'death', 'billing'];
  const ordersByNoteId = useMemo(() => {
    const bucket: Record<string, any[]> = {};
    (sections.order || []).forEach((item: any) => {
      const noteId = item.linkedNoteId ? String(item.linkedNoteId) : '';
      if (!noteId) return;
      if (!bucket[noteId]) bucket[noteId] = [];
      bucket[noteId].push(item);
    });
    return bucket;
  }, [sections]);
  const resultsByOrderId = useMemo(() => {
    const bucket: Record<string, any[]> = {};
    (sections.result || []).forEach((item: any) => {
      const orderId = item.orderId ? String(item.orderId) : '';
      if (!orderId) return;
      if (!bucket[orderId]) bucket[orderId] = [];
      bucket[orderId].push(item);
    });
    return bucket;
  }, [sections]);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 max-w-5xl space-y-4">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Patient Journey</h2>
          <p className="text-sm text-muted-foreground">Read-only timeline from first registration.</p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Status: {summary.currentStatus || 'UNKNOWN'}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Last Location: {summary.lastLocation || 'UNKNOWN'}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Department: {summary.lastDepartment || 'UNKNOWN'}</span>
            {summary.lastDoctor ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Doctor: {summary.lastDoctor}</span> : null}
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Billing: {summary.billingState || 'UNKNOWN'}</span>
            {summary.identityVerification?.matchLevel ? (
              summary.identityVerification.matchLevel === 'VERIFIED'
                ? <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">Identity {summary.identityVerification.matchLevel}</span>
                : <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Identity {summary.identityVerification.matchLevel}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" asChild>
              <Link href={`/patient/${encodeURIComponent(patientMasterId)}`}>Open Patient Profile</Link>
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" asChild>
              <Link href="/search">Search Another Patient</Link>
            </Button>
          </div>
          {summary.deathFinalized ? (
            <div className="text-sm text-destructive">Deceased — journey is read-only.</div>
          ) : null}
        </div>
      </div>

      {orderedSections.map((section) => {
        const items = sections[section] || [];
        if (!items.length) return null;
        const visibleItems =
          section === 'order' ? items.filter((item: any) => !item.linkedNoteId) : items;
        return (
          <div key={section} className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{SECTION_LABELS[section] || section}</h2>
            <div className="space-y-2">
              {visibleItems.map((item: any) => (
                <div
                  key={item.id}
                  id={section === 'note' && item.noteId ? `note-${item.noteId}` : undefined}
                  className="border border-border rounded-md p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.ts ? new Date(item.ts).toLocaleString() : '—'} • {item.status}
                      </div>
                    </div>
                    {item.deepLink ? (
                      <Button size="sm" variant="outline" className="rounded-xl" asChild>
                        <Link href={item.deepLink}>Open</Link>
                      </Button>
                    ) : null}
                  </div>
                  {section === 'note' && item.noteId && ordersByNoteId[item.noteId]?.length ? (
                    <div className="rounded-md border border-border bg-muted/30 p-2">
                      <div className="text-xs font-medium mb-1">Orders from this note</div>
                      <div className="space-y-1 text-xs">
                        {ordersByNoteId[item.noteId].map((order: any) => (
                          <div key={order.id} className="flex items-center justify-between">
                            <span>{order.label}</span>
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{order.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {section === 'order' && item.orderId && resultsByOrderId[item.orderId]?.length ? (
                    <div className="rounded-md border border-border bg-muted/30 p-2">
                      <div className="text-xs font-medium mb-1">Results for this order</div>
                      <div className="space-y-1 text-xs">
                        {resultsByOrderId[item.orderId].map((result: any) => (
                          <div key={result.id} className="flex items-center justify-between">
                            <span>{result.label}</span>
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{result.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
