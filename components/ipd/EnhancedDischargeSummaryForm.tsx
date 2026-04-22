'use client';

// =============================================================================
// EnhancedDischargeSummaryForm — Comprehensive discharge summary
// =============================================================================

import { useState, useEffect } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Save,
  FileSignature,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface DischargeDiagnosis {
  diagnosis: string;
  icdCode: string;
  isPrimary: boolean;
}

interface Procedure {
  procedure: string;
  cptCode: string;
  date: string;
  surgeon: string;
}

interface Consultation {
  specialty: string;
  consultant: string;
  findings: string;
}

interface DischargeMedication {
  drug: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  isNew: boolean;
  isChanged: boolean;
  isStopped: boolean;
}

interface MedReconItem {
  drug: string;
  dose: string;
  status: 'CONTINUE' | 'CHANGED' | 'NEW' | 'STOPPED';
  notes: string;
}

interface FollowUp {
  specialty: string;
  provider: string;
  date: string;
  instructions: string;
}

interface PendingResult {
  test: string;
  expectedDate: string;
  followUpWith: string;
}

interface PatientEducation {
  topic: string;
  materialProvided: boolean;
}

interface PatientInstructions {
  activityRestrictions: string;
  diet: string;
  woundCare: string;
  warningSigns: string;
}

interface DischargeSummaryData {
  admissionDate: string;
  dischargeDate: string;
  attendingPhysician: string;
  admittingDiagnosis: string;
  dischargeDiagnoses: DischargeDiagnosis[];
  procedures: Procedure[];
  hospitalCourse: string;
  significantFindings: string;
  consultations: Consultation[];
  conditionAtDischarge: string;
  dischargeMedications: DischargeMedication[];
  medReconciliation: MedReconItem[];
  followUp: FollowUp[];
  pendingResults: PendingResult[];
  patientInstructions: PatientInstructions;
  patientEducation: PatientEducation[];
  status: 'DRAFT' | 'SIGNED';
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  episodeId: string;
  existingSummary?: any;
  onSaved?: () => void;
}

// ── Defaults ─────────────────────────────────────────────────────────────────
const emptyForm: DischargeSummaryData = {
  admissionDate: '',
  dischargeDate: '',
  attendingPhysician: '',
  admittingDiagnosis: '',
  dischargeDiagnoses: [{ diagnosis: '', icdCode: '', isPrimary: true }],
  procedures: [],
  hospitalCourse: '',
  significantFindings: '',
  consultations: [],
  conditionAtDischarge: '',
  dischargeMedications: [],
  medReconciliation: [],
  followUp: [],
  pendingResults: [],
  patientInstructions: { activityRestrictions: '', diet: '', woundCare: '', warningSigns: '' },
  patientEducation: [],
  status: 'DRAFT',
};

// =============================================================================
// Component
// =============================================================================
export default function EnhancedDischargeSummaryForm({ episodeId, existingSummary, onSaved }: Props) {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();

  const [form, setForm] = useState<DischargeSummaryData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('admission');

  // Hydrate from existing summary
  useEffect(() => {
    if (existingSummary) {
      setForm({
        admissionDate: existingSummary.admissionDate || '',
        dischargeDate: existingSummary.dischargeDate || '',
        attendingPhysician: existingSummary.attendingPhysician || '',
        admittingDiagnosis: existingSummary.admittingDiagnosis || '',
        dischargeDiagnoses: existingSummary.dischargeDiagnoses?.length
          ? existingSummary.dischargeDiagnoses
          : [{ diagnosis: '', icdCode: '', isPrimary: true }],
        procedures: existingSummary.procedures || [],
        hospitalCourse: existingSummary.hospitalCourse || '',
        significantFindings: existingSummary.significantFindings || '',
        consultations: existingSummary.consultations || [],
        conditionAtDischarge: existingSummary.conditionAtDischarge || '',
        dischargeMedications: existingSummary.dischargeMedications || [],
        medReconciliation: existingSummary.medReconciliation || [],
        followUp: existingSummary.followUp || [],
        pendingResults: existingSummary.pendingResults || [],
        patientInstructions: existingSummary.patientInstructions || {
          activityRestrictions: '',
          diet: '',
          woundCare: '',
          warningSigns: '',
        },
        patientEducation: existingSummary.patientEducation || [],
        status: existingSummary.status || 'DRAFT',
      });
    }
  }, [existingSummary]);

  // ── Save handler ───────────────────────────────────────────────────────────
  async function handleSave(sign: boolean) {
    setSaving(true);
    try {
      const payload = { ...form, status: sign ? 'SIGNED' : 'DRAFT' };
      const res = await fetch(`/api/ipd/episodes/${episodeId}/discharge-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');

      toast({
        title: sign
          ? tr('تم التوقيع بنجاح', 'Signed successfully')
          : tr('تم حفظ المسودة', 'Draft saved'),
      });
      if (sign) setForm(prev => ({ ...prev, status: 'SIGNED' }));
      onSaved?.();
    } catch (err: any) {
      toast({ title: tr('فشل الحفظ', 'Save failed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ── Field updaters ─────────────────────────────────────────────────────────
  function setField<K extends keyof DischargeSummaryData>(key: K, value: DischargeSummaryData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function setInstructions<K extends keyof PatientInstructions>(key: K, value: string) {
    setForm(prev => ({
      ...prev,
      patientInstructions: { ...prev.patientInstructions, [key]: value },
    }));
  }

  // ── Dynamic list helpers ───────────────────────────────────────────────────
  function addItem<K extends keyof DischargeSummaryData>(key: K, item: unknown) {
    setForm(prev => ({ ...prev, [key]: [...(prev[key] as unknown[]), item] }));
  }

  function removeItem<K extends keyof DischargeSummaryData>(key: K, idx: number) {
    setForm(prev => ({
      ...prev,
      [key]: (prev[key] as unknown[]).filter((_: unknown, i: number) => i !== idx),
    }));
  }

  function updateItem<K extends keyof DischargeSummaryData>(key: K, idx: number, patch: Record<string, unknown>) {
    setForm(prev => ({
      ...prev,
      [key]: (prev[key] as unknown as Record<string, unknown>[]).map((item: Record<string, unknown>, i: number) =>
        i === idx ? { ...item, ...patch } : item
      ),
    }));
  }

  // ── Section label shorthand ────────────────────────────────────────────────
  const SectionTitle = ({ ar, en }: { ar: string; en: string }) => (
    <h3 className="text-sm font-semibold text-foreground mb-3">{tr(ar, en)}</h3>
  );

  const isSigned = form.status === 'SIGNED';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Status badge */}
      {isSigned && (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {tr('موقّع', 'Signed')}
        </Badge>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="admission">{tr('القبول', 'Admission')}</TabsTrigger>
          <TabsTrigger value="diagnoses">{tr('التشخيصات', 'Diagnoses')}</TabsTrigger>
          <TabsTrigger value="procedures">{tr('الإجراءات', 'Procedures')}</TabsTrigger>
          <TabsTrigger value="course">{tr('المسار', 'Course')}</TabsTrigger>
          <TabsTrigger value="medications">{tr('الأدوية', 'Medications')}</TabsTrigger>
          <TabsTrigger value="followup">{tr('المتابعة', 'Follow-up')}</TabsTrigger>
          <TabsTrigger value="instructions">{tr('التعليمات', 'Instructions')}</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Admission Info */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="admission" className="space-y-4 mt-4">
          <SectionTitle ar="معلومات القبول" en="Admission Information" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{tr('تاريخ القبول', 'Admission Date')}</label>
              <Input
                type="date"
                value={form.admissionDate}
                onChange={e => setField('admissionDate', e.target.value)}
                disabled={isSigned}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{tr('تاريخ الخروج', 'Discharge Date')}</label>
              <Input
                type="date"
                value={form.dischargeDate}
                onChange={e => setField('dischargeDate', e.target.value)}
                disabled={isSigned}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{tr('الطبيب المعالج', 'Attending Physician')}</label>
              <Input
                value={form.attendingPhysician}
                onChange={e => setField('attendingPhysician', e.target.value)}
                placeholder={tr('اسم الطبيب', 'Physician name')}
                disabled={isSigned}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{tr('تشخيص القبول', 'Admitting Diagnosis')}</label>
              <Input
                value={form.admittingDiagnosis}
                onChange={e => setField('admittingDiagnosis', e.target.value)}
                placeholder={tr('التشخيص عند القبول', 'Diagnosis at admission')}
                disabled={isSigned}
              />
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Discharge Diagnoses */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="diagnoses" className="space-y-4 mt-4">
          <SectionTitle ar="تشخيصات الخروج" en="Discharge Diagnoses" />
          {form.dischargeDiagnoses.map((dx, idx) => (
            <Card key={idx} className="border border-border">
              <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder={tr('التشخيص', 'Diagnosis')}
                    value={dx.diagnosis}
                    onChange={e =>
                      updateItem('dischargeDiagnoses', idx, { diagnosis: e.target.value })
                    }
                    disabled={isSigned}
                  />
                  <Input
                    placeholder={tr('رمز ICD', 'ICD Code')}
                    value={dx.icdCode}
                    onChange={e =>
                      updateItem('dischargeDiagnoses', idx, { icdCode: e.target.value })
                    }
                    disabled={isSigned}
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={dx.isPrimary}
                        onChange={e =>
                          updateItem('dischargeDiagnoses', idx, { isPrimary: e.target.checked })
                        }
                        className="rounded border-border"
                        disabled={isSigned}
                      />
                      {tr('رئيسي', 'Primary')}
                    </label>
                    {!isSigned && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem('dischargeDiagnoses', idx)}
                        className="text-red-500 h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isSigned && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                addItem('dischargeDiagnoses', { diagnosis: '', icdCode: '', isPrimary: false })
              }
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr('إضافة تشخيص', 'Add Diagnosis')}
            </Button>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Procedures */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="procedures" className="space-y-4 mt-4">
          <SectionTitle ar="الإجراءات" en="Procedures Performed" />
          {form.procedures.map((proc, idx) => (
            <Card key={idx} className="border border-border">
              <CardContent className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <Input
                    placeholder={tr('الإجراء', 'Procedure')}
                    value={proc.procedure}
                    onChange={e => updateItem('procedures', idx, { procedure: e.target.value })}
                    disabled={isSigned}
                  />
                  <Input
                    placeholder={tr('رمز CPT', 'CPT Code')}
                    value={proc.cptCode}
                    onChange={e => updateItem('procedures', idx, { cptCode: e.target.value })}
                    disabled={isSigned}
                  />
                  <Input
                    type="date"
                    value={proc.date}
                    onChange={e => updateItem('procedures', idx, { date: e.target.value })}
                    disabled={isSigned}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={tr('الجراح', 'Surgeon')}
                      value={proc.surgeon}
                      onChange={e => updateItem('procedures', idx, { surgeon: e.target.value })}
                      disabled={isSigned}
                    />
                    {!isSigned && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem('procedures', idx)}
                        className="text-red-500 h-7 w-7 p-0 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isSigned && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                addItem('procedures', { procedure: '', cptCode: '', date: '', surgeon: '' })
              }
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr('إضافة إجراء', 'Add Procedure')}
            </Button>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Course + Findings + Consultations + Condition */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="course" className="space-y-6 mt-4">
          {/* Hospital Course */}
          <div>
            <SectionTitle ar="المسار خلال الإقامة" en="Hospital Course" />
            <Textarea
              rows={5}
              value={form.hospitalCourse}
              onChange={e => setField('hospitalCourse', e.target.value)}
              placeholder={tr('وصف المسار السريري خلال الإقامة...', 'Describe the clinical course during hospitalization...')}
              disabled={isSigned}
            />
          </div>

          {/* Significant Findings */}
          <div>
            <SectionTitle ar="النتائج المهمة" en="Significant Findings" />
            <Textarea
              rows={3}
              value={form.significantFindings}
              onChange={e => setField('significantFindings', e.target.value)}
              placeholder={tr('نتائج مخبرية أو إشعاعية مهمة...', 'Significant lab or radiology findings...')}
              disabled={isSigned}
            />
          </div>

          {/* Consultations */}
          <div>
            <SectionTitle ar="الاستشارات" en="Consultations" />
            {form.consultations.map((c, idx) => (
              <Card key={idx} className="border border-border mb-2">
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder={tr('التخصص', 'Specialty')}
                      value={c.specialty}
                      onChange={e => updateItem('consultations', idx, { specialty: e.target.value })}
                      disabled={isSigned}
                    />
                    <Input
                      placeholder={tr('الاستشاري', 'Consultant')}
                      value={c.consultant}
                      onChange={e => updateItem('consultations', idx, { consultant: e.target.value })}
                      disabled={isSigned}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={tr('النتائج', 'Findings')}
                        value={c.findings}
                        onChange={e => updateItem('consultations', idx, { findings: e.target.value })}
                        disabled={isSigned}
                      />
                      {!isSigned && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem('consultations', idx)}
                          className="text-red-500 h-7 w-7 p-0 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isSigned && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  addItem('consultations', { specialty: '', consultant: '', findings: '' })
                }
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {tr('إضافة استشارة', 'Add Consultation')}
              </Button>
            )}
          </div>

          {/* Condition at Discharge */}
          <div>
            <SectionTitle ar="الحالة عند الخروج" en="Condition at Discharge" />
            <Select
              value={form.conditionAtDischarge}
              onValueChange={v => setField('conditionAtDischarge', v)}
              disabled={isSigned}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder={tr('اختر الحالة', 'Select condition')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IMPROVED">{tr('تحسن', 'Improved')}</SelectItem>
                <SelectItem value="STABLE">{tr('مستقر', 'Stable')}</SelectItem>
                <SelectItem value="UNCHANGED">{tr('بدون تغيير', 'Unchanged')}</SelectItem>
                <SelectItem value="DETERIORATED">{tr('تدهور', 'Deteriorated')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Medications + Reconciliation */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="medications" className="space-y-6 mt-4">
          {/* Discharge Medications */}
          <div>
            <SectionTitle ar="أدوية الخروج" en="Discharge Medications" />
            {form.dischargeMedications.map((med, idx) => (
              <Card key={idx} className="border border-border mb-2">
                <CardContent className="p-3 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    <Input
                      placeholder={tr('الدواء', 'Drug')}
                      value={med.drug}
                      onChange={e =>
                        updateItem('dischargeMedications', idx, { drug: e.target.value })
                      }
                      disabled={isSigned}
                    />
                    <Input
                      placeholder={tr('الجرعة', 'Dose')}
                      value={med.dose}
                      onChange={e =>
                        updateItem('dischargeMedications', idx, { dose: e.target.value })
                      }
                      disabled={isSigned}
                    />
                    <Input
                      placeholder={tr('التكرار', 'Frequency')}
                      value={med.frequency}
                      onChange={e =>
                        updateItem('dischargeMedications', idx, { frequency: e.target.value })
                      }
                      disabled={isSigned}
                    />
                    <Input
                      placeholder={tr('الطريق', 'Route')}
                      value={med.route}
                      onChange={e =>
                        updateItem('dischargeMedications', idx, { route: e.target.value })
                      }
                      disabled={isSigned}
                    />
                    <Input
                      placeholder={tr('المدة', 'Duration')}
                      value={med.duration}
                      onChange={e =>
                        updateItem('dischargeMedications', idx, { duration: e.target.value })
                      }
                      disabled={isSigned}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={med.isNew}
                        onChange={e =>
                          updateItem('dischargeMedications', idx, { isNew: e.target.checked })
                        }
                        className="rounded border-border"
                        disabled={isSigned}
                      />
                      {tr('جديد', 'New')}
                    </label>
                    <label className="flex items-center gap-1 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={med.isChanged}
                        onChange={e =>
                          updateItem('dischargeMedications', idx, { isChanged: e.target.checked })
                        }
                        className="rounded border-border"
                        disabled={isSigned}
                      />
                      {tr('معدّل', 'Changed')}
                    </label>
                    <label className="flex items-center gap-1 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={med.isStopped}
                        onChange={e =>
                          updateItem('dischargeMedications', idx, { isStopped: e.target.checked })
                        }
                        className="rounded border-border"
                        disabled={isSigned}
                      />
                      {tr('موقف', 'Stopped')}
                    </label>
                    {!isSigned && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem('dischargeMedications', idx)}
                        className="text-red-500 h-6 px-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isSigned && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  addItem('dischargeMedications', {
                    drug: '',
                    dose: '',
                    frequency: '',
                    route: '',
                    duration: '',
                    isNew: false,
                    isChanged: false,
                    isStopped: false,
                  })
                }
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {tr('إضافة دواء', 'Add Medication')}
              </Button>
            )}
          </div>

          {/* Med Reconciliation */}
          <div>
            <SectionTitle ar="مطابقة الأدوية" en="Medication Reconciliation" />
            {form.medReconciliation.map((rec, idx) => (
              <Card key={idx} className="border border-border mb-2">
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Input
                      placeholder={tr('الدواء', 'Drug')}
                      value={rec.drug}
                      onChange={e => updateItem('medReconciliation', idx, { drug: e.target.value })}
                      disabled={isSigned}
                    />
                    <Input
                      placeholder={tr('الجرعة', 'Dose')}
                      value={rec.dose}
                      onChange={e => updateItem('medReconciliation', idx, { dose: e.target.value })}
                      disabled={isSigned}
                    />
                    <Select
                      value={rec.status}
                      onValueChange={v => updateItem('medReconciliation', idx, { status: v })}
                      disabled={isSigned}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tr('الحالة', 'Status')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONTINUE">{tr('مستمر', 'Continue')}</SelectItem>
                        <SelectItem value="CHANGED">{tr('معدّل', 'Changed')}</SelectItem>
                        <SelectItem value="NEW">{tr('جديد', 'New')}</SelectItem>
                        <SelectItem value="STOPPED">{tr('موقف', 'Stopped')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={tr('ملاحظات', 'Notes')}
                        value={rec.notes}
                        onChange={e =>
                          updateItem('medReconciliation', idx, { notes: e.target.value })
                        }
                        disabled={isSigned}
                      />
                      {!isSigned && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem('medReconciliation', idx)}
                          className="text-red-500 h-7 w-7 p-0 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isSigned && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  addItem('medReconciliation', {
                    drug: '',
                    dose: '',
                    status: 'CONTINUE',
                    notes: '',
                  })
                }
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {tr('إضافة مطابقة', 'Add Reconciliation')}
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Follow-up + Pending Results + Education */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="followup" className="space-y-6 mt-4">
          {/* Follow-up Appointments */}
          <div>
            <SectionTitle ar="مواعيد المتابعة" en="Follow-up Appointments" />
            {form.followUp.map((fu, idx) => (
              <Card key={idx} className="border border-border mb-2">
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <Input
                      placeholder={tr('التخصص', 'Specialty')}
                      value={fu.specialty}
                      onChange={e => updateItem('followUp', idx, { specialty: e.target.value })}
                      disabled={isSigned}
                    />
                    <Input
                      placeholder={tr('المزود', 'Provider')}
                      value={fu.provider}
                      onChange={e => updateItem('followUp', idx, { provider: e.target.value })}
                      disabled={isSigned}
                    />
                    <Input
                      type="date"
                      value={fu.date}
                      onChange={e => updateItem('followUp', idx, { date: e.target.value })}
                      disabled={isSigned}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={tr('التعليمات', 'Instructions')}
                        value={fu.instructions}
                        onChange={e =>
                          updateItem('followUp', idx, { instructions: e.target.value })
                        }
                        disabled={isSigned}
                      />
                      {!isSigned && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem('followUp', idx)}
                          className="text-red-500 h-7 w-7 p-0 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isSigned && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  addItem('followUp', {
                    specialty: '',
                    provider: '',
                    date: '',
                    instructions: '',
                  })
                }
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {tr('إضافة موعد متابعة', 'Add Follow-up')}
              </Button>
            )}
          </div>

          {/* Pending Results */}
          <div>
            <SectionTitle ar="نتائج معلقة" en="Pending Results" />
            {form.pendingResults.map((pr, idx) => (
              <Card key={idx} className="border border-border mb-2">
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder={tr('الفحص', 'Test')}
                      value={pr.test}
                      onChange={e => updateItem('pendingResults', idx, { test: e.target.value })}
                      disabled={isSigned}
                    />
                    <Input
                      type="date"
                      placeholder={tr('التاريخ المتوقع', 'Expected Date')}
                      value={pr.expectedDate}
                      onChange={e =>
                        updateItem('pendingResults', idx, { expectedDate: e.target.value })
                      }
                      disabled={isSigned}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={tr('متابعة مع', 'Follow-up With')}
                        value={pr.followUpWith}
                        onChange={e =>
                          updateItem('pendingResults', idx, { followUpWith: e.target.value })
                        }
                        disabled={isSigned}
                      />
                      {!isSigned && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem('pendingResults', idx)}
                          className="text-red-500 h-7 w-7 p-0 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isSigned && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  addItem('pendingResults', {
                    test: '',
                    expectedDate: '',
                    followUpWith: '',
                  })
                }
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {tr('إضافة نتيجة معلقة', 'Add Pending Result')}
              </Button>
            )}
          </div>

          {/* Patient Education */}
          <div>
            <SectionTitle ar="تثقيف المريض" en="Patient Education" />
            {form.patientEducation.map((edu, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <Input
                  placeholder={tr('الموضوع', 'Topic')}
                  value={edu.topic}
                  onChange={e => updateItem('patientEducation', idx, { topic: e.target.value })}
                  disabled={isSigned}
                  className="flex-1"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <input
                    type="checkbox"
                    checked={edu.materialProvided}
                    onChange={e =>
                      updateItem('patientEducation', idx, {
                        materialProvided: e.target.checked,
                      })
                    }
                    className="rounded border-border"
                    disabled={isSigned}
                  />
                  {tr('مادة مقدمة', 'Material Provided')}
                </label>
                {!isSigned && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem('patientEducation', idx)}
                    className="text-red-500 h-7 w-7 p-0 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {!isSigned && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  addItem('patientEducation', { topic: '', materialProvided: false })
                }
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {tr('إضافة موضوع تثقيفي', 'Add Education Topic')}
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Patient Instructions */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="instructions" className="space-y-4 mt-4">
          <SectionTitle ar="تعليمات المريض" en="Patient Instructions" />

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {tr('قيود النشاط', 'Activity Restrictions')}
            </label>
            <Textarea
              rows={3}
              value={form.patientInstructions.activityRestrictions}
              onChange={e => setInstructions('activityRestrictions', e.target.value)}
              placeholder={tr('قيود على الحركة والنشاط...', 'Activity and mobility restrictions...')}
              disabled={isSigned}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {tr('النظام الغذائي', 'Diet')}
            </label>
            <Textarea
              rows={2}
              value={form.patientInstructions.diet}
              onChange={e => setInstructions('diet', e.target.value)}
              placeholder={tr('تعليمات الحمية الغذائية...', 'Dietary instructions...')}
              disabled={isSigned}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {tr('العناية بالجروح', 'Wound Care')}
            </label>
            <Textarea
              rows={2}
              value={form.patientInstructions.woundCare}
              onChange={e => setInstructions('woundCare', e.target.value)}
              placeholder={tr('تعليمات العناية بالجروح...', 'Wound care instructions...')}
              disabled={isSigned}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {tr('علامات التحذير', 'Warning Signs')}
            </label>
            <Textarea
              rows={3}
              value={form.patientInstructions.warningSigns}
              onChange={e => setInstructions('warningSigns', e.target.value)}
              placeholder={tr(
                'علامات تحذيرية تستدعي مراجعة الطوارئ...',
                'Warning signs that require emergency visit...'
              )}
              disabled={isSigned}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Action Buttons ──────────────────────────────────────────────────── */}
      {!isSigned && (
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {tr('حفظ كمسودة', 'Save Draft')}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSignature className="h-4 w-4" />
            )}
            {tr('توقيع وإنهاء', 'Sign & Finalize')}
          </Button>
        </div>
      )}
    </div>
  );
}
