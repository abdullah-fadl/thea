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

const PIPELINE_STAGES = ['IDENTIFIED', 'SCOT_NOTIFIED', 'FAMILY_APPROACHED', 'CONSENTED', 'DONOR_MANAGEMENT', 'ORGANS_ALLOCATED', 'PROCUREMENT_COMPLETE'] as const;

function stageLabel(s: string, tr: (a: string, e: string) => string) {
  const map: Record<string, [string, string]> = {
    IDENTIFIED: ['تم التحديد', 'Identified'],
    SCOT_NOTIFIED: ['تم إبلاغ SCOT', 'SCOT Notified'],
    FAMILY_APPROACHED: ['تم مقابلة العائلة', 'Family Approached'],
    CONSENTED: ['تمت الموافقة', 'Consented'],
    DONOR_MANAGEMENT: ['إدارة المتبرع', 'Donor Management'],
    ORGANS_ALLOCATED: ['تم تخصيص الأعضاء', 'Organs Allocated'],
    PROCUREMENT_COMPLETE: ['اكتمل الاستخراج', 'Procurement Complete'],
  };
  return tr(map[s]?.[0] || s, map[s]?.[1] || s);
}

function stageColor(s: string) {
  if (s === 'PROCUREMENT_COMPLETE') return 'bg-green-600 text-white';
  if (s === 'CONSENTED' || s === 'DONOR_MANAGEMENT' || s === 'ORGANS_ALLOCATED') return 'bg-blue-600 text-white';
  if (s === 'FAMILY_APPROACHED') return 'bg-yellow-500 text-foreground';
  return 'bg-muted text-foreground';
}

export default function OrganDonation() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('pipeline');

  const { data, mutate } = useSWR('/api/icu/organ-donation?limit=50', fetcher, { refreshInterval: 15000 });
  const cases = data?.cases || [];

  const advanceStage = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/icu/organ-donation/${id}/status`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) { toast({ title: tr('تم التقدم', 'Stage advanced') }); mutate(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [mutate, toast, tr]);

  const activeCases = cases.filter((c: any) => c.status !== 'COMPLETED' && c.status !== 'DECLINED');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('سير عمل التبرع بالأعضاء', 'Organ Donation Workflow')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{cases.length}</p><p className="text-sm text-muted-foreground">{tr('إجمالي الحالات', 'Total Cases')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-blue-600">{activeCases.length}</p><p className="text-sm text-muted-foreground">{tr('نشطة', 'Active')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-green-600">{cases.filter((c: any) => c.status === 'COMPLETED').length}</p><p className="text-sm text-muted-foreground">{tr('مكتملة', 'Completed')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-red-600">{cases.filter((c: any) => c.familyDecision === 'DECLINED').length}</p><p className="text-sm text-muted-foreground">{tr('مرفوضة', 'Declined')}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pipeline">{tr('خط الأنابيب', 'Pipeline')}</TabsTrigger>
          <TabsTrigger value="history">{tr('السجل', 'History')}</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <div className="space-y-4">
            {activeCases.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد حالات نشطة', 'No active cases')}</CardContent></Card>}
            {activeCases.map((c: any) => (
              <Card key={c.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold">{c.patientName || c.brainDeathProtocolId?.slice(0, 8)}</span>
                    <Badge className={stageColor(c.currentStage)}>{stageLabel(c.currentStage, tr)}</Badge>
                  </div>
                  <div className="flex gap-1 mb-3">
                    {PIPELINE_STAGES.map((s, idx) => {
                      const curIdx = (PIPELINE_STAGES as readonly string[]).indexOf(c.currentStage);
                      return <div key={s} className={`flex-1 h-2 rounded ${idx <= curIdx ? 'bg-blue-500' : 'bg-muted'}`} title={stageLabel(s, tr)} />;
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                    <div><span className="text-muted-foreground">{tr('إبلاغ SCOT', 'SCOT Notified')}:</span> {c.scotNotifiedAt ? new Date(c.scotNotifiedAt).toLocaleString() : '—'}</div>
                    <div><span className="text-muted-foreground">{tr('قرار العائلة', 'Family Decision')}:</span> {c.familyDecision || '—'}</div>
                    <div><span className="text-muted-foreground">{tr('الأعضاء', 'Organs')}:</span> {(c.organsOffered || []).join(', ') || '—'}</div>
                  </div>
                  <Button size="sm" onClick={() => advanceStage(c.id)}>{tr('تقدم للمرحلة التالية', 'Advance Stage')}</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-3">
            {cases.map((c: any) => (
              <Card key={c.id}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{c.patientName || '—'}</span>
                    <span className="text-xs text-muted-foreground ml-2">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={stageColor(c.currentStage)}>{stageLabel(c.currentStage, tr)}</Badge>
                    <Badge variant="outline">{c.status}</Badge>
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
