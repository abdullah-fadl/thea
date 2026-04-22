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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface OrPacuFormProps {
  caseId: string;
}

// Aldrete Score parameters — each scored 0, 1, or 2
interface AldreteEntry {
  time: string;
  activity: number;       // 0-2: Motor ability
  respiration: number;    // 0-2: Respiratory effort
  circulation: number;    // 0-2: Hemodynamic stability
  consciousness: number;  // 0-2: Level of awareness
  color: number;          // 0-2: SpO2 / color
  total: number;          // sum 0-10
}

interface PacuVitals {
  time: string;
  hr: string;
  bp: string;
  rr: string;
  spo2: string;
  pain: string;
  temp: string;
}

const ALDRETE_CRITERIA = [
  {
    key: 'activity' as const,
    ar: 'النشاط الحركي',
    en: 'Activity',
    options: [
      { v: 2, ar: 'يحرك 4 أطراف', en: 'Moves 4 extremities' },
      { v: 1, ar: 'يحرك 2 أطراف', en: 'Moves 2 extremities' },
      { v: 0, ar: 'لا يتحرك', en: 'Unable to move' },
    ],
  },
  {
    key: 'respiration' as const,
    ar: 'التنفس',
    en: 'Respiration',
    options: [
      { v: 2, ar: 'تنفس عميق وسعال', en: 'Breathes deeply & coughs' },
      { v: 1, ar: 'تنفس محدود أو صعوبة', en: 'Dyspnea or limited' },
      { v: 0, ar: 'توقف تنفس', en: 'Apneic' },
    ],
  },
  {
    key: 'circulation' as const,
    ar: 'الدورة الدموية',
    en: 'Circulation',
    options: [
      { v: 2, ar: 'ضغط ±20 من الأساس', en: 'BP ±20% of baseline' },
      { v: 1, ar: 'ضغط ±20-49 من الأساس', en: 'BP ±20-49% of baseline' },
      { v: 0, ar: 'ضغط أكثر من ±50 من الأساس', en: 'BP ±50%+ of baseline' },
    ],
  },
  {
    key: 'consciousness' as const,
    ar: 'مستوى الوعي',
    en: 'Consciousness',
    options: [
      { v: 2, ar: 'صاحٍ تماماً', en: 'Fully awake' },
      { v: 1, ar: 'يستيقظ عند النداء', en: 'Arousable on calling' },
      { v: 0, ar: 'لا يستجيب', en: 'Not responding' },
    ],
  },
  {
    key: 'color' as const,
    ar: 'اللون / الأكسجين',
    en: 'Color / SpO2',
    options: [
      { v: 2, ar: 'وردي طبيعي / SpO2>92%', en: 'Normal / SpO2>92%' },
      { v: 1, ar: 'شاحب أو جلدي / SpO2 90-92%', en: 'Pale/dusky, SpO2 90-92%' },
      { v: 0, ar: 'مزرق / SpO2<90%', en: 'Cyanotic / SpO2<90%' },
    ],
  },
];

export default function OrPacuForm({ caseId }: OrPacuFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const { data, mutate, isLoading } = useSWR(
    caseId ? `/api/or/cases/${caseId}/pacu` : null,
    fetcher,
  );

  const existing = data?.pacu ?? null;

  // Create form state
  const [arrivalTime, setArrivalTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [nausea, setNausea] = useState(false);
  const [shivering, setShivering] = useState(false);
  const [bleeding, setBleeding] = useState('');
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');

  // Aldrete score form
  const [aldreteScores, setAldreteScores] = useState<Record<string, number>>({
    activity: -1,
    respiration: -1,
    circulation: -1,
    consciousness: -1,
    color: -1,
  });
  const aldreteTotal = Object.values(aldreteScores).filter((v) => v >= 0).reduce((sum, v) => sum + v, 0);
  const aldreteComplete = Object.values(aldreteScores).every((v) => v >= 0);
  const canDischarge = aldreteTotal >= 9;

  // Vitals form
  const [vitHr, setVitHr] = useState('');
  const [vitBp, setVitBp] = useState('');
  const [vitRr, setVitRr] = useState('');
  const [vitSpo2, setVitSpo2] = useState('');
  const [vitPain, setVitPain] = useState('');
  const [vitTemp, setVitTemp] = useState('');
  const [dischargeTime, setDischargeTime] = useState('');

  const [saving, setSaving] = useState(false);
  const [addingVitals, setAddingVitals] = useState(false);
  const [addingAldrete, setAddingAldrete] = useState(false);

  const vitalsLog: PacuVitals[] = Array.isArray(existing?.vitalsLog) ? existing.vitalsLog : [];
  const savedAldretes: AldreteEntry[] = Array.isArray(existing?.aldreteScores) ? existing.aldreteScores : [];
  const latestAldrete = savedAldretes.length ? savedAldretes[savedAldretes.length - 1] : null;

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/pacu`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arrivalTime,
          nausea,
          shivering,
          bleeding: bleeding.trim() || null,
          disposition: disposition || null,
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Save failed'));

      toast({ title: tr('تم التسجيل', 'PACU Record Created'), description: tr('تم استلام المريض في وحدة الإفاقة', 'Patient admitted to recovery') });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAppendVitals = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/pacu`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appendVitals: {
            time: new Date().toISOString(),
            hr: vitHr, bp: vitBp, rr: vitRr,
            spo2: vitSpo2, pain: vitPain, temp: vitTemp,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Failed'));

      toast({ title: tr('تمت الإضافة', 'Vitals Logged') });
      setVitHr(''); setVitBp(''); setVitRr(''); setVitSpo2(''); setVitPain(''); setVitTemp('');
      setAddingVitals(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAppendAldrete = async () => {
    if (!aldreteComplete) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/pacu`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appendAldrete: {
            time: new Date().toISOString(),
            ...aldreteScores,
            total: aldreteTotal,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Failed'));

      toast({
        title: tr('تم تسجيل نتيجة ألدريت', 'Aldrete Score Recorded'),
        description: `${tr('الإجمالي', 'Total')}: ${aldreteTotal}/10${canDischarge ? ` — ${tr('مؤهل للخروج', 'Eligible for discharge')}` : ''}`,
      });
      setAldreteScores({ activity: -1, respiration: -1, circulation: -1, consciousness: -1, color: -1 });
      setAddingAldrete(false);
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDischarge = async () => {
    if (!dischargeTime || !existing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/pacu`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dischargeTime,
          disposition: disposition || existing.disposition,
          nausea,
          shivering,
          bleeding: bleeding || existing.bleeding,
          notes: notes || existing.notes,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Failed'));

      toast({ title: tr('تم الخروج', 'Discharged from PACU'), description: tr('تم توثيق خروج المريض من الإفاقة', 'Patient discharged from recovery') });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' });
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
      {/* Admission / Summary card */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">
            {tr('وحدة الإفاقة (PACU)', 'Post-Anesthesia Care Unit (PACU)')}
          </CardTitle>
          <CardDescription>{tr('سجل استقبال وخروج المريض من الإفاقة', 'Recovery room admission and discharge record')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {existing ? (
            /* Existing record view */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{tr('وقت الوصول', 'Arrival Time')}</p>
                  <p className="text-foreground">{new Date(existing.arrivalTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{tr('وقت الخروج', 'Discharge Time')}</p>
                  <p className="text-foreground">{existing.dischargeTime ? new Date(existing.dischargeTime).toLocaleString() : <span className="text-amber-600">{tr('لم يُخرَّج بعد', 'Not discharged yet')}</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{tr('الوجهة', 'Disposition')}</p>
                  <Badge variant="outline">{existing.disposition || '—'}</Badge>
                </div>
                <div className="flex gap-4">
                  <span className={`text-sm ${existing.nausea ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {tr('غثيان', 'Nausea')}: {existing.nausea ? tr('نعم', 'Yes') : tr('لا', 'No')}
                  </span>
                  <span className={`text-sm ${existing.shivering ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {tr('رعشة', 'Shivering')}: {existing.shivering ? tr('نعم', 'Yes') : tr('لا', 'No')}
                  </span>
                </div>
                {existing.bleeding && (
                  <div className="md:col-span-3">
                    <p className="text-xs text-muted-foreground mb-1">{tr('الدم / النزيف', 'Bleeding')}</p>
                    <p className="text-foreground text-sm">{existing.bleeding}</p>
                  </div>
                )}
              </div>

              {/* Latest Aldrete score badge */}
              {latestAldrete && (
                <div className={`p-3 rounded-lg border ${latestAldrete.total >= 9 ? 'bg-green-50 border-green-200 dark:bg-green-950/20' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {tr('آخر نتيجة ألدريت', 'Latest Aldrete Score')}:{' '}
                      <span className="text-2xl font-bold">{latestAldrete.total}</span>
                      <span className="text-muted-foreground">/10</span>
                    </p>
                    {latestAldrete.total >= 9 ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle2 className="h-3 w-3 inline mr-1" /> {tr('مؤهل للخروج', 'Eligible for Discharge')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 border-amber-300">
                        {tr('تحت الملاحظة', 'Under Observation')}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Discharge section */}
              {!existing.dischargeTime && (
                <div className="p-3 border rounded-lg space-y-3">
                  <p className="text-sm font-medium text-foreground">{tr('تسجيل الخروج', 'Discharge from PACU')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-foreground">{tr('وقت الخروج *', 'Discharge Time *')}</Label>
                      <Input
                        type="datetime-local"
                        value={dischargeTime}
                        onChange={(e) => setDischargeTime(e.target.value)}
                        className="thea-input-focus"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-foreground">{tr('الوجهة', 'Disposition')}</Label>
                      <Select value={disposition} onValueChange={setDisposition}>
                        <SelectTrigger className="thea-input-focus">
                          <SelectValue placeholder={tr('اختر', 'Select')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WARD">{tr('الجناح', 'Ward')}</SelectItem>
                          <SelectItem value="ICU">{tr('العناية المركزة', 'ICU')}</SelectItem>
                          <SelectItem value="HOME">{tr('المنزل', 'Home')}</SelectItem>
                          <SelectItem value="EXTENDED_STAY">{tr('إقامة ممتدة', 'Extended Stay')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleDischarge} disabled={saving || !dischargeTime} variant="default">
                    {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تأكيد الخروج من الإفاقة', 'Confirm PACU Discharge')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Admission form */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('وقت الوصول *', 'Arrival Time *')}</Label>
                  <Input
                    type="datetime-local"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="thea-input-focus"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('الوجهة المتوقعة', 'Expected Disposition')}</Label>
                  <Select value={disposition} onValueChange={setDisposition}>
                    <SelectTrigger className="thea-input-focus">
                      <SelectValue placeholder={tr('اختر', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WARD">{tr('الجناح', 'Ward')}</SelectItem>
                      <SelectItem value="ICU">{tr('العناية المركزة', 'ICU')}</SelectItem>
                      <SelectItem value="HOME">{tr('المنزل', 'Home')}</SelectItem>
                      <SelectItem value="EXTENDED_STAY">{tr('إقامة ممتدة', 'Extended Stay')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox checked={nausea} onCheckedChange={(v) => setNausea(Boolean(v))} />
                  {tr('غثيان', 'Nausea')}
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox checked={shivering} onCheckedChange={(v) => setShivering(Boolean(v))} />
                  {tr('رعشة', 'Shivering')}
                </label>
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('ملاحظات النزيف', 'Bleeding Notes')}</Label>
                <Input
                  value={bleeding}
                  onChange={(e) => setBleeding(e.target.value)}
                  placeholder={tr('وصف النزيف إن وجد...', 'Describe bleeding if any...')}
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

              <Button onClick={handleCreate} disabled={saving}>
                {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل وصول المريض للإفاقة', 'Admit to PACU')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aldrete Score Calculator */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-base">{tr('نتيجة ألدريت', 'Aldrete Score')}</CardTitle>
              <CardDescription>{tr('≥9 مطلوب للخروج من وحدة الإفاقة', '≥9 required for PACU discharge')}</CardDescription>
            </div>
            {existing && (
              <Button size="sm" variant="outline" onClick={() => setAddingAldrete((v) => !v)}>
                {addingAldrete ? tr('إلغاء', 'Cancel') : `+ ${tr('تسجيل نتيجة', 'Record Score')}`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {addingAldrete && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              {ALDRETE_CRITERIA.map((criterion) => (
                <div key={criterion.key} className="space-y-1">
                  <Label className="text-foreground text-sm">{tr(criterion.ar, criterion.en)}</Label>
                  <div className="flex gap-2 flex-wrap">
                    {criterion.options.map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setAldreteScores((prev) => ({ ...prev, [criterion.key]: opt.v }))}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                          aldreteScores[criterion.key] === opt.v
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        {opt.v} — {tr(opt.ar, opt.en)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className={`flex items-center justify-between p-3 rounded-lg border ${canDischarge && aldreteComplete ? 'bg-green-50 border-green-200 dark:bg-green-950/20' : 'bg-muted/50 border-border'}`}>
                <span className="text-sm font-medium text-foreground">
                  {tr('الإجمالي', 'Total')}: <span className="text-xl font-bold">{aldreteComplete ? aldreteTotal : '?'}</span>/10
                </span>
                {aldreteComplete && canDischarge && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle2 className="h-3 w-3 inline mr-1" /> {tr('مؤهل للخروج', 'Eligible for Discharge')}
                  </Badge>
                )}
              </div>

              <Button onClick={handleAppendAldrete} disabled={saving || !aldreteComplete}>
                {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل النتيجة', 'Record Score')}
              </Button>
            </div>
          )}

          {savedAldretes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('الوقت', 'Time')}</TableHead>
                  <TableHead>{tr('الحركة', 'Activity')}</TableHead>
                  <TableHead>{tr('التنفس', 'Respiration')}</TableHead>
                  <TableHead>{tr('الدورة', 'Circulation')}</TableHead>
                  <TableHead>{tr('الوعي', 'Consciousness')}</TableHead>
                  <TableHead>{tr('اللون', 'Color')}</TableHead>
                  <TableHead>{tr('الإجمالي', 'Total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedAldretes.map((score, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">
                      {score.time ? new Date(score.time).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell>{score.activity}</TableCell>
                    <TableCell>{score.respiration}</TableCell>
                    <TableCell>{score.circulation}</TableCell>
                    <TableCell>{score.consciousness}</TableCell>
                    <TableCell>{score.color}</TableCell>
                    <TableCell>
                      <Badge variant={score.total >= 9 ? 'default' : 'secondary'} className={score.total >= 9 ? 'bg-green-600' : ''}>
                        {score.total}/10
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr('لا توجد نتائج ألدريت مسجلة', 'No Aldrete scores recorded yet')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Vitals log */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-base">{tr('مراقبة العلامات الحيوية', 'Vitals Monitoring')}</CardTitle>
              <CardDescription>{tr('قياسات دورية في الإفاقة', 'Periodic vitals in recovery')}</CardDescription>
            </div>
            {existing && (
              <Button size="sm" variant="outline" onClick={() => setAddingVitals((v) => !v)}>
                {addingVitals ? tr('إلغاء', 'Cancel') : `+ ${tr('تسجيل قياس', 'Log Vitals')}`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {addingVitals && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 border rounded-lg bg-muted/30">
              {[
                { label: 'HR', value: vitHr, set: setVitHr, placeholder: '80' },
                { label: 'BP', value: vitBp, set: setVitBp, placeholder: '120/80' },
                { label: 'RR', value: vitRr, set: setVitRr, placeholder: '16' },
                { label: 'SpO2%', value: vitSpo2, set: setVitSpo2, placeholder: '99' },
                { label: tr('الألم', 'Pain') + ' 0-10', value: vitPain, set: setVitPain, placeholder: '0' },
                { label: tr('الحرارة', 'Temp'), value: vitTemp, set: setVitTemp, placeholder: '36.8' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs text-foreground">{label}</Label>
                  <Input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} className="thea-input-focus h-8" />
                </div>
              ))}
              <div className="md:col-span-6 flex justify-end">
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
                  <TableHead>RR</TableHead>
                  <TableHead>SpO2</TableHead>
                  <TableHead>{tr('الألم', 'Pain')}</TableHead>
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
                    <TableCell>{v.rr || '—'}</TableCell>
                    <TableCell>{v.spo2 ? `${v.spo2}%` : '—'}</TableCell>
                    <TableCell>{v.pain !== undefined && v.pain !== '' ? v.pain : '—'}</TableCell>
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
