'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Type definitions ──────────────────────────────────────────────────────────

interface IVFluidEntry {
  fluid: string;
  rate: string;
  duration: string;
}

interface MedEntry {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
}

interface AntibioticEntry {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
}

interface OrPostOpOrdersFormProps {
  caseId: string;
  onSaved?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIT_TO_OPTIONS = [
  { value: 'WARD', ar: 'الجناح', en: 'Ward' },
  { value: 'ICU', ar: 'العناية المركزة', en: 'ICU' },
  { value: 'PACU', ar: 'وحدة الإفاقة', en: 'PACU' },
  { value: 'SAME_DAY', ar: 'جراحة اليوم الواحد', en: 'Same Day Surgery' },
];

const BED_TYPE_OPTIONS = [
  { value: 'STANDARD', ar: 'عادي', en: 'Standard' },
  { value: 'MONITORED', ar: 'مراقب', en: 'Monitored' },
  { value: 'ISOLATION', ar: 'عزل', en: 'Isolation' },
  { value: 'PRIVATE', ar: 'خاص', en: 'Private' },
];

const CONDITION_OPTIONS = [
  { value: 'STABLE', ar: 'مستقر', en: 'Stable' },
  { value: 'GUARDED', ar: 'متحفظ', en: 'Guarded' },
  { value: 'CRITICAL', ar: 'حرج', en: 'Critical' },
];

const VITAL_FREQ_OPTIONS = [
  { value: 'Q15MIN', ar: 'كل 15 دقيقة', en: 'Every 15 min' },
  { value: 'Q30MIN', ar: 'كل 30 دقيقة', en: 'Every 30 min' },
  { value: 'Q1H', ar: 'كل ساعة', en: 'Every 1 hour' },
  { value: 'Q2H', ar: 'كل ساعتين', en: 'Every 2 hours' },
  { value: 'Q4H', ar: 'كل 4 ساعات', en: 'Every 4 hours' },
  { value: 'Q8H', ar: 'كل 8 ساعات', en: 'Every 8 hours' },
];

const ACTIVITY_OPTIONS = [
  { value: 'BED_REST', ar: 'راحة في السرير', en: 'Bed Rest' },
  { value: 'DANGLE', ar: 'تدلي الأقدام من السرير', en: 'Dangle' },
  { value: 'AMBULATE_WITH_ASSIST', ar: 'المشي بمساعدة', en: 'Ambulate with Assist' },
  { value: 'AD_LIB', ar: 'حسب الرغبة', en: 'Ad Lib' },
];

const DIET_OPTIONS = [
  { value: 'NPO', ar: 'ممنوع الأكل والشرب', en: 'NPO (Nothing by Mouth)' },
  { value: 'CLEAR_LIQUIDS', ar: 'سوائل صافية', en: 'Clear Liquids' },
  { value: 'FULL_LIQUIDS', ar: 'سوائل كاملة', en: 'Full Liquids' },
  { value: 'REGULAR', ar: 'غذاء عادي', en: 'Regular' },
  { value: 'CARDIAC', ar: 'حمية قلبية', en: 'Cardiac Diet' },
  { value: 'DIABETIC', ar: 'حمية سكري', en: 'Diabetic Diet' },
];

const DVT_METHOD_OPTIONS = [
  { value: 'SCD', ar: 'أجهزة ضغط متسلسل', en: 'Sequential Compression Devices (SCD)' },
  { value: 'TED_HOSE', ar: 'جوارب ضاغطة', en: 'TED Hose' },
  { value: 'ENOXAPARIN', ar: 'إينوكسابارين', en: 'Enoxaparin (Lovenox)' },
  { value: 'HEPARIN', ar: 'هيبارين', en: 'Heparin SC' },
  { value: 'EARLY_AMBULATION', ar: 'مشي مبكر', en: 'Early Ambulation' },
];

const OXYGEN_OPTIONS = [
  { value: 'NONE', ar: 'لا يوجد', en: 'None' },
  { value: 'NASAL_CANNULA_2L', ar: 'قنية أنفية 2 لتر', en: 'Nasal Cannula 2L' },
  { value: 'NASAL_CANNULA_4L', ar: 'قنية أنفية 4 لتر', en: 'Nasal Cannula 4L' },
  { value: 'FACE_MASK', ar: 'قناع وجه', en: 'Face Mask' },
  { value: 'NON_REBREATHER', ar: 'قناع بدون إعادة تنفس', en: 'Non-Rebreather' },
  { value: 'WEAN_AS_TOLERATED', ar: 'فطم حسب التحمل', en: 'Wean as Tolerated' },
];

const MED_ROUTE_OPTIONS = [
  { value: 'PO', ar: 'فموي', en: 'PO (Oral)' },
  { value: 'IV', ar: 'وريدي', en: 'IV' },
  { value: 'IM', ar: 'عضلي', en: 'IM' },
  { value: 'SC', ar: 'تحت الجلد', en: 'SC' },
  { value: 'PR', ar: 'شرجي', en: 'PR (Rectal)' },
  { value: 'TOPICAL', ar: 'موضعي', en: 'Topical' },
];

const MED_FREQ_OPTIONS = [
  { value: 'ONCE', ar: 'مرة واحدة', en: 'Once' },
  { value: 'PRN', ar: 'عند الحاجة', en: 'PRN (As Needed)' },
  { value: 'Q4H', ar: 'كل 4 ساعات', en: 'Q4H' },
  { value: 'Q6H', ar: 'كل 6 ساعات', en: 'Q6H' },
  { value: 'Q8H', ar: 'كل 8 ساعات', en: 'Q8H' },
  { value: 'Q12H', ar: 'كل 12 ساعة', en: 'Q12H' },
  { value: 'DAILY', ar: 'يومياً', en: 'Daily' },
  { value: 'BID', ar: 'مرتين يومياً', en: 'BID' },
  { value: 'TID', ar: 'ثلاث مرات يومياً', en: 'TID' },
];

// ── Helper: empty row factories ───────────────────────────────────────────────

function emptyIV(): IVFluidEntry { return { fluid: '', rate: '', duration: '' }; }
function emptyMed(): MedEntry { return { drug: '', dose: '', route: '', frequency: '' }; }
function emptyAntibiotic(): AntibioticEntry { return { drug: '', dose: '', route: '', frequency: '', duration: '' }; }

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export default function OrPostOpOrdersForm({ caseId, onSaved }: OrPostOpOrdersFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const { data, mutate, isLoading } = useSWR(
    caseId ? `/api/or/cases/${caseId}/post-op-orders` : null,
    fetcher,
  );

  const existing = data?.postOpOrder ?? null;

  // ── Admission ──────────────────────────────────────────────────────────────
  const [admitTo, setAdmitTo] = useState('');
  const [bedType, setBedType] = useState('');
  const [condition, setCondition] = useState('');

  // ── Vitals ─────────────────────────────────────────────────────────────────
  const [vitalFrequency, setVitalFrequency] = useState('');
  const [neurovascularChecks, setNeurovascularChecks] = useState(false);
  const [neurovascularFreq, setNeurovascularFreq] = useState('');

  // ── Activity ───────────────────────────────────────────────────────────────
  const [activityLevel, setActivityLevel] = useState('');
  const [positionRestrictions, setPositionRestrictions] = useState('');
  const [fallPrecautions, setFallPrecautions] = useState(false);

  // ── Diet ───────────────────────────────────────────────────────────────────
  const [dietType, setDietType] = useState('');
  const [fluidRestriction, setFluidRestriction] = useState('');

  // ── IV Fluids ──────────────────────────────────────────────────────────────
  const [ivFluids, setIvFluids] = useState<IVFluidEntry[]>([emptyIV()]);

  // ── Pain Management ────────────────────────────────────────────────────────
  const [painMeds, setPainMeds] = useState<MedEntry[]>([emptyMed()]);

  // ── Antibiotics ────────────────────────────────────────────────────────────
  const [antibiotics, setAntibiotics] = useState<AntibioticEntry[]>([emptyAntibiotic()]);

  // ── Other Medications ──────────────────────────────────────────────────────
  const [anticoagulation, setAnticoagulation] = useState('');
  const [antiemetics, setAntiemetics] = useState('');
  const [otherMedications, setOtherMedications] = useState('');

  // ── DVT Prophylaxis ────────────────────────────────────────────────────────
  const [dvtProphylaxis, setDvtProphylaxis] = useState(false);
  const [dvtMethod, setDvtMethod] = useState('');

  // ── Respiratory ────────────────────────────────────────────────────────────
  const [oxygenTherapy, setOxygenTherapy] = useState('');
  const [incentiveSpirometry, setIncentiveSpirometry] = useState(false);
  const [coughDeepBreath, setCoughDeepBreath] = useState(false);

  // ── I&O ────────────────────────────────────────────────────────────────────
  const [intakeOutputMonitoring, setIntakeOutputMonitoring] = useState(false);
  const [foleyPresent, setFoleyPresent] = useState(false);
  const [foleyRemovalPlan, setFoleyRemovalPlan] = useState('');

  // ── Wound Care ─────────────────────────────────────────────────────────────
  const [woundCareInstructions, setWoundCareInstructions] = useState('');
  const [drainManagement, setDrainManagement] = useState('');
  const [dressingChanges, setDressingChanges] = useState('');

  // ── Labs & Imaging ─────────────────────────────────────────────────────────
  const [labOrders, setLabOrders] = useState('');
  const [imagingOrders, setImagingOrders] = useState('');

  // ── Call Doctor If ─────────────────────────────────────────────────────────
  const [callDoctorConditions, setCallDoctorConditions] = useState<string[]>(['']);

  // ── Saving state ───────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  // ── Hydrate from existing record ───────────────────────────────────────────
  const hydrateForm = useCallback((record: any) => {
    if (!record) return;
    setAdmitTo(record.admitTo || '');
    setBedType(record.bedType || '');
    setCondition(record.condition || '');
    setVitalFrequency(record.vitalFrequency || '');
    setNeurovascularChecks(record.neurovascularChecks ?? false);
    setNeurovascularFreq(record.neurovascularFreq || '');
    setActivityLevel(record.activityLevel || '');
    setPositionRestrictions(record.positionRestrictions || '');
    setFallPrecautions(record.fallPrecautions ?? false);
    setDietType(record.dietType || '');
    setFluidRestriction(record.fluidRestriction || '');
    setAnticoagulation(record.anticoagulation || '');
    setAntiemetics(record.antiemetics || '');
    setOtherMedications(record.otherMedications || '');
    setDvtProphylaxis(record.dvtProphylaxis ?? false);
    setDvtMethod(record.dvtMethod || '');
    setOxygenTherapy(record.oxygenTherapy || '');
    setIncentiveSpirometry(record.incentiveSpirometry ?? false);
    setCoughDeepBreath(record.coughDeepBreath ?? false);
    setIntakeOutputMonitoring(record.intakeOutputMonitoring ?? false);
    setFoleyPresent(record.foleyPresent ?? false);
    setFoleyRemovalPlan(record.foleyRemovalPlan || '');
    setWoundCareInstructions(record.woundCareInstructions || '');
    setDrainManagement(record.drainManagement || '');
    setDressingChanges(record.dressingChanges || '');
    setLabOrders(record.labOrders || '');
    setImagingOrders(record.imagingOrders || '');

    // Dynamic lists
    if (Array.isArray(record.ivFluids) && record.ivFluids.length > 0) {
      setIvFluids(record.ivFluids);
    }
    if (Array.isArray(record.painManagement) && record.painManagement.length > 0) {
      setPainMeds(record.painManagement);
    }
    if (Array.isArray(record.antibiotics) && record.antibiotics.length > 0) {
      setAntibiotics(record.antibiotics);
    }
    if (Array.isArray(record.callDoctorIf) && record.callDoctorIf.length > 0) {
      setCallDoctorConditions(record.callDoctorIf);
    }
  }, []);

  useEffect(() => {
    if (existing) hydrateForm(existing);
  }, [existing, hydrateForm]);

  // ── Build payload ──────────────────────────────────────────────────────────

  const buildPayload = (statusOverride?: string) => ({
    admitTo: admitTo || null,
    bedType: bedType || null,
    condition: condition || null,
    vitalFrequency: vitalFrequency || null,
    neurovascularChecks,
    neurovascularFreq: neurovascularFreq || null,
    activityLevel: activityLevel || null,
    positionRestrictions: positionRestrictions || null,
    fallPrecautions,
    dietType: dietType || null,
    fluidRestriction: fluidRestriction || null,
    ivFluids: ivFluids.filter((f) => f.fluid.trim()),
    painManagement: painMeds.filter((m) => m.drug.trim()),
    antibiotics: antibiotics.filter((a) => a.drug.trim()),
    anticoagulation: anticoagulation || null,
    antiemetics: antiemetics || null,
    otherMedications: otherMedications || null,
    dvtProphylaxis,
    dvtMethod: dvtMethod || null,
    oxygenTherapy: oxygenTherapy || null,
    incentiveSpirometry,
    coughDeepBreath,
    intakeOutputMonitoring,
    foleyPresent,
    foleyRemovalPlan: foleyRemovalPlan || null,
    woundCareInstructions: woundCareInstructions || null,
    drainManagement: drainManagement || null,
    dressingChanges: dressingChanges || null,
    labOrders: labOrders || null,
    imagingOrders: imagingOrders || null,
    callDoctorIf: callDoctorConditions.filter((c) => c.trim()),
    status: statusOverride ?? 'DRAFT',
  });

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (status: 'DRAFT' | 'ACTIVE') => {
    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/post-op-orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(status)),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Save failed'));

      toast({
        title: status === 'ACTIVE'
          ? tr('تم تفعيل الأوامر', 'Orders Activated')
          : tr('تم حفظ المسودة', 'Draft Saved'),
        description: status === 'ACTIVE'
          ? tr('أوامر ما بعد العملية مفعّلة الآن', 'Post-op orders are now active')
          : tr('يمكنك المتابعة لاحقاً', 'You can continue later'),
      });

      await mutate();
      onSaved?.();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  // ── Dynamic list helpers ───────────────────────────────────────────────────

  const updateIV = (index: number, field: keyof IVFluidEntry, value: string) => {
    setIvFluids((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const updatePainMed = (index: number, field: keyof MedEntry, value: string) => {
    setPainMeds((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const updateAntibiotic = (index: number, field: keyof AntibioticEntry, value: string) => {
    setAntibiotics((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {tr('جارٍ التحميل...', 'Loading...')}
        </CardContent>
      </Card>
    );
  }

  const isActive = existing?.status === 'ACTIVE';

  // ══════════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ── Status banner ────────────────────────────────────────────────── */}
      {existing && (
        <div className={`px-4 py-2 rounded-lg flex items-center justify-between text-sm ${
          isActive
            ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-300'
            : 'bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300'
        }`}>
          <span>
            {isActive
              ? tr('الأوامر مفعّلة', 'Orders Active')
              : tr('مسودة — لم تُفعَّل بعد', 'Draft — Not yet activated')
            }
          </span>
          <Badge variant={isActive ? 'default' : 'secondary'} className={isActive ? 'bg-green-600' : ''}>
            {isActive ? tr('مفعّل', 'ACTIVE') : tr('مسودة', 'DRAFT')}
          </Badge>
        </div>
      )}

      {/* ── Section 1: Admission ─────────────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('القبول', 'Admission')}</CardTitle>
          <CardDescription>{tr('وجهة القبول ونوع السرير وحالة المريض', 'Admission destination, bed type, and patient condition')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('القبول في', 'Admit To')}</Label>
              <Select value={admitTo} onValueChange={setAdmitTo}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر', 'Select')} />
                </SelectTrigger>
                <SelectContent>
                  {ADMIT_TO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('نوع السرير', 'Bed Type')}</Label>
              <Select value={bedType} onValueChange={setBedType}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر', 'Select')} />
                </SelectTrigger>
                <SelectContent>
                  {BED_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('حالة المريض', 'Condition')}</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر', 'Select')} />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Vitals ────────────────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('العلامات الحيوية', 'Vital Signs')}</CardTitle>
          <CardDescription>{tr('تكرار القياسات وفحوصات الأعصاب والأوعية', 'Measurement frequency and neurovascular checks')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('تكرار العلامات الحيوية', 'Vital Frequency')}</Label>
              <Select value={vitalFrequency} onValueChange={setVitalFrequency}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر', 'Select')} />
                </SelectTrigger>
                <SelectContent>
                  {VITAL_FREQ_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('تكرار فحص الأعصاب والأوعية', 'Neurovascular Check Frequency')}</Label>
              <Input
                value={neurovascularFreq}
                onChange={(e) => setNeurovascularFreq(e.target.value)}
                placeholder={tr('مثال: كل ساعة لمدة 24 ساعة', 'e.g. Every 1h for 24h')}
                className="thea-input-focus"
                disabled={!neurovascularChecks}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox checked={neurovascularChecks} onCheckedChange={(v) => setNeurovascularChecks(Boolean(v))} />
            {tr('فحص الأعصاب والأوعية الدموية', 'Neurovascular Checks')}
          </label>
        </CardContent>
      </Card>

      {/* ── Section 3: Activity ──────────────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('النشاط والحركة', 'Activity & Mobility')}</CardTitle>
          <CardDescription>{tr('مستوى النشاط وقيود الوضعية واحتياطات السقوط', 'Activity level, position restrictions, and fall precautions')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('مستوى النشاط', 'Activity Level')}</Label>
              <Select value={activityLevel} onValueChange={setActivityLevel}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر', 'Select')} />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('قيود الوضعية', 'Position Restrictions')}</Label>
              <Input
                value={positionRestrictions}
                onChange={(e) => setPositionRestrictions(e.target.value)}
                placeholder={tr('مثال: رفع الرأس 30 درجة', 'e.g. HOB elevated 30 degrees')}
                className="thea-input-focus"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox checked={fallPrecautions} onCheckedChange={(v) => setFallPrecautions(Boolean(v))} />
            {tr('احتياطات السقوط', 'Fall Precautions')}
          </label>
        </CardContent>
      </Card>

      {/* ── Section 4: Diet ──────────────────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('التغذية', 'Diet')}</CardTitle>
          <CardDescription>{tr('نوع الغذاء وقيود السوائل', 'Diet type and fluid restrictions')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('نوع الغذاء', 'Diet Type')}</Label>
              <Select value={dietType} onValueChange={setDietType}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر', 'Select')} />
                </SelectTrigger>
                <SelectContent>
                  {DIET_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('قيود السوائل', 'Fluid Restriction')}</Label>
              <Input
                value={fluidRestriction}
                onChange={(e) => setFluidRestriction(e.target.value)}
                placeholder={tr('مثال: 1500 مل/يوم', 'e.g. 1500 mL/day')}
                className="thea-input-focus"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: IV Fluids ─────────────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-base">{tr('السوائل الوريدية', 'IV Fluids')}</CardTitle>
              <CardDescription>{tr('محاليل وريدية ومعدلات التسريب', 'Intravenous solutions and infusion rates')}</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIvFluids((prev) => [...prev, emptyIV()])}
            >
              + {tr('إضافة', 'Add')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {ivFluids.map((entry, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 border rounded-lg bg-muted/30">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-foreground text-xs">{tr('السائل', 'Fluid')}</Label>
                <Input
                  value={entry.fluid}
                  onChange={(e) => updateIV(idx, 'fluid', e.target.value)}
                  placeholder={tr('مثال: NaCl 0.9%', 'e.g. NaCl 0.9%')}
                  className="thea-input-focus h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('المعدل', 'Rate')}</Label>
                <Input
                  value={entry.rate}
                  onChange={(e) => updateIV(idx, 'rate', e.target.value)}
                  placeholder={tr('مثال: 125 مل/س', 'e.g. 125 mL/hr')}
                  className="thea-input-focus h-8"
                />
              </div>
              <div className="space-y-1 flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-foreground text-xs">{tr('المدة', 'Duration')}</Label>
                  <Input
                    value={entry.duration}
                    onChange={(e) => updateIV(idx, 'duration', e.target.value)}
                    placeholder={tr('مثال: 8 ساعات', 'e.g. 8 hours')}
                    className="thea-input-focus h-8"
                  />
                </div>
                {ivFluids.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-red-500 hover:text-red-700"
                    onClick={() => setIvFluids((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    x
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Section 6: Pain Management ───────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-base">{tr('إدارة الألم', 'Pain Management')}</CardTitle>
              <CardDescription>{tr('أدوية تسكين الألم والجرعات', 'Analgesic medications and dosing')}</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPainMeds((prev) => [...prev, emptyMed()])}
            >
              + {tr('إضافة', 'Add')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {painMeds.map((entry, idx) => (
            <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 border rounded-lg bg-muted/30">
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('الدواء', 'Drug')}</Label>
                <Input
                  value={entry.drug}
                  onChange={(e) => updatePainMed(idx, 'drug', e.target.value)}
                  placeholder={tr('مثال: باراسيتامول', 'e.g. Paracetamol')}
                  className="thea-input-focus h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('الجرعة', 'Dose')}</Label>
                <Input
                  value={entry.dose}
                  onChange={(e) => updatePainMed(idx, 'dose', e.target.value)}
                  placeholder={tr('مثال: 1 غرام', 'e.g. 1g')}
                  className="thea-input-focus h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('الطريقة', 'Route')}</Label>
                <Select value={entry.route} onValueChange={(v) => updatePainMed(idx, 'route', v)}>
                  <SelectTrigger className="thea-input-focus h-8">
                    <SelectValue placeholder={tr('اختر', 'Select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MED_ROUTE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('التكرار', 'Frequency')}</Label>
                <Select value={entry.frequency} onValueChange={(v) => updatePainMed(idx, 'frequency', v)}>
                  <SelectTrigger className="thea-input-focus h-8">
                    <SelectValue placeholder={tr('اختر', 'Select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MED_FREQ_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                {painMeds.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-red-500 hover:text-red-700"
                    onClick={() => setPainMeds((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    x
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Section 7: Antibiotics ───────────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-base">{tr('المضادات الحيوية', 'Antibiotics')}</CardTitle>
              <CardDescription>{tr('المضادات الحيوية بعد العملية', 'Post-operative antibiotic orders')}</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAntibiotics((prev) => [...prev, emptyAntibiotic()])}
            >
              + {tr('إضافة', 'Add')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {antibiotics.map((entry, idx) => (
            <div key={idx} className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 border rounded-lg bg-muted/30">
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('الدواء', 'Drug')}</Label>
                <Input
                  value={entry.drug}
                  onChange={(e) => updateAntibiotic(idx, 'drug', e.target.value)}
                  placeholder={tr('مثال: سيفازولين', 'e.g. Cefazolin')}
                  className="thea-input-focus h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('الجرعة', 'Dose')}</Label>
                <Input
                  value={entry.dose}
                  onChange={(e) => updateAntibiotic(idx, 'dose', e.target.value)}
                  placeholder={tr('مثال: 1 غرام', 'e.g. 1g')}
                  className="thea-input-focus h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('الطريقة', 'Route')}</Label>
                <Select value={entry.route} onValueChange={(v) => updateAntibiotic(idx, 'route', v)}>
                  <SelectTrigger className="thea-input-focus h-8">
                    <SelectValue placeholder={tr('اختر', 'Select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MED_ROUTE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('التكرار', 'Frequency')}</Label>
                <Select value={entry.frequency} onValueChange={(v) => updateAntibiotic(idx, 'frequency', v)}>
                  <SelectTrigger className="thea-input-focus h-8">
                    <SelectValue placeholder={tr('اختر', 'Select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MED_FREQ_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-foreground text-xs">{tr('المدة', 'Duration')}</Label>
                <Input
                  value={entry.duration}
                  onChange={(e) => updateAntibiotic(idx, 'duration', e.target.value)}
                  placeholder={tr('مثال: 3 أيام', 'e.g. 3 days')}
                  className="thea-input-focus h-8"
                />
              </div>
              <div className="flex items-end">
                {antibiotics.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-red-500 hover:text-red-700"
                    onClick={() => setAntibiotics((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    x
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Section 8: Other Medications ──────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('أدوية أخرى', 'Other Medications')}</CardTitle>
          <CardDescription>{tr('مضادات التخثر ومضادات القيء وأدوية إضافية', 'Anticoagulation, antiemetics, and additional medications')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('مضادات التخثر', 'Anticoagulation')}</Label>
              <Input
                value={anticoagulation}
                onChange={(e) => setAnticoagulation(e.target.value)}
                placeholder={tr('مثال: إينوكسابارين 40 مجم تحت الجلد يومياً', 'e.g. Enoxaparin 40mg SC daily')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('مضادات القيء', 'Antiemetics')}</Label>
              <Input
                value={antiemetics}
                onChange={(e) => setAntiemetics(e.target.value)}
                placeholder={tr('مثال: أوندانسيترون 4 مجم وريدي عند الحاجة', 'e.g. Ondansetron 4mg IV PRN')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('أدوية إضافية', 'Other Medications')}</Label>
              <Input
                value={otherMedications}
                onChange={(e) => setOtherMedications(e.target.value)}
                placeholder={tr('أي أدوية إضافية...', 'Any additional medications...')}
                className="thea-input-focus"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 9: DVT Prophylaxis ───────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('الوقاية من الجلطات الوريدية العميقة', 'DVT Prophylaxis')}</CardTitle>
          <CardDescription>{tr('إجراءات الوقاية من تجلط الأوردة العميقة', 'Deep vein thrombosis prevention measures')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox checked={dvtProphylaxis} onCheckedChange={(v) => setDvtProphylaxis(Boolean(v))} />
            {tr('تفعيل الوقاية من الجلطات', 'Enable DVT Prophylaxis')}
          </label>
          {dvtProphylaxis && (
            <div className="space-y-1">
              <Label className="text-foreground">{tr('طريقة الوقاية', 'Prophylaxis Method')}</Label>
              <Select value={dvtMethod} onValueChange={setDvtMethod}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر الطريقة', 'Select method')} />
                </SelectTrigger>
                <SelectContent>
                  {DVT_METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 10: Respiratory ──────────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('الجهاز التنفسي', 'Respiratory')}</CardTitle>
          <CardDescription>{tr('العلاج بالأكسجين وتمارين التنفس', 'Oxygen therapy and breathing exercises')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-foreground">{tr('العلاج بالأكسجين', 'Oxygen Therapy')}</Label>
            <Select value={oxygenTherapy} onValueChange={setOxygenTherapy}>
              <SelectTrigger className="thea-input-focus">
                <SelectValue placeholder={tr('اختر', 'Select')} />
              </SelectTrigger>
              <SelectContent>
                {OXYGEN_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <Checkbox checked={incentiveSpirometry} onCheckedChange={(v) => setIncentiveSpirometry(Boolean(v))} />
              {tr('جهاز التنفس التحفيزي', 'Incentive Spirometry')}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <Checkbox checked={coughDeepBreath} onCheckedChange={(v) => setCoughDeepBreath(Boolean(v))} />
              {tr('السعال والتنفس العميق', 'Cough & Deep Breathing')}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 11: I&O ──────────────────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('مراقبة السوائل والإخراج', 'Intake & Output')}</CardTitle>
          <CardDescription>{tr('مراقبة كمية السوائل والقسطرة', 'Fluid monitoring and catheter management')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <Checkbox checked={intakeOutputMonitoring} onCheckedChange={(v) => setIntakeOutputMonitoring(Boolean(v))} />
              {tr('مراقبة المدخلات والمخرجات', 'I&O Monitoring')}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <Checkbox checked={foleyPresent} onCheckedChange={(v) => setFoleyPresent(Boolean(v))} />
              {tr('قسطرة فولي موجودة', 'Foley Catheter Present')}
            </label>
          </div>
          {foleyPresent && (
            <div className="space-y-1">
              <Label className="text-foreground">{tr('خطة إزالة القسطرة', 'Foley Removal Plan')}</Label>
              <Input
                value={foleyRemovalPlan}
                onChange={(e) => setFoleyRemovalPlan(e.target.value)}
                placeholder={tr('مثال: إزالة يوم العملية +1', 'e.g. Remove POD#1')}
                className="thea-input-focus"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 12: Wound Care ───────────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('العناية بالجرح', 'Wound Care')}</CardTitle>
          <CardDescription>{tr('تعليمات الجرح والمصارف والضمادات', 'Wound instructions, drain management, and dressing changes')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-foreground">{tr('تعليمات العناية بالجرح', 'Wound Care Instructions')}</Label>
            <Textarea
              value={woundCareInstructions}
              onChange={(e) => setWoundCareInstructions(e.target.value)}
              placeholder={tr('تعليمات محددة للعناية بالجرح...', 'Specific wound care instructions...')}
              rows={2}
              className="thea-input-focus"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('إدارة المصارف', 'Drain Management')}</Label>
              <Input
                value={drainManagement}
                onChange={(e) => setDrainManagement(e.target.value)}
                placeholder={tr('مثال: JP drain — تسجيل المخرجات كل نوبة', 'e.g. JP drain — record output Q shift')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('تغيير الضمادات', 'Dressing Changes')}</Label>
              <Input
                value={dressingChanges}
                onChange={(e) => setDressingChanges(e.target.value)}
                placeholder={tr('مثال: تغيير يوم العملية +2', 'e.g. Change POD#2')}
                className="thea-input-focus"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 13: Labs & Imaging ───────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('الفحوصات والتصوير', 'Labs & Imaging')}</CardTitle>
          <CardDescription>{tr('طلبات المختبر والأشعة بعد العملية', 'Post-operative laboratory and imaging orders')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('طلبات المختبر', 'Lab Orders')}</Label>
              <Textarea
                value={labOrders}
                onChange={(e) => setLabOrders(e.target.value)}
                placeholder={tr('مثال: CBC, BMP صباحاً', 'e.g. CBC, BMP in AM')}
                rows={2}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('طلبات التصوير', 'Imaging Orders')}</Label>
              <Textarea
                value={imagingOrders}
                onChange={(e) => setImagingOrders(e.target.value)}
                placeholder={tr('مثال: أشعة صدر بعد العملية', 'e.g. Post-op CXR')}
                rows={2}
                className="thea-input-focus"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 14: Call Doctor If ───────────────────────────────────── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-base">{tr('اتصل بالطبيب إذا', 'Call Doctor If')}</CardTitle>
              <CardDescription>{tr('حالات تنبيه لإبلاغ الطبيب', 'Alert conditions to notify physician')}</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCallDoctorConditions((prev) => [...prev, ''])}
            >
              + {tr('إضافة', 'Add')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {callDoctorConditions.map((cond, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                value={cond}
                onChange={(e) => {
                  const updated = [...callDoctorConditions];
                  updated[idx] = e.target.value;
                  setCallDoctorConditions(updated);
                }}
                placeholder={tr(
                  `مثال: ${idx === 0 ? 'الحرارة > 38.5°' : idx === 1 ? 'ضغط الدم الانقباضي < 90' : 'نزيف زائد'}`,
                  `e.g. ${idx === 0 ? 'Temp > 38.5C' : idx === 1 ? 'SBP < 90' : 'Excessive bleeding'}`
                )}
                className="thea-input-focus"
              />
              {callDoctorConditions.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-red-500 hover:text-red-700 shrink-0"
                  onClick={() => setCallDoctorConditions((prev) => prev.filter((_, i) => i !== idx))}
                >
                  x
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Action Buttons ────────────────────────────────────────────────── */}
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={() => handleSubmit('DRAFT')} disabled={saving}>
          {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ كمسودة', 'Save Draft')}
        </Button>
        <Button onClick={() => handleSubmit('ACTIVE')} disabled={saving}>
          {saving ? tr('جارٍ التفعيل...', 'Activating...') : tr('تفعيل الأوامر', 'Activate Orders')}
        </Button>
      </div>
    </div>
  );
}
