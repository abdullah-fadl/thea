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

export default function BloodGasAnalysis() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('entry');

  const [form, setForm] = useState({ patientId: '', sampleType: 'ARTERIAL', ph: '', paCo2: '', paO2: '', hco3: '', lactate: '', fio2: '0.21', baseExcess: '', sodium: '', potassium: '', chloride: '', ionizedCalcium: '', hemoglobin: '' });
  const [interpretation, setInterpretation] = useState<any>(null);

  const { data: recentData } = useSWR('/api/lab/blood-gas?limit=20', fetcher, { refreshInterval: 30000 });
  const recent = recentData?.analyses || [];

  const submitAndInterpret = useCallback(async () => {
    try {
      // Save ABG
      const saveRes = await fetch('/api/lab/blood-gas', {
        credentials: 'include',
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: form.patientId || undefined,
          sampleType: form.sampleType,
          ph: Number(form.ph), paCo2: Number(form.paCo2), paO2: Number(form.paO2),
          hco3: Number(form.hco3), lactate: Number(form.lactate) || undefined,
          fio2: Number(form.fio2), baseExcess: Number(form.baseExcess) || undefined,
          sodium: Number(form.sodium) || undefined, potassium: Number(form.potassium) || undefined,
          chloride: Number(form.chloride) || undefined, ionizedCalcium: Number(form.ionizedCalcium) || undefined,
          hemoglobin: Number(form.hemoglobin) || undefined,
        }),
      });
      if (!saveRes.ok) throw new Error('Save failed');

      // Get interpretation
      const interpRes = await fetch('/api/lab/blood-gas/interpret', {
        credentials: 'include',
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ph: Number(form.ph), paCo2: Number(form.paCo2), paO2: Number(form.paO2), hco3: Number(form.hco3), fio2: Number(form.fio2) }),
      });
      const interpData = await interpRes.json();
      setInterpretation(interpData);
      toast({ title: tr('تم الحفظ والتفسير', 'Saved & interpreted') });
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [form, toast, tr]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('تحليل غازات الدم', 'Blood Gas Analysis')}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="entry">{tr('إدخال جديد', 'New Entry')}</TabsTrigger>
          <TabsTrigger value="recent">{tr('الأخيرة', 'Recent')}</TabsTrigger>
        </TabsList>

        <TabsContent value="entry">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>{tr('قيم غازات الدم', 'Blood Gas Values')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder={tr('معرف المريض', 'Patient ID')} value={form.patientId} onChange={e => setForm(p => ({ ...p, patientId: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="pH" type="number" step="0.01" value={form.ph} onChange={e => setForm(p => ({ ...p, ph: e.target.value }))} />
                  <Input placeholder="PaCO₂ (mmHg)" type="number" value={form.paCo2} onChange={e => setForm(p => ({ ...p, paCo2: e.target.value }))} />
                  <Input placeholder="PaO₂ (mmHg)" type="number" value={form.paO2} onChange={e => setForm(p => ({ ...p, paO2: e.target.value }))} />
                  <Input placeholder="HCO₃⁻ (mEq/L)" type="number" step="0.1" value={form.hco3} onChange={e => setForm(p => ({ ...p, hco3: e.target.value }))} />
                  <Input placeholder={tr('لاكتات', 'Lactate')} type="number" step="0.1" value={form.lactate} onChange={e => setForm(p => ({ ...p, lactate: e.target.value }))} />
                  <Input placeholder="FiO₂" type="number" step="0.01" value={form.fio2} onChange={e => setForm(p => ({ ...p, fio2: e.target.value }))} />
                  <Input placeholder={tr('فائض القاعدة', 'Base Excess')} type="number" step="0.1" value={form.baseExcess} onChange={e => setForm(p => ({ ...p, baseExcess: e.target.value }))} />
                  <Input placeholder="Na⁺" type="number" value={form.sodium} onChange={e => setForm(p => ({ ...p, sodium: e.target.value }))} />
                  <Input placeholder="K⁺" type="number" step="0.1" value={form.potassium} onChange={e => setForm(p => ({ ...p, potassium: e.target.value }))} />
                  <Input placeholder="Cl⁻" type="number" value={form.chloride} onChange={e => setForm(p => ({ ...p, chloride: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={submitAndInterpret}>{tr('حفظ وتفسير', 'Save & Interpret')}</Button>
              </CardContent>
            </Card>

            {interpretation && (
              <Card className="border-l-4 border-blue-500">
                <CardHeader><CardTitle>{tr('التفسير', 'Interpretation')}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-lg font-semibold">{interpretation.primaryDisorder || '—'}</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">{tr('تعويض', 'Compensation')}:</span> {interpretation.compensation || '—'}</div>
                    <div><span className="text-muted-foreground">{tr('فجوة الأنيون', 'Anion Gap')}:</span> {interpretation.anionGap ?? '—'}</div>
                    <div><span className="text-muted-foreground">A-a {tr('فرق', 'Gradient')}:</span> {interpretation.aaGradient?.toFixed(1) ?? '—'}</div>
                    <div><span className="text-muted-foreground">P/F {tr('نسبة', 'Ratio')}:</span> {interpretation.pfRatio?.toFixed(0) ?? '—'}</div>
                  </div>
                  {interpretation.criticalAlerts?.length > 0 && (
                    <div className="space-y-1">
                      {interpretation.criticalAlerts.map((a: string, i: number) => (
                        <Badge key={i} variant="destructive" className="mr-2">{a}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="recent">
          <div className="space-y-3">
            {recent.map((a: any) => (
              <Card key={a.id}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div className="font-mono text-sm">
                    pH {a.ph} | CO₂ {a.paCo2} | O₂ {a.paO2} | HCO₃ {a.hco3}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{a.sampleType}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
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
