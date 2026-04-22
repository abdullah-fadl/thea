'use client';
import { useLang } from '@/hooks/use-lang';
import useSWR from 'swr';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, X, Activity, Baby, Heart, Clock, CheckCircle2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ─── Types ────────────────────────────────────────────────────────────────────
type Observation = {
  id: string;
  observedAt: string;
  observedBy: string;
  bp: string | null;
  pulse: number | null;
  temperature: number | null;
  urineOutput: number | null;
  fhr: number | null;
  fhrPattern: string | null;
  cervixDilation: number | null;
  effacement: number | null;
  stationLevel: string | null;
  contractionFreq: number | null;
  contractionDuration: number | null;
  contractionStrength: string | null;
  oxytocin: number | null;
  notes: string | null;
};

type Partogram = {
  id: string;
  patientMasterId: string;
  episodeId?: string;
  admissionTime: string;
  gestationalAge?: number;
  gravidaPara?: string;
  membraneStatus?: string;
  ruptureTime?: string;
  cervixOnAdmission?: number;
  presentingPart?: string;
  fetalPosition?: string;
  status: string;
  deliveryTime?: string;
  deliveryMode?: string;
  observations: Observation[];
};

// ─── Cervicogram SVG Chart ────────────────────────────────────────────────────
function CervicogramChart({ partogram, lang }: { partogram: Partogram; lang: string }) {
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;

  const admission = new Date(partogram.admissionTime).getTime();
  const initialDilation = partogram.cervixOnAdmission ?? 0;

  // SVG dimensions
  const VW = 760; const VH = 280;
  const ML = 52; const MR = 20; const MT = 20; const MB = 40;
  const CW = VW - ML - MR;  // chart width
  const CH = VH - MT - MB;  // chart height
  const MAX_H = 24; // max hours shown
  const MAX_D = 10; // max dilation cm

  // Coordinate helpers
  const xOf = (hours: number) => ML + (hours / MAX_H) * CW;
  const yOf = (cm: number) => MT + CH - (cm / MAX_D) * CH;

  // Alert line: from (0, initial) at 1cm/hr
  // Ends at (10 - initial, 10cm)
  const alertStart = { x: xOf(0), y: yOf(initialDilation) };
  const alertEnd   = { x: xOf(MAX_D - initialDilation), y: yOf(MAX_D) };

  // Action line: alert shifted 4h right
  const actionStart = { x: xOf(4), y: yOf(initialDilation) };
  const actionEnd   = { x: xOf(MAX_D - initialDilation + 4), y: yOf(MAX_D) };

  // Actual dilation points
  const dilationPoints = partogram.observations
    .filter(o => o.cervixDilation != null)
    .map(o => ({
      hours: (new Date(o.observedAt).getTime() - admission) / 3600000,
      cm: o.cervixDilation!,
    }))
    .sort((a, b) => a.hours - b.hours);

  // FHR points
  const fhrPoints = partogram.observations
    .filter(o => o.fhr != null)
    .map(o => ({
      hours: (new Date(o.observedAt).getTime() - admission) / 3600000,
      fhr: o.fhr!,
    }))
    .sort((a, b) => a.hours - b.hours);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
        {tr('الرسم البياني للتمدد (البارتوجراف)', 'Cervicogram (WHO Partogram)')}
      </p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full min-w-[600px] border rounded-xl bg-card">
          {/* Grid lines */}
          {Array.from({ length: MAX_D + 1 }, (_, i) => (
            <g key={`cm-${i}`}>
              <line x1={ML} y1={yOf(i)} x2={ML + CW} y2={yOf(i)}
                stroke={i === 0 ? '#64748b' : '#e2e8f0'} strokeWidth={i === 0 ? 1.5 : 0.5}
                strokeDasharray={i > 0 && i < 10 ? '4,4' : ''} />
              <text x={ML - 6} y={yOf(i) + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{i}</text>
            </g>
          ))}
          {Array.from({ length: MAX_H + 1 }, (_, i) => (
            <g key={`h-${i}`}>
              <line x1={xOf(i)} y1={MT} x2={xOf(i)} y2={MT + CH}
                stroke={i === 0 ? '#64748b' : '#e2e8f0'} strokeWidth={i === 0 ? 1.5 : 0.5}
                strokeDasharray={i > 0 ? '4,4' : ''} />
              {i % 2 === 0 && (
                <text x={xOf(i)} y={MT + CH + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">{i}h</text>
              )}
            </g>
          ))}

          {/* Axis labels */}
          <text x={ML - 36} y={MT + CH / 2} transform={`rotate(-90, ${ML - 36}, ${MT + CH / 2})`}
            textAnchor="middle" fontSize={10} fill="#64748b">
            {tr('تمدد (سم)', 'Dilation (cm)')}
          </text>
          <text x={ML + CW / 2} y={VH - 4} textAnchor="middle" fontSize={10} fill="#64748b">
            {tr('الوقت (ساعة)', 'Time (hours from admission)')}
          </text>

          {/* Active phase shading (4-10cm zone) */}
          <rect x={ML} y={yOf(10)} width={CW} height={yOf(4) - yOf(10)}
            fill="#f0fdf4" fillOpacity={0.6} />

          {/* Alert line (yellow dashed) */}
          <line x1={alertStart.x} y1={alertStart.y} x2={alertEnd.x} y2={alertEnd.y}
            stroke="#eab308" strokeWidth={2} strokeDasharray="8,4" />
          <text x={alertEnd.x + 4} y={alertEnd.y - 4} fontSize={8} fill="#eab308">{tr('خط التحذير', 'Alert')}</text>

          {/* Action line (red dashed) */}
          <line x1={actionStart.x} y1={actionStart.y} x2={actionEnd.x} y2={actionEnd.y}
            stroke="#ef4444" strokeWidth={2} strokeDasharray="8,4" />
          <text x={actionEnd.x + 4} y={actionEnd.y - 4} fontSize={8} fill="#ef4444">{tr('خط التدخل', 'Action')}</text>

          {/* Actual dilation curve */}
          {dilationPoints.length >= 2 && (
            <polyline
              points={dilationPoints.map(p => `${xOf(p.hours)},${yOf(p.cm)}`).join(' ')}
              fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" />
          )}
          {dilationPoints.map((p, i) => (
            <g key={i}>
              <circle cx={xOf(p.hours)} cy={yOf(p.cm)} r={5} fill="#2563eb" stroke="white" strokeWidth={1.5} />
              <title>{`${tr('ساعة', 'h')} ${p.hours.toFixed(1)}: ${p.cm} cm`}</title>
            </g>
          ))}

          {/* Admission dilation marker */}
          {initialDilation > 0 && (
            <g>
              <circle cx={xOf(0)} cy={yOf(initialDilation)} r={6} fill="#7c3aed" stroke="white" strokeWidth={1.5} />
              <text x={xOf(0) + 8} y={yOf(initialDilation) - 6} fontSize={8} fill="#7c3aed">
                {initialDilation}cm {tr('دخول', 'Adm')}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1 text-xs">
        {[
          { color: '#7c3aed', label: tr('تمدد الدخول', 'Admission dilation') },
          { color: '#2563eb', label: tr('التمدد الفعلي', 'Actual dilation') },
          { color: '#eab308', label: tr('خط التحذير (1 سم/ساعة)', 'Alert line (1cm/hr)') },
          { color: '#ef4444', label: tr('خط التدخل (+4 ساعة)', 'Action line (+4h)') },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="h-2 w-5 rounded" style={{ background: l.color }} />
            <span className="text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* FHR mini-chart */}
      {fhrPoints.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mt-3">
            {tr('معدل قلب الجنين (bpm)', 'Fetal Heart Rate (bpm)')}
          </p>
          <svg viewBox={`0 0 ${VW} 120`} className="w-full min-w-[600px] border rounded-xl bg-card">
            {/* Normal range shading 110-160 */}
            <rect x={ML} y={120 - 40 - (160 - 100) * (80 / 100)}
              width={CW} height={(160 - 110) * (80 / 100)}
              fill="#dcfce7" fillOpacity={0.7} />
            {/* Y grid for FHR */}
            {[80, 100, 110, 120, 140, 160, 180].map(bpm => {
              const yy = 100 - ((bpm - 60) / 150) * 80;
              return (
                <g key={bpm}>
                  <line x1={ML} y1={yy} x2={ML + CW} y2={yy}
                    stroke={bpm === 110 || bpm === 160 ? '#16a34a' : '#e2e8f0'}
                    strokeWidth={bpm === 110 || bpm === 160 ? 1 : 0.5}
                    strokeDasharray={bpm !== 110 && bpm !== 160 ? '4,4' : ''} />
                  <text x={ML - 4} y={yy + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{bpm}</text>
                </g>
              );
            })}
            {/* FHR curve */}
            {fhrPoints.length >= 2 && (
              <polyline
                points={fhrPoints.map(p => `${xOf(p.hours)},${100 - ((p.fhr - 60) / 150) * 80}`).join(' ')}
                fill="none" stroke="#dc2626" strokeWidth={2} strokeLinejoin="round" />
            )}
            {fhrPoints.map((p, i) => {
              const yy = 100 - ((p.fhr - 60) / 150) * 80;
              const inRange = p.fhr >= 110 && p.fhr <= 160;
              return (
                <circle key={i} cx={xOf(p.hours)} cy={yy} r={4}
                  fill={inRange ? '#16a34a' : '#dc2626'} stroke="white" strokeWidth={1} />
              );
            })}
            <text x={ML - 36} y={60} transform={`rotate(-90, ${ML - 36}, 60)`}
              textAnchor="middle" fontSize={9} fill="#64748b">bpm</text>
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── Add Observation Form ─────────────────────────────────────────────────────
function AddObservationForm({ partogramId, lang, onAdded }: {
  partogramId: string;
  lang: string;
  onAdded: () => void;
}) {
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    observedAt: new Date().toISOString().slice(0, 16),
    bp: '',
    pulse: '',
    temperature: '',
    urineOutput: '',
    fhr: '',
    fhrPattern: 'NORMAL',
    cervixDilation: '',
    effacement: '',
    stationLevel: '',
    contractionFreq: '',
    contractionDuration: '',
    contractionStrength: 'MILD',
    oxytocin: '',
    notes: '',
  });
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const num = (v: string) => v !== '' ? Number(v) : undefined;
      const res = await fetch(`/api/obgyn/partogram/${partogramId}/observations`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observedAt: form.observedAt,
          bp: form.bp || undefined,
          pulse: num(form.pulse),
          temperature: num(form.temperature),
          urineOutput: num(form.urineOutput),
          fhr: num(form.fhr),
          fhrPattern: form.fhrPattern,
          cervixDilation: num(form.cervixDilation),
          effacement: num(form.effacement),
          stationLevel: form.stationLevel || undefined,
          contractionFreq: num(form.contractionFreq),
          contractionDuration: num(form.contractionDuration),
          contractionStrength: form.contractionStrength,
          oxytocin: num(form.oxytocin),
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم تسجيل المشاهدة', 'Observation recorded') });
      setForm(p => ({ ...p, observedAt: new Date().toISOString().slice(0, 16), bp: '', pulse: '', fhr: '', cervixDilation: '', notes: '' }));
      onAdded();
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">{tr('وقت المشاهدة *', 'Observation Time *')}</Label>
        <Input type="datetime-local" value={form.observedAt} onChange={e => set('observedAt', e.target.value)}
          className="thea-input-focus" />
      </div>

      {/* Maternal Vitals */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          {tr('علامات الأم', 'Maternal Vitals')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: tr('ضغط الدم', 'BP'), key: 'bp', type: 'text', placeholder: '120/80' },
            { label: tr('النبض (bpm)', 'Pulse (bpm)'), key: 'pulse', type: 'number', placeholder: '80' },
            { label: tr('الحرارة (°C)', 'Temp (°C)'), key: 'temperature', type: 'number', placeholder: '37.0' },
            { label: tr('البول (mL)', 'Urine (mL)'), key: 'urineOutput', type: 'number', placeholder: '0' },
          ].map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input type={f.type} value={form[f.key as keyof typeof form]}
                onChange={e => set(f.key as keyof typeof form, e.target.value)}
                placeholder={f.placeholder} className="h-8 text-xs thea-input-focus" />
            </div>
          ))}
        </div>
      </div>

      {/* Fetal */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          {tr('حالة الجنين', 'Fetal Condition')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{tr('قلب الجنين (bpm)', 'FHR (bpm)')}</Label>
            <Input type="number" min={60} max={220} value={form.fhr}
              onChange={e => set('fhr', e.target.value)} placeholder="140" className="h-8 text-xs thea-input-focus" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tr('نمط قلب الجنين', 'FHR Pattern')}</Label>
            <Select value={form.fhrPattern} onValueChange={v => set('fhrPattern', v)}>
              <SelectTrigger className="h-8 text-xs thea-input-focus"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">{tr('طبيعي', 'Normal')}</SelectItem>
                <SelectItem value="EARLY_DECEL">{tr('تباطؤ مبكر', 'Early Decel')}</SelectItem>
                <SelectItem value="LATE_DECEL">{tr('تباطؤ متأخر', 'Late Decel')}</SelectItem>
                <SelectItem value="VARIABLE_DECEL">{tr('تباطؤ متغير', 'Variable Decel')}</SelectItem>
                <SelectItem value="TACHYCARDIA">{tr('تسرع', 'Tachycardia')}</SelectItem>
                <SelectItem value="BRADYCARDIA">{tr('بطء', 'Bradycardia')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Labor Progress */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          {tr('تقدم المخاض', 'Labor Progress')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{tr('تمدد عنق الرحم (سم)', 'Cervix Dilation (cm)')}</Label>
            <Input type="number" min={0} max={10} step={0.5} value={form.cervixDilation}
              onChange={e => set('cervixDilation', e.target.value)} placeholder="0-10" className="h-8 text-xs thea-input-focus" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tr('المحو (%)', 'Effacement (%)')}</Label>
            <Input type="number" min={0} max={100} value={form.effacement}
              onChange={e => set('effacement', e.target.value)} placeholder="0-100" className="h-8 text-xs thea-input-focus" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tr('المستوى', 'Station')}</Label>
            <Select value={form.stationLevel} onValueChange={v => set('stationLevel', v)}>
              <SelectTrigger className="h-8 text-xs thea-input-focus"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {['-5', '-4', '-3', '-2', '-1', '0', '+1', '+2', '+3', '+4', '+5'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contractions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          {tr('الانقباضات', 'Contractions')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{tr('العدد / 10 دق', 'Freq / 10min')}</Label>
            <Input type="number" min={0} max={7} value={form.contractionFreq}
              onChange={e => set('contractionFreq', e.target.value)} placeholder="1-7" className="h-8 text-xs thea-input-focus" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tr('المدة (ثانية)', 'Duration (sec)')}</Label>
            <Input type="number" min={0} max={90} value={form.contractionDuration}
              onChange={e => set('contractionDuration', e.target.value)} placeholder="0-90" className="h-8 text-xs thea-input-focus" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tr('الشدة', 'Strength')}</Label>
            <Select value={form.contractionStrength} onValueChange={v => set('contractionStrength', v)}>
              <SelectTrigger className="h-8 text-xs thea-input-focus"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MILD">{tr('خفيف', 'Mild')}</SelectItem>
                <SelectItem value="MODERATE">{tr('معتدل', 'Moderate')}</SelectItem>
                <SelectItem value="STRONG">{tr('قوي', 'Strong')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Oxytocin & Notes */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{tr('أوكسيتوسين (mU/min)', 'Oxytocin (mU/min)')}</Label>
          <Input type="number" min={0} value={form.oxytocin}
            onChange={e => set('oxytocin', e.target.value)} placeholder="0" className="h-8 text-xs thea-input-focus" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{tr('ملاحظات', 'Notes')}</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder={tr('أي ملاحظات...', 'Any observations...')} rows={2} className="text-xs thea-input-focus" />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل المشاهدة', 'Record Observation')}
      </Button>
    </div>
  );
}

// ─── Delivery/Outcome Form ────────────────────────────────────────────────────
function DeliveryOutcomeForm({ partogramId, lang, onUpdated }: {
  partogramId: string;
  lang: string;
  onUpdated: () => void;
}) {
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ status: 'DELIVERED', deliveryTime: new Date().toISOString().slice(0, 16), deliveryMode: 'SVD' });
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/obgyn/partogram/${partogramId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: form.status, deliveryTime: form.deliveryTime, deliveryMode: form.deliveryMode }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم تسجيل نتيجة الولادة', 'Delivery outcome recorded') });
      onUpdated();
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{tr('نتيجة الولادة', 'Delivery Outcome')}</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="thea-input-focus"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DELIVERED">{tr('ولادة طبيعية/مساعدة', 'Vaginal Delivery')}</SelectItem>
              <SelectItem value="CSECTION">{tr('قيصرية', 'C-Section')}</SelectItem>
              <SelectItem value="TRANSFERRED">{tr('تحويل', 'Transferred')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{tr('وقت الولادة', 'Delivery Time')}</Label>
          <Input type="datetime-local" value={form.deliveryTime} onChange={e => set('deliveryTime', e.target.value)}
            className="thea-input-focus" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">{tr('طريقة الولادة', 'Delivery Mode')}</Label>
          <Select value={form.deliveryMode} onValueChange={v => set('deliveryMode', v)}>
            <SelectTrigger className="thea-input-focus"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SVD">{tr('ولادة طبيعية', 'Spontaneous Vaginal')}</SelectItem>
              <SelectItem value="FORCEPS">{tr('ملقط', 'Forceps')}</SelectItem>
              <SelectItem value="VACUUM">{tr('كأس شفط', 'Vacuum')}</SelectItem>
              <SelectItem value="ELECTIVE_CS">{tr('قيصرية اختيارية', 'Elective C-Section')}</SelectItem>
              <SelectItem value="EMERGENCY_CS">{tr('قيصرية طارئة', 'Emergency C-Section')}</SelectItem>
              <SelectItem value="TRANSFER">{tr('تحويل لمستوى أعلى', 'Transfer')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white gap-1">
        <CheckCircle2 className="h-4 w-4" />
        {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل الولادة', 'Record Delivery')}
      </Button>
    </div>
  );
}

// ─── Observations Table ───────────────────────────────────────────────────────
function ObservationsTable({ observations, lang }: { observations: Observation[]; lang: string }) {
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  if (observations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {tr('لا توجد مشاهدات مسجّلة', 'No observations recorded yet')}
      </div>
    );
  }
  const fhrColor = (fhr: number | null) => {
    if (fhr == null) return '';
    if (fhr < 110 || fhr > 160) return 'text-red-600 font-bold';
    return 'text-green-700';
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            {[
              tr('الوقت', 'Time'),
              tr('ضغط / نبض', 'BP / Pulse'),
              tr('حرارة', 'Temp'),
              tr('قلب الجنين', 'FHR'),
              tr('تمدد', 'Dilation'),
              tr('المحو', 'Effacement'),
              tr('المستوى', 'Station'),
              tr('انقباضات', 'Contractions'),
              tr('ملاحظات', 'Notes'),
            ].map(h => (
              <th key={h} className="p-2 text-start font-medium text-muted-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...observations].reverse().map(o => (
            <tr key={o.id} className="border-t hover:bg-muted/20">
              <td className="p-2 whitespace-nowrap">
                {new Date(o.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="p-2">{o.bp || '—'} / {o.pulse || '—'}</td>
              <td className="p-2">{o.temperature ?? '—'}</td>
              <td className={`p-2 ${fhrColor(o.fhr)}`}>{o.fhr ?? '—'}</td>
              <td className="p-2 font-semibold text-primary">{o.cervixDilation != null ? `${o.cervixDilation}cm` : '—'}</td>
              <td className="p-2">{o.effacement != null ? `${o.effacement}%` : '—'}</td>
              <td className="p-2">{o.stationLevel || '—'}</td>
              <td className="p-2">
                {o.contractionFreq != null ? `${o.contractionFreq}×/10' ${o.contractionDuration ?? ''}s` : '—'}
              </td>
              <td className="p-2 max-w-[120px] truncate text-muted-foreground">{o.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Detail Component ────────────────────────────────────────────────────
export function PartogramDetail({ id }: { id: string }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<'observations' | 'add' | 'delivery'>('observations');

  const { data, mutate } = useSWR(`/api/obgyn/partogram/${id}`, fetcher, { refreshInterval: 30000 });
  const partogram: Partogram | null = data?.partogram ?? null;

  if (!partogram) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <Baby className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>{tr('جارٍ التحميل...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  const observations = partogram.observations || [];
  const isActive = partogram.status === 'ACTIVE';
  const latestObs = observations.length > 0 ? observations[observations.length - 1] : null;
  const elapsedHours = ((Date.now() - new Date(partogram.admissionTime).getTime()) / 3600000).toFixed(1);

  const statusConfig: Record<string, { ar: string; en: string; color: string }> = {
    ACTIVE:      { ar: 'مخاض نشط',   en: 'Active Labor',  color: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300' },
    DELIVERED:   { ar: 'مولود',       en: 'Delivered',     color: 'bg-blue-100 text-blue-800' },
    CSECTION:    { ar: 'قيصرية',      en: 'C-Section',     color: 'bg-orange-100 text-orange-800' },
    TRANSFERRED: { ar: 'محوّل',       en: 'Transferred',   color: 'bg-muted text-foreground' },
  };
  const sCfg = statusConfig[partogram.status] || statusConfig['ACTIVE'];

  return (
    <div className="p-4 md:p-6 space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/obgyn/partogram')}
          className="p-2 hover:bg-muted rounded-xl transition-colors">
          <ArrowLeft className={`h-5 w-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">
              {tr('بارتوجراف', 'Partogram')} — {partogram.gravidaPara || 'G?P?'}
              {partogram.gestationalAge ? ` · ${partogram.gestationalAge}w` : ''}
            </h1>
            <Badge className={sCfg.color}>{tr(sCfg.ar, sCfg.en)}</Badge>
            {isActive && (
              <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <Activity className="h-3.5 w-3.5 animate-pulse" />
                {elapsedHours}h {tr('مخاض', 'labor')}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tr('دخول:', 'Admitted:')} {new Date(partogram.admissionTime).toLocaleString()}
            {partogram.presentingPart ? ` · ${partogram.presentingPart}` : ''}
            {partogram.fetalPosition ? ` (${partogram.fetalPosition})` : ''}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Clock className="h-4 w-4 text-amber-500" />, label: tr('مدة المخاض', 'Labor Duration'), value: `${elapsedHours}h` },
          { icon: <Activity className="h-4 w-4 text-primary" />, label: tr('آخر تمدد', 'Last Dilation'), value: latestObs?.cervixDilation != null ? `${latestObs.cervixDilation} cm` : `${partogram.cervixOnAdmission ?? '?'} cm ${tr('دخول', '(Adm)')}` },
          { icon: <Heart className="h-4 w-4 text-red-500" />, label: tr('آخر FHR', 'Last FHR'), value: latestObs?.fhr != null ? `${latestObs.fhr} bpm` : '—' },
          { icon: <Baby className="h-4 w-4 text-blue-500" />, label: tr('المشاهدات', 'Observations'), value: String(observations.length) },
        ].map(k => (
          <Card key={k.label} className="rounded-xl">
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-0.5">{k.icon}<p className="text-xs text-muted-foreground">{k.label}</p></div>
              <p className="text-xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main layout: Chart + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Partogram Chart (2/3 width) */}
        <Card className="rounded-2xl lg:col-span-2">
          <CardContent className="pt-5 pb-4">
            <CervicogramChart partogram={partogram} lang={language} />
          </CardContent>
        </Card>

        {/* Side Panel (1/3 width) */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex gap-1">
              {[
                { key: 'observations', ar: 'السجل', en: 'History' },
                ...(isActive ? [
                  { key: 'add', ar: '+ مشاهدة', en: '+ Obs' },
                  { key: 'delivery', ar: 'نتيجة', en: 'Delivery' },
                ] : []),
              ].map(t => (
                <button key={t.key} onClick={() => setActivePanel(t.key as typeof activePanel)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activePanel === t.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                  }`}>
                  {tr(t.ar, t.en)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[600px]">
            {activePanel === 'observations' && (
              <ObservationsTable observations={observations} lang={language} />
            )}
            {activePanel === 'add' && isActive && (
              <AddObservationForm partogramId={id} lang={language} onAdded={() => { mutate(); setActivePanel('observations'); }} />
            )}
            {activePanel === 'delivery' && isActive && (
              <DeliveryOutcomeForm partogramId={id} lang={language} onUpdated={() => { mutate(); }} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Observations Detail Table */}
      {observations.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {tr('سجل المشاهدات التفصيلي', 'Detailed Observation Log')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ObservationsTable observations={observations} lang={language} />
          </CardContent>
        </Card>
      )}

      {/* Add observation floating button for active cases */}
      {isActive && activePanel !== 'add' && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button onClick={() => setActivePanel('add')} className="rounded-full shadow-lg gap-2 h-12 px-5">
            <Plus className="h-5 w-5" />
            {tr('تسجيل مشاهدة', 'Record Observation')}
          </Button>
        </div>
      )}
    </div>
  );
}

export default PartogramDetail;
