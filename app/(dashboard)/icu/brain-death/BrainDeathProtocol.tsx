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

const STEPS = ['PREREQUISITES', 'EXAM_1', 'WAITING_PERIOD', 'EXAM_2', 'CONFIRMATORY_TEST', 'DECLARED'] as const;

function stepLabel(step: string, tr: (a: string, e: string) => string) {
  switch (step) {
    case 'PREREQUISITES': return tr('المتطلبات الأساسية', 'Prerequisites');
    case 'EXAM_1': return tr('الفحص الأول', 'First Examination');
    case 'WAITING_PERIOD': return tr('فترة الانتظار', 'Waiting Period');
    case 'EXAM_2': return tr('الفحص الثاني', 'Second Examination');
    case 'CONFIRMATORY_TEST': return tr('الفحص التأكيدي', 'Confirmatory Test');
    case 'DECLARED': return tr('تم الإعلان', 'Declared');
    default: return step;
  }
}

const BRAINSTEM_REFLEXES = [
  { key: 'pupillary', ar: 'منعكس الحدقة', en: 'Pupillary reflex' },
  { key: 'corneal', ar: 'منعكس القرنية', en: 'Corneal reflex' },
  { key: 'oculocephalic', ar: 'منعكس العين-الرأس', en: 'Oculocephalic' },
  { key: 'vestibularOcular', ar: 'منعكس دهليزي عيني', en: 'Vestibular-ocular' },
  { key: 'gag', ar: 'منعكس البلع', en: 'Gag reflex' },
  { key: 'cough', ar: 'منعكس السعال', en: 'Cough reflex' },
];

export default function BrainDeathProtocol() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('active');

  const { data, mutate } = useSWR('/api/icu/brain-death?status=IN_PROGRESS', fetcher, { refreshInterval: 15000 });
  const protocols = data?.protocols || [];

  const { data: allData } = useSWR('/api/icu/brain-death?limit=50', fetcher);
  const allProtocols = allData?.protocols || [];

  const [newForm, setNewForm] = useState({ episodeId: '', patientName: '' });

  const initProtocol = useCallback(async () => {
    try {
      // Actual route: /api/icu/episodes/[episodeId]/brain-death
      const res = await fetch(`/api/icu/episodes/${newForm.episodeId}/brain-death`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newForm) });
      if (res.ok) { toast({ title: tr('تم بدء البروتوكول', 'Protocol initiated') }); mutate(); setNewForm({ episodeId: '', patientName: '' }); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [newForm, mutate, toast, tr]);

  const advanceStep = useCallback(async (id: string, stepData: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/icu/brain-death/${id}/advance`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stepData) });
      if (res.ok) { toast({ title: tr('تم التقدم', 'Step advanced') }); mutate(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [mutate, toast, tr]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('بروتوكول الموت الدماغي', 'Brain Death Protocol')}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">{tr('النشطة', 'Active')}</TabsTrigger>
          <TabsTrigger value="all">{tr('الكل', 'All')}</TabsTrigger>
          <TabsTrigger value="new">{tr('بدء جديد', 'New Protocol')}</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <div className="space-y-4">
            {protocols.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد بروتوكولات نشطة', 'No active protocols')}</CardContent></Card>}
            {protocols.map((p: any) => (
              <Card key={p.id} className="border-l-4 border-yellow-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.patientName || tr('مريض', 'Patient')}</CardTitle>
                    <Badge variant="outline">{stepLabel(p.currentStep, tr)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1 mb-4">
                    {STEPS.map((s, idx) => {
                      const stepIdx = (STEPS as readonly string[]).indexOf(p.currentStep);
                      return <div key={s} className={`flex-1 h-2 rounded ${idx <= stepIdx ? 'bg-yellow-500' : 'bg-muted'}`} />;
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-semibold">{tr('الطبيب الأول', 'Examiner 1')}:</span> {p.examiner1Id || '—'}</div>
                    <div><span className="font-semibold">{tr('الطبيب الثاني', 'Examiner 2')}:</span> {p.examiner2Id || '—'}</div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => advanceStep(p.id, {})}>{tr('التقدم للخطوة التالية', 'Advance to Next Step')}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="all">
          <div className="space-y-3">
            {allProtocols.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{p.patientName}</span>
                    <span className="text-sm text-muted-foreground ml-2">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  <Badge className={p.status === 'DECLARED' ? 'bg-black text-white' : p.status === 'ABORTED' ? 'bg-red-500 text-white' : 'bg-yellow-200 text-yellow-800'}>{p.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="new">
          <Card>
            <CardHeader><CardTitle>{tr('بدء بروتوكول جديد', 'Initiate New Protocol')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder={tr('معرف الحالة', 'Episode ID')} value={newForm.episodeId} onChange={e => setNewForm(p => ({ ...p, episodeId: e.target.value }))} />
              <Input placeholder={tr('اسم المريض', 'Patient name')} value={newForm.patientName} onChange={e => setNewForm(p => ({ ...p, patientName: e.target.value }))} />
              <Button onClick={initProtocol}>{tr('بدء البروتوكول', 'Initiate Protocol')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
