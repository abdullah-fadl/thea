'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

function connColor(s: string) {
  switch (s) {
    case 'CONNECTED': return 'bg-green-100 text-green-800';
    case 'DISCONNECTED': return 'bg-red-100 text-red-800';
    case 'ERROR': return 'bg-red-100 text-red-800';
    case 'IDLE': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-muted text-foreground';
  }
}

export default function LisDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [tab, setTab] = useState('analyzers');

  const { data: connData } = useSWR('/api/lab/lis-dashboard', fetcher, { refreshInterval: 10000 });
  const connections = connData?.connections || [];

  const { data: queueData } = useSWR('/api/lab/lis-connections/message-queue', fetcher, { refreshInterval: 10000 });
  const messages = queueData?.messages || [];

  const connected = connections.filter((c: any) => c.connectionStatus === 'CONNECTED').length;
  const total = connections.length;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('لوحة تكامل LIS', 'LIS Integration Dashboard')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-green-600">{connected}/{total}</p><p className="text-sm">{tr('أجهزة متصلة', 'Connected Analyzers')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{messages.filter((m: any) => m.status === 'PENDING').length}</p><p className="text-sm">{tr('رسائل معلقة', 'Pending Messages')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-red-600">{messages.filter((m: any) => m.status === 'ERROR').length}</p><p className="text-sm">{tr('أخطاء', 'Errors')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{messages.filter((m: any) => m.status === 'PROCESSED').length}</p><p className="text-sm">{tr('تم المعالجة', 'Processed')}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="analyzers">{tr('الأجهزة', 'Analyzers')}</TabsTrigger>
          <TabsTrigger value="messages">{tr('الرسائل', 'Messages')}</TabsTrigger>
        </TabsList>

        <TabsContent value="analyzers">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.map((c: any) => (
              <Card key={c.id} className={`border-l-4 ${c.connectionStatus === 'CONNECTED' ? 'border-green-500' : 'border-red-500'}`}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{c.analyzerName || c.analyzerId}</span>
                    <Badge className={connColor(c.connectionStatus)}>{c.connectionStatus}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>{tr('البروتوكول', 'Protocol')}: {c.protocolType || '—'}</div>
                    <div>{tr('آخر رسالة', 'Last Message')}: {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : '—'}</div>
                    <div>{tr('الرسائل اليوم', 'Messages Today')}: {c.messageCount || 0}</div>
                    {c.errorCount > 0 && <div className="text-red-600">{tr('أخطاء', 'Errors')}: {c.errorCount}</div>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {connections.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد أجهزة', 'No analyzers configured')}</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="messages">
          <div className="space-y-2">
            {messages.slice(0, 50).map((m: any) => (
              <Card key={m.id}>
                <CardContent className="pt-3 flex justify-between items-center text-sm">
                  <div>
                    <Badge variant="outline">{m.messageType || 'HL7'}</Badge>
                    <span className="ml-2">{m.analyzerName || m.analyzerId}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge className={m.status === 'PROCESSED' ? 'bg-green-100 text-green-800' : m.status === 'ERROR' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>{m.status}</Badge>
                    <span className="text-muted-foreground">{new Date(m.receivedAt || m.createdAt).toLocaleString()}</span>
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
