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

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
const PLAN_STATUSES = ['PLANNED', 'IN_PRODUCTION', 'READY', 'DELIVERING', 'COMPLETED'] as const;
const DIET_TYPES = ['REGULAR', 'DIABETIC', 'RENAL', 'CARDIAC', 'SOFT', 'LIQUID', 'NPO', 'HALAL', 'CUSTOM'] as const;

function statusColor(status: string) {
  switch (status) {
    case 'PLANNED': return 'bg-blue-100 text-blue-800';
    case 'IN_PRODUCTION': return 'bg-yellow-100 text-yellow-800';
    case 'READY': return 'bg-green-100 text-green-800';
    case 'DELIVERING': return 'bg-orange-100 text-orange-800';
    case 'COMPLETED': return 'bg-muted text-foreground';
    case 'PREPARED': return 'bg-blue-100 text-blue-800';
    case 'SENT': return 'bg-yellow-100 text-yellow-800';
    case 'RECEIVED': return 'bg-green-100 text-green-800';
    case 'RETURNED': return 'bg-red-100 text-red-800';
    default: return 'bg-muted text-foreground';
  }
}

export default function KitchenDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('production');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [wardFilter, setWardFilter] = useState('');

  const plansUrl = `/api/nutrition/kitchen/meal-plans?date=${dateFilter}${wardFilter ? `&ward=${wardFilter}` : ''}`;
  const { data: plansData, mutate: mutatePlans } = useSWR(plansUrl, fetcher, { refreshInterval: 30000 });
  const { data: wasteData } = useSWR(`/api/nutrition/kitchen/waste?from=${dateFilter}&to=${dateFilter}`, fetcher, { refreshInterval: 60000 });

  const plans = plansData?.plans || [];
  const kpis = plansData?.kpis || {};
  const wasteStats = wasteData?.stats || {};

  const updatePlanStatus = useCallback(async (planId: string, status: string) => {
    try {
      const res = await fetch(`/api/nutrition/kitchen/meal-plans/${planId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({ title: tr('تم التحديث', 'Status updated') });
        mutatePlans();
      }
    } catch {
      toast({ title: tr('فشل التحديث', 'Update failed'), variant: 'destructive' });
    }
  }, [mutatePlans, toast, tr]);

  const deliverTray = useCallback(async (cardId: string) => {
    try {
      const res = await fetch(`/api/nutrition/kitchen/tray-cards/${cardId}/deliver`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast({ title: tr('تم التسليم', 'Tray delivered') });
        mutatePlans();
      }
    } catch {
      toast({ title: tr('فشل التسليم', 'Delivery failed'), variant: 'destructive' });
    }
  }, [mutatePlans, toast, tr]);

  return (
    <div className="p-4 space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{tr('لوحة المطبخ', 'Kitchen Dashboard')}</h1>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-40" />
          <Input
            placeholder={tr('تصفية حسب الجناح', 'Filter by ward')}
            value={wardFilter}
            onChange={e => setWardFilter(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{kpis.total || 0}</div><div className="text-xs text-muted-foreground">{tr('الإجمالي', 'Total')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-blue-600">{kpis.planned || 0}</div><div className="text-xs text-muted-foreground">{tr('مخطط', 'Planned')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-yellow-600">{kpis.inProduction || 0}</div><div className="text-xs text-muted-foreground">{tr('قيد الإنتاج', 'In Production')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-green-600">{kpis.ready || 0}</div><div className="text-xs text-muted-foreground">{tr('جاهز', 'Ready')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-orange-600">{kpis.delivering || 0}</div><div className="text-xs text-muted-foreground">{tr('قيد التوصيل', 'Delivering')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-muted-foreground">{kpis.completed || 0}</div><div className="text-xs text-muted-foreground">{tr('مكتمل', 'Completed')}</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{kpis.totalTrays || 0}</div><div className="text-xs text-muted-foreground">{tr('إجمالي الصواني', 'Total Trays')}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="production">{tr('الإنتاج', 'Production')}</TabsTrigger>
          <TabsTrigger value="tray-cards">{tr('بطاقات الصواني', 'Tray Cards')}</TabsTrigger>
          <TabsTrigger value="delivery">{tr('التوصيل', 'Delivery')}</TabsTrigger>
          <TabsTrigger value="waste">{tr('الهدر', 'Waste Report')}</TabsTrigger>
        </TabsList>

        {/* Production Tab */}
        <TabsContent value="production" className="space-y-3">
          {MEAL_TYPES.map(meal => {
            const mealPlans = plans.filter((p: any) => p.mealType === meal);
            if (mealPlans.length === 0) return null;
            return (
              <Card key={meal}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {meal === 'BREAKFAST' ? tr('الإفطار', 'Breakfast') :
                     meal === 'LUNCH' ? tr('الغداء', 'Lunch') :
                     meal === 'DINNER' ? tr('العشاء', 'Dinner') :
                     tr('وجبة خفيفة', 'Snack')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {mealPlans.map((plan: any) => (
                      <div key={plan.id} className="flex items-center justify-between border rounded-lg p-3">
                        <div>
                          <div className="font-medium">{plan.ward || tr('كل الأجنحة', 'All Wards')}</div>
                          <div className="text-sm text-muted-foreground">
                            {plan.totalTrays} {tr('صينية', 'trays')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColor(plan.status)}>{plan.status}</Badge>
                          {plan.status === 'PLANNED' && (
                            <Button size="sm" onClick={() => updatePlanStatus(plan.id, 'IN_PRODUCTION')}>
                              {tr('بدء الإنتاج', 'Start Production')}
                            </Button>
                          )}
                          {plan.status === 'IN_PRODUCTION' && (
                            <Button size="sm" onClick={() => updatePlanStatus(plan.id, 'READY')}>
                              {tr('جاهز', 'Mark Ready')}
                            </Button>
                          )}
                          {plan.status === 'READY' && (
                            <Button size="sm" onClick={() => updatePlanStatus(plan.id, 'DELIVERING')}>
                              {tr('بدء التوصيل', 'Start Delivery')}
                            </Button>
                          )}
                          {plan.status === 'DELIVERING' && (
                            <Button size="sm" onClick={() => updatePlanStatus(plan.id, 'COMPLETED')}>
                              {tr('اكتمل', 'Complete')}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {plans.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              {tr('لا توجد خطط وجبات لهذا التاريخ', 'No meal plans for this date')}
            </div>
          )}
        </TabsContent>

        {/* Tray Cards Tab */}
        <TabsContent value="tray-cards" className="space-y-3">
          {plans.map((plan: any) => {
            const details = Array.isArray(plan.trayDetails) ? plan.trayDetails : [];
            if (details.length === 0) return null;
            return (
              <Card key={plan.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {plan.mealType} - {plan.ward || tr('كل الأجنحة', 'All Wards')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-start p-2">{tr('المريض', 'Patient')}</th>
                          <th className="text-start p-2">{tr('الغرفة', 'Room')}</th>
                          <th className="text-start p-2">{tr('نوع الحمية', 'Diet Type')}</th>
                          <th className="text-start p-2">{tr('الحساسية', 'Allergies')}</th>
                          <th className="text-start p-2">{tr('القوام', 'Texture')}</th>
                          <th className="text-start p-2">{tr('طلبات خاصة', 'Special Requests')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.map((tray: any, i: number) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{tray.patientName}</td>
                            <td className="p-2">{tray.roomNumber || '-'}</td>
                            <td className="p-2"><Badge variant="outline">{tray.dietType}</Badge></td>
                            <td className="p-2">{tray.allergies?.join(', ') || '-'}</td>
                            <td className="p-2">{tray.texture || 'REGULAR'}</td>
                            <td className="p-2">{tray.specialRequests || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>{tr('تتبع التسليم', 'Delivery Tracking')}</CardTitle>
            </CardHeader>
            <CardContent>
              {plans.filter((p: any) => p.status === 'DELIVERING' || p.status === 'READY').length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {tr('لا توجد عمليات تسليم نشطة', 'No active deliveries')}
                </div>
              ) : (
                <div className="space-y-3">
                  {plans.filter((p: any) => p.status === 'DELIVERING' || p.status === 'READY').map((plan: any) => (
                    <div key={plan.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{plan.mealType}</span>
                          <span className="mx-2">-</span>
                          <span>{plan.ward || tr('كل الأجنحة', 'All Wards')}</span>
                        </div>
                        <Badge className={statusColor(plan.status)}>{plan.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {plan.totalTrays} {tr('صينية', 'trays')}
                        {plan.deliveredAt && ` - ${tr('تم التسليم', 'Delivered')}: ${new Date(plan.deliveredAt).toLocaleTimeString()}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Waste Tab */}
        <TabsContent value="waste" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{wasteStats.total || 0}</div><div className="text-xs text-muted-foreground">{tr('إجمالي السجلات', 'Total Records')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-green-600">{wasteStats.noWaste || 0}</div><div className="text-xs text-muted-foreground">{tr('بدون هدر', 'No Waste')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-yellow-600">{wasteStats.partialWaste || 0}</div><div className="text-xs text-muted-foreground">{tr('هدر جزئي', 'Partial Waste')}</div></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-red-600">{wasteStats.fullWaste || 0}</div><div className="text-xs text-muted-foreground">{tr('هدر كامل', 'Full Waste')}</div></CardContent></Card>
          </div>

          {wasteData?.topReasons?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{tr('أسباب الهدر الرئيسية', 'Top Waste Reasons')}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {wasteData.topReasons.map((r: any, i: number) => (
                    <div key={i} className="flex justify-between items-center border-b pb-2">
                      <span>{r.reason}</span>
                      <Badge variant="outline">{r.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
