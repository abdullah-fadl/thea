'use client';

import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import useSWR from 'swr';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ShieldAlert,
  AlertTriangle,
  Shield,
  HeartPulse,
  Plus,
  Eye,
  ClipboardCheck,
  Users,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface RiskAssessment {
  id: string;
  patientMasterId: string;
  assessedByName?: string;
  assessedAt: string;
  assessmentType: string;
  suicideIdeation?: boolean;
  ideationType?: string;
  ideationIntensity?: number;
  suicideBehavior?: boolean;
  behaviorType?: string;
  nonSuicidalSelfInjury?: boolean;
  phq9Score?: number;
  phq9Item9?: number;
  brosetConfusion?: boolean;
  brosetIrritability?: boolean;
  brosetBoisterousness?: boolean;
  brosetVerbalThreats?: boolean;
  brosetPhysicalThreats?: boolean;
  brosetAttackObjects?: boolean;
  brosetScore?: number;
  staticFactors?: { factor: string; present: boolean }[];
  dynamicFactors?: { factor: string; present: boolean }[];
  protectiveFactors?: { factor: string; present: boolean }[];
  suicideRiskLevel?: string;
  violenceRiskLevel?: string;
  overallRiskLevel?: string;
  safetyPlanCreated: boolean;
  safetyPlan?: {
    warningSigns?: string;
    copingStrategies?: string;
    reasonsToLive?: string;
    contactPeople?: string;
    professionals?: string;
    safeEnvironment?: string;
  };
  interventions?: { type: string; detail: string }[];
  dispositionPlan?: string;
  supervisionLevel?: string;
  environmentalSafety?: boolean;
  reassessmentDue?: string;
  notes?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */
const STATIC_FACTORS = [
  { key: 'prior_attempt', ar: 'محاولة سابقة', en: 'Prior Suicide Attempt' },
  { key: 'family_history', ar: 'تاريخ عائلي', en: 'Family History of Suicide' },
  { key: 'chronic_illness', ar: 'مرض مزمن', en: 'Chronic Medical Illness' },
  { key: 'childhood_abuse', ar: 'إساءة في الطفولة', en: 'Childhood Abuse/Trauma' },
  { key: 'hx_violence', ar: 'تاريخ عنف', en: 'History of Violence' },
  { key: 'incarceration', ar: 'سجن سابق', en: 'History of Incarceration' },
];

const DYNAMIC_FACTORS = [
  { key: 'current_intoxication', ar: 'تسمم حالي', en: 'Current Intoxication' },
  { key: 'recent_loss', ar: 'فقدان حديث', en: 'Recent Loss/Bereavement' },
  { key: 'hopelessness', ar: 'يأس', en: 'Hopelessness' },
  { key: 'agitation', ar: 'هياج', en: 'Agitation/Restlessness' },
  { key: 'insomnia', ar: 'أرق', en: 'Insomnia' },
  { key: 'command_hallucinations', ar: 'هلاوس أمرية', en: 'Command Hallucinations' },
  { key: 'non_adherence', ar: 'عدم الالتزام بالعلاج', en: 'Medication Non-adherence' },
];

const PROTECTIVE_FACTORS = [
  { key: 'social_support', ar: 'دعم اجتماعي', en: 'Social Support' },
  { key: 'children', ar: 'مسؤولية تجاه أطفال', en: 'Responsibility for Children' },
  { key: 'religious_beliefs', ar: 'معتقدات دينية', en: 'Religious/Spiritual Beliefs' },
  { key: 'future_plans', ar: 'خطط مستقبلية', en: 'Future-oriented Plans' },
  { key: 'engaged_treatment', ar: 'ملتزم بالعلاج', en: 'Engaged in Treatment' },
  { key: 'problem_solving', ar: 'مهارات حل المشكلات', en: 'Problem-solving Skills' },
];

/* ================================================================== */
/*  PsychRiskAssessment — Main Component                               */
/* ================================================================== */
export default function PsychRiskAssessment() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // ---------- State ----------
  const [riskTab, setRiskTab] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);

  // New assessment form — multi-step (sections a-i)
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    patientMasterId: '',
    assessmentType: 'COMBINED',
    // C-SSRS
    suicideIdeation: false,
    ideationType: '',
    ideationIntensity: 0,
    suicideBehavior: false,
    behaviorType: '',
    nonSuicidalSelfInjury: false,
    // PHQ-9
    phq9Item9: 0,
    // Broset
    brosetConfusion: false,
    brosetIrritability: false,
    brosetBoisterousness: false,
    brosetVerbalThreats: false,
    brosetPhysicalThreats: false,
    brosetAttackObjects: false,
    // Factors
    staticFactors: {} as Record<string, boolean>,
    dynamicFactors: {} as Record<string, boolean>,
    protectiveFactors: {} as Record<string, boolean>,
    // Risk levels
    overallRiskLevel: '',
    suicideRiskLevel: '',
    violenceRiskLevel: '',
    // Safety plan
    safetyPlanCreated: false,
    warningSigns: '',
    copingStrategies: '',
    reasonsToLive: '',
    contactPeople: '',
    professionals: '',
    safeEnvironment: '',
    // Supervision
    supervisionLevel: 'ROUTINE',
    // Interventions
    dispositionPlan: '',
    notes: '',
  });

  // ---------- Data ----------
  const params = new URLSearchParams();
  if (riskTab !== 'ALL') params.set('overallRiskLevel', riskTab);
  if (typeFilter !== 'ALL') params.set('assessmentType', typeFilter);
  const queryString = params.toString() ? `?${params.toString()}` : '';

  const { data, mutate } = useSWR(`/api/psychiatry/risk-assessment${queryString}`, fetcher, { refreshInterval: 15000 });
  const assessments: RiskAssessment[] = data?.assessments ?? [];

  const filtered = assessments.filter(
    (a) =>
      !search ||
      a.patientMasterId.toLowerCase().includes(search.toLowerCase()) ||
      (a.assessedByName || '').toLowerCase().includes(search.toLowerCase()),
  );

  // ---------- KPIs ----------
  const total = assessments.length;
  const highCritical = assessments.filter((a) => a.overallRiskLevel === 'HIGH' || a.overallRiskLevel === 'CRITICAL').length;
  const moderate = assessments.filter((a) => a.overallRiskLevel === 'MODERATE').length;
  const safetyPlans = assessments.filter((a) => a.safetyPlanCreated).length;

  // ---------- Helpers ----------
  const riskColor = (level?: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'MODERATE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'CRITICAL': case 'IMMINENT': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-muted text-foreground';
    }
  };

  const riskLabel = (level?: string) => {
    switch (level) {
      case 'LOW': return tr('منخفض', 'Low');
      case 'MODERATE': return tr('متوسط', 'Moderate');
      case 'HIGH': return tr('مرتفع', 'High');
      case 'CRITICAL': return tr('حرج', 'Critical');
      case 'IMMINENT': return tr('وشيك', 'Imminent');
      default: return level || '—';
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'SUICIDE': return tr('انتحار', 'Suicide');
      case 'VIOLENCE': return tr('عنف', 'Violence');
      case 'COMBINED': return tr('مشترك', 'Combined');
      default: return type;
    }
  };

  const getBrosetScore = () => {
    return (
      (form.brosetConfusion ? 1 : 0) +
      (form.brosetIrritability ? 1 : 0) +
      (form.brosetBoisterousness ? 1 : 0) +
      (form.brosetVerbalThreats ? 1 : 0) +
      (form.brosetPhysicalThreats ? 1 : 0) +
      (form.brosetAttackObjects ? 1 : 0)
    );
  };

  const suggestRiskLevel = (): string => {
    const bScore = getBrosetScore();
    const hasIdeation = form.suicideIdeation;
    const hasBehavior = form.suicideBehavior;
    const phq9 = form.phq9Item9;

    if (hasBehavior || form.ideationType === 'ACTIVE_WITH_PLAN' || bScore >= 4) return 'CRITICAL';
    if (form.ideationType === 'ACTIVE_WITH_INTENT' || form.ideationType === 'ACTIVE_WITH_METHOD' || bScore >= 3 || phq9 >= 3) return 'HIGH';
    if (hasIdeation || bScore >= 1 || phq9 >= 2) return 'MODERATE';
    return 'LOW';
  };

  // ---------- Actions ----------
  const resetForm = () => {
    setForm({
      patientMasterId: '', assessmentType: 'COMBINED',
      suicideIdeation: false, ideationType: '', ideationIntensity: 0,
      suicideBehavior: false, behaviorType: '', nonSuicidalSelfInjury: false,
      phq9Item9: 0,
      brosetConfusion: false, brosetIrritability: false, brosetBoisterousness: false,
      brosetVerbalThreats: false, brosetPhysicalThreats: false, brosetAttackObjects: false,
      staticFactors: {}, dynamicFactors: {}, protectiveFactors: {},
      overallRiskLevel: '', suicideRiskLevel: '', violenceRiskLevel: '',
      safetyPlanCreated: false, warningSigns: '', copingStrategies: '', reasonsToLive: '',
      contactPeople: '', professionals: '', safeEnvironment: '',
      supervisionLevel: 'ROUTINE', dispositionPlan: '', notes: '',
    });
    setStep(0);
  };

  const handleCreate = async () => {
    try {
      const safetyPlan = form.safetyPlanCreated
        ? {
            warningSigns: form.warningSigns,
            copingStrategies: form.copingStrategies,
            reasonsToLive: form.reasonsToLive,
            contactPeople: form.contactPeople,
            professionals: form.professionals,
            safeEnvironment: form.safeEnvironment,
          }
        : null;

      const payload = {
        patientMasterId: form.patientMasterId,
        assessmentType: form.assessmentType,
        suicideIdeation: form.suicideIdeation,
        ideationType: form.ideationType || null,
        ideationIntensity: form.ideationIntensity || null,
        suicideBehavior: form.suicideBehavior,
        behaviorType: form.behaviorType || null,
        nonSuicidalSelfInjury: form.nonSuicidalSelfInjury,
        phq9Item9: form.phq9Item9,
        brosetConfusion: form.brosetConfusion,
        brosetIrritability: form.brosetIrritability,
        brosetBoisterousness: form.brosetBoisterousness,
        brosetVerbalThreats: form.brosetVerbalThreats,
        brosetPhysicalThreats: form.brosetPhysicalThreats,
        brosetAttackObjects: form.brosetAttackObjects,
        staticFactors: STATIC_FACTORS.map((f) => ({ factor: f.key, present: !!form.staticFactors[f.key] })),
        dynamicFactors: DYNAMIC_FACTORS.map((f) => ({ factor: f.key, present: !!form.dynamicFactors[f.key] })),
        protectiveFactors: PROTECTIVE_FACTORS.map((f) => ({ factor: f.key, present: !!form.protectiveFactors[f.key] })),
        overallRiskLevel: form.overallRiskLevel || suggestRiskLevel(),
        suicideRiskLevel: form.suicideRiskLevel || null,
        violenceRiskLevel: form.violenceRiskLevel || null,
        safetyPlanCreated: form.safetyPlanCreated,
        safetyPlan,
        supervisionLevel: form.supervisionLevel,
        dispositionPlan: form.dispositionPlan || null,
        notes: form.notes || null,
      };

      const res = await fetch('/api/psychiatry/risk-assessment', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم إنشاء تقييم المخاطر', 'Risk assessment created') });
      setShowNewDialog(false);
      resetForm();
      mutate();
    } catch {
      toast({ title: tr('فشل في الإنشاء', 'Failed to create'), variant: 'destructive' });
    }
  };

  const STEPS = [
    tr('المعلومات الأساسية', 'Basic Info'),
    tr('مقياس كولومبيا', 'C-SSRS'),
    tr('PHQ-9 / بروسيت', 'PHQ-9 / Broset'),
    tr('عوامل الخطر', 'Risk Factors'),
    tr('مستوى الخطر', 'Risk Level'),
    tr('خطة السلامة', 'Safety Plan'),
    tr('الإشراف والخطة', 'Supervision & Plan'),
  ];

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {tr('تقييم خطر الانتحار / العنف', 'Suicide / Violence Risk Assessment')}
        </h1>
        <Button onClick={() => { resetForm(); setShowNewDialog(true); }} size="sm">
          <Plus className="h-4 w-4 me-1" />
          {tr('تقييم جديد', 'New Assessment')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ClipboardCheck className="h-3.5 w-3.5" />
              {tr('إجمالي التقييمات', 'Total Assessments')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tr('خطر مرتفع / حرج', 'High / Critical')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {highCritical}
              {highCritical > 0 && <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse ms-2" />}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1 text-yellow-600">
              <ShieldAlert className="h-3.5 w-3.5" />
              {tr('خطر متوسط', 'Moderate Risk')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{moderate}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-blue-500" />
              {tr('خطط سلامة', 'Safety Plans')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">{safetyPlans}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Tabs value={riskTab} onValueChange={setRiskTab}>
          <TabsList>
            <TabsTrigger value="ALL">{tr('الكل', 'All')}</TabsTrigger>
            <TabsTrigger value="LOW">{tr('منخفض', 'Low')}</TabsTrigger>
            <TabsTrigger value="MODERATE">{tr('متوسط', 'Moderate')}</TabsTrigger>
            <TabsTrigger value="HIGH">{tr('مرتفع', 'High')}</TabsTrigger>
            <TabsTrigger value="CRITICAL">{tr('حرج', 'Critical')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tr('نوع التقييم', 'Assessment Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('جميع الأنواع', 'All Types')}</SelectItem>
            <SelectItem value="SUICIDE">{tr('انتحار', 'Suicide')}</SelectItem>
            <SelectItem value="VIOLENCE">{tr('عنف', 'Violence')}</SelectItem>
            <SelectItem value="COMBINED">{tr('مشترك', 'Combined')}</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder={tr('بحث...', 'Search...')} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-start font-medium">{tr('المريض', 'Patient')}</th>
              <th className="p-3 text-start font-medium">{tr('التاريخ', 'Date')}</th>
              <th className="p-3 text-start font-medium">{tr('النوع', 'Type')}</th>
              <th className="p-3 text-start font-medium">{tr('خطر الانتحار', 'Suicide Risk')}</th>
              <th className="p-3 text-start font-medium">{tr('خطر العنف', 'Violence Risk')}</th>
              <th className="p-3 text-start font-medium">{tr('المستوى العام', 'Overall')}</th>
              <th className="p-3 text-start font-medium">{tr('بروسيت', 'Broset')}</th>
              <th className="p-3 text-start font-medium">{tr('خطة سلامة', 'Safety Plan')}</th>
              <th className="p-3 text-start font-medium">{tr('إشراف', 'Supervision')}</th>
              <th className="p-3 text-start font-medium">{tr('المقيّم', 'Assessed By')}</th>
              <th className="p-3 text-start font-medium">{tr('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">{tr('لا توجد تقييمات', 'No assessments found')}</td></tr>
            ) : filtered.map((a) => (
              <tr
                key={a.id}
                className={`border-t hover:bg-muted/30 ${a.overallRiskLevel === 'CRITICAL' ? 'bg-red-50 dark:bg-red-950/20' : a.overallRiskLevel === 'HIGH' ? 'bg-orange-50 dark:bg-orange-950/10' : ''}`}
              >
                <td className="p-3 font-mono text-xs">{a.patientMasterId.slice(0, 8)}...</td>
                <td className="p-3 text-xs">{new Date(a.assessedAt).toLocaleDateString()}</td>
                <td className="p-3 text-xs">{typeLabel(a.assessmentType)}</td>
                <td className="p-3">
                  {a.suicideRiskLevel ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColor(a.suicideRiskLevel)}`}>
                      {riskLabel(a.suicideRiskLevel)}
                    </span>
                  ) : '—'}
                </td>
                <td className="p-3">
                  {a.violenceRiskLevel ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColor(a.violenceRiskLevel)}`}>
                      {riskLabel(a.violenceRiskLevel)}
                    </span>
                  ) : '—'}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColor(a.overallRiskLevel)}`}>
                    {riskLabel(a.overallRiskLevel)}
                    {a.overallRiskLevel === 'CRITICAL' && <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse ms-1" />}
                  </span>
                </td>
                <td className="p-3 text-xs font-medium">{a.brosetScore ?? '—'}</td>
                <td className="p-3">
                  {a.safetyPlanCreated ? (
                    <Badge variant="outline" className="text-green-700 border-green-300 text-xs">{tr('نعم', 'Yes')}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border text-xs">{tr('لا', 'No')}</Badge>
                  )}
                </td>
                <td className="p-3 text-xs">{a.supervisionLevel?.replace(/_/g, ' ') || '—'}</td>
                <td className="p-3 text-xs">{a.assessedByName || '—'}</td>
                <td className="p-3">
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0"
                    onClick={() => { setSelectedAssessment(a); setShowDetailDialog(true); }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* New Assessment Dialog — Multi-step                            */}
      {/* ============================================================ */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {tr('تقييم مخاطر جديد', 'New Risk Assessment')} — {STEPS[step]} ({step + 1}/{STEPS.length})
            </DialogTitle>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex gap-1 mb-2">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          <div className="space-y-4 min-h-[200px]">
            {/* Step 0: Basic Info */}
            {step === 0 && (
              <>
                <div>
                  <Label>{tr('معرف المريض', 'Patient ID')}</Label>
                  <Input value={form.patientMasterId} onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))} placeholder={tr('أدخل معرف المريض', 'Enter patient ID')} />
                </div>
                <div>
                  <Label>{tr('نوع التقييم', 'Assessment Type')}</Label>
                  <Select value={form.assessmentType} onValueChange={(v) => setForm((f) => ({ ...f, assessmentType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUICIDE">{tr('انتحار', 'Suicide')}</SelectItem>
                      <SelectItem value="VIOLENCE">{tr('عنف', 'Violence')}</SelectItem>
                      <SelectItem value="COMBINED">{tr('مشترك', 'Combined')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Step 1: C-SSRS */}
            {step === 1 && (
              <>
                <h3 className="font-semibold text-sm">{tr('مقياس كولومبيا لشدة الانتحار (C-SSRS)', 'Columbia Suicide Severity Rating Scale (C-SSRS)')}</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.suicideIdeation} onCheckedChange={(v) => setForm((f) => ({ ...f, suicideIdeation: !!v }))} />
                    {tr('أفكار انتحارية', 'Suicide Ideation')}
                  </label>
                  {form.suicideIdeation && (
                    <>
                      <div>
                        <Label>{tr('نوع التفكير', 'Ideation Type')}</Label>
                        <Select value={form.ideationType} onValueChange={(v) => setForm((f) => ({ ...f, ideationType: v }))}>
                          <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WISH_TO_DIE">{tr('رغبة في الموت', 'Wish to Die')}</SelectItem>
                            <SelectItem value="NONSPECIFIC_THOUGHTS">{tr('أفكار غير محددة', 'Non-specific Thoughts')}</SelectItem>
                            <SelectItem value="ACTIVE_WITH_METHOD">{tr('نشط مع طريقة', 'Active with Method')}</SelectItem>
                            <SelectItem value="ACTIVE_WITH_INTENT">{tr('نشط مع نية', 'Active with Intent')}</SelectItem>
                            <SelectItem value="ACTIVE_WITH_PLAN">{tr('نشط مع خطة', 'Active with Plan')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{tr('شدة التفكير (1-5)', 'Ideation Intensity (1-5)')}</Label>
                        <Select value={String(form.ideationIntensity)} onValueChange={(v) => setForm((f) => ({ ...f, ideationIntensity: Number(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.suicideBehavior} onCheckedChange={(v) => setForm((f) => ({ ...f, suicideBehavior: !!v }))} />
                    {tr('سلوك انتحاري', 'Suicide Behavior')}
                  </label>
                  {form.suicideBehavior && (
                    <div>
                      <Label>{tr('نوع السلوك', 'Behavior Type')}</Label>
                      <Select value={form.behaviorType} onValueChange={(v) => setForm((f) => ({ ...f, behaviorType: v }))}>
                        <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PREPARATORY">{tr('تحضيري', 'Preparatory')}</SelectItem>
                          <SelectItem value="ABORTED">{tr('أُوقف', 'Aborted')}</SelectItem>
                          <SelectItem value="INTERRUPTED">{tr('أُقطع', 'Interrupted')}</SelectItem>
                          <SelectItem value="ACTUAL_ATTEMPT">{tr('محاولة فعلية', 'Actual Attempt')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.nonSuicidalSelfInjury} onCheckedChange={(v) => setForm((f) => ({ ...f, nonSuicidalSelfInjury: !!v }))} />
                    {tr('إيذاء ذاتي غير انتحاري', 'Non-suicidal Self-injury')}
                  </label>
                </div>
              </>
            )}

            {/* Step 2: PHQ-9 Item 9 + Broset */}
            {step === 2 && (
              <>
                <div>
                  <h3 className="font-semibold text-sm mb-2">{tr('PHQ-9 البند 9 (إيذاء النفس)', 'PHQ-9 Item 9 (Self-harm)')}</h3>
                  <Label>{tr('درجة البند 9 (0-3)', 'Item 9 Score (0-3)')}</Label>
                  <Select value={String(form.phq9Item9)} onValueChange={(v) => setForm((f) => ({ ...f, phq9Item9: Number(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 — {tr('أبداً', 'Not at all')}</SelectItem>
                      <SelectItem value="1">1 — {tr('عدة أيام', 'Several days')}</SelectItem>
                      <SelectItem value="2">2 — {tr('أكثر من نصف الأيام', 'More than half the days')}</SelectItem>
                      <SelectItem value="3">3 — {tr('تقريباً كل يوم', 'Nearly every day')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-t pt-3">
                  <h3 className="font-semibold text-sm mb-2">
                    {tr('قائمة بروسيت للعنف', 'Broset Violence Checklist')}
                    <span className="ms-2 text-muted-foreground">({tr('المجموع', 'Score')}: {getBrosetScore()}/6)</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'brosetConfusion', ar: 'ارتباك', en: 'Confusion' },
                      { key: 'brosetIrritability', ar: 'عصبية', en: 'Irritability' },
                      { key: 'brosetBoisterousness', ar: 'صخب', en: 'Boisterousness' },
                      { key: 'brosetVerbalThreats', ar: 'تهديدات لفظية', en: 'Verbal Threats' },
                      { key: 'brosetPhysicalThreats', ar: 'تهديدات جسدية', en: 'Physical Threats' },
                      { key: 'brosetAttackObjects', ar: 'هجوم على الأشياء', en: 'Attacks on Objects' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form[item.key as keyof typeof form] as boolean}
                          onCheckedChange={(v) => setForm((f) => ({ ...f, [item.key]: !!v }))}
                        />
                        {tr(item.ar, item.en)}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Risk Factors */}
            {step === 3 && (
              <>
                <div>
                  <h3 className="font-semibold text-sm mb-2">{tr('عوامل خطر ثابتة', 'Static Risk Factors')}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {STATIC_FACTORS.map((f) => (
                      <label key={f.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={!!form.staticFactors[f.key]}
                          onCheckedChange={(v) => setForm((prev) => ({
                            ...prev,
                            staticFactors: { ...prev.staticFactors, [f.key]: !!v },
                          }))}
                        />
                        {tr(f.ar, f.en)}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2">{tr('عوامل خطر ديناميكية', 'Dynamic Risk Factors')}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {DYNAMIC_FACTORS.map((f) => (
                      <label key={f.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={!!form.dynamicFactors[f.key]}
                          onCheckedChange={(v) => setForm((prev) => ({
                            ...prev,
                            dynamicFactors: { ...prev.dynamicFactors, [f.key]: !!v },
                          }))}
                        />
                        {tr(f.ar, f.en)}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2">{tr('عوامل الحماية', 'Protective Factors')}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {PROTECTIVE_FACTORS.map((f) => (
                      <label key={f.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={!!form.protectiveFactors[f.key]}
                          onCheckedChange={(v) => setForm((prev) => ({
                            ...prev,
                            protectiveFactors: { ...prev.protectiveFactors, [f.key]: !!v },
                          }))}
                        />
                        {tr(f.ar, f.en)}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Risk Level */}
            {step === 4 && (
              <>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-1">{tr('المستوى المقترح بناءً على النتائج', 'Suggested level based on scores')}:</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${riskColor(suggestRiskLevel())}`}>
                    {riskLabel(suggestRiskLevel())}
                  </span>
                </div>
                <div>
                  <Label>{tr('مستوى خطر الانتحار', 'Suicide Risk Level')}</Label>
                  <Select value={form.suicideRiskLevel} onValueChange={(v) => setForm((f) => ({ ...f, suicideRiskLevel: v }))}>
                    <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">{tr('منخفض', 'Low')}</SelectItem>
                      <SelectItem value="MODERATE">{tr('متوسط', 'Moderate')}</SelectItem>
                      <SelectItem value="HIGH">{tr('مرتفع', 'High')}</SelectItem>
                      <SelectItem value="IMMINENT">{tr('وشيك', 'Imminent')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tr('مستوى خطر العنف', 'Violence Risk Level')}</Label>
                  <Select value={form.violenceRiskLevel} onValueChange={(v) => setForm((f) => ({ ...f, violenceRiskLevel: v }))}>
                    <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">{tr('منخفض', 'Low')}</SelectItem>
                      <SelectItem value="MODERATE">{tr('متوسط', 'Moderate')}</SelectItem>
                      <SelectItem value="HIGH">{tr('مرتفع', 'High')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tr('المستوى العام للخطر', 'Overall Risk Level')}</Label>
                  <Select value={form.overallRiskLevel || suggestRiskLevel()} onValueChange={(v) => setForm((f) => ({ ...f, overallRiskLevel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">{tr('منخفض', 'Low')}</SelectItem>
                      <SelectItem value="MODERATE">{tr('متوسط', 'Moderate')}</SelectItem>
                      <SelectItem value="HIGH">{tr('مرتفع', 'High')}</SelectItem>
                      <SelectItem value="CRITICAL">{tr('حرج', 'Critical')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Step 5: Safety Plan */}
            {step === 5 && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox checked={form.safetyPlanCreated} onCheckedChange={(v) => setForm((f) => ({ ...f, safetyPlanCreated: !!v }))} />
                  {tr('إنشاء خطة سلامة', 'Create Safety Plan')}
                </label>
                {form.safetyPlanCreated && (
                  <div className="space-y-3">
                    <div>
                      <Label>{tr('علامات التحذير', 'Warning Signs')}</Label>
                      <Textarea value={form.warningSigns} onChange={(e) => setForm((f) => ({ ...f, warningSigns: e.target.value }))} placeholder={tr('ما العلامات التي تنذر بالأزمة؟', 'What signs indicate a crisis is developing?')} rows={2} />
                    </div>
                    <div>
                      <Label>{tr('استراتيجيات التأقلم', 'Coping Strategies')}</Label>
                      <Textarea value={form.copingStrategies} onChange={(e) => setForm((f) => ({ ...f, copingStrategies: e.target.value }))} placeholder={tr('ما الذي يمكنك فعله بنفسك؟', 'What can you do on your own?')} rows={2} />
                    </div>
                    <div>
                      <Label>{tr('أسباب الحياة', 'Reasons to Live')}</Label>
                      <Textarea value={form.reasonsToLive} onChange={(e) => setForm((f) => ({ ...f, reasonsToLive: e.target.value }))} rows={2} />
                    </div>
                    <div>
                      <Label>{tr('أشخاص للاتصال', 'Contact People')}</Label>
                      <Textarea value={form.contactPeople} onChange={(e) => setForm((f) => ({ ...f, contactPeople: e.target.value }))} placeholder={tr('الأسرة والأصدقاء', 'Family and friends')} rows={2} />
                    </div>
                    <div>
                      <Label>{tr('مختصون', 'Professionals')}</Label>
                      <Textarea value={form.professionals} onChange={(e) => setForm((f) => ({ ...f, professionals: e.target.value }))} placeholder={tr('معالجين ومقدمي رعاية', 'Therapists and care providers')} rows={2} />
                    </div>
                    <div>
                      <Label>{tr('بيئة آمنة', 'Safe Environment')}</Label>
                      <Textarea value={form.safeEnvironment} onChange={(e) => setForm((f) => ({ ...f, safeEnvironment: e.target.value }))} placeholder={tr('كيفية جعل البيئة آمنة', 'How to make the environment safe')} rows={2} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 6: Supervision & Plan */}
            {step === 6 && (
              <>
                <div>
                  <Label>{tr('مستوى الإشراف', 'Supervision Level')}</Label>
                  <Select value={form.supervisionLevel} onValueChange={(v) => setForm((f) => ({ ...f, supervisionLevel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONSTANT">{tr('مراقبة مستمرة', 'Constant Observation')}</SelectItem>
                      <SelectItem value="Q15MIN">{tr('كل 15 دقيقة', 'Every 15 Minutes')}</SelectItem>
                      <SelectItem value="Q30MIN">{tr('كل 30 دقيقة', 'Every 30 Minutes')}</SelectItem>
                      <SelectItem value="Q1H">{tr('كل ساعة', 'Every 1 Hour')}</SelectItem>
                      <SelectItem value="ROUTINE">{tr('روتيني', 'Routine')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tr('خطة التصرف', 'Disposition Plan')}</Label>
                  <Textarea value={form.dispositionPlan} onChange={(e) => setForm((f) => ({ ...f, dispositionPlan: e.target.value }))} placeholder={tr('خطة التصرف والتدخلات', 'Disposition and intervention plan')} rows={3} />
                </div>
                <div>
                  <Label>{tr('ملاحظات', 'Notes')}</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>{tr('إلغاء', 'Cancel')}</Button>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>{tr('السابق', 'Previous')}</Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !form.patientMasterId}>
                {tr('التالي', 'Next')}
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={!form.patientMasterId}>
                {tr('إنشاء التقييم', 'Create Assessment')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Detail Dialog                                                 */}
      {/* ============================================================ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('تفاصيل تقييم المخاطر', 'Risk Assessment Details')}</DialogTitle>
          </DialogHeader>
          {selectedAssessment && (
            <div className="space-y-4 text-sm">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{tr('المريض', 'Patient')}:</span> <span className="font-mono">{selectedAssessment.patientMasterId.slice(0, 12)}</span></div>
                <div><span className="text-muted-foreground">{tr('التاريخ', 'Date')}:</span> {new Date(selectedAssessment.assessedAt).toLocaleString()}</div>
                <div><span className="text-muted-foreground">{tr('النوع', 'Type')}:</span> {typeLabel(selectedAssessment.assessmentType)}</div>
                <div><span className="text-muted-foreground">{tr('المقيّم', 'Assessed By')}:</span> {selectedAssessment.assessedByName || '—'}</div>
              </div>

              {/* Risk Levels */}
              <div className="flex gap-3 flex-wrap">
                {selectedAssessment.suicideRiskLevel && (
                  <div className="border rounded-lg p-2">
                    <span className="text-xs text-muted-foreground">{tr('خطر الانتحار', 'Suicide Risk')}</span>
                    <div className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium inline-block ${riskColor(selectedAssessment.suicideRiskLevel)}`}>
                      {riskLabel(selectedAssessment.suicideRiskLevel)}
                    </div>
                  </div>
                )}
                {selectedAssessment.violenceRiskLevel && (
                  <div className="border rounded-lg p-2">
                    <span className="text-xs text-muted-foreground">{tr('خطر العنف', 'Violence Risk')}</span>
                    <div className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium inline-block ${riskColor(selectedAssessment.violenceRiskLevel)}`}>
                      {riskLabel(selectedAssessment.violenceRiskLevel)}
                    </div>
                  </div>
                )}
                <div className="border rounded-lg p-2">
                  <span className="text-xs text-muted-foreground">{tr('المستوى العام', 'Overall')}</span>
                  <div className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium inline-block ${riskColor(selectedAssessment.overallRiskLevel)}`}>
                    {riskLabel(selectedAssessment.overallRiskLevel)}
                  </div>
                </div>
                {selectedAssessment.brosetScore != null && (
                  <div className="border rounded-lg p-2">
                    <span className="text-xs text-muted-foreground">{tr('بروسيت', 'Broset')}</span>
                    <div className="mt-1 text-lg font-bold">{selectedAssessment.brosetScore}/6</div>
                  </div>
                )}
              </div>

              {/* C-SSRS */}
              {selectedAssessment.suicideIdeation && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold text-sm mb-1">{tr('مقياس كولومبيا', 'C-SSRS')}</h4>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>{tr('تفكير انتحاري', 'Ideation')}: {selectedAssessment.ideationType?.replace(/_/g, ' ') || tr('نعم', 'Yes')}</span>
                    {selectedAssessment.ideationIntensity && <span>{tr('الشدة', 'Intensity')}: {selectedAssessment.ideationIntensity}/5</span>}
                    {selectedAssessment.suicideBehavior && <span>{tr('سلوك', 'Behavior')}: {selectedAssessment.behaviorType?.replace(/_/g, ' ')}</span>}
                    {selectedAssessment.nonSuicidalSelfInjury && <span>{tr('إيذاء ذاتي', 'NSSI')}: {tr('نعم', 'Yes')}</span>}
                  </div>
                </div>
              )}

              {/* Factors */}
              {selectedAssessment.staticFactors && selectedAssessment.staticFactors.some((f) => f.present) && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">{tr('عوامل خطر ثابتة', 'Static Risk Factors')}</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedAssessment.staticFactors.filter((f) => f.present).map((f, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{f.factor.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedAssessment.protectiveFactors && selectedAssessment.protectiveFactors.some((f) => f.present) && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">{tr('عوامل الحماية', 'Protective Factors')}</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedAssessment.protectiveFactors.filter((f) => f.present).map((f, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs text-green-700 border-green-300">{f.factor.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Safety Plan */}
              {selectedAssessment.safetyPlanCreated && selectedAssessment.safetyPlan && (
                <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                    <Shield className="h-4 w-4 text-blue-600" />
                    {tr('خطة السلامة', 'Safety Plan')}
                  </h4>
                  <div className="space-y-1 text-xs">
                    {selectedAssessment.safetyPlan.warningSigns && <p><strong>{tr('علامات التحذير', 'Warning Signs')}:</strong> {selectedAssessment.safetyPlan.warningSigns}</p>}
                    {selectedAssessment.safetyPlan.copingStrategies && <p><strong>{tr('استراتيجيات التأقلم', 'Coping')}:</strong> {selectedAssessment.safetyPlan.copingStrategies}</p>}
                    {selectedAssessment.safetyPlan.reasonsToLive && <p><strong>{tr('أسباب الحياة', 'Reasons to Live')}:</strong> {selectedAssessment.safetyPlan.reasonsToLive}</p>}
                    {selectedAssessment.safetyPlan.contactPeople && <p><strong>{tr('جهات اتصال', 'Contacts')}:</strong> {selectedAssessment.safetyPlan.contactPeople}</p>}
                    {selectedAssessment.safetyPlan.professionals && <p><strong>{tr('مختصون', 'Professionals')}:</strong> {selectedAssessment.safetyPlan.professionals}</p>}
                    {selectedAssessment.safetyPlan.safeEnvironment && <p><strong>{tr('بيئة آمنة', 'Safe Environment')}:</strong> {selectedAssessment.safetyPlan.safeEnvironment}</p>}
                  </div>
                </div>
              )}

              {/* Supervision & Disposition */}
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{tr('الإشراف', 'Supervision')}:</span> {selectedAssessment.supervisionLevel?.replace(/_/g, ' ') || '—'}</div>
                {selectedAssessment.reassessmentDue && (
                  <div><span className="text-muted-foreground">{tr('إعادة التقييم', 'Reassess Due')}:</span> {new Date(selectedAssessment.reassessmentDue).toLocaleDateString()}</div>
                )}
              </div>
              {selectedAssessment.dispositionPlan && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">{tr('خطة التصرف', 'Disposition Plan')}</h4>
                  <p className="text-muted-foreground">{selectedAssessment.dispositionPlan}</p>
                </div>
              )}
              {selectedAssessment.notes && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">{tr('ملاحظات', 'Notes')}</h4>
                  <p className="text-muted-foreground">{selectedAssessment.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>{tr('إغلاق', 'Close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
