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

function statusColor(s: string) {
  switch (s) {
    case 'SCHEDULED': return 'bg-blue-100 text-blue-800';
    case 'WAITING_ROOM': return 'bg-yellow-100 text-yellow-800';
    case 'IN_CALL': return 'bg-green-100 text-green-800';
    case 'COMPLETED': return 'bg-muted text-foreground';
    case 'NO_SHOW': return 'bg-red-100 text-red-800';
    default: return 'bg-muted text-foreground';
  }
}

export default function TeleVisits() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('waiting');

  const { data, mutate } = useSWR('/api/telemedicine/visits?limit=50', fetcher, { refreshInterval: 10000 });
  const visits = data?.visits || [];

  const updateStatus = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/telemedicine/visits/${id}/status`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (res.ok) { toast({ title: tr('تم التحديث', 'Updated') }); mutate(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [mutate, toast, tr]);

  const waitingRoom = visits.filter((v: any) => v.status === 'WAITING_ROOM');
  const inCall = visits.filter((v: any) => v.status === 'IN_CALL');
  const scheduled = visits.filter((v: any) => v.status === 'SCHEDULED');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('الزيارات الافتراضية', 'Virtual Visits')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-yellow-600">{waitingRoom.length}</p><p className="text-sm">{tr('غرفة الانتظار', 'Waiting Room')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-green-600">{inCall.length}</p><p className="text-sm">{tr('في المكالمة', 'In Call')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-blue-600">{scheduled.length}</p><p className="text-sm">{tr('مجدولة', 'Scheduled')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{visits.length}</p><p className="text-sm">{tr('الإجمالي', 'Total')}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="waiting">{tr('غرفة الانتظار', 'Waiting Room')} ({waitingRoom.length})</TabsTrigger>
          <TabsTrigger value="active">{tr('نشطة', 'Active')} ({inCall.length})</TabsTrigger>
          <TabsTrigger value="scheduled">{tr('مجدولة', 'Scheduled')}</TabsTrigger>
          <TabsTrigger value="completed">{tr('مكتملة', 'Completed')}</TabsTrigger>
        </TabsList>

        {['waiting', 'active', 'scheduled', 'completed'].map(t => {
          const filtered = t === 'waiting' ? waitingRoom : t === 'active' ? inCall : t === 'scheduled' ? scheduled : visits.filter((v: any) => v.status === 'COMPLETED' || v.status === 'NO_SHOW');
          return (
            <TabsContent key={t} value={t}>
              <div className="space-y-3">
                {filtered.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد زيارات', 'No visits')}</CardContent></Card>}
                {filtered.map((v: any) => (
                  <Card key={v.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{v.patientName || v.patientId?.slice(0, 8)}</span>
                          <span className="text-sm text-muted-foreground ml-3">{new Date(v.scheduledAt).toLocaleString()}</span>
                          {v.duration && <span className="text-sm text-muted-foreground ml-2">{v.duration} {tr('دقيقة', 'min')}</span>}
                        </div>
                        <div className="flex gap-2 items-center">
                          <Badge className={statusColor(v.status)}>{v.status}</Badge>
                          {v.connectionQuality && <Badge variant="outline">{v.connectionQuality}</Badge>}
                          {v.status === 'WAITING_ROOM' && <Button size="sm" onClick={() => updateStatus(v.id, 'IN_CALL')}>{tr('بدء المكالمة', 'Start Call')}</Button>}
                          {v.status === 'IN_CALL' && <Button size="sm" variant="outline" onClick={() => updateStatus(v.id, 'COMPLETED')}>{tr('إنهاء', 'End Call')}</Button>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
