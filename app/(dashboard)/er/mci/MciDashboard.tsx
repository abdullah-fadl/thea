'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

const MCI_LEVELS = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'] as const;
const TRIAGE_TAGS = ['RED', 'YELLOW', 'GREEN', 'BLACK'] as const;

function tagColor(tag: string) {
  switch (tag) {
    case 'RED': return 'bg-red-600 text-white';
    case 'YELLOW': return 'bg-yellow-400 text-foreground';
    case 'GREEN': return 'bg-green-600 text-white';
    case 'BLACK': return 'bg-black text-white';
    default: return 'bg-muted text-foreground';
  }
}

function levelLabel(level: string, tr: (a: string, e: string) => string) {
  switch (level) {
    case 'LEVEL_1': return tr('المستوى 1 (10-20 مصاب)', 'Level 1 (10-20 casualties)');
    case 'LEVEL_2': return tr('المستوى 2 (21-50 مصاب)', 'Level 2 (21-50 casualties)');
    case 'LEVEL_3': return tr('المستوى 3 (50+ مصاب)', 'Level 3 (50+ casualties)');
    default: return level;
  }
}

export default function MciDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('command');

  const { data, mutate } = useSWR('/api/er/mci?status=ACTIVE', fetcher, { refreshInterval: 10000 });
  const incidents = data?.incidents || [];
  const activeIncident = incidents[0];

  const [activateForm, setActivateForm] = useState({ level: 'LEVEL_1', type: '', location: '', estimatedCasualties: '' });

  const activateMci = useCallback(async () => {
    try {
      const res = await fetch('/api/er/mci', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...activateForm, estimatedCasualties: Number(activateForm.estimatedCasualties) || 0 }),
      });
      if (res.ok) {
        toast({ title: tr('تم تفعيل بروتوكول الكوارث', 'MCI protocol activated') });
        mutate();
      }
    } catch { toast({ title: tr('فشل التفعيل', 'Activation failed'), variant: 'destructive' }); }
  }, [activateForm, mutate, toast, tr]);

  const deactivateMci = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/er/mci/${id}/deactivate`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) { toast({ title: tr('تم إلغاء التفعيل', 'MCI deactivated') }); mutate(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [mutate, toast, tr]);

  const registerPatient = useCallback(async (incidentId: string, triageTag: string, info: any) => {
    try {
      const res = await fetch(`/api/er/mci/${incidentId}/patients`, {
        credentials: 'include',
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triageTag, ...info }),
      });
      if (res.ok) { toast({ title: tr('تم تسجيل المصاب', 'Patient registered') }); mutate(); }
    } catch { toast({ title: tr('فشل التسجيل', 'Registration failed'), variant: 'destructive' }); }
  }, [mutate, toast, tr]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tr('مركز قيادة الكوارث', 'MCI Command Center')}</h1>
        {activeIncident && (
          <Badge className="bg-red-600 text-white animate-pulse text-lg px-4 py-2">
            {tr('كارثة نشطة', 'ACTIVE MCI')} — {levelLabel(activeIncident.level, tr)}
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="command">{tr('القيادة', 'Command')}</TabsTrigger>
          <TabsTrigger value="patients">{tr('المصابون', 'Patients')}</TabsTrigger>
          <TabsTrigger value="resources">{tr('الموارد', 'Resources')}</TabsTrigger>
          <TabsTrigger value="activate">{tr('تفعيل', 'Activate')}</TabsTrigger>
        </TabsList>

        <TabsContent value="command">
          {activeIncident ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {TRIAGE_TAGS.map(tag => {
                const count = (activeIncident.patients || []).filter((p: any) => p.triageTag === tag).length;
                return (
                  <Card key={tag}>
                    <CardContent className="pt-6 text-center">
                      <Badge className={`${tagColor(tag)} text-2xl px-6 py-3`}>{tag}</Badge>
                      <p className="text-4xl font-bold mt-4">{count}</p>
                      <p className="text-muted-foreground mt-1">
                        {tag === 'RED' ? tr('فوري', 'Immediate') : tag === 'YELLOW' ? tr('مؤجل', 'Delayed') : tag === 'GREEN' ? tr('بسيط', 'Minor') : tr('متوفى', 'Deceased')}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
              <Card className="col-span-full">
                <CardHeader><CardTitle>{tr('هيكل القيادة', 'Command Structure')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="font-semibold">{tr('القائد', 'Commander')}:</span> {activeIncident.commandStructure?.incidentCommander || '—'}</div>
                    <div><span className="font-semibold">{tr('فرز', 'Triage')}:</span> {activeIncident.commandStructure?.triageOfficer || '—'}</div>
                    <div><span className="font-semibold">{tr('علاج', 'Treatment')}:</span> {activeIncident.commandStructure?.treatmentOfficer || '—'}</div>
                    <div><span className="font-semibold">{tr('نقل', 'Transport')}:</span> {activeIncident.commandStructure?.transportOfficer || '—'}</div>
                  </div>
                </CardContent>
              </Card>
              <div className="col-span-full">
                <Button variant="destructive" onClick={() => deactivateMci(activeIncident.id)}>
                  {tr('إلغاء تفعيل الكارثة', 'Deactivate MCI')}
                </Button>
              </div>
            </div>
          ) : (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد كارثة نشطة', 'No active MCI incident')}</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="patients">
          {activeIncident ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {(activeIncident.patients || []).map((p: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="pt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={tagColor(p.triageTag)}>{p.triageTag}</Badge>
                        <span className="font-medium">{p.tempId || tr('مجهول', 'Unknown')}</span>
                        <span className="text-sm text-muted-foreground">{p.chiefInjury || ''}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{p.area || tr('غير محدد', 'Unassigned')}</Badge>
                        <Badge variant="outline">{p.status || 'REGISTERED'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد كارثة نشطة', 'No active MCI')}</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="resources">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle>{tr('أسرة الطوارئ المتاحة', 'Available ER Beds')}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{activeIncident?.surgeCapacity?.availableBeds ?? '—'}</p></CardContent></Card>
            <Card><CardHeader><CardTitle>{tr('غرف العمليات', 'OR Rooms')}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{activeIncident?.surgeCapacity?.orRooms ?? '—'}</p></CardContent></Card>
            <Card><CardHeader><CardTitle>{tr('الأطباء المتاحون', 'Available Physicians')}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{activeIncident?.surgeCapacity?.physicians ?? '—'}</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="activate">
          <Card>
            <CardHeader><CardTitle>{tr('تفعيل بروتوكول كارثة جديد', 'Activate New MCI Protocol')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select value={activateForm.level} onValueChange={v => setActivateForm(p => ({ ...p, level: v }))}>
                  <SelectTrigger><SelectValue placeholder={tr('المستوى', 'Level')} /></SelectTrigger>
                  <SelectContent>
                    {MCI_LEVELS.map(l => <SelectItem key={l} value={l}>{levelLabel(l, tr)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder={tr('نوع الحادث', 'Incident type')} value={activateForm.type} onChange={e => setActivateForm(p => ({ ...p, type: e.target.value }))} />
                <Input placeholder={tr('الموقع', 'Location')} value={activateForm.location} onChange={e => setActivateForm(p => ({ ...p, location: e.target.value }))} />
                <Input placeholder={tr('عدد المصابين المتوقع', 'Estimated casualties')} type="number" value={activateForm.estimatedCasualties} onChange={e => setActivateForm(p => ({ ...p, estimatedCasualties: e.target.value }))} />
              </div>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={activateMci}>
                {tr('تفعيل البروتوكول', 'Activate MCI Protocol')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
