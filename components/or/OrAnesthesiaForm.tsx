'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface OrAnesthesiaFormProps {
  caseId: string;
}

interface Agent {
  drug: string;
  dose: string;
  route: string;
  time: string;
}

interface VitalsEntry {
  time: string;
  hr: string;
  bp: string;
  spo2: string;
  etco2: string;
  temp: string;
}

export default function OrAnesthesiaForm({ caseId }: OrAnesthesiaFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const { data, mutate, isLoading } = useSWR(
    caseId ? `/api/or/cases/${caseId}/anesthesia` : null,
    fetcher,
  );

  const existing = data?.anesthesia ?? null;

  // Core form state
  const [anesthesiaType, setAnesthesiaType] = useState('');
  const [airwayManagement, setAirwayManagement] = useState('');
  const [inductionTime, setInductionTime] = useState('');
  const [emergenceTime, setEmergenceTime] = useState('');
  const [complications, setComplications] = useState('');
  const [notes, setNotes] = useState('');

  // Fluid balance
  const [crystalloid, setCrystalloid] = useState('');
  const [colloid, setColloid] = useState('');
  const [blood, setBlood] = useState('');
  const [urine, setUrine] = useState('');
  const [ebl, setEbl] = useState('');

  // New agent form
  const [agentDrug, setAgentDrug] = useState('');
  const [agentDose, setAgentDose] = useState('');
  const [agentRoute, setAgentRoute] = useState('IV');
  const [agentTime, setAgentTime] = useState('');

  // New vitals form
  const [vitHr, setVitHr] = useState('');
  const [vitBp, setVitBp] = useState('');
  const [vitSpo2, setVitSpo2] = useState('');
  const [vitEtco2, setVitEtco2] = useState('');
  const [vitTemp, setVitTemp] = useState('');

  const [saving, setSaving] = useState(false);
  const [addingAgent, setAddingAgent] = useState(false);
  const [addingVitals, setAddingVitals] = useState(false);

  const agents: Agent[] = Array.isArray(existing?.agents) ? existing.agents : [];
  const vitalsLog: VitalsEntry[] = Array.isArray(existing?.vitalsLog) ? existing.vitalsLog : [];

  const handleCreate = async () => {
    if (!anesthesiaType) {
      toast({ title: tr('خطأ', 'Error'), description: tr('نوع التخدير مطلوب', 'Anesthesia type is required'), variant: 'destructive' as const });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/anesthesia`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anesthesiaType,
          airwayManagement: airwayManagement || null,
          inductionTime: inductionTime || null,
          emergenceTime: emergenceTime || null,
          complications: complications.trim() || null,
          notes: notes.trim() || null,
          fluidBalance: {
            crystalloid: Number(crystalloid) || 0,
            colloid: Number(colloid) || 0,
            blood: Number(blood) || 0,
            urine: Number(urine) || 0,
            ebl: Number(ebl) || 0,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Save failed'));

      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم إنشاء سجل التخدير', 'Anesthesia record created') });
      await mutate();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: err instanceof Error ? err.message : String(err), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const handleAppendAgent = async () => {
    if (!agentDrug.trim()) return;

    setSaving(true);
    try {
      const method = existing ? 'PUT' : 'POST';
      const res = await fetch(`/api/or/cases/${caseId}/anesthesia`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(existing ? {} : { anesthesiaType: 'GENERAL' }),
          appendAgent: {
            drug: agentDrug.trim(),
            dose: agentDose.trim(),
            route: agentRoute,
            time: agentTime || new Date().toISOString(),
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الإضافة', 'Failed to add'));

      toast({ title: tr('تمت الإضافة', 'Added'), description: tr('تم إضافة الدواء', 'Agent added') });
      setAgentDrug('');
      setAgentDose('');
      setAgentTime('');
      setAddingAgent(false);
      await mutate();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: err instanceof Error ? err.message : String(err), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const handleAppendVitals = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/anesthesia`, {
        method: existing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(existing ? {} : { anesthesiaType: 'GENERAL' }),
          appendVitals: {
            time: new Date().toISOString(),
            hr: vitHr,
            bp: vitBp,
            spo2: vitSpo2,
            etco2: vitEtco2,
            temp: vitTemp,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Failed to save'));

      toast({ title: tr('تمت الإضافة', 'Added'), description: tr('تم تسجيل العلامات الحيوية', 'Vitals logged') });
      setVitHr(''); setVitBp(''); setVitSpo2(''); setVitEtco2(''); setVitTemp('');
      setAddingVitals(false);
      await mutate();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: err instanceof Error ? err.message : String(err), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmergence = async () => {
    if (!emergenceTime || !existing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/anesthesia`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emergenceTime }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Failed to save'));
      toast({ title: tr('تم الحفظ', 'Saved') });
      await mutate();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: err instanceof Error ? err.message : String(err), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {tr('جارٍ التحميل...', 'Loading...')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Main record card */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">{tr('سجل التخدير', 'Anesthesia Record')}</CardTitle>
          <CardDescription>{tr('بيانات التخدير وإدارة مجرى الهواء', 'Anesthesia type, airway, and induction details')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {existing ? (
            /* Existing record summary */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{tr('نوع التخدير', 'Anesthesia Type')}</p>
                <Badge variant="outline">{existing.anesthesiaType}</Badge>
              </div>
              {existing.airwayManagement && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{tr('إدارة مجرى الهواء', 'Airway Management')}</p>
                  <Badge variant="secondary">{existing.airwayManagement}</Badge>
                </div>
              )}
              {existing.inductionTime && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{tr('وقت الحث', 'Induction Time')}</p>
                  <p className="text-foreground">{new Date(existing.inductionTime).toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">{tr('وقت الإفاقة', 'Emergence Time')}</p>
                {existing.emergenceTime ? (
                  <p className="text-foreground">{new Date(existing.emergenceTime).toLocaleString()}</p>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Input
                      type="datetime-local"
                      value={emergenceTime}
                      onChange={(e) => setEmergenceTime(e.target.value)}
                      className="thea-input-focus h-8 text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={handleUpdateEmergence} disabled={saving || !emergenceTime}>
                      {tr('حفظ', 'Save')}
                    </Button>
                  </div>
                )}
              </div>
              {existing.complications && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">{tr('المضاعفات', 'Complications')}</p>
                  <p className="text-foreground text-sm bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-200">{existing.complications}</p>
                </div>
              )}
            </div>
          ) : (
            /* New record form */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('نوع التخدير *', 'Anesthesia Type *')}</Label>
                  <Select value={anesthesiaType} onValueChange={setAnesthesiaType}>
                    <SelectTrigger className="thea-input-focus">
                      <SelectValue placeholder={tr('اختر نوع التخدير', 'Select type')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">{tr('تخدير عام', 'General')}</SelectItem>
                      <SelectItem value="REGIONAL">{tr('تخدير موضعي إقليمي', 'Regional')}</SelectItem>
                      <SelectItem value="LOCAL">{tr('تخدير موضعي', 'Local')}</SelectItem>
                      <SelectItem value="MAC">{tr('مراقبة التخدير', 'MAC')}</SelectItem>
                      <SelectItem value="SEDATION">{tr('تخدير خفيف', 'Sedation')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-foreground">{tr('إدارة مجرى الهواء', 'Airway Management')}</Label>
                  <Select value={airwayManagement} onValueChange={setAirwayManagement}>
                    <SelectTrigger className="thea-input-focus">
                      <SelectValue placeholder={tr('اختر', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ETT">{tr('أنبوب رغامي (ETT)', 'Endotracheal Tube (ETT)')}</SelectItem>
                      <SelectItem value="LMA">{tr('قناع حنجري (LMA)', 'Laryngeal Mask (LMA)')}</SelectItem>
                      <SelectItem value="MASK">{tr('قناع وجه', 'Face Mask')}</SelectItem>
                      <SelectItem value="AWAKE_INTUBATION">{tr('تنبيب واعٍ', 'Awake Intubation')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-foreground">{tr('وقت الحث', 'Induction Time')}</Label>
                  <Input
                    type="datetime-local"
                    value={inductionTime}
                    onChange={(e) => setInductionTime(e.target.value)}
                    className="thea-input-focus"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-foreground">{tr('وقت الإفاقة (اختياري)', 'Emergence Time (optional)')}</Label>
                  <Input
                    type="datetime-local"
                    value={emergenceTime}
                    onChange={(e) => setEmergenceTime(e.target.value)}
                    className="thea-input-focus"
                  />
                </div>
              </div>

              {/* Fluid balance */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">{tr('توازن السوائل (مل)', 'Fluid Balance (mL)')}</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { label: tr('محلول كريستالي', 'Crystalloid'), value: crystalloid, set: setCrystalloid },
                    { label: tr('محلول غروي', 'Colloid'), value: colloid, set: setColloid },
                    { label: tr('دم', 'Blood'), value: blood, set: setBlood },
                    { label: tr('بول', 'Urine'), value: urine, set: setUrine },
                    { label: tr('الفقد الدموي', 'EBL'), value: ebl, set: setEbl },
                  ].map(({ label, value, set }) => (
                    <div key={label} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder="0"
                        className="thea-input-focus"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('المضاعفات', 'Complications')}</Label>
                <Textarea
                  value={complications}
                  onChange={(e) => setComplications(e.target.value)}
                  placeholder={tr('اذكر أي مضاعفات...', 'Describe any complications...')}
                  rows={2}
                  className="thea-input-focus"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('ملاحظات', 'Notes')}</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
                  rows={2}
                  className="thea-input-focus"
                />
              </div>

              <Button onClick={handleCreate} disabled={saving || !anesthesiaType}>
                {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('إنشاء سجل التخدير', 'Create Anesthesia Record')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agents / Medications table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-base">{tr('الأدوية المستخدمة', 'Anesthetic Agents')}</CardTitle>
              <CardDescription>{tr('الأدوية والجرعات', 'Drugs, doses and routes used')}</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddingAgent((v) => !v)}>
              {addingAgent ? tr('إلغاء', 'Cancel') : `+ ${tr('إضافة دواء', 'Add Agent')}`}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {addingAgent && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border rounded-lg bg-muted/30">
              <div className="space-y-1">
                <Label className="text-xs text-foreground">{tr('الدواء *', 'Drug *')}</Label>
                <Input value={agentDrug} onChange={(e) => setAgentDrug(e.target.value)} placeholder={tr('مثل: بروبوفول', 'e.g. Propofol')} className="thea-input-focus h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-foreground">{tr('الجرعة', 'Dose')}</Label>
                <Input value={agentDose} onChange={(e) => setAgentDose(e.target.value)} placeholder="e.g. 200 mg" className="thea-input-focus h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-foreground">{tr('المسار', 'Route')}</Label>
                <Select value={agentRoute} onValueChange={setAgentRoute}>
                  <SelectTrigger className="thea-input-focus h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IV">IV</SelectItem>
                    <SelectItem value="IM">IM</SelectItem>
                    <SelectItem value="INH">{tr('استنشاق', 'Inhalation')}</SelectItem>
                    <SelectItem value="SC">SC</SelectItem>
                    <SelectItem value="PO">PO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-foreground">{tr('الوقت', 'Time')}</Label>
                <Input type="datetime-local" value={agentTime} onChange={(e) => setAgentTime(e.target.value)} className="thea-input-focus h-8" />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <Button size="sm" onClick={handleAppendAgent} disabled={saving || !agentDrug.trim()}>
                  {tr('إضافة', 'Add')}
                </Button>
              </div>
            </div>
          )}

          {agents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('الدواء', 'Drug')}</TableHead>
                  <TableHead>{tr('الجرعة', 'Dose')}</TableHead>
                  <TableHead>{tr('المسار', 'Route')}</TableHead>
                  <TableHead>{tr('الوقت', 'Time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{a.drug}</TableCell>
                    <TableCell>{a.dose || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{a.route}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.time ? new Date(a.time).toLocaleTimeString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr('لا توجد أدوية مسجلة', 'No agents recorded yet')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Vitals log */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-base">{tr('مراقبة العلامات الحيوية', 'Intra-op Vitals Log')}</CardTitle>
              <CardDescription>{tr('قياسات دورية أثناء العملية', 'Periodic measurements during surgery')}</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddingVitals((v) => !v)}>
              {addingVitals ? tr('إلغاء', 'Cancel') : `+ ${tr('تسجيل قياس', 'Log Vitals')}`}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {addingVitals && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 border rounded-lg bg-muted/30">
              {[
                { label: 'HR (bpm)', value: vitHr, set: setVitHr, placeholder: '80' },
                { label: 'BP (mmHg)', value: vitBp, set: setVitBp, placeholder: '120/80' },
                { label: 'SpO2 (%)', value: vitSpo2, set: setVitSpo2, placeholder: '99' },
                { label: 'EtCO2 (mmHg)', value: vitEtco2, set: setVitEtco2, placeholder: '38' },
                { label: tr('الحرارة (°C)', 'Temp (°C)'), value: vitTemp, set: setVitTemp, placeholder: '36.8' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs text-foreground">{label}</Label>
                  <Input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} className="thea-input-focus h-8" />
                </div>
              ))}
              <div className="md:col-span-5 flex justify-end">
                <Button size="sm" onClick={handleAppendVitals} disabled={saving}>
                  {tr('تسجيل', 'Log')}
                </Button>
              </div>
            </div>
          )}

          {vitalsLog.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('الوقت', 'Time')}</TableHead>
                  <TableHead>HR</TableHead>
                  <TableHead>BP</TableHead>
                  <TableHead>SpO2</TableHead>
                  <TableHead>EtCO2</TableHead>
                  <TableHead>{tr('الحرارة', 'Temp')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vitalsLog.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">
                      {v.time ? new Date(v.time).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell>{v.hr || '—'}</TableCell>
                    <TableCell>{v.bp || '—'}</TableCell>
                    <TableCell>{v.spo2 ? `${v.spo2}%` : '—'}</TableCell>
                    <TableCell>{v.etco2 || '—'}</TableCell>
                    <TableCell>{v.temp || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr('لا توجد قياسات مسجلة', 'No vitals logged yet')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
