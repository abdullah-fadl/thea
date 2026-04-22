'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

function cabinetStatusColor(status: string) {
  switch (status) {
    case 'ONLINE': return 'bg-green-100 text-green-800';
    case 'OFFLINE': return 'bg-red-100 text-red-800';
    case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-muted text-foreground';
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-100 text-red-800';
    case 'HIGH': return 'bg-orange-100 text-orange-800';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-muted text-foreground';
  }
}

export default function AdcDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('cabinets');
  const [selectedCabinet, setSelectedCabinet] = useState('');

  const { data: cabinetData } = useSWR('/api/pharmacy/adc/cabinets', fetcher, { refreshInterval: 30000 });
  const inventoryUrl = `/api/pharmacy/adc/inventory${selectedCabinet ? `?cabinetId=${selectedCabinet}` : ''}`;
  const { data: inventoryData } = useSWR(inventoryUrl, fetcher, { refreshInterval: 30000 });
  const txUrl = `/api/pharmacy/adc/transactions${selectedCabinet ? `?cabinetId=${selectedCabinet}` : ''}`;
  const { data: txData } = useSWR(txUrl, fetcher);
  const { data: restockData } = useSWR('/api/pharmacy/adc/inventory/restock-alerts', fetcher, { refreshInterval: 60000 });
  const { data: overrideData } = useSWR('/api/pharmacy/adc/overrides', fetcher);
  const { data: discrepancyData } = useSWR('/api/pharmacy/adc/discrepancies', fetcher);

  const cabinets = cabinetData?.cabinets || [];
  const cabinetKpis = cabinetData?.kpis || {};
  const inventory = inventoryData?.inventory || [];
  const inventoryKpis = inventoryData?.kpis || {};
  const transactions = txData?.transactions || [];
  const restockAlerts = restockData?.alerts || [];
  const overrides = overrideData?.overrides || [];
  const discrepancies = discrepancyData?.discrepancies || [];

  return (
    <div className="p-4 space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{tr('خزائن الصرف الآلي', 'Automated Dispensing Cabinets')}</h1>
        <Select value={selectedCabinet || '__all__'} onValueChange={(v) => setSelectedCabinet(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={tr('كل الخزائن', 'All Cabinets')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('الكل', 'All')}</SelectItem>
            {cabinets.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.cabinetName} - {c.location}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{cabinetKpis.total || 0}</div><div className="text-xs text-muted-foreground">{tr('خزائن', 'Cabinets')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-green-600">{cabinetKpis.online || 0}</div><div className="text-xs text-muted-foreground">{tr('متصل', 'Online')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-red-600">{cabinetKpis.offline || 0}</div><div className="text-xs text-muted-foreground">{tr('غير متصل', 'Offline')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-orange-600">{restockData?.total || 0}</div><div className="text-xs text-muted-foreground">{tr('تنبيهات إعادة تعبئة', 'Restock Alerts')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-red-600">{discrepancyData?.total || 0}</div><div className="text-xs text-muted-foreground">{tr('تباينات', 'Discrepancies')}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="cabinets">{tr('الخزائن', 'Cabinets')}</TabsTrigger>
          <TabsTrigger value="inventory">{tr('المخزون', 'Inventory')}</TabsTrigger>
          <TabsTrigger value="transactions">{tr('المعاملات', 'Transactions')}</TabsTrigger>
          <TabsTrigger value="restock">{tr('إعادة التعبئة', 'Restock')}</TabsTrigger>
          <TabsTrigger value="overrides">{tr('التجاوزات', 'Overrides')}</TabsTrigger>
          <TabsTrigger value="discrepancies">{tr('التباينات', 'Discrepancies')}</TabsTrigger>
        </TabsList>

        <TabsContent value="cabinets" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cabinets.map((cab: any) => (
              <Card key={cab.id} className="cursor-pointer hover:shadow-md" onClick={() => { setSelectedCabinet(cab.id); setTab('inventory'); }}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-lg">{cab.cabinetName}</div>
                      <div className="text-sm text-muted-foreground">{cab.location}</div>
                      {cab.manufacturer && <div className="text-xs text-muted-foreground">{cab.manufacturer} {cab.model || ''}</div>}
                    </div>
                    <Badge className={cabinetStatusColor(cab.status)}>{cab.status}</Badge>
                  </div>
                  <div className="mt-3 text-sm">
                    <span>{cab.totalPockets} {tr('جيوب', 'pockets')}</span>
                    {cab.lastSyncAt && (
                      <span className="mx-2 text-muted-foreground">
                        {tr('آخر مزامنة', 'Last sync')}: {new Date(cab.lastSyncAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{inventoryKpis.totalItems || 0}</div><div className="text-xs text-muted-foreground">{tr('أصناف', 'Items')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{inventoryKpis.totalUnits || 0}</div><div className="text-xs text-muted-foreground">{tr('وحدات', 'Units')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-orange-600">{inventoryKpis.belowMin || 0}</div><div className="text-xs text-muted-foreground">{tr('أقل من الحد الأدنى', 'Below Min')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-red-600">{inventoryKpis.atZero || 0}</div><div className="text-xs text-muted-foreground">{tr('صفر', 'At Zero')}</div></CardContent></Card>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-start p-2">{tr('رقم الجيب', 'Pocket')}</th>
                  <th className="text-start p-2">{tr('الدواء', 'Drug')}</th>
                  <th className="text-start p-2">{tr('الكمية', 'Qty')}</th>
                  <th className="text-start p-2">{tr('الحد الأدنى', 'Min')}</th>
                  <th className="text-start p-2">{tr('الحد الأقصى', 'Max')}</th>
                  <th className="text-start p-2">{tr('الحالة', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item: any) => (
                  <tr key={item.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">{item.pocketNumber}</td>
                    <td className="p-2">{item.drugName}</td>
                    <td className="p-2 font-medium">{item.currentQuantity}</td>
                    <td className="p-2">{item.minQuantity}</td>
                    <td className="p-2">{item.maxQuantity}</td>
                    <td className="p-2">
                      {item.needsRestock ? (
                        <Badge className="bg-red-100 text-red-800">{tr('إعادة تعبئة', 'Restock')}</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">{tr('كافي', 'OK')}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-start p-2">{tr('الوقت', 'Time')}</th>
                  <th className="text-start p-2">{tr('النوع', 'Type')}</th>
                  <th className="text-start p-2">{tr('الدواء', 'Drug')}</th>
                  <th className="text-start p-2">{tr('الكمية', 'Qty')}</th>
                  <th className="text-start p-2">{tr('المستخدم', 'User')}</th>
                  <th className="text-start p-2">{tr('تجاوز', 'Override')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 100).map((tx: any) => (
                  <tr key={tx.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="p-2"><Badge variant="outline">{tx.transactionType}</Badge></td>
                    <td className="p-2">{tx.drugName}</td>
                    <td className="p-2">{tx.quantity}</td>
                    <td className="p-2">{tx.userName || tx.userId?.slice(0, 8)}</td>
                    <td className="p-2">{tx.isOverride ? <Badge className="bg-red-100 text-red-800">{tr('نعم', 'Yes')}</Badge> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="restock" className="space-y-3">
          <div className="space-y-2">
            {restockAlerts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">{tr('لا توجد تنبيهات', 'No restock alerts')}</div>
            ) : (
              restockAlerts.map((alert: any) => (
                <Card key={alert.id}>
                  <CardContent className="p-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{alert.drugName}</div>
                      <div className="text-sm text-muted-foreground">
                        {alert.cabinet?.cabinetName} - {alert.pocketNumber} | {tr('الحالي', 'Current')}: {alert.currentQuantity} / {tr('الحد الأدنى', 'Min')}: {alert.minQuantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={severityColor(alert.severity)}>{alert.severity}</Badge>
                      <span className="text-sm font-medium">{tr('النقص', 'Deficit')}: {alert.deficit}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="overrides" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{overrideData?.total || 0}</div><div className="text-xs text-muted-foreground">{tr('إجمالي التجاوزات', 'Total Overrides')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-green-600">{overrideData?.withWitness || 0}</div><div className="text-xs text-muted-foreground">{tr('مع شاهد', 'With Witness')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-red-600">{overrideData?.withoutWitness || 0}</div><div className="text-xs text-muted-foreground">{tr('بدون شاهد', 'Without Witness')}</div></CardContent></Card>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-start p-2">{tr('الوقت', 'Time')}</th>
                  <th className="text-start p-2">{tr('الدواء', 'Drug')}</th>
                  <th className="text-start p-2">{tr('الكمية', 'Qty')}</th>
                  <th className="text-start p-2">{tr('السبب', 'Reason')}</th>
                  <th className="text-start p-2">{tr('المستخدم', 'User')}</th>
                  <th className="text-start p-2">{tr('شاهد', 'Witness')}</th>
                </tr>
              </thead>
              <tbody>
                {overrides.slice(0, 50).map((o: any) => (
                  <tr key={o.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-xs">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="p-2">{o.drugName}</td>
                    <td className="p-2">{o.quantity}</td>
                    <td className="p-2">{o.overrideReason || '-'}</td>
                    <td className="p-2">{o.userName || o.userId?.slice(0, 8)}</td>
                    <td className="p-2">{o.witnessUserId ? tr('نعم', 'Yes') : tr('لا', 'No')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="discrepancies" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{discrepancyData?.total || 0}</div><div className="text-xs text-muted-foreground">{tr('إجمالي التباينات', 'Total Discrepancies')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-orange-600">{discrepancyData?.positive || 0}</div><div className="text-xs text-muted-foreground">{tr('زيادة', 'Positive')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-red-600">{discrepancyData?.negative || 0}</div><div className="text-xs text-muted-foreground">{tr('نقص', 'Negative')}</div></CardContent></Card>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-start p-2">{tr('الوقت', 'Time')}</th>
                  <th className="text-start p-2">{tr('الدواء', 'Drug')}</th>
                  <th className="text-start p-2">{tr('العدد السابق', 'Previous')}</th>
                  <th className="text-start p-2">{tr('العدد الجديد', 'New')}</th>
                  <th className="text-start p-2">{tr('الفرق', 'Difference')}</th>
                  <th className="text-start p-2">{tr('المستخدم', 'User')}</th>
                </tr>
              </thead>
              <tbody>
                {discrepancies.slice(0, 50).map((d: any) => (
                  <tr key={d.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-xs">{new Date(d.createdAt).toLocaleString()}</td>
                    <td className="p-2">{d.drugName}</td>
                    <td className="p-2">{d.previousCount ?? '-'}</td>
                    <td className="p-2">{d.newCount ?? '-'}</td>
                    <td className="p-2">
                      <span className={d.discrepancyAmount > 0 ? 'text-orange-600' : 'text-red-600'}>
                        {d.discrepancyAmount > 0 ? '+' : ''}{d.discrepancyAmount}
                      </span>
                    </td>
                    <td className="p-2">{d.userName || d.userId?.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
