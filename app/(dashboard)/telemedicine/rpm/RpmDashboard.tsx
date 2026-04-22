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

const READING_TYPES = ['BP', 'GLUCOSE', 'WEIGHT', 'SPO2', 'HR', 'TEMPERATURE'] as const;

function typeLabel(t: string, tr: (a: string, e: string) => string) {
  const m: Record<string, [string, string]> = {
    BP: ['ضغط الدم', 'Blood Pressure'], GLUCOSE: ['السكر', 'Glucose'], WEIGHT: ['الوزن', 'Weight'],
    SPO2: ['تشبع الأكسجين', 'SpO2'], HR: ['النبض', 'Heart Rate'], TEMPERATURE: ['الحرارة', 'Temperature'],
  };
  return tr(m[t]?.[0] || t, m[t]?.[1] || t);
}

export default function RpmDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('alerts');

  const { data: alertsData, mutate: mutateAlerts } = useSWR('/api/telemedicine/rpm/readings?abnormalOnly=true&limit=30', fetcher, { refreshInterval: 15000 });
  const { data: devicesData } = useSWR('/api/telemedicine/rpm/devices', fetcher);
  const { data: readingsData } = useSWR('/api/telemedicine/rpm/readings?limit=50', fetcher);

  const alerts = alertsData?.readings || [];
  const devices = devicesData?.devices || [];
  const readings = readingsData?.readings || [];

  const ackAlert = useCallback(async (readingId: string) => {
    try {
      const res = await fetch(`/api/telemedicine/rpm/readings/${readingId}/ack`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) { toast({ title: tr('تم التأكيد', 'Alert acknowledged') }); mutateAlerts(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [mutateAlerts, toast, tr]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('مراقبة المريض عن بُعد', 'Remote Patient Monitoring')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-200"><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-red-600">{alerts.filter((a: any) => !a.alertAckedAt).length}</p><p className="text-sm">{tr('تنبيهات غير مؤكدة', 'Unacked Alerts')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{devices.filter((d: any) => d.isActive).length}</p><p className="text-sm">{tr('أجهزة نشطة', 'Active Devices')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{readings.length}</p><p className="text-sm">{tr('قراءات اليوم', "Today's Readings")}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{new Set(devices.map((d: any) => d.patientId)).size}</p><p className="text-sm">{tr('مرضى مراقبون', 'Monitored Patients')}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="alerts">{tr('التنبيهات', 'Alerts')}</TabsTrigger>
          <TabsTrigger value="readings">{tr('القراءات', 'Readings')}</TabsTrigger>
          <TabsTrigger value="devices">{tr('الأجهزة', 'Devices')}</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <div className="space-y-3">
            {alerts.filter((a: any) => !a.alertAckedAt).length === 0 && <Card><CardContent className="pt-6 text-center text-green-600">{tr('لا توجد تنبيهات', 'No active alerts')}</CardContent></Card>}
            {alerts.filter((a: any) => !a.alertAckedAt).map((a: any) => (
              <Card key={a.id} className="border-l-4 border-red-500">
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <Badge variant="destructive">{typeLabel(a.readingType, tr)}</Badge>
                    <span className="font-medium ml-3">{JSON.stringify(a.value)}</span>
                    <span className="text-sm text-muted-foreground ml-2">{a.unit}</span>
                    <span className="text-xs text-muted-foreground ml-3">{new Date(a.readAt).toLocaleString()}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => ackAlert(a.id)}>{tr('تأكيد', 'Acknowledge')}</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="readings">
          <div className="space-y-2">
            {readings.map((r: any) => (
              <Card key={r.id}>
                <CardContent className="pt-3 flex justify-between items-center text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{typeLabel(r.readingType, tr)}</Badge>
                    <span className="font-mono">{JSON.stringify(r.value)}</span>
                    <span className="text-muted-foreground">{r.unit}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.isAbnormal && <Badge variant="destructive">{tr('غير طبيعي', 'Abnormal')}</Badge>}
                    <span className="text-muted-foreground">{new Date(r.readAt).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="devices">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((d: any) => (
              <Card key={d.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between">
                    <div>
                      <span className="font-medium">{d.deviceName || d.deviceType}</span>
                      <span className="text-sm text-muted-foreground ml-2">{d.manufacturer || ''}</span>
                    </div>
                    <Badge className={d.isActive ? 'bg-green-100 text-green-800' : 'bg-muted'}>{d.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {tr('آخر مزامنة', 'Last sync')}: {d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString() : '—'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
