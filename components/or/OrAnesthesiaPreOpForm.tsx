'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { CheckCircle2, Loader2, Save, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Props {
  caseId: string;
  tr: (ar: string, en: string) => string;
  language: string;
  onSaved?: () => void;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
      <span>{label}</span>
    </label>
  );
}

export default function OrAnesthesiaPreOpForm({ caseId, tr, language, onSaved }: Props) {
  const { data, mutate } = useSWR(caseId ? `/api/or/cases/${caseId}/anesthesia-pre-op` : null, fetcher);
  const existing = data?.anesthesiaPreOp;

  const [f, setF] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (existing) setF({ ...existing }); }, [existing]);

  const set = useCallback((key: string, val: any) => { setF((p) => ({ ...p, [key]: val })); setSaved(false); }, []);
  const toggle = useCallback((key: string) => { setF((p) => ({ ...p, [key]: !p[key] })); setSaved(false); }, []);

  const handleSave = async (markComplete = false) => {
    setSaving(true);
    try {
      await fetch(`/api/or/cases/${caseId}/anesthesia-pre-op`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, status: markComplete ? 'COMPLETED' : 'IN_PROGRESS' }),
      });
      await mutate();
      setSaved(true);
      onSaved?.();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* ── Status ── */}
      <div className="flex items-center gap-2">
        <Badge variant={f.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
          {f.status === 'COMPLETED' ? tr('مكتمل', 'Completed') : tr('قيد التقييم', 'In Progress')}
        </Badge>
        {f.predictedDifficultAirway && (
          <Badge variant="destructive" className="text-xs gap-1">
            <AlertTriangle className="h-3 w-3" /> {tr('مجرى هواء صعب متوقع', 'Predicted Difficult Airway')}
          </Badge>
        )}
      </div>

      {/* ═══════ ASA Classification ═══════ */}
      <Section title={tr('تصنيف ASA', 'ASA Classification')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{tr('تصنيف ASA', 'ASA Class')}</Label>
            <Select value={f.asaClass || ''} onValueChange={(v) => set('asaClass', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {[
                  { v: 'I', d: tr('مريض سليم', 'Healthy patient') },
                  { v: 'II', d: tr('مرض جهازي خفيف', 'Mild systemic disease') },
                  { v: 'III', d: tr('مرض جهازي شديد', 'Severe systemic disease') },
                  { v: 'IV', d: tr('مرض مهدد للحياة', 'Life-threatening disease') },
                  { v: 'V', d: tr('مريض مُحتَضَر', 'Moribund patient') },
                  { v: 'VI', d: tr('موت دماغي', 'Brain-dead organ donor') },
                ].map((o) => (
                  <SelectItem key={o.v} value={o.v}>ASA {o.v} — {o.d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end pb-1">
            <Check label={tr('حالة طوارئ (E)', 'Emergency (E)')} checked={!!f.asaEmergency} onChange={() => toggle('asaEmergency')} />
          </div>
        </div>
      </Section>

      {/* ═══════ Airway Assessment ═══════ */}
      <Section title={tr('تقييم مجرى الهواء', 'Airway Assessment')}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{tr('Mallampati', 'Mallampati Score')}</Label>
            <Select value={f.mallampatiScore || ''} onValueChange={(v) => set('mallampatiScore', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {['I', 'II', 'III', 'IV'].map((s) => <SelectItem key={s} value={s}>{tr('درجة', 'Class')} {s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('المسافة الدرقية الذقنية', 'Thyromental Distance')}</Label>
            <Select value={f.thyroMentalDistance || ''} onValueChange={(v) => set('thyroMentalDistance', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">{tr('طبيعي (>6 سم)', 'Normal (>6cm)')}</SelectItem>
                <SelectItem value="REDUCED">{tr('قصير (<6 سم)', 'Reduced (<6cm)')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('فتحة الفم', 'Mouth Opening')}</Label>
            <Select value={f.mouthOpening || ''} onValueChange={(v) => set('mouthOpening', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADEQUATE">{tr('كافي (>3 سم)', 'Adequate (>3cm)')}</SelectItem>
                <SelectItem value="LIMITED">{tr('محدود (<3 سم)', 'Limited (<3cm)')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('حركة الرقبة', 'Neck Mobility')}</Label>
            <Select value={f.neckMobility || ''} onValueChange={(v) => set('neckMobility', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL">{tr('كاملة', 'Full')}</SelectItem>
                <SelectItem value="LIMITED">{tr('محدودة', 'Limited')}</SelectItem>
                <SelectItem value="FIXED">{tr('ثابتة', 'Fixed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('حالة الأسنان', 'Dentition')}</Label>
            <Select value={f.dentitionStatus || ''} onValueChange={(v) => set('dentitionStatus', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {[
                  { v: 'NORMAL', ar: 'طبيعي', en: 'Normal' },
                  { v: 'MISSING', ar: 'مفقود', en: 'Missing' },
                  { v: 'LOOSE', ar: 'متحرك', en: 'Loose' },
                  { v: 'DENTURES', ar: 'أطقم', en: 'Dentures' },
                  { v: 'CROWNS', ar: 'تيجان', en: 'Crowns' },
                ].map((o) => <SelectItem key={o.v} value={o.v}>{tr(o.ar, o.en)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <Check label={tr('لحية', 'Beard present')} checked={!!f.beardPresent} onChange={() => toggle('beardPresent')} />
          <Check label={tr('مجرى هواء صعب متوقع', 'Predicted difficult airway')} checked={!!f.predictedDifficultAirway} onChange={() => toggle('predictedDifficultAirway')} />
        </div>
        <div>
          <Label className="text-xs">{tr('ملاحظات المجرى', 'Airway notes')}</Label>
          <Input value={f.airwayNotes || ''} onChange={(e) => set('airwayNotes', e.target.value)} className="h-8 text-xs" />
        </div>
      </Section>

      {/* ═══════ Medical History ═══════ */}
      <Section title={tr('التاريخ الطبي', 'Medical History')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'cardiacHistory', ar: 'القلب', en: 'Cardiac' },
            { key: 'respiratoryHistory', ar: 'الجهاز التنفسي', en: 'Respiratory' },
            { key: 'hepaticHistory', ar: 'الكبد', en: 'Hepatic' },
            { key: 'renalHistory', ar: 'الكلى', en: 'Renal' },
            { key: 'endocrineHistory', ar: 'الغدد الصماء', en: 'Endocrine' },
            { key: 'neurologicHistory', ar: 'الجهاز العصبي', en: 'Neurologic' },
            { key: 'hematologicHistory', ar: 'الدم', en: 'Hematologic' },
          ].map((h) => (
            <div key={h.key}>
              <Label className="text-xs">{tr(h.ar, h.en)}</Label>
              <Input
                value={(f[h.key] as Record<string, string> | undefined)?.notes || ''}
                onChange={(e) => set(h.key, { ...(f[h.key] || {}), notes: e.target.value })}
                className="h-8 text-xs"
                placeholder={tr('ملاحظات...', 'Notes...')}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ═══════ Previous Anesthesia ═══════ */}
      <Section title={tr('تخدير سابق', 'Previous Anesthesia')}>
        <Check label={tr('تخدير سابق', 'Previous anesthesia')} checked={!!f.previousAnesthesia} onChange={() => toggle('previousAnesthesia')} />
        {f.previousAnesthesia && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{tr('مضاعفات سابقة', 'Previous complications')}</Label>
              <Input value={f.previousComplications || ''} onChange={(e) => set('previousComplications', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">{tr('تاريخ عائلي', 'Family Hx (e.g. MH)')}</Label>
              <Input value={f.familyAnesthesiaHx || ''} onChange={(e) => set('familyAnesthesiaHx', e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        )}
      </Section>

      {/* ═══════ NPO Verification ═══════ */}
      <Section title={tr('التحقق من الصيام', 'NPO Verification')}>
        <Check label={tr('تم التحقق من الصيام', 'NPO verified')} checked={!!f.npoVerified} onChange={() => toggle('npoVerified')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{tr('آخر وجبة صلبة', 'Last solids')}</Label>
            <Input
              type="datetime-local"
              value={f.lastSolidsTime ? new Date(f.lastSolidsTime).toISOString().slice(0, 16) : ''}
              onChange={(e) => set('lastSolidsTime', e.target.value || null)}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">{tr('آخر سوائل صافية', 'Last clear liquids')}</Label>
            <Input
              type="datetime-local"
              value={f.lastClearLiquidsTime ? new Date(f.lastClearLiquidsTime).toISOString().slice(0, 16) : ''}
              onChange={(e) => set('lastClearLiquidsTime', e.target.value || null)}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </Section>

      {/* ═══════ Planned Anesthesia ═══════ */}
      <Section title={tr('خطة التخدير', 'Planned Anesthesia')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{tr('نوع التخدير', 'Anesthesia type')}</Label>
            <Select value={f.plannedAnesthesiaType || ''} onValueChange={(v) => set('plannedAnesthesiaType', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {[
                  { v: 'GENERAL', ar: 'عام', en: 'General' },
                  { v: 'REGIONAL', ar: 'ناحي', en: 'Regional' },
                  { v: 'SPINAL', ar: 'نخاعي', en: 'Spinal' },
                  { v: 'EPIDURAL', ar: 'فوق الجافية', en: 'Epidural' },
                  { v: 'COMBINED', ar: 'مشترك', en: 'Combined' },
                  { v: 'MAC', ar: 'تهدئة مراقبة', en: 'MAC' },
                  { v: 'LOCAL', ar: 'موضعي', en: 'Local' },
                ].map((o) => <SelectItem key={o.v} value={o.v}>{tr(o.ar, o.en)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('إدارة المجرى', 'Planned airway')}</Label>
            <Select value={f.plannedAirway || ''} onValueChange={(v) => set('plannedAirway', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {[
                  { v: 'ETT', ar: 'أنبوب رغامي', en: 'ETT' },
                  { v: 'LMA', ar: 'قناع حنجري', en: 'LMA' },
                  { v: 'MASK', ar: 'قناع وجهي', en: 'Face Mask' },
                  { v: 'AWAKE_FIBEROPTIC', ar: 'منظار ليفي واعي', en: 'Awake Fiberoptic' },
                  { v: 'TRACHEOSTOMY', ar: 'فغر رغامي', en: 'Tracheostomy' },
                ].map((o) => <SelectItem key={o.v} value={o.v}>{tr(o.ar, o.en)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* ═══════ Risk Assessment ═══════ */}
      <Section title={tr('تقييم المخاطر', 'Risk Assessment')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'cardiacRiskIndex', ar: 'خطر القلب', en: 'Cardiac Risk' },
            { key: 'bleedingRisk', ar: 'خطر النزيف', en: 'Bleeding Risk' },
            { key: 'ponvRisk', ar: 'خطر الغثيان', en: 'PONV Risk' },
          ].map((r) => (
            <div key={r.key}>
              <Label className="text-xs">{tr(r.ar, r.en)}</Label>
              <Select value={f[r.key] || ''} onValueChange={(v) => set(r.key, v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">{tr('منخفض', 'Low')}</SelectItem>
                  <SelectItem value="INTERMEDIATE">{tr('متوسط', 'Intermediate')}</SelectItem>
                  <SelectItem value="HIGH">{tr('عالي', 'High')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
          <div>
            <Label className="text-xs">{tr('خطر رئوي', 'Pulmonary Risk')}</Label>
            <Input value={f.pulmonaryRiskScore || ''} onChange={(e) => set('pulmonaryRiskScore', e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </Section>

      {/* ═══════ Consent ═══════ */}
      <Section title={tr('الموافقة المستنيرة', 'Informed Consent')}>
        <Check label={tr('تم شرح المخاطر', 'Risks explained')} checked={!!f.risksExplained} onChange={() => toggle('risksExplained')} />
        <Check label={tr('تم الحصول على الموافقة', 'Consent obtained')} checked={!!f.consentObtained} onChange={() => toggle('consentObtained')} />
      </Section>

      {/* ═══════ Notes ═══════ */}
      <div>
        <Label className="text-xs font-semibold">{tr('اعتبارات خاصة', 'Special Considerations')}</Label>
        <Textarea value={f.specialConsiderations || ''} onChange={(e) => set('specialConsiderations', e.target.value)} rows={2} className="text-xs mt-1" />
      </div>
      <div>
        <Label className="text-xs font-semibold">{tr('ملاحظات التخدير', 'Anesthesia Notes')}</Label>
        <Textarea value={f.anesthesiaNotes || ''} onChange={(e) => set('anesthesiaNotes', e.target.value)} rows={2} className="text-xs mt-1" />
      </div>

      {/* ═══════ Actions ═══════ */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button size="sm" onClick={() => handleSave(false)} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {tr('حفظ مسودة', 'Save Draft')}
        </Button>
        <Button size="sm" variant="default" onClick={() => handleSave(true)} disabled={saving} className="gap-1.5 bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {tr('اكتمل التقييم', 'Complete Assessment')}
        </Button>
        {saved && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> {tr('تم الحفظ', 'Saved')}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground border-b pb-1">{title}</h3>
      <div className="space-y-2 pl-1">{children}</div>
    </div>
  );
}
