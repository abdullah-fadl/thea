'use client';

import { useState, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RHYTHM_OPTIONS = [
  { value: 'VF', ar: 'رجفان بطيني (VF)', en: 'Ventricular Fibrillation (VF)' },
  { value: 'VT', ar: 'تسرع بطيني (VT)', en: 'Ventricular Tachycardia (VT)' },
  { value: 'PEA', ar: 'نشاط كهربائي بلا نبض (PEA)', en: 'Pulseless Electrical Activity (PEA)' },
  { value: 'ASYSTOLE', ar: 'توقف القلب (Asystole)', en: 'Asystole' },
  { value: 'BRADYCARDIA', ar: 'بطء القلب', en: 'Bradycardia' },
  { value: 'TACHYCARDIA', ar: 'تسرع القلب', en: 'Tachycardia' },
];

const EVENT_ACTION_TYPES = [
  { value: 'CPR_START', ar: 'بدء الإنعاش', en: 'CPR Start' },
  { value: 'CPR_PAUSE', ar: 'إيقاف الإنعاش', en: 'CPR Pause' },
  { value: 'DEFIBRILLATION', ar: 'صدمة كهربائية', en: 'Defibrillation' },
  { value: 'MEDICATION', ar: 'دواء', en: 'Medication' },
  { value: 'RHYTHM_CHECK', ar: 'فحص الإيقاع', en: 'Rhythm Check' },
  { value: 'IV_ACCESS', ar: 'وصول وريدي', en: 'IV Access' },
  { value: 'INTUBATION', ar: 'تنبيب', en: 'Intubation' },
  { value: 'ROSC', ar: 'عودة الدورة الدموية', en: 'ROSC' },
  { value: 'OTHER', ar: 'أخرى', en: 'Other' },
];

const ACLS_DRUGS = [
  { value: 'Epinephrine', ar: 'إبينفرين', en: 'Epinephrine' },
  { value: 'Amiodarone', ar: 'أميودارون', en: 'Amiodarone' },
  { value: 'Lidocaine', ar: 'ليدوكائين', en: 'Lidocaine' },
  { value: 'Atropine', ar: 'أتروبين', en: 'Atropine' },
  { value: 'Vasopressin', ar: 'فاسوبريسين', en: 'Vasopressin' },
  { value: 'Sodium Bicarbonate', ar: 'بيكربونات الصوديوم', en: 'Sodium Bicarbonate' },
  { value: 'Calcium Chloride', ar: 'كلوريد الكالسيوم', en: 'Calcium Chloride' },
  { value: 'Magnesium', ar: 'مغنيسيوم', en: 'Magnesium' },
];

const ROUTE_OPTIONS = [
  { value: 'IV', ar: 'وريدي (IV)', en: 'IV' },
  { value: 'IO', ar: 'عظمي (IO)', en: 'IO' },
];

const AIRWAY_TYPES = [
  { value: 'BVM', ar: 'كيس وقناع (BVM)', en: 'Bag-Valve-Mask (BVM)' },
  { value: 'LMA', ar: 'قناع حنجري (LMA)', en: 'Laryngeal Mask Airway (LMA)' },
  { value: 'ETT', ar: 'أنبوب رغامي (ETT)', en: 'Endotracheal Tube (ETT)' },
  { value: 'SURGICAL', ar: 'مجرى هوائي جراحي', en: 'Surgical Airway' },
];

const OUTCOME_OPTIONS = [
  { value: 'ROSC', ar: 'عودة الدورة الدموية (ROSC)', en: 'Return of Spontaneous Circulation (ROSC)' },
  { value: 'DEATH', ar: 'وفاة', en: 'Death' },
  { value: 'ONGOING', ar: 'مستمر', en: 'Ongoing' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineEvent {
  id: string;
  timestamp: string;
  actionType: string;
  detail: string;
  performedBy: string;
}

interface Defibrillation {
  id: string;
  time: string;
  joules: number;
  rhythmBefore: string;
  rhythmAfter: string;
}

interface MedEntry {
  id: string;
  time: string;
  drug: string;
  dose: string;
  route: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IcuCodeBlueFormProps {
  codeBlueId?: string;
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function nowISO() {
  const d = new Date();
  return d.toISOString().slice(0, 16);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IcuCodeBlueForm({ codeBlueId, initialData, onSuccess, onCancel }: IcuCodeBlueFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const isEdit = !!codeBlueId;

  // --- Header state ---
  const [location, setLocation] = useState(initialData?.location || '');
  const [initialRhythm, setInitialRhythm] = useState(initialData?.initialRhythm || '');
  const [codeCalledAt] = useState(initialData?.codeCalledAt ? new Date(initialData.codeCalledAt).toISOString().slice(0, 16) : nowISO());

  // --- Team state ---
  const [teamLeader, setTeamLeader] = useState(initialData?.teamLeader || '');
  const [cprProvider1, setCprProvider1] = useState(initialData?.cprProvider1 || '');
  const [cprProvider2, setCprProvider2] = useState(initialData?.cprProvider2 || '');
  const [airwayManager, setAirwayManager] = useState(initialData?.airwayManager || '');
  const [medicationNurse, setMedicationNurse] = useState(initialData?.medicationNurse || '');
  const [recorder, setRecorder] = useState(initialData?.recorder || '');

  // --- Timeline events ---
  const [events, setEvents] = useState<TimelineEvent[]>(() => {
    try {
      const raw = initialData?.timelineEvents;
      return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    } catch { return []; }
  });

  // --- Defibrillations ---
  const [defibrillations, setDefibrillations] = useState<Defibrillation[]>(() => {
    try {
      const raw = initialData?.defibrillations;
      return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    } catch { return []; }
  });

  // --- Medications ---
  const [medications, setMedications] = useState<MedEntry[]>(() => {
    try {
      const raw = initialData?.medications;
      return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    } catch { return []; }
  });

  // --- Airway ---
  const [airwayType, setAirwayType] = useState(initialData?.airwayType || '');
  const [intubationTime, setIntubationTime] = useState(initialData?.intubationTime || '');
  const [intubatedBy, setIntubatedBy] = useState(initialData?.intubatedBy || '');

  // --- Outcome ---
  const [outcome, setOutcome] = useState(initialData?.outcome || '');
  const [roscTime, setRoscTime] = useState(initialData?.roscTime || '');
  const [timeOfDeath, setTimeOfDeath] = useState(initialData?.timeOfDeath || '');
  const [postRoscPlan, setPostRoscPlan] = useState(initialData?.postRoscPlan || '');

  // --- Family ---
  const [familyNotified, setFamilyNotified] = useState(initialData?.familyNotified || false);
  const [familyNotifiedAt, setFamilyNotifiedAt] = useState(initialData?.familyNotifiedAt || '');
  const [familyNotifiedBy, setFamilyNotifiedBy] = useState(initialData?.familyNotifiedBy || '');

  // --- Debrief ---
  const [debriefDone, setDebriefDone] = useState(initialData?.debriefDone || false);
  const [debriefNotes, setDebriefNotes] = useState(initialData?.debriefNotes || '');

  const [saving, setSaving] = useState(false);

  // ---- New event form state ----
  const [newEventAction, setNewEventAction] = useState('');
  const [newEventDetail, setNewEventDetail] = useState('');
  const [newEventBy, setNewEventBy] = useState('');

  // ---- New defibrillation form state ----
  const [newDefibJoules, setNewDefibJoules] = useState('');
  const [newDefibRhythmBefore, setNewDefibRhythmBefore] = useState('');
  const [newDefibRhythmAfter, setNewDefibRhythmAfter] = useState('');

  // ---- New medication form state ----
  const [newMedDrug, setNewMedDrug] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedRoute, setNewMedRoute] = useState('IV');

  // --- Add event ---
  const addEvent = () => {
    if (!newEventAction) return;
    setEvents((prev) => [
      ...prev,
      {
        id: uid(),
        timestamp: new Date().toISOString(),
        actionType: newEventAction,
        detail: newEventDetail,
        performedBy: newEventBy,
      },
    ]);
    setNewEventAction('');
    setNewEventDetail('');
    setNewEventBy('');
  };

  // --- Add defibrillation ---
  const addDefibrillation = () => {
    if (!newDefibJoules) return;
    setDefibrillations((prev) => [
      ...prev,
      {
        id: uid(),
        time: new Date().toISOString(),
        joules: Number(newDefibJoules),
        rhythmBefore: newDefibRhythmBefore,
        rhythmAfter: newDefibRhythmAfter,
      },
    ]);
    setNewDefibJoules('');
    setNewDefibRhythmBefore('');
    setNewDefibRhythmAfter('');
  };

  // --- Add medication ---
  const addMedication = () => {
    if (!newMedDrug || !newMedDose) return;
    setMedications((prev) => [
      ...prev,
      {
        id: uid(),
        time: new Date().toISOString(),
        drug: newMedDrug,
        dose: newMedDose,
        route: newMedRoute,
      },
    ]);
    setNewMedDrug('');
    setNewMedDose('');
    setNewMedRoute('IV');
  };

  // --- Save ---
  const handleSave = async (complete: boolean) => {
    if (!location) {
      toast({ title: tr('خطأ', 'Error'), description: tr('الموقع مطلوب', 'Location is required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        location,
        initialRhythm,
        teamLeader,
        cprProvider1,
        cprProvider2,
        airwayManager,
        medicationNurse,
        recorder,
        timelineEvents: events,
        defibrillations,
        medications,
        airwayType: airwayType || null,
        intubationTime: intubationTime || null,
        intubatedBy: intubatedBy || null,
        outcome: outcome || null,
        roscTime: roscTime || null,
        timeOfDeath: timeOfDeath || null,
        postRoscPlan: postRoscPlan || null,
        familyNotified,
        familyNotifiedAt: familyNotifiedAt || null,
        familyNotifiedBy: familyNotifiedBy || null,
        debriefDone,
        debriefNotes: debriefNotes || null,
        status: complete ? 'COMPLETED' : 'ACTIVE',
      };

      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/icu/code-blue/${codeBlueId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/icu/code-blue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }

      toast({
        title: tr('تم الحفظ', 'Saved'),
        description: complete
          ? tr('تم إكمال توثيق الإنعاش', 'Code blue documentation completed')
          : tr('تم حفظ التقدم', 'Progress saved'),
      });
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err.message || tr('فشل الحفظ', 'Save failed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const actionLabel = (val: string) => {
    const found = EVENT_ACTION_TYPES.find((t) => t.value === val);
    return found ? tr(found.ar, found.en) : val;
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-6">
      {/* ========== HEADER SECTION ========== */}
      <section className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-lg">{tr('معلومات الإنعاش', 'Code Blue Information')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>{tr('وقت الإعلان', 'Code called at')}</Label>
            <Input type="datetime-local" value={codeCalledAt} disabled className="mt-1" />
          </div>
          <div>
            <Label>{tr('الموقع', 'Location')}</Label>
            <Input
              placeholder={tr('مثال: العناية المركزة - سرير 5', 'e.g. ICU - Bed 5')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>{tr('الإيقاع الأولي', 'Initial rhythm')}</Label>
            <Select value={initialRhythm} onValueChange={setInitialRhythm}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={tr('اختر الإيقاع', 'Select rhythm')} />
              </SelectTrigger>
              <SelectContent>
                {RHYTHM_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {tr(r.ar, r.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* ========== TEAM SECTION ========== */}
      <section className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-lg">{tr('فريق الإنعاش', 'Code Team')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>{tr('قائد الفريق', 'Team leader')}</Label>
            <Input value={teamLeader} onChange={(e) => setTeamLeader(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{tr('مقدم الإنعاش 1', 'CPR Provider 1')}</Label>
            <Input value={cprProvider1} onChange={(e) => setCprProvider1(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{tr('مقدم الإنعاش 2', 'CPR Provider 2')}</Label>
            <Input value={cprProvider2} onChange={(e) => setCprProvider2(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{tr('مسؤول المجرى الهوائي', 'Airway manager')}</Label>
            <Input value={airwayManager} onChange={(e) => setAirwayManager(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{tr('ممرض/ة الأدوية', 'Medication nurse')}</Label>
            <Input value={medicationNurse} onChange={(e) => setMedicationNurse(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{tr('المسجّل', 'Recorder')}</Label>
            <Input value={recorder} onChange={(e) => setRecorder(e.target.value)} className="mt-1" />
          </div>
        </div>
      </section>

      {/* ========== LIVE TIMELINE ========== */}
      <section className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-lg">{tr('الجدول الزمني', 'Live Timeline')}</h3>

        {/* Existing events */}
        {events.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {[...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-sm p-2 bg-background rounded border">
                <Badge variant="outline" className="text-xs shrink-0">{formatTime(ev.timestamp)}</Badge>
                <Badge variant="secondary" className="shrink-0">{actionLabel(ev.actionType)}</Badge>
                <span className="truncate">{ev.detail}</span>
                {ev.performedBy && (
                  <span className="text-muted-foreground text-xs shrink-0">— {ev.performedBy}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add event form */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-xs">{tr('نوع الإجراء', 'Action type')}</Label>
            <Select value={newEventAction} onValueChange={setNewEventAction}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={tr('اختر', 'Select')} />
              </SelectTrigger>
              <SelectContent>
                {EVENT_ACTION_TYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {tr(a.ar, a.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('التفاصيل', 'Detail')}</Label>
            <Input value={newEventDetail} onChange={(e) => setNewEventDetail(e.target.value)} className="mt-1" placeholder={tr('تفاصيل إضافية', 'Additional detail')} />
          </div>
          <div>
            <Label className="text-xs">{tr('نفّذ بواسطة', 'Performed by')}</Label>
            <Input value={newEventBy} onChange={(e) => setNewEventBy(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={addEvent} disabled={!newEventAction} size="sm">
            {tr('إضافة حدث', 'Add Event')}
          </Button>
        </div>
      </section>

      {/* ========== DEFIBRILLATION SECTION ========== */}
      <section className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-lg">{tr('الصدمات الكهربائية', 'Defibrillation')}</h3>

        {defibrillations.length > 0 && (
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {defibrillations.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm p-2 bg-background rounded border">
                <Badge variant="outline" className="text-xs">{formatTime(d.time)}</Badge>
                <span className="font-medium">{d.joules}J</span>
                <span className="text-muted-foreground">
                  {tr('قبل', 'Before')}: {d.rhythmBefore || '—'} | {tr('بعد', 'After')}: {d.rhythmAfter || '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-xs">{tr('جول', 'Joules')}</Label>
            <Input type="number" value={newDefibJoules} onChange={(e) => setNewDefibJoules(e.target.value)} className="mt-1" placeholder="200" />
          </div>
          <div>
            <Label className="text-xs">{tr('الإيقاع قبل', 'Rhythm before')}</Label>
            <Input value={newDefibRhythmBefore} onChange={(e) => setNewDefibRhythmBefore(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{tr('الإيقاع بعد', 'Rhythm after')}</Label>
            <Input value={newDefibRhythmAfter} onChange={(e) => setNewDefibRhythmAfter(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={addDefibrillation} disabled={!newDefibJoules} size="sm">
            {tr('إضافة صدمة', 'Add Shock')}
          </Button>
        </div>
      </section>

      {/* ========== MEDICATION SECTION ========== */}
      <section className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-lg">{tr('الأدوية', 'Medications')}</h3>

        {medications.length > 0 && (
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {medications.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm p-2 bg-background rounded border">
                <Badge variant="outline" className="text-xs">{formatTime(m.time)}</Badge>
                <span className="font-medium">{m.drug}</span>
                <span>{m.dose}</span>
                <Badge variant="secondary">{m.route}</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-xs">{tr('الدواء', 'Drug')}</Label>
            <Select value={newMedDrug} onValueChange={setNewMedDrug}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={tr('اختر الدواء', 'Select drug')} />
              </SelectTrigger>
              <SelectContent>
                {ACLS_DRUGS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {tr(d.ar, d.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('الجرعة', 'Dose')}</Label>
            <Input value={newMedDose} onChange={(e) => setNewMedDose(e.target.value)} className="mt-1" placeholder={tr('مثال: 1mg', 'e.g. 1mg')} />
          </div>
          <div>
            <Label className="text-xs">{tr('الطريق', 'Route')}</Label>
            <Select value={newMedRoute} onValueChange={setNewMedRoute}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUTE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {tr(r.ar, r.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addMedication} disabled={!newMedDrug || !newMedDose} size="sm">
            {tr('إضافة دواء', 'Add Med')}
          </Button>
        </div>
      </section>

      {/* ========== AIRWAY SECTION ========== */}
      <section className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-lg">{tr('إدارة المجرى الهوائي', 'Airway Management')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>{tr('نوع المجرى الهوائي', 'Airway type')}</Label>
            <Select value={airwayType} onValueChange={setAirwayType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={tr('اختر النوع', 'Select type')} />
              </SelectTrigger>
              <SelectContent>
                {AIRWAY_TYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {tr(a.ar, a.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tr('وقت التنبيب', 'Intubation time')}</Label>
            <Input type="datetime-local" value={intubationTime} onChange={(e) => setIntubationTime(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{tr('تنبيب بواسطة', 'Intubated by')}</Label>
            <Input value={intubatedBy} onChange={(e) => setIntubatedBy(e.target.value)} className="mt-1" />
          </div>
        </div>
      </section>

      {/* ========== OUTCOME SECTION ========== */}
      <section className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-lg">{tr('النتيجة', 'Outcome')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>{tr('النتيجة', 'Outcome')}</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={tr('اختر النتيجة', 'Select outcome')} />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {tr(o.ar, o.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {outcome === 'ROSC' && (
            <div>
              <Label>{tr('وقت ROSC', 'ROSC time')}</Label>
              <Input type="datetime-local" value={roscTime} onChange={(e) => setRoscTime(e.target.value)} className="mt-1" />
            </div>
          )}
          {outcome === 'DEATH' && (
            <div>
              <Label>{tr('وقت الوفاة', 'Time of death')}</Label>
              <Input type="datetime-local" value={timeOfDeath} onChange={(e) => setTimeOfDeath(e.target.value)} className="mt-1" />
            </div>
          )}
        </div>
        {outcome === 'ROSC' && (
          <div>
            <Label>{tr('خطة ما بعد ROSC', 'Post-ROSC plan')}</Label>
            <Textarea
              value={postRoscPlan}
              onChange={(e) => setPostRoscPlan(e.target.value)}
              className="mt-1"
              rows={3}
              placeholder={tr('خطة الرعاية بعد عودة الدورة الدموية...', 'Post-ROSC care plan...')}
            />
          </div>
        )}
      </section>

      {/* ========== FAMILY NOTIFICATION ========== */}
      <section className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-lg">{tr('إبلاغ العائلة', 'Family Notification')}</h3>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={familyNotified}
            onCheckedChange={(v) => setFamilyNotified(!!v)}
          />
          <Label>{tr('تم إبلاغ العائلة', 'Family notified')}</Label>
        </div>
        {familyNotified && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{tr('وقت الإبلاغ', 'Notification time')}</Label>
              <Input type="datetime-local" value={familyNotifiedAt} onChange={(e) => setFamilyNotifiedAt(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{tr('أبلغ بواسطة', 'Notified by')}</Label>
              <Input value={familyNotifiedBy} onChange={(e) => setFamilyNotifiedBy(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}
      </section>

      {/* ========== DEBRIEF ========== */}
      <section className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-lg">{tr('جلسة المراجعة', 'Debrief')}</h3>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={debriefDone}
            onCheckedChange={(v) => setDebriefDone(!!v)}
          />
          <Label>{tr('تمت جلسة المراجعة', 'Debrief completed')}</Label>
        </div>
        {debriefDone && (
          <div>
            <Label>{tr('ملاحظات المراجعة', 'Debrief notes')}</Label>
            <Textarea
              value={debriefNotes}
              onChange={(e) => setDebriefNotes(e.target.value)}
              className="mt-1"
              rows={3}
              placeholder={tr('ملاحظات جلسة المراجعة...', 'Debrief session notes...')}
            />
          </div>
        )}
      </section>

      {/* ========== ACTION BUTTONS ========== */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {tr('إلغاء', 'Cancel')}
          </Button>
        )}
        <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التقدم', 'Save Progress')}
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving}>
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إكمال التوثيق', 'Complete Documentation')}
        </Button>
      </div>
    </div>
  );
}
