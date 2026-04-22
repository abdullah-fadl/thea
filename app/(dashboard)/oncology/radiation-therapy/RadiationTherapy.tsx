'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Zap, CalendarDays, CheckCircle2, TrendingUp, Plus, Eye, X, FileText,
  Activity, AlertTriangle, BarChart3, Loader2,
} from 'lucide-react';
import {
  RT_TECHNIQUES, RT_INTENTS, RT_FREQUENCIES, SETUP_VERIFICATIONS,
  SKIN_REACTIONS, PATIENT_TOLERANCE, SESSION_STATUS, PLAN_STATUS,
  STANDARD_SCHEMES, OAR_CONSTRAINTS,
  getOptionLabel, calculateEstimatedEndDate,
  type BilingualOption, type OARConstraint, type FractionationScheme,
} from '@/lib/oncology/radiationDefinitions';

// =============================================================================
// Types
// =============================================================================
interface RadiationPlan {
  id: string;
  tenantId: string;
  patientMasterId: string;
  planName: string;
  technique: string;
  intent: string | null;
  targetSite: string | null;
  targetVolumes: any;
  totalDoseGy: number;
  dosePerFraction: number;
  totalFractions: number;
  completedFractions: number;
  frequency: string;
  machine: string | null;
  energy: string | null;
  startDate: string;
  endDate: string | null;
  concurrentChemo: string | null;
  oarConstraints: any;
  status: string;
  suspendReason: string | null;
  physicist: string | null;
  oncologistId: string | null;
  notes: string | null;
  sessions: RadiationSessionPartial[];
  sessionCount: number;
  totalDeliveredDoseGy: number;
  createdAt: string;
  updatedAt: string;
}

interface RadiationSessionPartial {
  id: string;
  fractionNumber: number;
  status: string;
  deliveredDoseGy: number;
}

interface RadiationSessionFull {
  id: string;
  tenantId: string;
  planId: string;
  fractionNumber: number;
  sessionDate: string;
  deliveredDoseGy: number;
  machine: string | null;
  technician: string | null;
  setupVerification: string | null;
  skinReaction: string | null;
  patientTolerance: string | null;
  isocenterShift: any;
  treatmentTime: number | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

interface TargetVolume {
  name: string;
  prescribedDoseGy: number;
}

// =============================================================================
// Fetcher
// =============================================================================
const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// =============================================================================
// Main Component
// =============================================================================
export function RadiationTherapy() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // ---- State ----
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [techniqueFilter, setTechniqueFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewPlan, setViewPlan] = useState<RadiationPlan | null>(null);
  const [showSessionDialog, setShowSessionDialog] = useState(false);

  // ---- Data ----
  const { data: plansData, isLoading } = useSWR('/api/oncology/radiation-therapy', fetcher, {
    refreshInterval: 30000,
  });
  const plans: RadiationPlan[] = plansData?.plans ?? [];

  // ---- Filters ----
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (techniqueFilter !== 'ALL' && p.technique !== techniqueFilter) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const matchName = p.planName?.toLowerCase().includes(q);
        const matchPatient = p.patientMasterId?.toLowerCase().includes(q);
        const matchSite = p.targetSite?.toLowerCase().includes(q);
        if (!matchName && !matchPatient && !matchSite) return false;
      }
      return true;
    });
  }, [plans, statusFilter, techniqueFilter, searchText]);

  // ---- KPIs ----
  const activePlans = plans.filter((p) => p.status === 'IN_PROGRESS').length;
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const sessionsThisWeek = plans.reduce((sum, p) => {
    return sum + (p.sessions || []).filter((s) => {
      return s.status === 'COMPLETED';
    }).length;
  }, 0);
  const completedPlans = plans.filter((p) => p.status === 'COMPLETED').length;
  const avgCompletion = plans.length > 0
    ? Math.round(
        plans.reduce((sum, p) => {
          const pct = p.totalFractions > 0 ? (p.completedFractions / p.totalFractions) * 100 : 0;
          return sum + pct;
        }, 0) / plans.length,
      )
    : 0;

  // ---- Status Badge ----
  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      PLANNED: 'bg-muted text-foreground',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-orange-100 text-orange-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return map[s] ?? 'bg-muted text-muted-foreground';
  };

  // ---- Refresh ----
  const refresh = () => globalMutate('/api/oncology/radiation-therapy');

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {tr('سجل العلاج الإشعاعي', 'Radiation Therapy Log')}
        </h1>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {tr('خطة علاج جديدة', 'New Treatment Plan')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              {tr('خطط نشطة', 'Active Plans')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activePlans}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {tr('جلسات هذا الأسبوع', 'Sessions This Week')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{sessionsThisWeek}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {tr('خطط مكتملة', 'Completed Plans')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedPlans}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {tr('متوسط الإنجاز', 'Avg Completion')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{avgCompletion}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={tr('بحث بالاسم أو الموقع...', 'Search by name or site...')}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:max-w-[180px]">
            <SelectValue placeholder={tr('الحالة', 'Status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
            {PLAN_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {language === 'ar' ? s.labelAr : s.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={techniqueFilter} onValueChange={setTechniqueFilter}>
          <SelectTrigger className="sm:max-w-[180px]">
            <SelectValue placeholder={tr('التقنية', 'Technique')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
            {RT_TECHNIQUES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {language === 'ar' ? t.labelAr : t.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plans Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {tr('لا توجد خطط علاج إشعاعي', 'No radiation therapy plans found')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('المريض', 'Patient')}</TableHead>
                <TableHead>{tr('اسم الخطة', 'Plan Name')}</TableHead>
                <TableHead>{tr('التقنية', 'Technique')}</TableHead>
                <TableHead>{tr('الموقع', 'Site')}</TableHead>
                <TableHead>{tr('الجرعة', 'Dose')}</TableHead>
                <TableHead>{tr('الجلسات', 'Fractions')}</TableHead>
                <TableHead>{tr('التقدم', 'Progress')}</TableHead>
                <TableHead>{tr('الحالة', 'Status')}</TableHead>
                <TableHead>{tr('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => {
                const pct = plan.totalFractions > 0
                  ? Math.round((plan.completedFractions / plan.totalFractions) * 100)
                  : 0;
                return (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium text-xs">
                      {plan.patientMasterId?.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-semibold">{plan.planName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getOptionLabel(RT_TECHNIQUES, plan.technique, language)}
                      </Badge>
                    </TableCell>
                    <TableCell>{plan.targetSite || '-'}</TableCell>
                    <TableCell className="text-xs">
                      {plan.totalDoseGy} Gy / {plan.dosePerFraction} Gy
                    </TableCell>
                    <TableCell className="text-sm">
                      {plan.completedFractions}/{plan.totalFractions}
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadge(plan.status)}>
                        {getOptionLabel(PLAN_STATUS, plan.status, language)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewPlan(plan)}
                        className="gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {tr('عرض', 'View')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Plan Dialog */}
      {showCreateDialog && (
        <CreatePlanDialog
          language={language}
          tr={tr}
          toast={toast}
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => {
            setShowCreateDialog(false);
            refresh();
          }}
        />
      )}

      {/* View/Manage Plan Dialog */}
      {viewPlan && (
        <ViewPlanDialog
          plan={viewPlan}
          language={language}
          tr={tr}
          toast={toast}
          onClose={() => setViewPlan(null)}
          onRefresh={() => {
            refresh();
            setViewPlan(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Create Plan Dialog
// =============================================================================
function CreatePlanDialog({
  language,
  tr,
  toast,
  onClose,
  onCreated,
}: {
  language: string;
  tr: (ar: string, en: string) => string;
  toast: any;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientMasterId: '',
    planName: '',
    technique: 'IMRT',
    intent: 'CURATIVE',
    frequency: 'DAILY_5',
    targetSite: '',
    totalDoseGy: '',
    dosePerFraction: '',
    totalFractions: '',
    machine: '',
    energy: '',
    physicist: '',
    concurrentChemo: '',
    startDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [targetVolumes, setTargetVolumes] = useState<TargetVolume[]>([
    { name: 'GTV', prescribedDoseGy: 0 },
    { name: 'CTV', prescribedDoseGy: 0 },
    { name: 'PTV', prescribedDoseGy: 0 },
  ]);
  const [oarConstraints, setOarConstraints] = useState<OARConstraint[]>([]);
  const [selectedScheme, setSelectedScheme] = useState('');

  // Auto-populate OAR when site changes
  const handleSiteChange = (site: string) => {
    setForm((prev) => ({ ...prev, targetSite: site }));
    const constraints = OAR_CONSTRAINTS[site];
    if (constraints) {
      setOarConstraints([...constraints]);
    }
  };

  // Apply standard scheme
  const applyScheme = (schemeName: string) => {
    const scheme = STANDARD_SCHEMES.find((s) => s.name === schemeName);
    if (!scheme) return;
    setForm((prev) => ({
      ...prev,
      totalDoseGy: String(scheme.totalDoseGy),
      dosePerFraction: String(scheme.dosePerFraction),
      totalFractions: String(scheme.fractions),
      technique: scheme.technique,
      targetSite: scheme.site,
    }));
    setSelectedScheme(schemeName);
    // Auto-populate OAR
    const constraints = OAR_CONSTRAINTS[scheme.site];
    if (constraints) {
      setOarConstraints([...constraints]);
    }
  };

  // Estimated end date
  const estimatedEnd = useMemo(() => {
    if (!form.startDate || !form.totalFractions) return '';
    const fractions = Number(form.totalFractions);
    if (fractions <= 0) return '';
    const end = calculateEstimatedEndDate(new Date(form.startDate), fractions, form.frequency);
    return end.toISOString().slice(0, 10);
  }, [form.startDate, form.totalFractions, form.frequency]);

  const handleSubmit = async () => {
    if (!form.patientMasterId || !form.planName || !form.totalDoseGy || !form.dosePerFraction || !form.totalFractions) {
      toast({ title: tr('يرجى ملء الحقول المطلوبة', 'Please fill in required fields'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/oncology/radiation-therapy', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          totalDoseGy: Number(form.totalDoseGy),
          dosePerFraction: Number(form.dosePerFraction),
          totalFractions: Number(form.totalFractions),
          targetVolumes: targetVolumes.filter((tv) => tv.prescribedDoseGy > 0),
          oarConstraints: oarConstraints.length > 0 ? oarConstraints : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create plan');
      }
      toast({ title: tr('تم إنشاء الخطة بنجاح', 'Plan created successfully') });
      onCreated();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr('خطة علاج إشعاعي جديدة', 'New Radiation Therapy Plan')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">
              {tr('المعلومات الأساسية', 'Basic Information')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{tr('معرف المريض *', 'Patient ID *')}</Label>
                <Input
                  value={form.patientMasterId}
                  onChange={(e) => setForm((prev) => ({ ...prev, patientMasterId: e.target.value }))}
                  placeholder={tr('معرف المريض', 'Patient master ID')}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('اسم الخطة *', 'Plan Name *')}</Label>
                <Input
                  value={form.planName}
                  onChange={(e) => setForm((prev) => ({ ...prev, planName: e.target.value }))}
                  placeholder={tr('مثال: ثدي أيمن', 'e.g., Right Breast')}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('التقنية', 'Technique')}</Label>
                <Select value={form.technique} onValueChange={(v) => setForm((prev) => ({ ...prev, technique: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RT_TECHNIQUES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {language === 'ar' ? t.labelAr : t.labelEn}
                        {t.description ? ` - ${t.description}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{tr('الغرض', 'Intent')}</Label>
                <Select value={form.intent} onValueChange={(v) => setForm((prev) => ({ ...prev, intent: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RT_INTENTS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {language === 'ar' ? i.labelAr : i.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{tr('التكرار', 'Frequency')}</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm((prev) => ({ ...prev, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RT_FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {language === 'ar' ? f.labelAr : f.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Dose Prescription */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-muted-foreground">
                {tr('وصفة الجرعة', 'Dose Prescription')}
              </h3>
              <Select value={selectedScheme} onValueChange={applyScheme}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={tr('استخدام مخطط قياسي', 'Use Standard Scheme')} />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_SCHEMES.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name} ({s.totalDoseGy} Gy / {s.fractions} fx)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{tr('الجرعة الكلية (Gy) *', 'Total Dose (Gy) *')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.totalDoseGy}
                  onChange={(e) => setForm((prev) => ({ ...prev, totalDoseGy: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('جرعة الجلسة (Gy) *', 'Dose/Fraction (Gy) *')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.dosePerFraction}
                  onChange={(e) => setForm((prev) => ({ ...prev, dosePerFraction: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('عدد الجلسات *', 'Total Fractions *')}</Label>
                <Input
                  type="number"
                  value={form.totalFractions}
                  onChange={(e) => setForm((prev) => ({ ...prev, totalFractions: e.target.value }))}
                />
              </div>
            </div>
          </section>

          {/* Target */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">
              {tr('الهدف', 'Target')}
            </h3>
            <div className="space-y-1">
              <Label>{tr('الموقع المستهدف', 'Target Site')}</Label>
              <Input
                value={form.targetSite}
                onChange={(e) => handleSiteChange(e.target.value)}
                placeholder={tr('مثال: الثدي، البروستاتا', 'e.g., Breast, Prostate')}
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('الأحجام المستهدفة', 'Target Volumes')}</Label>
              {targetVolumes.map((tv, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={tv.name}
                    onChange={(e) => {
                      const updated = [...targetVolumes];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setTargetVolumes(updated);
                    }}
                    className="w-24"
                    placeholder="GTV/CTV/PTV"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={tv.prescribedDoseGy || ''}
                    onChange={(e) => {
                      const updated = [...targetVolumes];
                      updated[idx] = { ...updated[idx], prescribedDoseGy: Number(e.target.value) };
                      setTargetVolumes(updated);
                    }}
                    className="w-32"
                    placeholder="Gy"
                  />
                  <span className="text-xs text-muted-foreground">Gy</span>
                </div>
              ))}
            </div>
          </section>

          {/* OAR Constraints */}
          {oarConstraints.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                {tr('قيود الأعضاء المعرضة للخطر', 'OAR Constraints')}
              </h3>
              <div className="space-y-2">
                {oarConstraints.map((oar, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Input
                      value={oar.organ}
                      onChange={(e) => {
                        const updated = [...oarConstraints];
                        updated[idx] = { ...updated[idx], organ: e.target.value };
                        setOarConstraints(updated);
                      }}
                      className="w-40"
                    />
                    <Input
                      value={oar.constraint}
                      onChange={(e) => {
                        const updated = [...oarConstraints];
                        updated[idx] = { ...updated[idx], constraint: e.target.value };
                        setOarConstraints(updated);
                      }}
                      className="w-28"
                    />
                    <Input
                      value={oar.limit}
                      onChange={(e) => {
                        const updated = [...oarConstraints];
                        updated[idx] = { ...updated[idx], limit: e.target.value };
                        setOarConstraints(updated);
                      }}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOarConstraints((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOarConstraints((prev) => [...prev, { organ: '', constraint: '', limit: '' }])
                  }
                >
                  <Plus className="h-3 w-3 me-1" />
                  {tr('إضافة قيد', 'Add Constraint')}
                </Button>
              </div>
            </section>
          )}

          {/* Concurrent Chemo */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">
              {tr('العلاج الكيميائي المتزامن', 'Concurrent Chemotherapy')}
            </h3>
            <Input
              value={form.concurrentChemo}
              onChange={(e) => setForm((prev) => ({ ...prev, concurrentChemo: e.target.value }))}
              placeholder={tr('اختياري - مثال: سيسبلاتين', 'Optional - e.g., Cisplatin weekly')}
            />
          </section>

          {/* Machine, Energy, Physicist */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">
              {tr('الجهاز والطاقم', 'Machine & Staff')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{tr('الجهاز', 'Machine')}</Label>
                <Input
                  value={form.machine}
                  onChange={(e) => setForm((prev) => ({ ...prev, machine: e.target.value }))}
                  placeholder={tr('مثال: TrueBeam', 'e.g., TrueBeam')}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('الطاقة', 'Energy')}</Label>
                <Input
                  value={form.energy}
                  onChange={(e) => setForm((prev) => ({ ...prev, energy: e.target.value }))}
                  placeholder={tr('مثال: 6 MV', 'e.g., 6 MV')}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('الفيزيائي', 'Physicist')}</Label>
                <Input
                  value={form.physicist}
                  onChange={(e) => setForm((prev) => ({ ...prev, physicist: e.target.value }))}
                />
              </div>
            </div>
          </section>

          {/* Start Date & Estimated End */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">
              {tr('التواريخ', 'Dates')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{tr('تاريخ البدء', 'Start Date')}</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('تاريخ الانتهاء المتوقع', 'Estimated End Date')}</Label>
                <Input type="date" value={estimatedEnd} disabled className="bg-muted" />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-2">
            <Label>{tr('ملاحظات', 'Notes')}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
            />
          </section>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">{tr('إلغاء', 'Cancel')}</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {tr('إنشاء الخطة', 'Create Plan')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// View / Manage Plan Dialog (Tabbed)
// =============================================================================
function ViewPlanDialog({
  plan,
  language,
  tr,
  toast,
  onClose,
  onRefresh,
}: {
  plan: RadiationPlan;
  language: string;
  tr: (ar: string, en: string) => string;
  toast: any;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState('summary');
  const [showRecordSession, setShowRecordSession] = useState(false);

  // Fetch full sessions for this plan
  const { data: sessionsData, mutate: mutateSessions } = useSWR(
    `/api/oncology/radiation-therapy/sessions?planId=${plan.id}`,
    fetcher,
  );
  const sessions: RadiationSessionFull[] = sessionsData?.sessions ?? [];

  // Status badge
  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      PLANNED: 'bg-muted text-foreground',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-orange-100 text-orange-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return map[s] ?? 'bg-muted text-muted-foreground';
  };

  const pct = plan.totalFractions > 0
    ? Math.round((plan.completedFractions / plan.totalFractions) * 100)
    : 0;

  // Cumulative dose data
  const cumulativeDoseData = useMemo(() => {
    let cumulative = 0;
    return sessions
      .filter((s) => s.status === 'COMPLETED')
      .sort((a, b) => a.fractionNumber - b.fractionNumber)
      .map((s) => {
        cumulative += s.deliveredDoseGy;
        return {
          fraction: s.fractionNumber,
          delivered: s.deliveredDoseGy,
          planned: plan.dosePerFraction,
          cumulative,
          plannedCumulative: s.fractionNumber * plan.dosePerFraction,
        };
      });
  }, [sessions, plan.dosePerFraction]);

  // Skin reaction timeline
  const skinTimeline = useMemo(() => {
    return sessions
      .filter((s) => s.status === 'COMPLETED')
      .sort((a, b) => a.fractionNumber - b.fractionNumber)
      .map((s) => ({
        fraction: s.fractionNumber,
        date: new Date(s.sessionDate).toLocaleDateString(),
        reaction: s.skinReaction || 'NONE',
        tolerance: s.patientTolerance || 'GOOD',
      }));
  }, [sessions]);

  // Plan status update
  const updatePlanStatus = async (newStatus: string, suspendReason?: string) => {
    try {
      const res = await fetch('/api/oncology/radiation-therapy', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, status: newStatus, suspendReason }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast({ title: tr('تم تحديث الحالة', 'Status updated') });
      onRefresh();
    } catch {
      toast({ title: tr('فشل في التحديث', 'Failed to update'), variant: 'destructive' });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">
              {plan.planName}
              <Badge className={`ms-2 ${statusBadge(plan.status)}`}>
                {getOptionLabel(PLAN_STATUS, plan.status, language as 'ar' | 'en')}
              </Badge>
            </DialogTitle>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="summary" className="gap-1 text-xs">
              <FileText className="h-3 w-3" />
              {tr('الملخص', 'Summary')}
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-1 text-xs">
              <CalendarDays className="h-3 w-3" />
              {tr('الجلسات', 'Sessions')}
            </TabsTrigger>
            <TabsTrigger value="dose" className="gap-1 text-xs">
              <BarChart3 className="h-3 w-3" />
              {tr('تحليل الجرعة', 'Dose Analysis')}
            </TabsTrigger>
            <TabsTrigger value="toxicity" className="gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />
              {tr('السمية', 'Toxicity')}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Plan Summary */}
          <TabsContent value="summary" className="space-y-4 mt-4">
            {/* Progress visualization */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {tr('تقدم العلاج', 'Treatment Progress')}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {plan.completedFractions} / {plan.totalFractions} {tr('جلسة', 'fractions')} ({pct}%)
                  </span>
                </div>
                <Progress value={pct} className="h-4" />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {tr('الجرعة المعطاة', 'Delivered')}: {plan.totalDeliveredDoseGy?.toFixed(1) ?? 0} Gy
                  </span>
                  <span>
                    {tr('الجرعة الكلية', 'Total Prescribed')}: {plan.totalDoseGy} Gy
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Plan details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{tr('تفاصيل الخطة', 'Plan Details')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <DetailRow label={tr('المريض', 'Patient')} value={plan.patientMasterId} />
                  <DetailRow
                    label={tr('التقنية', 'Technique')}
                    value={getOptionLabel(RT_TECHNIQUES, plan.technique, language as 'ar' | 'en')}
                  />
                  <DetailRow
                    label={tr('الغرض', 'Intent')}
                    value={plan.intent ? getOptionLabel(RT_INTENTS, plan.intent, language as 'ar' | 'en') : '-'}
                  />
                  <DetailRow label={tr('الموقع المستهدف', 'Target Site')} value={plan.targetSite || '-'} />
                  <DetailRow
                    label={tr('التكرار', 'Frequency')}
                    value={getOptionLabel(RT_FREQUENCIES, plan.frequency, language as 'ar' | 'en')}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{tr('وصفة الجرعة', 'Dose Prescription')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <DetailRow label={tr('الجرعة الكلية', 'Total Dose')} value={`${plan.totalDoseGy} Gy`} />
                  <DetailRow label={tr('جرعة الجلسة', 'Dose/Fraction')} value={`${plan.dosePerFraction} Gy`} />
                  <DetailRow label={tr('عدد الجلسات', 'Total Fractions')} value={String(plan.totalFractions)} />
                  <DetailRow label={tr('الجهاز', 'Machine')} value={plan.machine || '-'} />
                  <DetailRow label={tr('الطاقة', 'Energy')} value={plan.energy || '-'} />
                  <DetailRow label={tr('الفيزيائي', 'Physicist')} value={plan.physicist || '-'} />
                </CardContent>
              </Card>
            </div>

            {/* Dates */}
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <DetailRow
                    label={tr('تاريخ البدء', 'Start Date')}
                    value={plan.startDate ? new Date(plan.startDate).toLocaleDateString() : '-'}
                  />
                  <DetailRow
                    label={tr('تاريخ الانتهاء المتوقع', 'Est. End Date')}
                    value={plan.endDate ? new Date(plan.endDate).toLocaleDateString() : '-'}
                  />
                  <DetailRow
                    label={tr('العلاج الكيميائي المتزامن', 'Concurrent Chemo')}
                    value={plan.concurrentChemo || '-'}
                  />
                  <DetailRow label={tr('ملاحظات', 'Notes')} value={plan.notes || '-'} />
                </div>
              </CardContent>
            </Card>

            {/* OAR Constraints */}
            {plan.oarConstraints && Array.isArray(plan.oarConstraints) && plan.oarConstraints.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{tr('قيود الأعضاء المعرضة', 'OAR Constraints')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tr('العضو', 'Organ')}</TableHead>
                        <TableHead>{tr('القيد', 'Constraint')}</TableHead>
                        <TableHead>{tr('الحد', 'Limit')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(plan.oarConstraints as OARConstraint[]).map((oar, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{oar.organ}</TableCell>
                          <TableCell>{oar.constraint}</TableCell>
                          <TableCell>{oar.limit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Target volumes */}
            {plan.targetVolumes && Array.isArray(plan.targetVolumes) && plan.targetVolumes.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{tr('الأحجام المستهدفة', 'Target Volumes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tr('الاسم', 'Name')}</TableHead>
                        <TableHead>{tr('الجرعة الموصوفة', 'Prescribed Dose')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(plan.targetVolumes as TargetVolume[]).map((tv, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{tv.name}</TableCell>
                          <TableCell>{tv.prescribedDoseGy} Gy</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Status Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              {plan.status === 'PLANNED' && (
                <Button size="sm" onClick={() => updatePlanStatus('IN_PROGRESS')}>
                  {tr('بدء العلاج', 'Start Treatment')}
                </Button>
              )}
              {plan.status === 'IN_PROGRESS' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => updatePlanStatus('SUSPENDED')}>
                    {tr('تعليق', 'Suspend')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updatePlanStatus('COMPLETED')}>
                    {tr('إكمال', 'Complete')}
                  </Button>
                </>
              )}
              {plan.status === 'SUSPENDED' && (
                <Button size="sm" onClick={() => updatePlanStatus('IN_PROGRESS')}>
                  {tr('استئناف', 'Resume')}
                </Button>
              )}
              {(plan.status === 'PLANNED' || plan.status === 'IN_PROGRESS') && (
                <Button size="sm" variant="destructive" onClick={() => updatePlanStatus('CANCELLED')}>
                  {tr('إلغاء', 'Cancel')}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Tab 2: Session Log */}
          <TabsContent value="sessions" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {tr('سجل الجلسات', 'Session Log')}
                <span className="text-sm text-muted-foreground ms-2">
                  ({sessions.length} {tr('جلسة', 'sessions')})
                </span>
              </h3>
              {(plan.status === 'IN_PROGRESS' || plan.status === 'PLANNED') && (
                <Button size="sm" onClick={() => setShowRecordSession(true)} className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  {tr('تسجيل جلسة', 'Record Session')}
                </Button>
              )}
            </div>

            {sessions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {tr('لا توجد جلسات مسجلة بعد', 'No sessions recorded yet')}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{tr('التاريخ', 'Date')}</TableHead>
                      <TableHead>{tr('الجرعة', 'Dose')}</TableHead>
                      <TableHead>{tr('التحقق', 'Verification')}</TableHead>
                      <TableHead>{tr('رد فعل الجلد', 'Skin Reaction')}</TableHead>
                      <TableHead>{tr('التحمل', 'Tolerance')}</TableHead>
                      <TableHead>{tr('مدة العلاج', 'Tx Time')}</TableHead>
                      <TableHead>{tr('الحالة', 'Status')}</TableHead>
                      <TableHead>{tr('ملاحظات', 'Notes')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-bold">{s.fractionNumber}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(s.sessionDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className={s.deliveredDoseGy !== plan.dosePerFraction ? 'text-orange-600 font-semibold' : ''}>
                            {s.deliveredDoseGy} Gy
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {s.setupVerification
                            ? getOptionLabel(SETUP_VERIFICATIONS, s.setupVerification, language as 'ar' | 'en')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <SkinReactionBadge
                            reaction={s.skinReaction || 'NONE'}
                            language={language}
                          />
                        </TableCell>
                        <TableCell>
                          <ToleranceBadge
                            tolerance={s.patientTolerance || 'GOOD'}
                            language={language}
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          {s.treatmentTime ? `${s.treatmentTime} ${tr('دقيقة', 'min')}` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            s.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            s.status === 'MISSED' ? 'bg-red-100 text-red-800' :
                            'bg-muted text-foreground'
                          }>
                            {getOptionLabel(SESSION_STATUS, s.status, language as 'ar' | 'en')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">
                          {s.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* Record Session Sub-Dialog */}
            {showRecordSession && (
              <RecordSessionDialog
                planId={plan.id}
                planDosePerFraction={plan.dosePerFraction}
                planMachine={plan.machine}
                lastFraction={sessions.length > 0 ? Math.max(...sessions.map((s) => s.fractionNumber)) : 0}
                language={language}
                tr={tr}
                toast={toast}
                onClose={() => setShowRecordSession(false)}
                onCreated={() => {
                  setShowRecordSession(false);
                  mutateSessions();
                  onRefresh();
                }}
              />
            )}
          </TabsContent>

          {/* Tab 3: Dose Analysis */}
          <TabsContent value="dose" className="space-y-4 mt-4">
            <h3 className="font-semibold">{tr('تحليل الجرعة', 'Dose Analysis')}</h3>

            {cumulativeDoseData.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {tr('لا توجد بيانات جرعة بعد', 'No dose data available yet')}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Cumulative Dose Chart (simple bar representation) */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {tr('الجرعة التراكمية', 'Cumulative Dose')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {cumulativeDoseData.map((d) => {
                        const maxDose = plan.totalDoseGy;
                        const cumPct = (d.cumulative / maxDose) * 100;
                        const plannedPct = (d.plannedCumulative / maxDose) * 100;
                        return (
                          <div key={d.fraction} className="flex items-center gap-2">
                            <span className="text-xs w-6 text-muted-foreground font-mono">
                              #{d.fraction}
                            </span>
                            <div className="flex-1 h-5 bg-muted rounded relative overflow-hidden">
                              {/* Planned reference line */}
                              <div
                                className="absolute top-0 h-full border-r-2 border-dashed border-gray-400 z-10"
                                style={{ left: `${Math.min(plannedPct, 100)}%` }}
                              />
                              {/* Delivered bar */}
                              <div
                                className={`h-full rounded transition-all ${
                                  Math.abs(d.cumulative - d.plannedCumulative) > d.planned * 0.1
                                    ? 'bg-orange-500'
                                    : 'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(cumPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs w-16 text-end font-mono">
                              {d.cumulative.toFixed(1)} Gy
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 rounded" />
                        {tr('الجرعة المعطاة', 'Delivered')}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 border-t-2 border-dashed border-gray-400" style={{ width: 12 }} />
                        {tr('المخطط', 'Planned')}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-orange-500 rounded" />
                        {tr('انحراف >10%', 'Deviation >10%')}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Planned vs Delivered Table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {tr('المقارنة بين المخطط والمعطى', 'Planned vs Delivered')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tr('الجلسة', 'Fraction')}</TableHead>
                          <TableHead>{tr('المخطط (Gy)', 'Planned (Gy)')}</TableHead>
                          <TableHead>{tr('المعطى (Gy)', 'Delivered (Gy)')}</TableHead>
                          <TableHead>{tr('الفرق (Gy)', 'Difference (Gy)')}</TableHead>
                          <TableHead>{tr('التراكمي (Gy)', 'Cumulative (Gy)')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cumulativeDoseData.map((d) => {
                          const diff = d.delivered - d.planned;
                          return (
                            <TableRow key={d.fraction}>
                              <TableCell className="font-mono">#{d.fraction}</TableCell>
                              <TableCell>{d.planned.toFixed(2)}</TableCell>
                              <TableCell>{d.delivered.toFixed(2)}</TableCell>
                              <TableCell className={diff !== 0 ? 'text-orange-600 font-semibold' : ''}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {d.cumulative.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Dose summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">{tr('الجرعة الكلية المخططة', 'Total Planned')}</p>
                      <p className="text-xl font-bold">{plan.totalDoseGy} Gy</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">{tr('الجرعة المعطاة', 'Total Delivered')}</p>
                      <p className="text-xl font-bold">
                        {cumulativeDoseData.length > 0
                          ? cumulativeDoseData[cumulativeDoseData.length - 1].cumulative.toFixed(1)
                          : 0}{' '}
                        Gy
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">{tr('الجلسات المكتملة', 'Completed Fractions')}</p>
                      <p className="text-xl font-bold">{cumulativeDoseData.length} / {plan.totalFractions}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">{tr('الجرعة المتبقية', 'Remaining Dose')}</p>
                      <p className="text-xl font-bold">
                        {(
                          plan.totalDoseGy -
                          (cumulativeDoseData.length > 0
                            ? cumulativeDoseData[cumulativeDoseData.length - 1].cumulative
                            : 0)
                        ).toFixed(1)}{' '}
                        Gy
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Tab 4: Toxicity */}
          <TabsContent value="toxicity" className="space-y-4 mt-4">
            <h3 className="font-semibold">{tr('متابعة السمية', 'Toxicity Tracking')}</h3>

            {skinTimeline.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {tr('لا توجد بيانات سمية بعد', 'No toxicity data available yet')}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Skin Reaction Timeline */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {tr('تطور رد فعل الجلد', 'Skin Reaction Timeline')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {skinTimeline.map((item) => {
                        const gradeNum = item.reaction === 'NONE' ? 0 :
                          item.reaction === 'GRADE1' ? 1 :
                          item.reaction === 'GRADE2' ? 2 :
                          item.reaction === 'GRADE3' ? 3 :
                          item.reaction === 'GRADE4' ? 4 : 0;
                        const barWidth = (gradeNum / 4) * 100;
                        const barColor = gradeNum === 0 ? 'bg-green-500' :
                          gradeNum === 1 ? 'bg-yellow-500' :
                          gradeNum === 2 ? 'bg-orange-500' :
                          gradeNum === 3 ? 'bg-red-500' : 'bg-red-700';
                        return (
                          <div key={item.fraction} className="flex items-center gap-2">
                            <span className="text-xs w-6 text-muted-foreground font-mono">
                              #{item.fraction}
                            </span>
                            <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                              <div
                                className={`h-full rounded transition-all ${barColor}`}
                                style={{ width: `${Math.max(barWidth, 2)}%` }}
                              />
                            </div>
                            <SkinReactionBadge reaction={item.reaction} language={language} />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Patient Tolerance Trend */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {tr('تحمل المريض', 'Patient Tolerance Trend')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tr('الجلسة', 'Fraction')}</TableHead>
                          <TableHead>{tr('التاريخ', 'Date')}</TableHead>
                          <TableHead>{tr('رد فعل الجلد', 'Skin Reaction')}</TableHead>
                          <TableHead>{tr('التحمل', 'Tolerance')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {skinTimeline.map((item) => (
                          <TableRow key={item.fraction}>
                            <TableCell className="font-mono">#{item.fraction}</TableCell>
                            <TableCell className="text-xs">{item.date}</TableCell>
                            <TableCell>
                              <SkinReactionBadge reaction={item.reaction} language={language} />
                            </TableCell>
                            <TableCell>
                              <ToleranceBadge tolerance={item.tolerance} language={language} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Toxicity Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        {tr('أعلى درجة جلدية', 'Max Skin Grade')}
                      </p>
                      <p className="text-xl font-bold">
                        {(() => {
                          const grades = skinTimeline.map((s) =>
                            s.reaction === 'NONE' ? 0 :
                            s.reaction === 'GRADE1' ? 1 :
                            s.reaction === 'GRADE2' ? 2 :
                            s.reaction === 'GRADE3' ? 3 :
                            s.reaction === 'GRADE4' ? 4 : 0
                          );
                          const max = Math.max(...grades);
                          return max === 0 ? tr('لا يوجد', 'None') : `Grade ${max}`;
                        })()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        {tr('جلسات بتحمل ضعيف', 'Poor Tolerance Sessions')}
                      </p>
                      <p className="text-xl font-bold">
                        {skinTimeline.filter((s) => s.tolerance === 'POOR').length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        {tr('جلسات بتحمل جيد', 'Good Tolerance Sessions')}
                      </p>
                      <p className="text-xl font-bold">
                        {skinTimeline.filter((s) => s.tolerance === 'GOOD').length}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Record Session Dialog
// =============================================================================
function RecordSessionDialog({
  planId,
  planDosePerFraction,
  planMachine,
  lastFraction,
  language,
  tr,
  toast,
  onClose,
  onCreated,
}: {
  planId: string;
  planDosePerFraction: number;
  planMachine: string | null;
  lastFraction: number;
  language: string;
  tr: (ar: string, en: string) => string;
  toast: any;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fractionNumber: String(lastFraction + 1),
    sessionDate: new Date().toISOString().slice(0, 10),
    deliveredDoseGy: String(planDosePerFraction),
    machine: planMachine || '',
    technician: '',
    setupVerification: 'CBCT',
    skinReaction: 'NONE',
    patientTolerance: 'GOOD',
    isocenterShiftX: '',
    isocenterShiftY: '',
    isocenterShiftZ: '',
    treatmentTime: '',
    notes: '',
    status: 'COMPLETED',
  });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const isocenterShift =
        form.isocenterShiftX || form.isocenterShiftY || form.isocenterShiftZ
          ? {
              x: Number(form.isocenterShiftX) || 0,
              y: Number(form.isocenterShiftY) || 0,
              z: Number(form.isocenterShiftZ) || 0,
            }
          : null;

      const res = await fetch('/api/oncology/radiation-therapy/sessions', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          fractionNumber: Number(form.fractionNumber),
          sessionDate: form.sessionDate,
          deliveredDoseGy: Number(form.deliveredDoseGy),
          machine: form.machine || null,
          technician: form.technician || null,
          setupVerification: form.setupVerification,
          skinReaction: form.skinReaction,
          patientTolerance: form.patientTolerance,
          isocenterShift,
          treatmentTime: form.treatmentTime ? Number(form.treatmentTime) : null,
          notes: form.notes || null,
          status: form.status,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record session');
      }
      toast({ title: tr('تم تسجيل الجلسة بنجاح', 'Session recorded successfully') });
      onCreated();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr('تسجيل جلسة علاج إشعاعي', 'Record Radiation Session')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{tr('رقم الجلسة', 'Fraction Number')}</Label>
              <Input
                type="number"
                value={form.fractionNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, fractionNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('التاريخ', 'Session Date')}</Label>
              <Input
                type="date"
                value={form.sessionDate}
                onChange={(e) => setForm((prev) => ({ ...prev, sessionDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{tr('الجرعة المعطاة (Gy)', 'Delivered Dose (Gy)')}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.deliveredDoseGy}
                onChange={(e) => setForm((prev) => ({ ...prev, deliveredDoseGy: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('الجهاز', 'Machine')}</Label>
              <Input
                value={form.machine}
                onChange={(e) => setForm((prev) => ({ ...prev, machine: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{tr('الفني', 'Technician')}</Label>
              <Input
                value={form.technician}
                onChange={(e) => setForm((prev) => ({ ...prev, technician: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('التحقق من الإعداد', 'Setup Verification')}</Label>
              <Select value={form.setupVerification} onValueChange={(v) => setForm((prev) => ({ ...prev, setupVerification: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SETUP_VERIFICATIONS.map((sv) => (
                    <SelectItem key={sv.value} value={sv.value}>
                      {language === 'ar' ? sv.labelAr : sv.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{tr('رد فعل الجلد', 'Skin Reaction')}</Label>
              <Select value={form.skinReaction} onValueChange={(v) => setForm((prev) => ({ ...prev, skinReaction: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKIN_REACTIONS.map((sr) => (
                    <SelectItem key={sr.value} value={sr.value}>
                      {language === 'ar' ? sr.labelAr : sr.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('تحمل المريض', 'Patient Tolerance')}</Label>
              <Select value={form.patientTolerance} onValueChange={(v) => setForm((prev) => ({ ...prev, patientTolerance: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PATIENT_TOLERANCE.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>
                      {language === 'ar' ? pt.labelAr : pt.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Isocenter Shift */}
          <div className="space-y-2">
            <Label>{tr('انزياح مركز التوازن (مم)', 'Isocenter Shift (mm)')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">X</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.isocenterShiftX}
                  onChange={(e) => setForm((prev) => ({ ...prev, isocenterShiftX: e.target.value }))}
                  placeholder="0.0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Y</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.isocenterShiftY}
                  onChange={(e) => setForm((prev) => ({ ...prev, isocenterShiftY: e.target.value }))}
                  placeholder="0.0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Z</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.isocenterShiftZ}
                  onChange={(e) => setForm((prev) => ({ ...prev, isocenterShiftZ: e.target.value }))}
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{tr('مدة العلاج (دقائق)', 'Treatment Time (min)')}</Label>
              <Input
                type="number"
                value={form.treatmentTime}
                onChange={(e) => setForm((prev) => ({ ...prev, treatmentTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('الحالة', 'Status')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_STATUS.map((ss) => (
                    <SelectItem key={ss.value} value={ss.value}>
                      {language === 'ar' ? ss.labelAr : ss.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>{tr('ملاحظات', 'Notes')}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder={tr('ملاحظات الجلسة...', 'Session notes...')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">{tr('إلغاء', 'Cancel')}</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {tr('تسجيل الجلسة', 'Record Session')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      <span className="text-end text-sm font-medium">{value}</span>
    </div>
  );
}

function SkinReactionBadge({ reaction, language }: { reaction: string; language: string }) {
  const colorMap: Record<string, string> = {
    NONE: 'bg-green-100 text-green-800',
    GRADE1: 'bg-yellow-100 text-yellow-800',
    GRADE2: 'bg-orange-100 text-orange-800',
    GRADE3: 'bg-red-100 text-red-800',
    GRADE4: 'bg-red-200 text-red-900',
  };
  return (
    <Badge className={`text-xs ${colorMap[reaction] || 'bg-muted text-foreground'}`}>
      {getOptionLabel(SKIN_REACTIONS, reaction, language as 'ar' | 'en')}
    </Badge>
  );
}

function ToleranceBadge({ tolerance, language }: { tolerance: string; language: string }) {
  const colorMap: Record<string, string> = {
    GOOD: 'bg-green-100 text-green-800',
    FAIR: 'bg-yellow-100 text-yellow-800',
    POOR: 'bg-red-100 text-red-800',
  };
  return (
    <Badge className={`text-xs ${colorMap[tolerance] || 'bg-muted text-foreground'}`}>
      {getOptionLabel(PATIENT_TOLERANCE, tolerance, language as 'ar' | 'en')}
    </Badge>
  );
}
