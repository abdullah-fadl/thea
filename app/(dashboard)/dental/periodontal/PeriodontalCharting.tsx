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

const TOOTH_NUMBERS = Array.from({ length: 32 }, (_, i) => i + 1);
const UPPER = TOOTH_NUMBERS.slice(0, 16);
const LOWER = TOOTH_NUMBERS.slice(16).reverse();

function depthColor(d: number) {
  if (d <= 3) return 'bg-green-200 text-green-900';
  if (d <= 5) return 'bg-yellow-200 text-yellow-900';
  return 'bg-red-200 text-red-900';
}

export default function PeriodontalCharting() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [patientId, setPatientId] = useState('');
  const [tab, setTab] = useState('chart');

  const { data, mutate } = useSWR(patientId ? `/api/dental/periodontal?patientId=${patientId}` : null, fetcher);
  const charts = data?.charts || [];
  const latest = charts[0];

  const [editingTooth, setEditingTooth] = useState<number | null>(null);
  const [depths, setDepths] = useState<number[]>([0, 0, 0, 0, 0, 0]);

  const saveChart = useCallback(async (toothData: any) => {
    try {
      const res = await fetch('/api/dental/periodontal', {
        credentials: 'include',
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, chartType: 'FULL_MOUTH', teethData: toothData }),
      });
      if (res.ok) { toast({ title: tr('تم الحفظ', 'Saved') }); mutate(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [patientId, mutate, toast, tr]);

  const toothData = latest?.teethData || {};

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('خريطة اللثة', 'Periodontal Charting')}</h1>

      <Input placeholder={tr('معرف المريض', 'Patient ID')} value={patientId} onChange={e => setPatientId(e.target.value)} className="max-w-md" />

      {patientId && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="chart">{tr('الخريطة', 'Chart')}</TabsTrigger>
            <TabsTrigger value="history">{tr('السجل', 'History')}</TabsTrigger>
          </TabsList>

          <TabsContent value="chart">
            <Card>
              <CardHeader><CardTitle>{tr('الفك العلوي', 'Upper Arch')}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-1 justify-center flex-wrap">
                  {UPPER.map(t => {
                    const td = toothData[String(t)];
                    const maxD = td ? Math.max(...(td.probingDepths || [0])) : 0;
                    return (
                      <button key={t} onClick={() => { setEditingTooth(t); setDepths(td?.probingDepths || [0,0,0,0,0,0]); }}
                        className={`w-12 h-16 border rounded flex flex-col items-center justify-center text-xs transition-all ${editingTooth === t ? 'ring-2 ring-blue-500' : ''} ${maxD > 5 ? 'border-red-400 bg-red-50' : maxD > 3 ? 'border-yellow-400 bg-yellow-50' : 'border-border'}`}>
                        <span className="font-bold">{t}</span>
                        {td && <span className={`text-[10px] px-1 rounded ${depthColor(maxD)}`}>{maxD}mm</span>}
                        {td?.bleeding && <span className="text-red-500 text-[10px]">BOP</span>}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader><CardTitle>{tr('الفك السفلي', 'Lower Arch')}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-1 justify-center flex-wrap">
                  {LOWER.map(t => {
                    const td = toothData[String(t)];
                    const maxD = td ? Math.max(...(td.probingDepths || [0])) : 0;
                    return (
                      <button key={t} onClick={() => { setEditingTooth(t); setDepths(td?.probingDepths || [0,0,0,0,0,0]); }}
                        className={`w-12 h-16 border rounded flex flex-col items-center justify-center text-xs transition-all ${editingTooth === t ? 'ring-2 ring-blue-500' : ''} ${maxD > 5 ? 'border-red-400 bg-red-50' : maxD > 3 ? 'border-yellow-400 bg-yellow-50' : 'border-border'}`}>
                        <span className="font-bold">{t}</span>
                        {td && <span className={`text-[10px] px-1 rounded ${depthColor(maxD)}`}>{maxD}mm</span>}
                        {td?.bleeding && <span className="text-red-500 text-[10px]">BOP</span>}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {editingTooth !== null && (
              <Card className="mt-4 border-blue-300">
                <CardHeader><CardTitle>{tr('سن رقم', 'Tooth #')}{editingTooth} — {tr('عمق السبر (6 نقاط)', 'Probing Depths (6 points)')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-6 gap-2">
                    {depths.map((d, i) => (
                      <Input key={i} type="number" min={0} max={15} value={d} onChange={e => { const nd = [...depths]; nd[i] = Number(e.target.value); setDepths(nd); }} className="text-center" />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => {
                      const updated = { ...toothData, [String(editingTooth)]: { probingDepths: depths, bleeding: depths.some(d => d > 4), mobility: 0 } };
                      saveChart(updated);
                      setEditingTooth(null);
                    }}>{tr('حفظ', 'Save')}</Button>
                    <Button variant="outline" onClick={() => setEditingTooth(null)}>{tr('إلغاء', 'Cancel')}</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-3">
              {charts.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="pt-4 flex justify-between">
                    <span>{new Date(c.examDate || c.createdAt).toLocaleDateString()}</span>
                    <Badge variant="outline">{c.chartType}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
