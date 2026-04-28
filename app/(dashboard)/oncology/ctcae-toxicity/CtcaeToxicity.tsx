'use client';

import { useLang } from '@/hooks/use-lang';
import useSWR, { mutate as globalMutate } from 'swr';
import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  ClipboardList,
  Pill,
  PauseCircle,
  XCircle,
  Plus,
  Trash2,
  Eye,
  ChevronRight,
  ChevronLeft,
  Activity,
} from 'lucide-react';
import {
  CTCAE_CATEGORIES,
  CTCAE_ADVERSE_EVENTS,
  ATTRIBUTION_OPTIONS,
  ACTION_OPTIONS,
  getEventsByCategory,
  findAdverseEvent,
  getWorstGrade,
  getGradeColor,
  getGradeLabel,
  type ToxicityEntry,
} from '@/lib/oncology/ctcaeDefinitions';

// ---------------------------------------------------------------------------
// SWR fetcher
// ---------------------------------------------------------------------------
const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ToxicityRecord {
  id: string;
  patientMasterId: string;
  cycleId: string | null;
  assessmentDate: string;
  assessedBy: string;
  ctcaeVersion: string;
  toxicities: ToxicityEntry[];
  overallWorstGrade: number;
  doseModRequired: boolean;
  treatmentHeld: boolean;
  treatmentDiscontinued: boolean;
  nextAssessmentDate: string | null;
  notes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CtcaeToxicity() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isRtl = language === 'ar';

  // ---- State ----
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [viewRecord, setViewRecord] = useState<ToxicityRecord | null>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // New assessment form state
  const [formPatientId, setFormPatientId] = useState('');
  const [formCycleId, setFormCycleId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formToxicities, setFormToxicities] = useState<ToxicityEntry[]>([]);
  const [formDoseMod, setFormDoseMod] = useState(false);
  const [formHeld, setFormHeld] = useState(false);
  const [formDiscontinued, setFormDiscontinued] = useState(false);
  const [formNextDate, setFormNextDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Current toxicity being added
  const [curCategory, setCurCategory] = useState('');
  const [curTerm, setCurTerm] = useState('');
  const [curGrade, setCurGrade] = useState<number>(0);
  const [curAttribution, setCurAttribution] = useState('');
  const [curOnset, setCurOnset] = useState('');
  const [curResolved, setCurResolved] = useState(false);
  const [curResolvedDate, setCurResolvedDate] = useState('');
  const [curAction, setCurAction] = useState('NONE');
  const [curNotes, setCurNotes] = useState('');

  // ---- Data Fetching ----
  const apiUrl = gradeFilter !== 'all'
    ? `/api/oncology/ctcae-toxicity?minGrade=${gradeFilter}`
    : '/api/oncology/ctcae-toxicity';

  const { data } = useSWR(apiUrl, fetcher, { refreshInterval: 30000 });
  const records: ToxicityRecord[] = data?.records ?? [];

  // ---- KPI Calculations ----
  const totalAssessments = records.length;
  const grade3PlusEvents = useMemo(() => {
    let count = 0;
    for (const r of records) {
      if (Array.isArray(r.toxicities)) {
        count += r.toxicities.filter((t: ToxicityEntry) => t.grade >= 3).length;
      }
    }
    return count;
  }, [records]);
  const doseModCount = records.filter((r) => r.doseModRequired).length;
  const heldOrDiscontinued = records.filter((r) => r.treatmentHeld || r.treatmentDiscontinued).length;

  // ---- Available terms for selected category ----
  const availableTerms = useMemo(() => {
    if (!curCategory) return [];
    return getEventsByCategory(curCategory);
  }, [curCategory]);

  // ---- Current adverse event detail ----
  const currentAE = useMemo(() => {
    if (!curTerm) return null;
    return findAdverseEvent(curTerm) ?? null;
  }, [curTerm]);

  // ---- Running worst grade for form ----
  const runningWorstGrade = useMemo(() => {
    return getWorstGrade(formToxicities);
  }, [formToxicities]);

  // ---- Handlers ----
  const resetForm = useCallback(() => {
    setStep(1);
    setFormPatientId('');
    setFormCycleId('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormToxicities([]);
    setFormDoseMod(false);
    setFormHeld(false);
    setFormDiscontinued(false);
    setFormNextDate('');
    setFormNotes('');
    resetCurrentToxicity();
  }, []);

  const resetCurrentToxicity = () => {
    setCurCategory('');
    setCurTerm('');
    setCurGrade(0);
    setCurAttribution('');
    setCurOnset('');
    setCurResolved(false);
    setCurResolvedDate('');
    setCurAction('NONE');
    setCurNotes('');
  };

  const addToxicityToList = () => {
    if (!curCategory || !curTerm || !curGrade || !curAttribution) return;
    const entry: ToxicityEntry = {
      category: curCategory,
      term: curTerm,
      grade: curGrade,
      attribution: curAttribution,
      onset: curOnset || null,
      resolved: curResolved,
      resolvedDate: curResolved && curResolvedDate ? curResolvedDate : null,
      action: curAction,
      notes: curNotes,
    };
    setFormToxicities((prev) => [...prev, entry]);
    resetCurrentToxicity();
  };

  const removeToxicity = (index: number) => {
    setFormToxicities((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formPatientId || formToxicities.length === 0) return;
    setSaving(true);
    try {
      const resp = await fetch('/api/oncology/ctcae-toxicity', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId: formPatientId,
          cycleId: formCycleId || null,
          assessmentDate: formDate,
          toxicities: formToxicities,
          doseModRequired: formDoseMod,
          treatmentHeld: formHeld,
          treatmentDiscontinued: formDiscontinued,
          nextAssessmentDate: formNextDate || null,
          notes: formNotes || null,
        }),
      });
      if (resp.ok) {
        globalMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/oncology/ctcae-toxicity'));
        setShowNewDialog(false);
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- Grade badge component ----
  const GradeBadge = ({ grade }: { grade: number }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getGradeColor(grade)}`}>
      {tr('درجة', 'Grade')} {grade} - {getGradeLabel(grade, language as 'ar' | 'en')}
    </span>
  );

  // ---- Render ----
  return (
    <div className="p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('تصنيف السمية CTCAE v5.0', 'CTCAE v5.0 Toxicity Grading')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'المعايير المشتركة لتصنيف الأحداث السلبية - الإصدار الخامس',
              'Common Terminology Criteria for Adverse Events - Version 5.0'
            )}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowNewDialog(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          {tr('تقييم جديد', 'New Assessment')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {tr('إجمالي التقييمات', 'Total Assessments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalAssessments}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {tr('أحداث درجة 3+', 'Grade 3+ Events')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{grade3PlusEvents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Pill className="h-4 w-4" />
              {tr('تعديلات الجرعة', 'Dose Modifications')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{doseModCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PauseCircle className="h-4 w-4" />
              {tr('تعليق / إيقاف العلاج', 'Held / Discontinued')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{heldOrDiscontinued}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm font-medium">{tr('تصفية حسب الدرجة', 'Filter by Grade')}</Label>
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr('جميع الدرجات', 'All Grades')}</SelectItem>
            <SelectItem value="1">{tr('درجة 1+', 'Grade 1+')}</SelectItem>
            <SelectItem value="2">{tr('درجة 2+', 'Grade 2+')}</SelectItem>
            <SelectItem value="3">{tr('درجة 3+ (شديدة)', 'Grade 3+ (Severe)')}</SelectItem>
            <SelectItem value="4">{tr('درجة 4+ (مهددة للحياة)', 'Grade 4+ (Life-threatening)')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assessment Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-start font-medium">{tr('التاريخ', 'Date')}</th>
              <th className="p-3 text-start font-medium">{tr('المريض', 'Patient')}</th>
              <th className="p-3 text-start font-medium">{tr('الدورة', 'Cycle')}</th>
              <th className="p-3 text-start font-medium">{tr('أسوأ درجة', 'Worst Grade')}</th>
              <th className="p-3 text-start font-medium">{tr('عدد السميات', '# Toxicities')}</th>
              <th className="p-3 text-start font-medium">{tr('تعديل الجرعة', 'Dose Mod.')}</th>
              <th className="p-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
              <th className="p-3 text-start font-medium">{tr('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground">
                  <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-base font-medium">
                    {tr('لا توجد تقييمات سمية', 'No toxicity assessments found')}
                  </p>
                  <p className="text-sm mt-1">
                    {tr('انقر على "تقييم جديد" للبدء', 'Click "New Assessment" to get started')}
                  </p>
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const toxCount = Array.isArray(r.toxicities) ? r.toxicities.length : 0;
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(r.assessmentDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {r.patientMasterId?.slice(-8) ?? '---'}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {r.cycleId ? r.cycleId.slice(-6) : '---'}
                    </td>
                    <td className="p-3">
                      <GradeBadge grade={r.overallWorstGrade ?? 0} />
                    </td>
                    <td className="p-3 text-center font-semibold">{toxCount}</td>
                    <td className="p-3">
                      {r.doseModRequired ? (
                        <Badge variant="outline" className="border-orange-300 text-orange-700 text-xs">
                          {tr('نعم', 'Yes')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">{tr('لا', 'No')}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {r.treatmentDiscontinued ? (
                        <Badge variant="destructive" className="text-xs">
                          {tr('متوقف', 'Discontinued')}
                        </Badge>
                      ) : r.treatmentHeld ? (
                        <Badge variant="outline" className="border-yellow-300 text-yellow-700 text-xs">
                          {tr('معلّق', 'Held')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {tr('مستمر', 'Active')}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewRecord(r)}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        {tr('عرض', 'View')}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ================================================================= */}
      {/* NEW ASSESSMENT DIALOG                                              */}
      {/* ================================================================= */}
      <Dialog
        open={showNewDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewDialog(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {tr('تقييم سمية جديد — CTCAE v5.0', 'New Toxicity Assessment — CTCAE v5.0')}
            </DialogTitle>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mt-3">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      step === s
                        ? 'bg-primary text-primary-foreground'
                        : step > s
                          ? 'bg-green-100 text-green-700'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {s}
                  </div>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {s === 1 && tr('معلومات أساسية', 'Basic Info')}
                    {s === 2 && tr('السميات', 'Toxicities')}
                    {s === 3 && tr('الملخص', 'Summary')}
                  </span>
                  {s < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </DialogHeader>

          {/* ============================================================= */}
          {/* STEP 1: Basic Info                                             */}
          {/* ============================================================= */}
          {step === 1 && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('معرف المريض', 'Patient ID')} *</Label>
                  <Input
                    placeholder={tr('أدخل معرف المريض...', 'Enter patient ID...')}
                    value={formPatientId}
                    onChange={(e) => setFormPatientId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr('معرف الدورة (اختياري)', 'Cycle ID (optional)')}</Label>
                  <Input
                    placeholder={tr('ربط بدورة علاج كيميائي...', 'Link to chemo cycle...')}
                    value={formCycleId}
                    onChange={(e) => setFormCycleId(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tr('تاريخ التقييم', 'Assessment Date')} *</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* STEP 2: Add Toxicities                                         */}
          {/* ============================================================= */}
          {step === 2 && (
            <div className="space-y-4 py-4">
              {/* Running worst grade indicator */}
              {formToxicities.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <span className="text-sm font-medium">
                    {tr('أسوأ درجة حالية', 'Running Worst Grade')}
                  </span>
                  <GradeBadge grade={runningWorstGrade} />
                </div>
              )}

              {/* Already-added toxicities */}
              {formToxicities.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {tr('السميات المضافة', 'Added Toxicities')} ({formToxicities.length})
                  </Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {formToxicities.map((t, idx) => {
                      const ae = findAdverseEvent(t.term);
                      const cat = CTCAE_CATEGORIES.find((c) => c.key === t.category);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-md border bg-card"
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <GradeBadge grade={t.grade} />
                            <span className="text-sm font-medium">
                              {isRtl ? (ae?.termAr ?? t.term) : t.term}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({isRtl ? (cat?.labelAr ?? t.category) : (cat?.labelEn ?? t.category)})
                            </span>
                            {t.resolved && (
                              <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                                {tr('تم الحل', 'Resolved')}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeToxicity(idx)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add new toxicity form */}
              <div className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 space-y-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {tr('إضافة سمية', 'Add Toxicity')}
                </Label>

                {/* Category and Term */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{tr('فئة الجهاز العضوي', 'System Organ Class')} *</Label>
                    <Select
                      value={curCategory}
                      onValueChange={(v) => {
                        setCurCategory(v);
                        setCurTerm('');
                        setCurGrade(0);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tr('اختر الفئة...', 'Select category...')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CTCAE_CATEGORIES.map((c) => (
                          <SelectItem key={c.key} value={c.key}>
                            {isRtl ? c.labelAr : c.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tr('الحدث السلبي', 'Adverse Event')} *</Label>
                    <Select
                      value={curTerm}
                      onValueChange={(v) => {
                        setCurTerm(v);
                        setCurGrade(0);
                      }}
                      disabled={!curCategory}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            curCategory
                              ? tr('اختر الحدث...', 'Select event...')
                              : tr('اختر الفئة أولاً', 'Select category first')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTerms.map((ae) => (
                          <SelectItem key={ae.term} value={ae.term}>
                            {isRtl ? ae.termAr : ae.term}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Grade Selection with definitions */}
                {curTerm && currentAE && (
                  <div className="space-y-2">
                    <Label className="text-xs">{tr('الدرجة', 'Grade')} *</Label>
                    <div className="space-y-1.5">
                      {([1, 2, 3, 4, 5] as const).map((g) => {
                        const def = currentAE.grades[g];
                        const isNA =
                          def.descEn === 'Not applicable' || def.descEn === 'Death';
                        const isSelected = curGrade === g;
                        return (
                          <button
                            key={g}
                            type="button"
                            disabled={def.descEn === 'Not applicable'}
                            onClick={() => setCurGrade(g)}
                            className={`w-full text-start p-2.5 rounded-md border transition-all ${
                              def.descEn === 'Not applicable'
                                ? 'opacity-40 cursor-not-allowed bg-muted/20'
                                : isSelected
                                  ? 'ring-2 ring-primary border-primary bg-primary/5'
                                  : 'hover:bg-muted/50 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${getGradeColor(g)}`}>
                                {g}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-semibold">
                                  {getGradeLabel(g, language as 'ar' | 'en')}
                                </span>
                                {!isNA && (
                                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                    {isRtl ? def.descAr : def.descEn}
                                  </p>
                                )}
                                {isNA && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {isRtl ? def.descAr : def.descEn}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Attribution and Action */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{tr('العلاقة بالعلاج', 'Attribution')} *</Label>
                    <Select value={curAttribution} onValueChange={setCurAttribution}>
                      <SelectTrigger>
                        <SelectValue placeholder={tr('اختر...', 'Select...')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTRIBUTION_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {isRtl ? o.labelAr : o.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tr('الإجراء المتخذ', 'Action Taken')}</Label>
                    <Select value={curAction} onValueChange={setCurAction}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {isRtl ? o.labelAr : o.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Onset and Resolution */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{tr('تاريخ البداية', 'Onset Date')}</Label>
                    <Input
                      type="date"
                      value={curOnset}
                      onChange={(e) => setCurOnset(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tr('تم الحل', 'Resolved')}</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Checkbox
                        checked={curResolved}
                        onCheckedChange={(v) => setCurResolved(v === true)}
                      />
                      <span className="text-sm">
                        {curResolved ? tr('نعم', 'Yes') : tr('لا', 'No')}
                      </span>
                    </div>
                  </div>
                  {curResolved && (
                    <div className="space-y-2">
                      <Label className="text-xs">{tr('تاريخ الحل', 'Resolved Date')}</Label>
                      <Input
                        type="date"
                        value={curResolvedDate}
                        onChange={(e) => setCurResolvedDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Notes for this toxicity */}
                <div className="space-y-2">
                  <Label className="text-xs">{tr('ملاحظات', 'Notes')}</Label>
                  <Input
                    placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
                    value={curNotes}
                    onChange={(e) => setCurNotes(e.target.value)}
                  />
                </div>

                {/* Add button */}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addToxicityToList}
                  disabled={!curCategory || !curTerm || !curGrade || !curAttribution}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {tr('إضافة هذه السمية إلى القائمة', 'Add This Toxicity to List')}
                </Button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* STEP 3: Summary                                                */}
          {/* ============================================================= */}
          {step === 3 && (
            <div className="space-y-4 py-4">
              {/* Summary of toxicities */}
              <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {tr('ملخص التقييم', 'Assessment Summary')}
                  </span>
                  <GradeBadge grade={runningWorstGrade} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{tr('المريض', 'Patient')}:</span>{' '}
                    <span className="font-mono text-xs">{formPatientId.slice(-8) || '---'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{tr('التاريخ', 'Date')}:</span>{' '}
                    <span>{formDate}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{tr('عدد السميات', 'Toxicities')}:</span>{' '}
                    <span className="font-bold">{formToxicities.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{tr('الدورة', 'Cycle')}:</span>{' '}
                    <span>{formCycleId || '---'}</span>
                  </div>
                </div>

                {/* Grade distribution */}
                {formToxicities.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                    {[1, 2, 3, 4, 5].map((g) => {
                      const count = formToxicities.filter((t) => t.grade === g).length;
                      if (count === 0) return null;
                      return (
                        <div key={g} className="flex items-center gap-1">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getGradeColor(g)}`}>
                            {g}
                          </span>
                          <span className="text-xs text-muted-foreground">x{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Treatment impact checkboxes */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  {tr('تأثير العلاج', 'Treatment Impact')}
                </Label>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/30 transition-colors">
                    <Checkbox
                      checked={formDoseMod}
                      onCheckedChange={(v) => setFormDoseMod(v === true)}
                    />
                    <div>
                      <span className="text-sm font-medium">
                        {tr('تعديل الجرعة مطلوب', 'Dose Modification Required')}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          'هل تتطلب السمية تعديل جرعة العلاج الكيميائي؟',
                          'Does the toxicity require chemotherapy dose modification?'
                        )}
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/30 transition-colors">
                    <Checkbox
                      checked={formHeld}
                      onCheckedChange={(v) => setFormHeld(v === true)}
                    />
                    <div>
                      <span className="text-sm font-medium">
                        {tr('تعليق العلاج', 'Treatment Held')}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          'هل تم تعليق العلاج مؤقتاً بسبب السمية؟',
                          'Was treatment temporarily held due to toxicity?'
                        )}
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/30 transition-colors border-red-200">
                    <Checkbox
                      checked={formDiscontinued}
                      onCheckedChange={(v) => setFormDiscontinued(v === true)}
                    />
                    <div>
                      <span className="text-sm font-medium text-red-700">
                        {tr('إيقاف العلاج نهائياً', 'Treatment Discontinued')}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          'هل تم إيقاف العلاج نهائياً بسبب السمية؟',
                          'Was treatment permanently discontinued due to toxicity?'
                        )}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Next assessment date */}
              <div className="space-y-2">
                <Label>{tr('تاريخ التقييم القادم', 'Next Assessment Date')}</Label>
                <Input
                  type="date"
                  value={formNextDate}
                  onChange={(e) => setFormNextDate(e.target.value)}
                />
              </div>

              {/* Overall notes */}
              <div className="space-y-2">
                <Label>{tr('ملاحظات عامة', 'Overall Notes')}</Label>
                <Textarea
                  placeholder={tr(
                    'ملاحظات إضافية حول هذا التقييم...',
                    'Additional notes about this assessment...'
                  )}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Dialog Footer — Navigation */}
          <DialogFooter className="flex items-center justify-between gap-2 pt-4 border-t">
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1">
                  {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  {tr('السابق', 'Back')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setShowNewDialog(false); resetForm(); }}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              {step < 3 && (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !formPatientId) ||
                    (step === 2 && formToxicities.length === 0)
                  }
                  className="gap-1"
                >
                  {tr('التالي', 'Next')}
                  {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              )}
              {step === 3 && (
                <Button
                  onClick={handleSubmit}
                  disabled={saving || formToxicities.length === 0}
                  className="gap-2"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {tr('جاري الحفظ...', 'Saving...')}
                    </>
                  ) : (
                    tr('حفظ التقييم', 'Save Assessment')
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* VIEW ASSESSMENT DIALOG                                             */}
      {/* ================================================================= */}
      <Dialog open={!!viewRecord} onOpenChange={(open) => { if (!open) setViewRecord(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-3">
              {tr('تفاصيل تقييم السمية', 'Toxicity Assessment Details')}
              {viewRecord && <GradeBadge grade={viewRecord.overallWorstGrade ?? 0} />}
            </DialogTitle>
          </DialogHeader>

          {viewRecord && (
            <div className="space-y-5 py-4">
              {/* Meta info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-lg border bg-muted/20">
                <div>
                  <p className="text-xs text-muted-foreground">{tr('المريض', 'Patient')}</p>
                  <p className="text-sm font-mono">{viewRecord.patientMasterId?.slice(-8) ?? '---'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('تاريخ التقييم', 'Assessment Date')}</p>
                  <p className="text-sm">
                    {new Date(viewRecord.assessmentDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('الدورة', 'Cycle')}</p>
                  <p className="text-sm">{viewRecord.cycleId?.slice(-6) ?? '---'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('الإصدار', 'Version')}</p>
                  <p className="text-sm">CTCAE v{viewRecord.ctcaeVersion}</p>
                </div>
              </div>

              {/* Grade visualization bar */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  {tr('توزيع الدرجات', 'Grade Distribution')}
                </Label>
                <div className="flex h-8 rounded-lg overflow-hidden border">
                  {[1, 2, 3, 4, 5].map((g) => {
                    const toxArr = Array.isArray(viewRecord.toxicities) ? viewRecord.toxicities : [];
                    const count = toxArr.filter((t: ToxicityEntry) => t.grade === g).length;
                    if (count === 0 || toxArr.length === 0) return null;
                    const pct = (count / toxArr.length) * 100;
                    const colors: Record<number, string> = {
                      1: 'bg-green-400',
                      2: 'bg-yellow-400',
                      3: 'bg-orange-400',
                      4: 'bg-red-500',
                      5: 'bg-gray-900',
                    };
                    return (
                      <div
                        key={g}
                        className={`${colors[g]} flex items-center justify-center text-xs font-bold ${g <= 3 ? 'text-foreground' : 'text-white'}`}
                        style={{ width: `${pct}%`, minWidth: count > 0 ? '32px' : '0' }}
                        title={`Grade ${g}: ${count}`}
                      >
                        G{g}:{count}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Treatment impact */}
              <div className="flex gap-3 flex-wrap">
                {viewRecord.doseModRequired && (
                  <Badge variant="outline" className="border-orange-300 text-orange-700">
                    <Pill className="h-3 w-3 me-1" />
                    {tr('تعديل الجرعة مطلوب', 'Dose Modification Required')}
                  </Badge>
                )}
                {viewRecord.treatmentHeld && (
                  <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                    <PauseCircle className="h-3 w-3 me-1" />
                    {tr('العلاج معلّق', 'Treatment Held')}
                  </Badge>
                )}
                {viewRecord.treatmentDiscontinued && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 me-1" />
                    {tr('العلاج متوقف', 'Treatment Discontinued')}
                  </Badge>
                )}
                {!viewRecord.doseModRequired && !viewRecord.treatmentHeld && !viewRecord.treatmentDiscontinued && (
                  <Badge variant="outline">
                    {tr('لا يوجد تأثير على العلاج', 'No treatment impact')}
                  </Badge>
                )}
              </div>

              {/* Toxicity details */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  {tr('تفاصيل السميات', 'Toxicity Details')} ({Array.isArray(viewRecord.toxicities) ? viewRecord.toxicities.length : 0})
                </Label>
                <div className="space-y-2">
                  {(Array.isArray(viewRecord.toxicities) ? viewRecord.toxicities : []).map((t: ToxicityEntry, idx: number) => {
                    const ae = findAdverseEvent(t.term);
                    const cat = CTCAE_CATEGORIES.find((c) => c.key === t.category);
                    const attrOption = ATTRIBUTION_OPTIONS.find((a) => a.value === t.attribution);
                    const actOption = ACTION_OPTIONS.find((a) => a.value === t.action);
                    const gradeDef = ae ? ae.grades[t.grade as 1 | 2 | 3 | 4 | 5] : null;

                    return (
                      <div key={idx} className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${getGradeColor(t.grade)}`}>
                              {t.grade}
                            </span>
                            <span className="font-semibold text-sm">
                              {isRtl ? (ae?.termAr ?? t.term) : t.term}
                            </span>
                            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                              {isRtl ? (cat?.labelAr ?? t.category) : (cat?.labelEn ?? t.category)}
                            </span>
                          </div>
                          {t.resolved && (
                            <Badge variant="outline" className="text-xs border-green-300 text-green-700 shrink-0">
                              {tr('تم الحل', 'Resolved')}
                              {t.resolvedDate && (
                                <span className="ms-1">
                                  {new Date(t.resolvedDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
                                </span>
                              )}
                            </Badge>
                          )}
                        </div>

                        {/* Grade definition */}
                        {gradeDef && gradeDef.descEn !== 'Not applicable' && (
                          <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            <span className="font-semibold">{tr('التعريف', 'Definition')}:</span>{' '}
                            {isRtl ? gradeDef.descAr : gradeDef.descEn}
                          </p>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">{tr('العلاقة', 'Attribution')}:</span>{' '}
                            <span className="font-medium">
                              {isRtl ? (attrOption?.labelAr ?? t.attribution) : (attrOption?.labelEn ?? t.attribution)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{tr('الإجراء', 'Action')}:</span>{' '}
                            <span className="font-medium">
                              {isRtl ? (actOption?.labelAr ?? t.action) : (actOption?.labelEn ?? t.action)}
                            </span>
                          </div>
                          {t.onset && (
                            <div>
                              <span className="text-muted-foreground">{tr('البداية', 'Onset')}:</span>{' '}
                              <span>{new Date(t.onset).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}</span>
                            </div>
                          )}
                          {t.notes && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">{tr('ملاحظات', 'Notes')}:</span>{' '}
                              <span>{t.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next assessment */}
              {viewRecord.nextAssessmentDate && (
                <div className="p-3 rounded-lg border bg-blue-50/50 text-sm">
                  <span className="text-muted-foreground">{tr('التقييم القادم', 'Next Assessment')}:</span>{' '}
                  <span className="font-medium">
                    {new Date(viewRecord.nextAssessmentDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
                  </span>
                </div>
              )}

              {/* Notes */}
              {viewRecord.notes && (
                <div className="p-3 rounded-lg border bg-muted/20 text-sm">
                  <span className="text-muted-foreground font-semibold">{tr('ملاحظات', 'Notes')}:</span>
                  <p className="mt-1">{viewRecord.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRecord(null)}>
              {tr('إغلاق', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
