'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

const ESI_LEVELS = [
  { level: 1, ar: 'إنعاش', en: 'Resuscitation', color: 'bg-red-700 text-white' },
  { level: 2, ar: 'طوارئ', en: 'Emergent', color: 'bg-red-500 text-white' },
  { level: 3, ar: 'عاجل', en: 'Urgent', color: 'bg-yellow-500 text-foreground' },
  { level: 4, ar: 'أقل عاجل', en: 'Less Urgent', color: 'bg-green-500 text-white' },
  { level: 5, ar: 'غير عاجل', en: 'Non-Urgent', color: 'bg-blue-400 text-white' },
];

export default function TriageScoring() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [encounterId, setEncounterId] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<'CTAS' | 'ESI'>('ESI');
  const [formData, setFormData] = useState({
    chiefComplaint: '', acuityLevel: 3, heartRate: '', systolicBP: '', respiratoryRate: '', o2Sat: '', temperature: '', painScore: '', gcsTotal: '', resourcesNeeded: 2,
  });

  const { data: scoresData } = useSWR('/api/er/triage-score?limit=20', fetcher, { refreshInterval: 15000 });
  const recentScores = scoresData?.scores || [];

  const submitScore = useCallback(async () => {
    try {
      const payload = {
        encounterId: encounterId || undefined,
        system: selectedSystem,
        acuityLevel: formData.acuityLevel,
        chiefComplaint: formData.chiefComplaint,
        vitals: {
          heartRate: Number(formData.heartRate) || undefined,
          systolicBP: Number(formData.systolicBP) || undefined,
          respiratoryRate: Number(formData.respiratoryRate) || undefined,
          o2Sat: Number(formData.o2Sat) || undefined,
          temperature: Number(formData.temperature) || undefined,
        },
        painScore: Number(formData.painScore) || undefined,
        gcsTotal: Number(formData.gcsTotal) || undefined,
        resourcesNeeded: formData.resourcesNeeded,
      };
      const res = await fetch('/api/er/triage-score', { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { toast({ title: tr('تم حفظ الدرجة', 'Score saved') }); }
    } catch { toast({ title: tr('فشل الحفظ', 'Save failed'), variant: 'destructive' }); }
  }, [encounterId, selectedSystem, formData, toast, tr]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('تقييم الفرز — CTAS/ESI', 'Triage Scoring — CTAS/ESI')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{tr('تقييم جديد', 'New Assessment')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedSystem} onValueChange={v => setSelectedSystem(v as 'CTAS' | 'ESI')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ESI">ESI (Emergency Severity Index)</SelectItem>
                <SelectItem value="CTAS">CTAS (Canadian Triage & Acuity Scale)</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder={tr('معرف الزيارة (اختياري)', 'Encounter ID (optional)')} value={encounterId} onChange={e => setEncounterId(e.target.value)} />
            <Input placeholder={tr('الشكوى الرئيسية', 'Chief complaint')} value={formData.chiefComplaint} onChange={e => setFormData(p => ({ ...p, chiefComplaint: e.target.value }))} />
            <div className="grid grid-cols-5 gap-2">
              {ESI_LEVELS.map(l => (
                <button key={l.level} onClick={() => setFormData(p => ({ ...p, acuityLevel: l.level }))} className={`rounded-lg p-3 text-center font-bold transition-all ${formData.acuityLevel === l.level ? l.color + ' ring-2 ring-offset-2 ring-black scale-105' : 'bg-muted text-muted-foreground'}`}>
                  <div className="text-2xl">{l.level}</div>
                  <div className="text-xs mt-1">{tr(l.ar, l.en)}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder={tr('نبض', 'HR')} type="number" value={formData.heartRate} onChange={e => setFormData(p => ({ ...p, heartRate: e.target.value }))} />
              <Input placeholder={tr('ضغط انقباضي', 'SBP')} type="number" value={formData.systolicBP} onChange={e => setFormData(p => ({ ...p, systolicBP: e.target.value }))} />
              <Input placeholder={tr('تنفس', 'RR')} type="number" value={formData.respiratoryRate} onChange={e => setFormData(p => ({ ...p, respiratoryRate: e.target.value }))} />
              <Input placeholder={tr('تشبع أكسجين', 'SpO2')} type="number" value={formData.o2Sat} onChange={e => setFormData(p => ({ ...p, o2Sat: e.target.value }))} />
              <Input placeholder={tr('حرارة', 'Temp')} type="number" value={formData.temperature} onChange={e => setFormData(p => ({ ...p, temperature: e.target.value }))} />
              <Input placeholder={tr('الألم 0-10', 'Pain 0-10')} type="number" value={formData.painScore} onChange={e => setFormData(p => ({ ...p, painScore: e.target.value }))} />
            </div>
            <Input placeholder={tr('غلاسكو GCS', 'GCS Total')} type="number" value={formData.gcsTotal} onChange={e => setFormData(p => ({ ...p, gcsTotal: e.target.value }))} />
            <Button onClick={submitScore} className="w-full">{tr('حفظ التقييم', 'Save Assessment')}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{tr('آخر التقييمات', 'Recent Scores')}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentScores.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <span className="font-medium">{s.chiefComplaint || '—'}</span>
                    <span className="text-xs text-muted-foreground ml-2">{s.system}</span>
                  </div>
                  <Badge className={ESI_LEVELS[s.acuityLevel - 1]?.color || 'bg-muted'}>{tr('مستوى', 'Level')} {s.acuityLevel}</Badge>
                </div>
              ))}
              {recentScores.length === 0 && <p className="text-muted-foreground text-center">{tr('لا توجد تقييمات', 'No scores yet')}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
