'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Results() {
  const { isRTL } = useLang();
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/results');
  const { me } = useMe();

  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [kind, setKind] = useState<'ALL' | 'LAB' | 'RAD' | 'PROC'>('ALL');

  const canAck = useMemo(() => {
    const roleLower = String(me?.user?.role || '').toLowerCase();
    const email = String(me?.user?.email || '').trim().toLowerCase();
    return (
      roleLower.includes('doctor') ||
      roleLower.includes('nurse') ||
      roleLower.includes('charge') ||
      roleLower.includes('admin')
    );
  }, [me]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('scope', scope);
    params.set('unacked', '1');
    if (kind !== 'ALL') params.set('kind', kind);
    return `/api/results/inbox?${params.toString()}`;
  }, [scope, kind]);

  const { data, mutate } = useSWR(hasPermission ? url : null, fetcher, { refreshInterval: 0 });
  const items = Array.isArray(data?.items) ? data.items : [];

  const ackResult = async (resultId: string) => {
    if (!canAck) return;
    try {
      const key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch(`/api/results/${encodeURIComponent(resultId)}/ack`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: key }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? 'Already acknowledged' : 'Acknowledged' });
      await mutate();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed', variant: 'destructive' });
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">Results Inbox</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Unacknowledged results for review</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={scope} onValueChange={(value) => setScope(value as 'mine' | 'all')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Mine</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={(value) => setKind(value as 'ALL' | 'LAB' | 'RAD' | 'PROC')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="LAB">Lab</SelectItem>
                <SelectItem value="RAD">Radiology</SelectItem>
                <SelectItem value="PROC">Procedure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Header row */}
          <div className="grid grid-cols-6 gap-4 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Patient</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kind</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</span>
          </div>
          {/* Body rows */}
          {items.length ? (
            items.map((item: any) => (
              <div key={item.resultId} className="grid grid-cols-6 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                <span className="text-xs text-foreground">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : '\u2014'}
                </span>
                <span className="text-sm text-foreground">
                  <div className="font-medium">{item.patientName || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">{String(item.patientMasterId || '').slice(0, 8)}</div>
                </span>
                <span className="text-xs text-foreground">{item.orderCode || item.orderId?.slice(0, 8)}</span>
                <span className="text-sm text-foreground space-x-2">
                  <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">{item.kind || '\u2014'}</span>
                  {item.source === 'CONNECT' ? <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 bg-muted text-muted-foreground">External</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">{item.summary || '\u2014'}</span>
                <span className="text-sm text-foreground space-x-2">
                  {item.deepLink ? (
                    <Button className="rounded-xl" size="sm" variant="outline" asChild>
                      <Link href={item.deepLink}>Open</Link>
                    </Button>
                  ) : null}
                  {canAck && item.source !== 'CONNECT' ? (
                    <Button className="rounded-xl" size="sm" variant="outline" onClick={() => ackResult(item.resultId)}>
                      Ack
                    </Button>
                  ) : null}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No unacknowledged results.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
