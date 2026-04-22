'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';

type EncounterData = {
  id: string;
  patient?: { fullName?: string; mrn?: string; tempMrn?: string };
  status: string;
  triageLevel?: number | null;
  chiefComplaint?: string | null;
  respiratoryDecision?: 'ISOLATE' | 'PRECAUTIONS' | 'NO' | null;
};

export default function ERTriage() {
  const params = useParams();
  const router = useRouter();
  const encounterId = String(params.encounterId || '');
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/er/triage');

  const [encounter, setEncounter] = useState<EncounterData | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [onset, setOnset] = useState('');
  const [painScore, setPainScore] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronic, setChronic] = useState('');
  const [previousSurgeries, setPreviousSurgeries] = useState('');
  const [historyNotes, setHistoryNotes] = useState('');
  const [vitals, setVitals] = useState({
    BP: '',
    HR: '',
    RR: '',
    TEMP: '',
    SPO2: '',
    systolic: '',
    diastolic: '',
  });
  const [triageLevel, setTriageLevel] = useState<number | null>(null);
  const [critical, setCritical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!encounterId) return;
    let active = true;
    async function load() {
      const res = await fetch(`/api/er/encounters/${encounterId}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (!active) return;
      setEncounter(data.encounter);
      setChiefComplaint(data.encounter?.chiefComplaint || '');
      setTriageLevel(data.encounter?.triageLevel ?? null);
      if (data.encounter?.triage) {
        const t = data.encounter.triage;
        setPainScore(t.painScore?.toString() || '');
        setAllergies(t.allergiesShort || '');
        setChronic(t.chronicShort || '');
        setOnset(t.onset || '');
        setPreviousSurgeries(t.previousSurgeries || '');
        setHistoryNotes(t.historyNotes || '');
        const systolicValue = t.vitals?.systolic?.toString() || '';
        const diastolicValue = t.vitals?.diastolic?.toString() || '';
        const bpValue =
          t.vitals?.BP ||
          (systolicValue && diastolicValue ? `${systolicValue}/${diastolicValue}` : '');
        setVitals({
          BP: bpValue,
          HR: t.vitals?.HR?.toString() || '',
          RR: t.vitals?.RR?.toString() || '',
          TEMP: t.vitals?.TEMP?.toString() || '',
          SPO2: t.vitals?.SPO2?.toString() || '',
          systolic: systolicValue,
          diastolic: diastolicValue,
        });
        setCritical(Boolean(t.critical));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [encounterId]);

  const parseBloodPressure = (value: string) => {
    const cleaned = value.replace(/\s+/g, '');
    const match = /^(\d{2,3})\/(\d{2,3})$/.exec(cleaned);
    if (!match) {
      return { systolic: '', diastolic: '' };
    }
    return { systolic: match[1], diastolic: match[2] };
  };

  const triggerSave = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/er/triage/save', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            encounterId,
            chiefComplaint,
            onset,
            painScore: painScore ? Number(painScore) : null,
            allergiesShort: allergies,
            chronicShort: chronic,
            previousSurgeries,
            historyNotes,
            vitals: {
              BP: vitals.BP || null,
              HR: vitals.HR ? Number(vitals.HR) : null,
              RR: vitals.RR ? Number(vitals.RR) : null,
              TEMP: vitals.TEMP ? Number(vitals.TEMP) : null,
              SPO2: vitals.SPO2 ? Number(vitals.SPO2) : null,
              systolic: vitals.systolic ? Number(vitals.systolic) : null,
              diastolic: vitals.diastolic ? Number(vitals.diastolic) : null,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        setTriageLevel(data.triageLevel ?? null);
        setCritical(Boolean(data.critical));
      } catch (err: any) {
        setSaveError(err.message || 'Save failed');
      } finally {
        setSaving(false);
      }
    }, 500);
  };

  const finishTriage = async () => {
    setFinishing(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/er/triage/complete', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId,
          chiefComplaint,
          onset,
          painScore: painScore ? Number(painScore) : null,
          allergiesShort: allergies,
          chronicShort: chronic,
            previousSurgeries,
            historyNotes,
          vitals: {
            BP: vitals.BP || null,
            HR: vitals.HR ? Number(vitals.HR) : null,
            RR: vitals.RR ? Number(vitals.RR) : null,
            TEMP: vitals.TEMP ? Number(vitals.TEMP) : null,
            SPO2: vitals.SPO2 ? Number(vitals.SPO2) : null,
            systolic: vitals.systolic ? Number(vitals.systolic) : null,
            diastolic: vitals.diastolic ? Number(vitals.diastolic) : null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.missing?.length
            ? `${data.error || 'Finish failed'}: ${data.missing.join(', ')}`
            : (data.error || 'Finish failed');
        throw new Error(msg);
      }
      setTriageLevel(data.triageLevel ?? null);
      setCritical(Boolean(data.critical));
      router.push('/er/board');
    } catch (err: any) {
      setSaveError(err?.message || 'Finish failed');
    } finally {
      setFinishing(false);
    }
  };

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{tr('فرز الطوارئ', 'ER Triage')}</h1>
            <p className="text-sm text-muted-foreground">{tr('تقييم فرز مباشر مع تحديد المستوى تلقائياً.', 'Live triage assessment with auto-level.')}</p>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => router.push('/er/board')}>
            {tr('العودة للوحة', 'Back to Board')}
          </Button>
        </div>

        {critical && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            {tr('تم اكتشاف علامات حيوية حرجة. قم بالتصعيد فوراً.', 'Critical vitals detected. Escalate immediately.')}
          </div>
        )}
        {encounter?.respiratoryDecision && encounter.respiratoryDecision !== 'NO' && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-4 text-amber-800">
            {tr('احتياطات تنفسية:', 'Respiratory precautions:')} {encounter.respiratoryDecision === 'ISOLATE' ? tr('عزل', 'ISOLATE') : tr('احتياطات', 'PRECAUTIONS')}
          </div>
        )}

        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{tr('المريض', 'Patient')}</p>
              <p className="font-semibold">{encounter?.patient?.fullName || tr('غير معروف', 'Unknown')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tr('رقم الملف', 'MRN')}</p>
              <p className="font-semibold">{encounter?.patient?.mrn || encounter?.patient?.tempMrn || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tr('مستوى الفرز', 'Triage Level')}</p>
              <p className="font-semibold text-destructive">{triageLevel ?? '--'}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('التقييم', 'Assessment')}</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشكوى الرئيسية', 'Chief Complaint')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={chiefComplaint}
                  onChange={(e) => {
                    setChiefComplaint(e.target.value);
                    triggerSave();
                  }}
                  placeholder={tr('شكوى مختصرة', 'Short complaint')}
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('وقت البداية', 'Onset Time')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={onset}
                  onChange={(e) => {
                    setOnset(e.target.value);
                    triggerSave();
                  }}
                  placeholder={tr('مثال: قبل ساعتين', 'e.g. 2 hours ago')}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('درجة الألم', 'Pain Score')}</span>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={painScore}
                    onChange={(e) => {
                      setPainScore(e.target.value);
                      triggerSave();
                    }}
                    placeholder={tr('٠-١٠', '0-10')}
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحساسية', 'Allergies')}</span>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={allergies}
                    onChange={(e) => {
                      setAllergies(e.target.value);
                      triggerSave();
                    }}
                    placeholder={tr('مختصر', 'Short')}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأمراض المزمنة', 'Chronic Conditions')}</span>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={chronic}
                    onChange={(e) => {
                      setChronic(e.target.value);
                      triggerSave();
                    }}
                    placeholder={tr('مختصر', 'Short')}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العمليات السابقة (التاريخ)', 'Previous Surgeries (History)')}</span>
                  <Textarea
                    className="rounded-xl thea-input-focus"
                    value={previousSurgeries}
                    onChange={(e) => {
                      setPreviousSurgeries(e.target.value);
                      triggerSave();
                    }}
                    placeholder={tr('اختياري', 'Optional')}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات التاريخ المرضي', 'History Notes')}</span>
                  <Textarea
                    className="rounded-xl thea-input-focus"
                    value={historyNotes}
                    onChange={(e) => {
                      setHistoryNotes(e.target.value);
                      triggerSave();
                    }}
                    placeholder={tr('نص اختياري', 'Optional free text')}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('العلامات الحيوية', 'Vitals')}</h2>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {['BP', 'HR', 'RR', 'TEMP', 'SPO2'].map((key) => (
                  <div key={key} className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{key}</span>
                    <Input
                      className="rounded-xl thea-input-focus"
                      value={vitals[key as keyof typeof vitals]}
                      onChange={(e) => {
                        if (key === 'BP') {
                          const next = e.target.value;
                          const parsed = parseBloodPressure(next);
                          setVitals((prev) => ({
                            ...prev,
                            BP: next,
                            systolic: parsed.systolic,
                            diastolic: parsed.diastolic,
                          }));
                        } else {
                          setVitals((prev) => ({ ...prev, [key]: e.target.value }));
                        }
                        triggerSave();
                      }}
                      placeholder={key}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {saving ? tr('جاري الحفظ...', 'Saving...') : saveError ? `${tr('خطأ في الحفظ', 'Save error')}: ${saveError}` : tr('تم الحفظ مباشرة', 'Live saved')}
                </div>
                <Button className="rounded-xl" onClick={finishTriage} disabled={finishing}>
                  {finishing ? tr('جاري الإنهاء...', 'Finishing...') : tr('إنهاء الفرز', 'Finish Triage')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
