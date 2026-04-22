'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

function statusColor(s: string) {
  switch (s) {
    case 'PENDING': return 'bg-yellow-100 text-yellow-800';
    case 'CONFIRMED': return 'bg-green-100 text-green-800';
    case 'CANCELLED': return 'bg-red-100 text-red-800';
    default: return 'bg-muted text-foreground';
  }
}

export default function MultiResourceBooking() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('bookings');

  const { data, mutate } = useSWR('/api/scheduling/multi-resource?limit=50', fetcher, { refreshInterval: 15000 });
  const bookings = data?.items || [];

  const { data: resourcesData } = useSWR('/api/scheduling/resources', fetcher);
  const resources = resourcesData?.resources || [];

  const [conflictCheck, setConflictCheck] = useState({ resourceIds: '', startAt: '', endAt: '' });
  const [conflicts, setConflicts] = useState<any>(null);

  const checkConflicts = useCallback(async () => {
    try {
      const ids = conflictCheck.resourceIds.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/scheduling/multi-resource/check-conflicts', {
        credentials: 'include',
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceIds: ids, startAt: conflictCheck.startAt, endAt: conflictCheck.endAt }),
      });
      const data = await res.json();
      setConflicts(data);
    } catch { toast({ title: tr('فشل الفحص', 'Check failed'), variant: 'destructive' }); }
  }, [conflictCheck, toast, tr]);

  const confirmBooking = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/scheduling/multi-resource/${id}/confirm`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) { toast({ title: tr('تم التأكيد', 'Confirmed') }); mutate(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [mutate, toast, tr]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('حجز متعدد الموارد', 'Multi-Resource Booking')}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="bookings">{tr('الحجوزات', 'Bookings')}</TabsTrigger>
          <TabsTrigger value="conflicts">{tr('فحص التعارض', 'Conflict Check')}</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <div className="space-y-3">
            {bookings.map((b: any) => (
              <Card key={b.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{(b.items || b.resources || []).map((r: any) => r.resourceName).join(', ')}</div>
                      <div className="text-sm text-muted-foreground">{new Date(b.startAt).toLocaleString()} — {new Date(b.endAt).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge className={statusColor(b.status)}>{b.status}</Badge>
                      {b.status === 'PENDING' && <Button size="sm" onClick={() => confirmBooking(b.id)}>{tr('تأكيد', 'Confirm')}</Button>}
                    </div>
                  </div>
                  {b.conflictDetails && <div className="mt-2 text-xs text-red-600">{tr('تعارضات', 'Conflicts')}: {JSON.stringify(b.conflictDetails)}</div>}
                </CardContent>
              </Card>
            ))}
            {bookings.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد حجوزات', 'No bookings')}</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="conflicts">
          <Card>
            <CardHeader><CardTitle>{tr('فحص التعارض', 'Check Resource Conflicts')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder={tr('معرفات الموارد (مفصولة بفاصلة)', 'Resource IDs (comma-separated)')} value={conflictCheck.resourceIds} onChange={e => setConflictCheck(p => ({ ...p, resourceIds: e.target.value }))} />
              <div className="grid grid-cols-2 gap-4">
                <Input type="datetime-local" value={conflictCheck.startAt} onChange={e => setConflictCheck(p => ({ ...p, startAt: e.target.value }))} />
                <Input type="datetime-local" value={conflictCheck.endAt} onChange={e => setConflictCheck(p => ({ ...p, endAt: e.target.value }))} />
              </div>
              <Button onClick={checkConflicts}>{tr('فحص التعارض', 'Check Conflicts')}</Button>
              {conflicts && (
                <div className="mt-4 p-4 rounded-lg border">
                  <div className="flex gap-2 items-center">
                    {conflicts.hasConflicts ? (
                      <Badge variant="destructive">{tr('يوجد تعارض', 'Conflicts Found')}</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">{tr('لا تعارض', 'No Conflicts')}</Badge>
                    )}
                  </div>
                  {conflicts.conflicts?.length > 0 && (
                    <div className="mt-2 space-y-1 text-sm">
                      {conflicts.conflicts.map((c: any, i: number) => (
                        <div key={i} className="text-red-600">{c.resourceId}: {c.reason || tr('محجوز', 'Already booked')}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
