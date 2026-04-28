'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

function statusColor(s: string) {
  switch (s) {
    case 'CREATED': return 'bg-blue-100 text-blue-800';
    case 'SENT_TO_PATIENT': return 'bg-yellow-100 text-yellow-800';
    case 'PHARMACY_NOTIFIED': return 'bg-orange-100 text-orange-800';
    case 'DISPENSED': return 'bg-green-100 text-green-800';
    case 'DELIVERY_ARRANGED': return 'bg-purple-100 text-purple-800';
    default: return 'bg-muted text-foreground';
  }
}

export default function TelePrescriptions() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [tab, setTab] = useState('all');

  const { data } = useSWR('/api/telemedicine/prescriptions?limit=50', fetcher, { refreshInterval: 15000 });
  const prescriptions = data?.prescriptions || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('وصفات الطب عن بُعد', 'Tele-Prescriptions')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['CREATED', 'SENT_TO_PATIENT', 'PHARMACY_NOTIFIED', 'DISPENSED', 'DELIVERY_ARRANGED'].map(s => (
          <Card key={s}><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{prescriptions.filter((p: any) => p.status === s).length}</p>
            <Badge className={`${statusColor(s)} mt-2`}>{s.replace(/_/g, ' ')}</Badge>
          </CardContent></Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{tr('الكل', 'All')}</TabsTrigger>
          <TabsTrigger value="pending">{tr('بانتظار الصرف', 'Pending Dispense')}</TabsTrigger>
          <TabsTrigger value="delivery">{tr('التوصيل', 'Delivery')}</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="space-y-3">
            {prescriptions.map((rx: any) => (
              <Card key={rx.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{(rx.medications || []).length} {tr('أدوية', 'medications')}</span>
                      <span className="text-sm text-muted-foreground ml-3">{new Date(rx.createdAt).toLocaleDateString()}</span>
                      {rx.wasfatyRef && <span className="text-xs text-blue-600 ml-2">Wasfaty: {rx.wasfatyRef}</span>}
                    </div>
                    <div className="flex gap-2">
                      {rx.deliveryOption && <Badge variant="outline">{rx.deliveryOption === 'HOME_DELIVERY' ? tr('توصيل منزلي', 'Home Delivery') : tr('استلام', 'Pickup')}</Badge>}
                      <Badge className={statusColor(rx.status)}>{rx.status.replace(/_/g, ' ')}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {(rx.medications || []).map((m: any, i: number) => <span key={i} className="mr-3">{m.name} {m.dose}</span>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <div className="space-y-3">
            {prescriptions.filter((rx: any) => ['CREATED', 'SENT_TO_PATIENT', 'PHARMACY_NOTIFIED'].includes(rx.status)).map((rx: any) => (
              <Card key={rx.id}><CardContent className="pt-4 flex justify-between"><span>{(rx.medications || []).length} {tr('أدوية', 'meds')}</span><Badge className={statusColor(rx.status)}>{rx.status.replace(/_/g, ' ')}</Badge></CardContent></Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="delivery">
          <div className="space-y-3">
            {prescriptions.filter((rx: any) => rx.deliveryOption === 'HOME_DELIVERY').map((rx: any) => (
              <Card key={rx.id}><CardContent className="pt-4 flex justify-between">
                <div><span className="font-medium">{rx.deliveryAddress || '—'}</span><span className="text-sm ml-2">{rx.deliveryStatus || '—'}</span></div>
                <Badge className={statusColor(rx.status)}>{rx.status.replace(/_/g, ' ')}</Badge>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
