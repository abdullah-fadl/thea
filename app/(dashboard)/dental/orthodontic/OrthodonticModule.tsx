'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

const APPLIANCE_TYPES = ['METAL_BRACKETS', 'CERAMIC_BRACKETS', 'LINGUAL_BRACKETS', 'CLEAR_ALIGNERS', 'FUNCTIONAL'] as const;

function statusColor(s: string) {
  switch (s) {
    case 'PLANNING': return 'bg-blue-100 text-blue-800';
    case 'ACTIVE': return 'bg-green-100 text-green-800';
    case 'RETENTION': return 'bg-purple-100 text-purple-800';
    case 'COMPLETED': return 'bg-muted text-foreground';
    default: return 'bg-muted text-foreground';
  }
}

export default function OrthodonticModule() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('cases');

  const { data: casesData, mutate: mutateCases } = useSWR('/api/dental/orthodontic/cases?limit=50', fetcher, { refreshInterval: 15000 });
  const cases = casesData?.cases || [];

  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const { data: visitsData } = useSWR(selectedCase ? `/api/dental/orthodontic/cases/${selectedCase}/visits` : null, fetcher);
  const visits = visitsData?.visits || [];

  const [newCase, setNewCase] = useState({ patientId: '', applianceType: 'METAL_BRACKETS', estimatedDuration: '18', diagnosis: '' });

  const createCase = useCallback(async () => {
    try {
      const res = await fetch('/api/dental/orthodontic/cases', {
        credentials: 'include',
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newCase, estimatedDuration: Number(newCase.estimatedDuration) }),
      });
      if (res.ok) { toast({ title: tr('تم إنشاء الحالة', 'Case created') }); mutateCases(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [newCase, mutateCases, toast, tr]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('تقويم الأسنان', 'Orthodontics')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{cases.length}</p><p className="text-sm">{tr('إجمالي الحالات', 'Total Cases')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-green-600">{cases.filter((c: any) => c.status === 'ACTIVE').length}</p><p className="text-sm">{tr('نشطة', 'Active')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-purple-600">{cases.filter((c: any) => c.status === 'RETENTION').length}</p><p className="text-sm">{tr('تثبيت', 'Retention')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-blue-600">{cases.filter((c: any) => c.status === 'PLANNING').length}</p><p className="text-sm">{tr('تخطيط', 'Planning')}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="cases">{tr('الحالات', 'Cases')}</TabsTrigger>
          <TabsTrigger value="visits">{tr('الزيارات', 'Visits')}</TabsTrigger>
          <TabsTrigger value="new">{tr('حالة جديدة', 'New Case')}</TabsTrigger>
        </TabsList>

        <TabsContent value="cases">
          <div className="space-y-3">
            {cases.map((c: any) => (
              <Card key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedCase(c.id); setTab('visits'); }}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{c.patientId?.slice(0, 8)}</span>
                    <Badge variant="outline" className="ml-2">{c.applianceType?.replace(/_/g, ' ')}</Badge>
                    <span className="text-sm text-muted-foreground ml-3">{c.diagnosis?.slice(0, 60) || ''}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={statusColor(c.status)}>{c.status}</Badge>
                    {c.estimatedDuration && <span className="text-xs text-muted-foreground">{c.estimatedDuration} {tr('شهر', 'mo')}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {cases.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد حالات', 'No cases')}</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="visits">
          {selectedCase ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{tr('زيارات الحالة', 'Case Visits')}</h2>
              {visits.map((v: any) => (
                <Card key={v.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-medium">{tr('زيارة', 'Visit')} {v.visitNumber}</span>
                        <span className="text-sm text-muted-foreground ml-3">{new Date(v.visitDate || v.createdAt).toLocaleDateString()}</span>
                      </div>
                      <Badge variant="outline">{v.procedureType || '—'}</Badge>
                    </div>
                    {v.wireDetails && <p className="text-sm text-muted-foreground mt-1">{tr('سلك', 'Wire')}: {JSON.stringify(v.wireDetails)}</p>}
                    {v.notes && <p className="text-sm mt-1">{v.notes}</p>}
                  </CardContent>
                </Card>
              ))}
              {visits.length === 0 && <p className="text-muted-foreground">{tr('لا توجد زيارات', 'No visits recorded')}</p>}
            </div>
          ) : (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('اختر حالة أولاً', 'Select a case first')}</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="new">
          <Card>
            <CardHeader><CardTitle>{tr('حالة تقويم جديدة', 'New Orthodontic Case')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder={tr('معرف المريض', 'Patient ID')} value={newCase.patientId} onChange={e => setNewCase(p => ({ ...p, patientId: e.target.value }))} />
              <Select value={newCase.applianceType} onValueChange={v => setNewCase(p => ({ ...p, applianceType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPLIANCE_TYPES.map(a => <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder={tr('المدة المتوقعة (أشهر)', 'Estimated duration (months)')} type="number" value={newCase.estimatedDuration} onChange={e => setNewCase(p => ({ ...p, estimatedDuration: e.target.value }))} />
              <Input placeholder={tr('التشخيص', 'Diagnosis')} value={newCase.diagnosis} onChange={e => setNewCase(p => ({ ...p, diagnosis: e.target.value }))} />
              <Button onClick={createCase}>{tr('إنشاء الحالة', 'Create Case')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
