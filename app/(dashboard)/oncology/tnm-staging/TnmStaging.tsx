'use client';

import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import useSWR, { mutate } from 'swr';
import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Activity,
  AlertTriangle,
  Calendar,
  BarChart3,
  Plus,
  Eye,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
} from 'lucide-react';
import {
  TNM_CANCER_TYPES,
  getTnmDefinition,
  calculateStageGroup,
  STAGING_TYPES,
  STAGING_METHODS,
  STAGING_SYSTEMS,
  type TnmDefinition,
  type BiomarkerField,
} from '@/lib/oncology/tnmDefinitions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StagingRecord {
  id: string;
  patientMasterId: string;
  cancerType: string;
  stagingSystem: string;
  stagingType: string;
  tCategory: string;
  nCategory: string;
  mCategory: string;
  stageGroup: string | null;
  gradeGroup: string | null;
  biomarkers: Record<string, unknown> | null;
  stagingDate: string;
  stagedBy: string;
  method: string | null;
  notes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const API = '/api/oncology/tnm-staging';

function stageColor(stage: string | null | undefined): string {
  if (!stage) return 'bg-muted text-foreground';
  const s = stage.toUpperCase();
  if (s.startsWith('IV')) return 'bg-red-100 text-red-800';
  if (s.startsWith('III')) return 'bg-orange-100 text-orange-800';
  if (s.startsWith('II')) return 'bg-blue-100 text-blue-800';
  // Stage 0 and all Stage I variants (IA, IA1, IA2, IB, IB3, etc.)
  if (s === '0' || s === 'I' || s.startsWith('IA') || s.startsWith('IB') || s.startsWith('IC')) {
    return 'bg-green-100 text-green-800';
  }
  return 'bg-muted text-foreground';
}

function stageSeverity(stage: string | null | undefined): number {
  if (!stage) return 0;
  const s = stage.toUpperCase();
  if (s === '0') return 0;
  if (s.startsWith('I') && !s.startsWith('II') && !s.startsWith('IV')) return 1;
  if (s.startsWith('II')) return 2;
  if (s.startsWith('III')) return 3;
  if (s.startsWith('IV')) return 4;
  return 0;
}

function cancerLabel(type: string, lang: string): string {
  const def = getTnmDefinition(type);
  if (!def) return type;
  return lang === 'ar' ? def.labelAr : def.labelEn;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TnmStaging() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // State
  const [cancerFilter, setCancerFilter] = useState<string>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<StagingRecord | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  // Data
  const { data, isLoading } = useSWR(API, fetcher, { refreshInterval: 30000 });
  const records: StagingRecord[] = data?.stagings ?? [];

  // Filtered list
  const filtered = useMemo(() => {
    if (cancerFilter === 'ALL') return records;
    return records.filter((r) => r.cancerType === cancerFilter);
  }, [records, cancerFilter]);

  // KPI calculations
  const totalStagings = records.length;

  const stageIVCount = useMemo(
    () => records.filter((r) => r.stageGroup && r.stageGroup.toUpperCase().startsWith('IV')).length,
    [records],
  );

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return records.filter((r) => new Date(r.stagingDate) >= startOfMonth).length;
  }, [records]);

  const mostCommonType = useMemo(() => {
    if (records.length === 0) return '-';
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      counts[r.cancerType] = (counts[r.cancerType] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? cancerLabel(top[0], language) : '-';
  }, [records, language]);

  // Patient history for the view dialog
  const patientHistory = useMemo(() => {
    if (!viewRecord) return [];
    return records
      .filter((r) => r.patientMasterId === viewRecord.patientMasterId)
      .sort((a, b) => new Date(a.stagingDate).getTime() - new Date(b.stagingDate).getTime());
  }, [viewRecord, records]);

  const handleView = (rec: StagingRecord) => {
    setViewRecord(rec);
    setViewOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('حاسبة تصنيف TNM', 'TNM Staging Calculator')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'تصنيف الأورام وفق نظام AJCC الإصدار الثامن',
              'AJCC 8th Edition Cancer Staging System',
            )}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {tr('تصنيف جديد', 'New Staging')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{tr('تصنيف TNM جديد', 'New TNM Staging')}</DialogTitle>
            </DialogHeader>
            <CreateStagingWizard
              language={language}
              tr={tr}
              onSuccess={() => {
                setCreateOpen(false);
                mutate(API);
                toast({
                  title: tr('تم الحفظ', 'Saved'),
                  description: tr('تم حفظ التصنيف بنجاح', 'Staging record saved successfully'),
                });
              }}
              onError={(msg: string) => {
                toast({ title: tr('خطأ', 'Error'), description: msg, variant: 'destructive' });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {tr('إجمالي التصنيفات', 'Total Stagings')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalStagings}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              {tr('المرحلة الرابعة', 'Stage IV')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stageIVCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {tr('هذا الشهر', 'This Month')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{thisMonthCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {tr('الأكثر شيوعاً', 'Most Common')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold truncate">{mostCommonType}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={cancerFilter} onValueChange={setCancerFilter}>
          <SelectTrigger className="w-full sm:w-[260px]">
            <SelectValue placeholder={tr('نوع السرطان', 'Cancer Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('جميع الأنواع', 'All Types')}</SelectItem>
            {TNM_CANCER_TYPES.map((ct) => (
              <SelectItem key={ct.cancerType} value={ct.cancerType}>
                {language === 'ar' ? ct.labelAr : ct.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Records Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              {tr('جارٍ التحميل...', 'Loading...')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{tr('لا توجد تصنيفات بعد', 'No staging records yet')}</p>
              <p className="text-xs mt-1">
                {tr('اضغط "تصنيف جديد" للبدء', 'Click "New Staging" to get started')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('التاريخ', 'Date')}</TableHead>
                  <TableHead>{tr('المريض', 'Patient')}</TableHead>
                  <TableHead>{tr('نوع السرطان', 'Cancer Type')}</TableHead>
                  <TableHead>{tr('TNM', 'TNM')}</TableHead>
                  <TableHead>{tr('المرحلة', 'Stage')}</TableHead>
                  <TableHead>{tr('النوع', 'Type')}</TableHead>
                  <TableHead>{tr('الطريقة', 'Method')}</TableHead>
                  <TableHead className="text-center">{tr('عرض', 'View')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(rec.stagingDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {rec.patientMasterId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm">
                      {cancerLabel(rec.cancerType, language)}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold">
                      {rec.tCategory} {rec.nCategory} {rec.mCategory}
                    </TableCell>
                    <TableCell>
                      <Badge className={stageColor(rec.stageGroup)}>
                        {tr('المرحلة', 'Stage')} {rec.stageGroup ?? '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {STAGING_TYPES.find((s) => s.value === rec.stagingType)?.[
                        language === 'ar' ? 'labelAr' : 'labelEn'
                      ] ?? rec.stagingType}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rec.method
                        ? STAGING_METHODS.find((m) => m.value === rec.method)?.[
                            language === 'ar' ? 'labelAr' : 'labelEn'
                          ] ?? rec.method
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" onClick={() => handleView(rec)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View / Compare Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('تفاصيل التصنيف', 'Staging Details')}</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <ViewStagingPanel
              record={viewRecord}
              history={patientHistory}
              language={language}
              tr={tr}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===========================================================================
// CreateStagingWizard — 4-step wizard
// ===========================================================================

interface WizardProps {
  language: string;
  tr: (ar: string, en: string) => string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function CreateStagingWizard({ language, tr, onSuccess, onError }: WizardProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [patientMasterId, setPatientMasterId] = useState('');
  const [cancerType, setCancerType] = useState('');
  const [stagingSystem, setStagingSystem] = useState('AJCC_8TH');
  const [stagingType, setStagingType] = useState('CLINICAL');

  // Step 2
  const [tCategory, setTCategory] = useState('');
  const [nCategory, setNCategory] = useState('');
  const [mCategory, setMCategory] = useState('');
  const [gradeGroup, setGradeGroup] = useState('');

  // Step 3
  const [biomarkers, setBiomarkers] = useState<Record<string, string>>({});

  // Step 4
  const [method, setMethod] = useState('');
  const [stagingDate, setStagingDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const def: TnmDefinition | undefined = getTnmDefinition(cancerType);

  // Live stage group calculation
  const liveStage = useMemo(() => {
    if (!cancerType || !tCategory || !nCategory || !mCategory) return null;
    return calculateStageGroup(cancerType, tCategory, nCategory, mCategory, biomarkers);
  }, [cancerType, tCategory, nCategory, mCategory, biomarkers]);

  const canProceedStep1 = patientMasterId.trim().length > 0 && cancerType.length > 0;
  const canProceedStep2 = tCategory.length > 0 && nCategory.length > 0 && mCategory.length > 0;

  const handleBiomarkerChange = useCallback((key: string, value: string) => {
    setBiomarkers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(API, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId,
          cancerType,
          stagingSystem,
          stagingType,
          tCategory,
          nCategory,
          mCategory,
          gradeGroup: gradeGroup || null,
          biomarkers: Object.keys(biomarkers).length > 0 ? biomarkers : null,
          method: method || null,
          stagingDate,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || res.statusText);
      }
      onSuccess();
    } catch (err: any) {
      onError(err.message || tr('حدث خطأ أثناء الحفظ', 'An error occurred while saving'));
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                s === step
                  ? 'bg-primary text-primary-foreground'
                  : s < step
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </div>
            {s < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* ------- Step 1: Patient + Cancer Type ------- */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            {tr('المعلومات الأساسية', 'Basic Information')}
          </h3>

          <div className="space-y-2">
            <Label>{tr('معرّف المريض', 'Patient ID')}</Label>
            <Input
              value={patientMasterId}
              onChange={(e) => setPatientMasterId(e.target.value)}
              placeholder={tr('أدخل معرّف المريض', 'Enter Patient Master ID')}
            />
          </div>

          <div className="space-y-2">
            <Label>{tr('نوع السرطان', 'Cancer Type')}</Label>
            <Select value={cancerType} onValueChange={(v) => {
              setCancerType(v);
              setTCategory('');
              setNCategory('');
              setMCategory('');
              setBiomarkers({});
            }}>
              <SelectTrigger>
                <SelectValue placeholder={tr('اختر نوع السرطان', 'Select Cancer Type')} />
              </SelectTrigger>
              <SelectContent>
                {TNM_CANCER_TYPES.map((ct) => (
                  <SelectItem key={ct.cancerType} value={ct.cancerType}>
                    {language === 'ar' ? ct.labelAr : ct.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tr('نظام التصنيف', 'Staging System')}</Label>
              <Select value={stagingSystem} onValueChange={setStagingSystem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGING_SYSTEMS.map((ss) => (
                    <SelectItem key={ss.value} value={ss.value}>
                      {language === 'ar' ? ss.labelAr : ss.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tr('نوع التصنيف', 'Staging Type')}</Label>
              <Select value={stagingType} onValueChange={setStagingType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGING_TYPES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>
                      {language === 'ar' ? st.labelAr : st.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* ------- Step 2: TNM Selection ------- */}
      {step === 2 && def && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            {tr('اختيار TNM', 'TNM Selection')} &mdash;{' '}
            {language === 'ar' ? def.labelAr : def.labelEn}
          </h3>

          {/* T Category */}
          <div className="space-y-2">
            <Label className="font-semibold text-base">
              {tr('تصنيف الورم (T)', 'Tumor Category (T)')}
            </Label>
            <Select value={tCategory} onValueChange={setTCategory}>
              <SelectTrigger>
                <SelectValue placeholder={tr('اختر T', 'Select T')} />
              </SelectTrigger>
              <SelectContent>
                {def.tCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="font-mono font-semibold">{cat.value}</span>
                    <span className="text-muted-foreground mx-2">-</span>
                    <span className="text-sm text-muted-foreground">{cat.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tCategory && (
              <p className="text-xs text-muted-foreground">
                {def.tCategories.find((c) => c.value === tCategory)?.description}
              </p>
            )}
          </div>

          {/* N Category */}
          <div className="space-y-2">
            <Label className="font-semibold text-base">
              {tr('تصنيف العقد الليمفاوية (N)', 'Node Category (N)')}
            </Label>
            <Select value={nCategory} onValueChange={setNCategory}>
              <SelectTrigger>
                <SelectValue placeholder={tr('اختر N', 'Select N')} />
              </SelectTrigger>
              <SelectContent>
                {def.nCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="font-mono font-semibold">{cat.value}</span>
                    <span className="text-muted-foreground mx-2">-</span>
                    <span className="text-sm text-muted-foreground">{cat.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {nCategory && (
              <p className="text-xs text-muted-foreground">
                {def.nCategories.find((c) => c.value === nCategory)?.description}
              </p>
            )}
          </div>

          {/* M Category */}
          <div className="space-y-2">
            <Label className="font-semibold text-base">
              {tr('تصنيف الانتشار (M)', 'Metastasis Category (M)')}
            </Label>
            <Select value={mCategory} onValueChange={setMCategory}>
              <SelectTrigger>
                <SelectValue placeholder={tr('اختر M', 'Select M')} />
              </SelectTrigger>
              <SelectContent>
                {def.mCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="font-mono font-semibold">{cat.value}</span>
                    <span className="text-muted-foreground mx-2">-</span>
                    <span className="text-sm text-muted-foreground">{cat.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mCategory && (
              <p className="text-xs text-muted-foreground">
                {def.mCategories.find((c) => c.value === mCategory)?.description}
              </p>
            )}
          </div>

          {/* Live Stage Group */}
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground mb-1">
              {tr('المرحلة المحسوبة تلقائياً', 'Auto-Calculated Stage Group')}
            </p>
            {liveStage ? (
              <div className="flex items-center gap-3">
                <Badge className={`text-lg px-4 py-1 ${stageColor(liveStage)}`}>
                  {tr('المرحلة', 'Stage')} {liveStage}
                </Badge>
                {stageSeverity(liveStage) >= 3 && (
                  <span className="text-sm text-orange-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {tr('مرحلة متقدمة', 'Advanced Stage')}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {tCategory && nCategory && mCategory
                  ? tr('لم يتم العثور على مرحلة مطابقة', 'No matching stage group found')
                  : tr('اختر T و N و M لحساب المرحلة', 'Select T, N, and M to calculate stage')}
              </p>
            )}
          </div>

          {/* Grade Group */}
          <div className="space-y-2">
            <Label>{tr('مجموعة الدرجة النسيجية', 'Histologic Grade Group')}</Label>
            <Select value={gradeGroup} onValueChange={setGradeGroup}>
              <SelectTrigger>
                <SelectValue placeholder={tr('اختياري', 'Optional')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="G1">{tr('G1 - متمايز جيداً', 'G1 - Well differentiated')}</SelectItem>
                <SelectItem value="G2">{tr('G2 - متمايز بشكل معتدل', 'G2 - Moderately differentiated')}</SelectItem>
                <SelectItem value="G3">{tr('G3 - ضعيف التمايز', 'G3 - Poorly differentiated')}</SelectItem>
                <SelectItem value="G4">{tr('G4 - غير متمايز', 'G4 - Undifferentiated')}</SelectItem>
                <SelectItem value="GX">{tr('GX - لا يمكن تقييمه', 'GX - Cannot be assessed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ------- Step 3: Biomarkers ------- */}
      {step === 3 && def && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            {tr('المؤشرات الحيوية', 'Biomarkers')} &mdash;{' '}
            {language === 'ar' ? def.labelAr : def.labelEn}
          </h3>

          {def.biomarkerFields.length === 0 ? (
            <p className="text-muted-foreground">
              {tr('لا توجد مؤشرات حيوية لهذا النوع', 'No biomarker fields for this cancer type')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {def.biomarkerFields.map((field: BiomarkerField) => (
                <div key={field.key} className="space-y-2">
                  <Label>{language === 'ar' ? field.labelAr : field.label}</Label>
                  {field.type === 'select' && field.options ? (
                    <Select
                      value={biomarkers[field.key] ?? ''}
                      onValueChange={(v) => handleBiomarkerChange(field.key, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tr('اختر', 'Select')} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'number' ? (
                    <Input
                      type="number"
                      value={biomarkers[field.key] ?? ''}
                      onChange={(e) => handleBiomarkerChange(field.key, e.target.value)}
                      placeholder={language === 'ar' ? field.labelAr : field.label}
                    />
                  ) : (
                    <Input
                      value={biomarkers[field.key] ?? ''}
                      onChange={(e) => handleBiomarkerChange(field.key, e.target.value)}
                      placeholder={language === 'ar' ? field.labelAr : field.label}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Show current staging context */}
          {liveStage && (
            <div className="rounded-lg border p-3 mt-4 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {tr('التصنيف الحالي:', 'Current staging:')}
              </span>
              <span className="font-mono font-semibold text-sm">
                {tCategory} {nCategory} {mCategory}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge className={stageColor(liveStage)}>
                {tr('المرحلة', 'Stage')} {liveStage}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* ------- Step 4: Review & Submit ------- */}
      {step === 4 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            {tr('المراجعة والتقديم', 'Review & Submit')}
          </h3>

          {/* TNM Summary Card */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{tr('نوع السرطان', 'Cancer Type')}</span>
                <span className="font-semibold">{cancerLabel(cancerType, language)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{tr('تصنيف TNM', 'TNM Classification')}</span>
                <span className="font-mono font-bold text-lg">{tCategory} {nCategory} {mCategory}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{tr('المرحلة', 'Stage Group')}</span>
                {liveStage ? (
                  <Badge className={`text-base px-3 py-1 ${stageColor(liveStage)}`}>
                    {tr('المرحلة', 'Stage')} {liveStage}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{tr('نوع التصنيف', 'Staging Type')}</span>
                <span>
                  {STAGING_TYPES.find((s) => s.value === stagingType)?.[
                    language === 'ar' ? 'labelAr' : 'labelEn'
                  ]}
                </span>
              </div>
              {gradeGroup && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{tr('الدرجة', 'Grade')}</span>
                  <span className="font-mono">{gradeGroup}</span>
                </div>
              )}
              {Object.keys(biomarkers).length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">{tr('المؤشرات الحيوية', 'Biomarkers')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(biomarkers)
                      .filter(([, v]) => v)
                      .map(([k, v]) => {
                        const field = def?.biomarkerFields.find((f) => f.key === k);
                        return (
                          <div key={k} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {field ? (language === 'ar' ? field.labelAr : field.label) : k}
                            </span>
                            <span className="font-medium">{v}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tr('طريقة التصنيف', 'Staging Method')}</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر الطريقة', 'Select Method')} />
                </SelectTrigger>
                <SelectContent>
                  {STAGING_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {language === 'ar' ? m.labelAr : m.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tr('تاريخ التصنيف', 'Staging Date')}</Label>
              <Input
                type="date"
                value={stagingDate}
                onChange={(e) => setStagingDate(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{tr('ملاحظات', 'Notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr('ملاحظات إضافية (اختياري)', 'Additional notes (optional)')}
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 1}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          {tr('السابق', 'Previous')}
        </Button>

        <div className="text-sm text-muted-foreground">
          {tr('الخطوة', 'Step')} {step} / 4
        </div>

        {step < 4 ? (
          <Button
            onClick={nextStep}
            disabled={
              (step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)
            }
            className="gap-1"
          >
            {tr('التالي', 'Next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} className="gap-1">
            {submitting
              ? tr('جارٍ الحفظ...', 'Saving...')
              : tr('حفظ التصنيف', 'Save Staging')}
          </Button>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// ViewStagingPanel — Details + History comparison
// ===========================================================================

interface ViewPanelProps {
  record: StagingRecord;
  history: StagingRecord[];
  language: string;
  tr: (ar: string, en: string) => string;
}

function ViewStagingPanel({ record, history, language, tr }: ViewPanelProps) {
  const def = getTnmDefinition(record.cancerType);

  return (
    <div className="space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Main details */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{tr('نوع السرطان', 'Cancer Type')}</span>
            <span className="font-semibold">{cancerLabel(record.cancerType, language)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{tr('تصنيف TNM', 'TNM')}</span>
            <span className="font-mono font-bold text-lg">
              {record.tCategory} {record.nCategory} {record.mCategory}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{tr('المرحلة', 'Stage')}</span>
            <Badge className={`text-base px-3 py-1 ${stageColor(record.stageGroup)}`}>
              {tr('المرحلة', 'Stage')} {record.stageGroup ?? '-'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{tr('نوع التصنيف', 'Type')}</span>
            <span>
              {STAGING_TYPES.find((s) => s.value === record.stagingType)?.[
                language === 'ar' ? 'labelAr' : 'labelEn'
              ] ?? record.stagingType}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{tr('النظام', 'System')}</span>
            <span>
              {STAGING_SYSTEMS.find((s) => s.value === record.stagingSystem)?.[
                language === 'ar' ? 'labelAr' : 'labelEn'
              ] ?? record.stagingSystem}
            </span>
          </div>

          {record.gradeGroup && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{tr('الدرجة', 'Grade')}</span>
              <span className="font-mono">{record.gradeGroup}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{tr('الطريقة', 'Method')}</span>
            <span>
              {record.method
                ? STAGING_METHODS.find((m) => m.value === record.method)?.[
                    language === 'ar' ? 'labelAr' : 'labelEn'
                  ] ?? record.method
                : '-'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{tr('التاريخ', 'Date')}</span>
            <span>
              {new Date(record.stagingDate).toLocaleDateString(
                language === 'ar' ? 'ar-SA' : 'en-US',
              )}
            </span>
          </div>

          {/* T description */}
          {def && (
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">{record.tCategory}:</span>{' '}
                {def.tCategories.find((c) => c.value === record.tCategory)?.description ?? '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">{record.nCategory}:</span>{' '}
                {def.nCategories.find((c) => c.value === record.nCategory)?.description ?? '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">{record.mCategory}:</span>{' '}
                {def.mCategories.find((c) => c.value === record.mCategory)?.description ?? '-'}
              </p>
            </div>
          )}

          {/* Biomarkers */}
          {record.biomarkers && Object.keys(record.biomarkers).length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-2">{tr('المؤشرات الحيوية', 'Biomarkers')}</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(record.biomarkers)
                  .filter(([, v]) => v)
                  .map(([k, v]) => {
                    const field = def?.biomarkerFields.find((f) => f.key === k);
                    return (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {field ? (language === 'ar' ? field.labelAr : field.label) : k}
                        </span>
                        <span className="font-medium">{String(v)}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Notes */}
          {record.notes && (
            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-1">{tr('ملاحظات', 'Notes')}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{record.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History / Comparison */}
      {history.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {tr('سجل التصنيف للمريض', 'Patient Staging History')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Stage migration timeline */}
            <div className="flex items-center gap-2 flex-wrap">
              {history.map((h, i) => (
                <div key={h.id} className="flex items-center gap-1">
                  <div className="text-center">
                    <Badge
                      className={`${stageColor(h.stageGroup)} ${h.id === record.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                    >
                      {h.stageGroup ?? '-'}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(h.stagingDate).toLocaleDateString(
                        language === 'ar' ? 'ar-SA' : 'en-US',
                        { month: 'short', year: '2-digit' },
                      )}
                    </p>
                  </div>
                  {i < history.length - 1 && (
                    <ArrowRight
                      className={`h-4 w-4 ${
                        stageSeverity(history[i + 1].stageGroup) > stageSeverity(h.stageGroup)
                          ? 'text-red-500'
                          : stageSeverity(history[i + 1].stageGroup) < stageSeverity(h.stageGroup)
                            ? 'text-green-500'
                            : 'text-muted-foreground'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Detailed history table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('التاريخ', 'Date')}</TableHead>
                  <TableHead>{tr('TNM', 'TNM')}</TableHead>
                  <TableHead>{tr('المرحلة', 'Stage')}</TableHead>
                  <TableHead>{tr('النوع', 'Type')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow
                    key={h.id}
                    className={h.id === record.id ? 'bg-primary/5' : ''}
                  >
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(h.stagingDate).toLocaleDateString(
                        language === 'ar' ? 'ar-SA' : 'en-US',
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold">
                      {h.tCategory} {h.nCategory} {h.mCategory}
                    </TableCell>
                    <TableCell>
                      <Badge className={stageColor(h.stageGroup)}>
                        {h.stageGroup ?? '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {STAGING_TYPES.find((s) => s.value === h.stagingType)?.[
                        language === 'ar' ? 'labelAr' : 'labelEn'
                      ] ?? h.stagingType}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Stage change summary */}
            {history.length >= 2 && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium mb-1">
                  {tr('ملخص تغيير المرحلة', 'Stage Change Summary')}
                </p>
                <div className="flex items-center gap-2">
                  <Badge className={stageColor(history[0].stageGroup)}>
                    {tr('المرحلة', 'Stage')} {history[0].stageGroup ?? '-'}
                  </Badge>
                  <ArrowRight
                    className={`h-5 w-5 ${
                      stageSeverity(history[history.length - 1].stageGroup) >
                      stageSeverity(history[0].stageGroup)
                        ? 'text-red-500'
                        : stageSeverity(history[history.length - 1].stageGroup) <
                            stageSeverity(history[0].stageGroup)
                          ? 'text-green-500'
                          : 'text-muted-foreground'
                    }`}
                  />
                  <Badge className={stageColor(history[history.length - 1].stageGroup)}>
                    {tr('المرحلة', 'Stage')} {history[history.length - 1].stageGroup ?? '-'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({history.length} {tr('تصنيفات', 'stagings')})
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
