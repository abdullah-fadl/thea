'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

function urgencyColor(u: string) {
  switch (u) {
    case 'ASAP': return 'bg-red-100 text-red-800';
    case 'URGENT': return 'bg-orange-100 text-orange-800';
    case 'ROUTINE': return 'bg-blue-100 text-blue-800';
    default: return 'bg-muted text-foreground';
  }
}

function statusColor(s: string) {
  switch (s) {
    case 'WAITING': return 'bg-yellow-100 text-yellow-800';
    case 'OFFERED': return 'bg-blue-100 text-blue-800';
    case 'ACCEPTED': return 'bg-green-100 text-green-800';
    case 'DECLINED': return 'bg-red-100 text-red-800';
    case 'EXPIRED': return 'bg-muted text-foreground';
    default: return 'bg-muted text-foreground';
  }
}

export default function WaitlistManager() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('queue');

  const { data, mutate } = useSWR('/api/scheduling/waitlist?limit=100', fetcher, { refreshInterval: 15000 });
  const entries = data?.entries || [];
  const { data: analyticsData } = useSWR('/api/scheduling/waitlist/analytics', fetcher);
  const analytics = analyticsData || {};

  const offerSlot = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/scheduling/waitlist/${id}/offer`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) { toast({ title: tr('تم عرض الموعد', 'Slot offered') }); mutate(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [mutate, toast, tr]);

  const waiting = entries.filter((e: any) => e.status === 'WAITING');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('قائمة الانتظار', 'Waitlist Management')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{waiting.length}</p><p className="text-sm">{tr('بالانتظار', 'Waiting')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-red-600">{waiting.filter((e: any) => e.urgency === 'ASAP').length}</p><p className="text-sm">{tr('عاجل', 'ASAP')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-green-600">{entries.filter((e: any) => e.status === 'ACCEPTED').length}</p><p className="text-sm">{tr('تم القبول', 'Accepted')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{analytics.conversionRate ? (analytics.conversionRate * 100).toFixed(0) + '%' : '—'}</p><p className="text-sm">{tr('نسبة التحويل', 'Conversion Rate')}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="queue">{tr('الطابور', 'Queue')} ({waiting.length})</TabsTrigger>
          <TabsTrigger value="offered">{tr('تم العرض', 'Offered')}</TabsTrigger>
          <TabsTrigger value="history">{tr('السجل', 'History')}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <div className="space-y-3">
            {waiting.sort((a: any, b: any) => { const u = { ASAP: 0, URGENT: 1, ROUTINE: 2 }; return (u[a.urgency as keyof typeof u] ?? 2) - (u[b.urgency as keyof typeof u] ?? 2); }).map((e: any, idx: number) => (
              <Card key={e.id}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono text-muted-foreground">#{e.position || idx + 1}</span>
                    <div>
                      <span className="font-medium">{e.patientName}</span>
                      {e.desiredClinic && <span className="text-sm text-muted-foreground ml-2">{e.desiredClinic}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge className={urgencyColor(e.urgency)}>{e.urgency}</Badge>
                    <Button size="sm" onClick={() => offerSlot(e.id)}>{tr('عرض موعد', 'Offer Slot')}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {waiting.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('القائمة فارغة', 'Waitlist empty')}</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="offered">
          <div className="space-y-3">
            {entries.filter((e: any) => e.status === 'OFFERED').map((e: any) => (
              <Card key={e.id}><CardContent className="pt-4 flex justify-between"><span>{e.patientName}</span><div className="flex gap-2"><Badge className="bg-blue-100 text-blue-800">{tr('بانتظار الرد', 'Awaiting Response')}</Badge>{e.offeredAt && <span className="text-xs text-muted-foreground">{new Date(e.offeredAt).toLocaleString()}</span>}</div></CardContent></Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-2">
            {entries.filter((e: any) => ['ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'].includes(e.status)).map((e: any) => (
              <Card key={e.id}><CardContent className="pt-3 flex justify-between text-sm"><span>{e.patientName}</span><Badge className={statusColor(e.status)}>{e.status}</Badge></CardContent></Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
