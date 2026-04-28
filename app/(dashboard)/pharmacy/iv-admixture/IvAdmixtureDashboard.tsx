'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

const DILUENTS = ['NS', 'D5W', 'LR', 'STERILE_WATER', 'D5NS'];
const DOSE_UNITS = ['mg', 'g', 'mcg', 'units', 'mEq'];

function statusColor(status: string) {
  switch (status) {
    case 'ORDERED': return 'bg-blue-100 text-blue-800';
    case 'PREPARING': return 'bg-yellow-100 text-yellow-800';
    case 'VERIFIED': return 'bg-green-100 text-green-800';
    case 'DISPENSED': return 'bg-purple-100 text-purple-800';
    case 'ADMINISTERED': return 'bg-muted text-foreground';
    default: return 'bg-muted text-foreground';
  }
}

export default function IvAdmixtureDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('queue');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCompat, setShowCompat] = useState(false);
  const [compatDrug, setCompatDrug] = useState('');
  const [compatDiluent, setCompatDiluent] = useState('NS');
  const [compatResult, setCompatResult] = useState<any>(null);

  const url = `/api/pharmacy/iv-admixture${statusFilter ? `?status=${statusFilter}` : ''}`;
  const { data, mutate } = useSWR(url, fetcher, { refreshInterval: 15000 });
  const { data: batchData } = useSWR('/api/pharmacy/iv-admixture/batch', fetcher);

  const orders = data?.orders || [];
  const kpis = data?.kpis || {};

  const updateStatus = useCallback(async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/pharmacy/iv-admixture/${orderId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({ title: tr('تم التحديث', 'Status updated') });
        mutate();
      }
    } catch {
      toast({ title: tr('فشل التحديث', 'Update failed'), variant: 'destructive' });
    }
  }, [mutate, toast, tr]);

  const verifyOrder = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/pharmacy/iv-admixture/${orderId}/verify`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: tr('تم التحقق', 'Order verified') });
        mutate();
      } else {
        toast({ title: data.error || tr('فشل التحقق', 'Verification failed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('فشل التحقق', 'Verification failed'), variant: 'destructive' });
    }
  }, [mutate, toast, tr]);

  const checkCompatibility = useCallback(async () => {
    if (!compatDrug) return;
    try {
      const res = await fetch('/api/pharmacy/iv-admixture/compatibility', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug: compatDrug, diluent: compatDiluent, coInfusions: [] }),
      });
      const data = await res.json();
      setCompatResult(data.result);
    } catch {
      toast({ title: tr('فشل الفحص', 'Check failed'), variant: 'destructive' });
    }
  }, [compatDrug, compatDiluent, toast, tr]);

  const printLabel = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/pharmacy/iv-admixture/${orderId}/label`, { credentials: 'include' });
      if (res.ok) {
        toast({ title: tr('تم طباعة الملصق', 'Label printed') });
        mutate();
      }
    } catch {
      toast({ title: tr('فشل الطباعة', 'Print failed'), variant: 'destructive' });
    }
  }, [mutate, toast, tr]);

  return (
    <div className="p-4 space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{tr('خلط الأدوية الوريدية', 'IV Admixture')}</h1>
        <div className="flex items-center gap-2">
          <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={tr('كل الحالات', 'All Statuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{tr('الكل', 'All')}</SelectItem>
              <SelectItem value="ORDERED">{tr('مطلوب', 'Ordered')}</SelectItem>
              <SelectItem value="PREPARING">{tr('قيد التحضير', 'Preparing')}</SelectItem>
              <SelectItem value="VERIFIED">{tr('تم التحقق', 'Verified')}</SelectItem>
              <SelectItem value="DISPENSED">{tr('تم الصرف', 'Dispensed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{kpis.total || 0}</div><div className="text-xs text-muted-foreground">{tr('الإجمالي', 'Total')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-blue-600">{kpis.ordered || 0}</div><div className="text-xs text-muted-foreground">{tr('مطلوب', 'Ordered')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-yellow-600">{kpis.preparing || 0}</div><div className="text-xs text-muted-foreground">{tr('قيد التحضير', 'Preparing')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-green-600">{kpis.verified || 0}</div><div className="text-xs text-muted-foreground">{tr('تم التحقق', 'Verified')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-purple-600">{kpis.dispensed || 0}</div><div className="text-xs text-muted-foreground">{tr('تم الصرف', 'Dispensed')}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="queue">{tr('قائمة الطلبات', 'Order Queue')}</TabsTrigger>
          <TabsTrigger value="compatibility">{tr('التوافق', 'Compatibility')}</TabsTrigger>
          <TabsTrigger value="batch">{tr('التحضير الجماعي', 'Batch Prep')}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">{tr('لا توجد طلبات', 'No orders found')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-start p-2">{tr('الدواء', 'Drug')}</th>
                    <th className="text-start p-2">{tr('الجرعة', 'Dose')}</th>
                    <th className="text-start p-2">{tr('المذيب', 'Diluent')}</th>
                    <th className="text-start p-2">{tr('الحجم', 'Volume')}</th>
                    <th className="text-start p-2">{tr('المعدل', 'Rate')}</th>
                    <th className="text-start p-2">{tr('الحالة', 'Status')}</th>
                    <th className="text-start p-2">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: any) => (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{order.drug}</td>
                      <td className="p-2">{order.drugDose} {order.drugDoseUnit}</td>
                      <td className="p-2">{order.diluent}</td>
                      <td className="p-2">{order.diluentVolume} mL</td>
                      <td className="p-2">{order.infusionRate ? `${order.infusionRate} mL/hr` : '-'}</td>
                      <td className="p-2"><Badge className={statusColor(order.status)}>{order.status}</Badge></td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          {order.status === 'ORDERED' && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, 'PREPARING')}>
                              {tr('تحضير', 'Prepare')}
                            </Button>
                          )}
                          {order.status === 'PREPARING' && (
                            <Button size="sm" variant="outline" onClick={() => verifyOrder(order.id)}>
                              {tr('تحقق', 'Verify')}
                            </Button>
                          )}
                          {order.status === 'VERIFIED' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => printLabel(order.id)}>
                                {tr('طباعة', 'Label')}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, 'DISPENSED')}>
                                {tr('صرف', 'Dispense')}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="compatibility" className="space-y-3">
          <Card>
            <CardHeader><CardTitle>{tr('فحص التوافق', 'Compatibility Checker')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>{tr('الدواء', 'Drug')}</Label>
                  <Input value={compatDrug} onChange={e => setCompatDrug(e.target.value)} placeholder={tr('اسم الدواء', 'Drug name')} />
                </div>
                <div>
                  <Label>{tr('المذيب', 'Diluent')}</Label>
                  <Select value={compatDiluent} onValueChange={setCompatDiluent}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DILUENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={checkCompatibility}>{tr('فحص', 'Check')}</Button>
                </div>
              </div>

              {compatResult && (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tr('النتيجة', 'Result')}:</span>
                    <Badge className={compatResult.overallResult === 'COMPATIBLE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {compatResult.overallResult}
                    </Badge>
                  </div>
                  <p className="text-sm">{compatResult.diluentMessage}</p>
                  <p className="text-sm">{compatResult.ySiteMessage}</p>
                  <p className="text-xs text-muted-foreground italic">{compatResult.disclaimer}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-3">
          <Card>
            <CardHeader><CardTitle>{tr('التحضير الجماعي', 'Batch Preparations')}</CardTitle></CardHeader>
            <CardContent>
              {batchData?.batches?.length > 0 ? (
                <div className="space-y-2">
                  {batchData.batches.map((batch: any) => (
                    <div key={batch.batchId} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{batch.batchId}</span>
                          <span className="mx-2">-</span>
                          <span>{batch.drug}</span>
                        </div>
                        <Badge variant="outline">{batch.totalOrders} {tr('طلب', 'orders')}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {tr('المذيب', 'Diluent')}: {batch.diluent}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {tr('لا توجد تحضيرات جماعية', 'No batch preparations')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
