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

/* ── Checkbox row helper ── */
function Check({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

export default function OrNursingPreOpForm({ caseId, tr, language, onSaved }: Props) {
  const { data, mutate } = useSWR(caseId ? `/api/or/cases/${caseId}/nursing-pre-op` : null, fetcher);
  const existing = data?.nursingPreOp;

  /* ── Form state ── */
  const [f, setF] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existing) setF({ ...existing });
  }, [existing]);

  const set = useCallback((key: string, val: any) => {
    setF((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const toggle = useCallback((key: string) => {
    setF((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }, []);

  /* ── Save ── */
  const handleSave = async (markComplete = false) => {
    setSaving(true);
    try {
      const payload = { ...f, status: markComplete ? 'COMPLETED' : 'IN_PROGRESS' };
      await fetch(`/api/or/cases/${caseId}/nursing-pre-op`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await mutate();
      setSaved(true);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const completedChecks = [
    f.patientIdVerified, f.idBandChecked, f.npoCompliant, f.allergiesReviewed,
    f.ivAccess, f.surgicalConsentSigned, f.anesthesiaConsentSigned,
    f.surgicalSiteMarked, f.fallRiskAssessed, f.patientEducation,
  ].filter(Boolean).length;
  const totalChecks = 10;

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ── Progress Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={f.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
            {f.status === 'COMPLETED'
              ? tr('مكتمل', 'Completed')
              : tr('قيد التقييم', 'In Progress')}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {completedChecks}/{totalChecks} {tr('بنود', 'items')}
          </span>
        </div>
        <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(completedChecks / totalChecks) * 100}%` }}
          />
        </div>
      </div>

      {/* ═══════ Section 1: Patient Identification ═══════ */}
      <Section title={tr('التعريف بالمريض', 'Patient Identification')}>
        <Check label={tr('تم التحقق من هوية المريض', 'Patient identity verified')} checked={!!f.patientIdVerified} onChange={() => toggle('patientIdVerified')} />
        <Check label={tr('سوار التعريف مثبت', 'ID band checked')} checked={!!f.idBandChecked} onChange={() => toggle('idBandChecked')} />
      </Section>

      {/* ═══════ Section 2: NPO Status ═══════ */}
      <Section title={tr('حالة الصيام (NPO)', 'NPO Status')}>
        <Check label={tr('المريض صائم', 'NPO compliant')} checked={!!f.npoCompliant} onChange={() => toggle('npoCompliant')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{tr('آخر تناول عن طريق الفم', 'Last oral intake')}</Label>
            <Input
              type="datetime-local"
              value={f.lastOralIntakeTime ? new Date(f.lastOralIntakeTime).toISOString().slice(0, 16) : ''}
              onChange={(e) => set('lastOralIntakeTime', e.target.value || null)}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">{tr('ملاحظات الصيام', 'NPO notes')}</Label>
            <Input value={f.npoNotes || ''} onChange={(e) => set('npoNotes', e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </Section>

      {/* ═══════ Section 3: Allergies & Medications ═══════ */}
      <Section title={tr('الحساسية والأدوية', 'Allergies & Medications')}>
        <Check label={tr('تم مراجعة الحساسية', 'Allergies reviewed')} checked={!!f.allergiesReviewed} onChange={() => toggle('allergiesReviewed')} />
        <Check label={tr('تم مراجعة الأدوية المنزلية', 'Home medications reviewed')} checked={!!f.homeMediaReviewed} onChange={() => toggle('homeMediaReviewed')} />
      </Section>

      {/* ═══════ Section 4: Pre-Op Vitals ═══════ */}
      <Section title={tr('العلامات الحيوية', 'Pre-Op Vitals')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { key: 'hr', ar: 'النبض', en: 'HR', unit: 'bpm' },
            { key: 'bp', ar: 'ضغط الدم', en: 'BP', unit: 'mmHg' },
            { key: 'rr', ar: 'التنفس', en: 'RR', unit: '/min' },
            { key: 'spo2', ar: 'الأكسجين', en: 'SpO2', unit: '%' },
            { key: 'temp', ar: 'الحرارة', en: 'Temp', unit: '°C' },
            { key: 'pain', ar: 'الألم', en: 'Pain', unit: '/10' },
            { key: 'weight', ar: 'الوزن', en: 'Weight', unit: 'kg' },
            { key: 'height', ar: 'الطول', en: 'Height', unit: 'cm' },
          ].map((v) => (
            <div key={v.key}>
              <Label className="text-[10px] text-muted-foreground">{tr(v.ar, v.en)} ({v.unit})</Label>
              <Input
                value={(f.vitals as Record<string, string> | undefined)?.[v.key] || ''}
                onChange={(e) => set('vitals', { ...(f.vitals || {}), [v.key]: e.target.value })}
                className="h-7 text-xs"
                placeholder={v.unit}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ═══════ Section 5: IV Access ═══════ */}
      <Section title={tr('الوصول الوريدي', 'IV Access')}>
        <Check label={tr('تم تأمين الوريد', 'IV access established')} checked={!!f.ivAccess} onChange={() => toggle('ivAccess')} />
        {f.ivAccess && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{tr('الموقع', 'Site')}</Label>
              <Input value={f.ivSite || ''} onChange={(e) => set('ivSite', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">{tr('القياس', 'Gauge')}</Label>
              <Select value={f.ivGauge || ''} onValueChange={(v) => set('ivGauge', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['14G', '16G', '18G', '20G', '22G', '24G'].map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{tr('المحلول', 'Fluid')}</Label>
              <Input value={f.ivFluid || ''} onChange={(e) => set('ivFluid', e.target.value)} className="h-8 text-xs" placeholder={tr('مثال: NS 0.9%', 'e.g. NS 0.9%')} />
            </div>
          </div>
        )}
      </Section>

      {/* ═══════ Section 6: Skin & Mental Status ═══════ */}
      <Section title={tr('الجلد والحالة الذهنية', 'Skin & Mental Status')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{tr('سلامة الجلد', 'Skin integrity')}</Label>
            <Select value={f.skinIntegrity || ''} onValueChange={(v) => set('skinIntegrity', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {[
                  { v: 'INTACT', ar: 'سليم', en: 'Intact' },
                  { v: 'RASH', ar: 'طفح', en: 'Rash' },
                  { v: 'BRUISING', ar: 'كدمات', en: 'Bruising' },
                  { v: 'WOUND', ar: 'جرح', en: 'Wound' },
                  { v: 'PRESSURE_INJURY', ar: 'إصابة ضغطية', en: 'Pressure Injury' },
                  { v: 'OTHER', ar: 'أخرى', en: 'Other' },
                ].map((o) => (
                  <SelectItem key={o.v} value={o.v}>{tr(o.ar, o.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('الحالة الذهنية', 'Mental status')}</Label>
            <Select value={f.mentalStatus || ''} onValueChange={(v) => set('mentalStatus', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {[
                  { v: 'ALERT', ar: 'واعي', en: 'Alert' },
                  { v: 'ORIENTED', ar: 'موجّه', en: 'Oriented' },
                  { v: 'CONFUSED', ar: 'مشوش', en: 'Confused' },
                  { v: 'SEDATED', ar: 'مُهدَّأ', en: 'Sedated' },
                  { v: 'ANXIOUS', ar: 'قلق', en: 'Anxious' },
                ].map((o) => (
                  <SelectItem key={o.v} value={o.v}>{tr(o.ar, o.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {f.skinIntegrity && f.skinIntegrity !== 'INTACT' && (
          <div>
            <Label className="text-xs">{tr('ملاحظات الجلد', 'Skin notes')}</Label>
            <Input value={f.skinNotes || ''} onChange={(e) => set('skinNotes', e.target.value)} className="h-8 text-xs" />
          </div>
        )}
      </Section>

      {/* ═══════ Section 7: Belongings ═══════ */}
      <Section title={tr('المقتنيات الشخصية', 'Personal Belongings')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          <Check label={tr('تمت إزالة المجوهرات', 'Jewelry removed')} checked={!!f.jewelryRemoved} onChange={() => toggle('jewelryRemoved')} />
          <Check label={tr('تمت إزالة أطقم الأسنان', 'Dentures removed')} checked={!!f.denturesRemoved} onChange={() => toggle('denturesRemoved')} />
          <Check label={tr('تمت إزالة الأطراف الصناعية', 'Prosthetics removed')} checked={!!f.prostheticsRemoved} onChange={() => toggle('prostheticsRemoved')} />
          <Check label={tr('تمت إزالة السماعات', 'Hearing aids removed')} checked={!!f.hearingAidsRemoved} onChange={() => toggle('hearingAidsRemoved')} />
          <Check label={tr('المقتنيات مؤمّنة', 'Belongings secured')} checked={!!f.belongingsSecured} onChange={() => toggle('belongingsSecured')} />
        </div>
      </Section>

      {/* ═══════ Section 8: Consents ═══════ */}
      <Section title={tr('الموافقات', 'Consents')}>
        <Check label={tr('موافقة العملية الجراحية', 'Surgical consent signed')} checked={!!f.surgicalConsentSigned} onChange={() => toggle('surgicalConsentSigned')} />
        <Check label={tr('موافقة التخدير', 'Anesthesia consent signed')} checked={!!f.anesthesiaConsentSigned} onChange={() => toggle('anesthesiaConsentSigned')} />
        <Check label={tr('موافقة نقل الدم', 'Blood consent signed')} checked={!!f.bloodConsentSigned} onChange={() => toggle('bloodConsentSigned')} />
      </Section>

      {/* ═══════ Section 9: Lab & Imaging ═══════ */}
      <Section title={tr('الفحوصات والأشعة', 'Lab & Imaging')}>
        <Check label={tr('تم مراجعة نتائج المختبر', 'Lab results reviewed')} checked={!!f.labResultsReviewed} onChange={() => toggle('labResultsReviewed')} />
        <Check label={tr('تم مراجعة الأشعة', 'Imaging reviewed')} checked={!!f.imagingReviewed} onChange={() => toggle('imagingReviewed')} />
        <Check label={tr('منتجات الدم جاهزة', 'Blood products ready')} checked={!!f.bloodProductsReady} onChange={() => toggle('bloodProductsReady')} />
        <div>
          <Label className="text-xs">{tr('فحص الحمل', 'Pregnancy test')}</Label>
          <Select value={f.pregnancyTestResult || ''} onValueChange={(v) => set('pregnancyTestResult', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="N_A">{tr('لا ينطبق', 'N/A')}</SelectItem>
              <SelectItem value="NEGATIVE">{tr('سلبي', 'Negative')}</SelectItem>
              <SelectItem value="POSITIVE">{tr('إيجابي', 'Positive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* ═══════ Section 10: Surgical Site ═══════ */}
      <Section title={tr('موقع العملية', 'Surgical Site')}>
        <Check label={tr('تم تحديد موقع العملية', 'Surgical site marked')} checked={!!f.surgicalSiteMarked} onChange={() => toggle('surgicalSiteMarked')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{tr('تم التحديد بواسطة', 'Marked by')}</Label>
            <Input value={f.siteMarkedBy || ''} onChange={(e) => set('siteMarkedBy', e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">{tr('الجانب', 'Laterality')}</Label>
            <Select value={f.laterality || ''} onValueChange={(v) => set('laterality', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="N_A">{tr('لا ينطبق', 'N/A')}</SelectItem>
                <SelectItem value="LEFT">{tr('يسار', 'Left')}</SelectItem>
                <SelectItem value="RIGHT">{tr('يمين', 'Right')}</SelectItem>
                <SelectItem value="BILATERAL">{tr('ثنائي', 'Bilateral')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* ═══════ Section 11: Patient Safety ═══════ */}
      <Section title={tr('سلامة المريض', 'Patient Safety')}>
        <Check label={tr('تم تقييم خطر السقوط', 'Fall risk assessed')} checked={!!f.fallRiskAssessed} onChange={() => toggle('fallRiskAssessed')} />
        {f.fallRiskAssessed && (
          <div>
            <Label className="text-xs">{tr('مستوى الخطر', 'Risk level')}</Label>
            <Select value={f.fallRiskLevel || ''} onValueChange={(v) => set('fallRiskLevel', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">{tr('منخفض', 'Low')}</SelectItem>
                <SelectItem value="MODERATE">{tr('متوسط', 'Moderate')}</SelectItem>
                <SelectItem value="HIGH">{tr('عالي', 'High')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Check label={tr('الوقاية من الجلطات', 'DVT prophylaxis')} checked={!!f.dvtProphylaxis} onChange={() => toggle('dvtProphylaxis')} />
        {f.dvtProphylaxis && (
          <div>
            <Label className="text-xs">{tr('طريقة الوقاية', 'DVT method')}</Label>
            <Select value={f.dvtMethod || ''} onValueChange={(v) => set('dvtMethod', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SCD">{tr('ضغط متقطع (SCD)', 'SCD')}</SelectItem>
                <SelectItem value="TED_HOSE">{tr('جوارب ضاغطة', 'TED Hose')}</SelectItem>
                <SelectItem value="PHARMACOLOGICAL">{tr('دوائية', 'Pharmacological')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Check label={tr('تم تثقيف المريض', 'Patient education completed')} checked={!!f.patientEducation} onChange={() => toggle('patientEducation')} />
      </Section>

      {/* ═══════ Notes ═══════ */}
      <div>
        <Label className="text-xs font-semibold">{tr('ملاحظات التمريض', 'Nursing Notes')}</Label>
        <Textarea
          value={f.nursingNotes || ''}
          onChange={(e) => set('nursingNotes', e.target.value)}
          rows={3}
          className="text-xs mt-1"
          placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
        />
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

/* ── Section wrapper ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground border-b pb-1">{title}</h3>
      <div className="space-y-2 pl-1">{children}</div>
    </div>
  );
}
