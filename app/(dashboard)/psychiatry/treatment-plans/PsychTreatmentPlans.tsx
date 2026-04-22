'use client';

import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardList,
  Plus,
  Target,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  RotateCcw,
  XCircle,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Intervention {
  type: string;
  detail: string;
  responsibleClinician: string;
}

interface Goal {
  id: string;
  type: 'SHORT_TERM' | 'LONG_TERM';
  description: string;
  targetDate: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'MODIFIED';
  interventions: Intervention[];
  reviewNotes?: string | null;
  lastReviewed?: string | null;
}

interface ProblemItem {
  problem: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
}

interface ReviewEntry {
  reviewedAt: string;
  reviewedBy: string;
  reviewedByUserId?: string;
  notes: string;
  goalsUpdated: boolean;
}

interface TreatmentPlan {
  id: string;
  tenantId: string;
  patientMasterId: string;
  episodeId?: string;
  encounterId?: string;
  createdByUserId: string;
  createdByName?: string;
  dsm5Diagnosis?: string;
  icdCode?: string;
  diagnosisNotes?: string;
  psychiatricProblems: ProblemItem[];
  medicalProblems: ProblemItem[];
  goals: Goal[];
  patientInvolved: boolean;
  familyInvolved: boolean;
  participationNotes?: string;
  reviewSchedule?: string;
  nextReviewDate?: string;
  lastReviewedAt?: string;
  lastReviewedBy?: string;
  reviewHistory: ReviewEntry[];
  status: 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED';
  discontinuedReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INTERVENTION_TYPES = [
  'CBT',
  'DBT',
  'PSYCHODYNAMIC',
  'MEDICATION',
  'GROUP',
  'MILIEU',
  'FAMILY',
] as const;

const GOAL_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'MODIFIED'] as const;

const EMPTY_GOAL: Goal = {
  id: '',
  type: 'SHORT_TERM',
  description: '',
  targetDate: null,
  status: 'NOT_STARTED',
  interventions: [],
};

const EMPTY_PROBLEM: ProblemItem = { problem: '', priority: 'MEDIUM', status: 'ACTIVE' };

const EMPTY_INTERVENTION: Intervention = { type: 'CBT', detail: '', responsibleClinician: '' };

/* ================================================================== */
/*  PsychTreatmentPlans — Main Component                               */
/* ================================================================== */

export default function PsychTreatmentPlans() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // ---------- State ----------
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusAction, setStatusAction] = useState<'COMPLETED' | 'DISCONTINUED'>('COMPLETED');
  const [statusReason, setStatusReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Review form
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewGoalsUpdated, setReviewGoalsUpdated] = useState(false);

  // ---------- Data ----------
  const apiUrl = '/api/psychiatry/treatment-plan';
  const { data, mutate, isLoading } = useSWR(apiUrl, fetcher, { revalidateOnFocus: false });
  const plans: TreatmentPlan[] = data?.plans ?? [];

  // ---------- Filtered list ----------
  const filteredPlans = useMemo(() => {
    let list = plans;
    if (statusFilter !== 'ALL') {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.dsm5Diagnosis || '').toLowerCase().includes(q) ||
          (p.icdCode || '').toLowerCase().includes(q) ||
          (p.patientMasterId || '').toLowerCase().includes(q) ||
          (p.createdByName || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [plans, statusFilter, search]);

  // ---------- KPI computations ----------
  const activePlans = plans.filter((p) => p.status === 'ACTIVE');
  const completedPlans = plans.filter((p) => p.status === 'COMPLETED');

  const goalsInProgress = plans.reduce((sum, p) => {
    const gs: Goal[] = Array.isArray(p.goals) ? p.goals : [];
    return sum + gs.filter((g) => g.status === 'IN_PROGRESS').length;
  }, 0);

  const now = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const reviewsDueThisWeek = activePlans.filter((p) => {
    if (!p.nextReviewDate) return false;
    const rd = new Date(p.nextReviewDate);
    return rd >= now && rd <= weekFromNow;
  }).length;

  // ---------- Create form state ----------
  const [form, setForm] = useState({
    patientMasterId: '',
    dsm5Diagnosis: '',
    icdCode: '',
    diagnosisNotes: '',
    patientInvolved: false,
    familyInvolved: false,
    participationNotes: '',
    reviewSchedule: '' as string,
    notes: '',
  });
  const [formPsychProblems, setFormPsychProblems] = useState<ProblemItem[]>([]);
  const [formMedProblems, setFormMedProblems] = useState<ProblemItem[]>([]);
  const [formGoals, setFormGoals] = useState<Goal[]>([]);

  // ---------- Edit form state ----------
  const [editForm, setEditForm] = useState({
    dsm5Diagnosis: '',
    icdCode: '',
    diagnosisNotes: '',
    patientInvolved: false,
    familyInvolved: false,
    participationNotes: '',
    reviewSchedule: '' as string,
    notes: '',
  });
  const [editPsychProblems, setEditPsychProblems] = useState<ProblemItem[]>([]);
  const [editMedProblems, setEditMedProblems] = useState<ProblemItem[]>([]);
  const [editGoals, setEditGoals] = useState<Goal[]>([]);

  // ==========================================================================
  //  Helpers
  // ==========================================================================

  function resetCreateForm() {
    setForm({
      patientMasterId: '',
      dsm5Diagnosis: '',
      icdCode: '',
      diagnosisNotes: '',
      patientInvolved: false,
      familyInvolved: false,
      participationNotes: '',
      reviewSchedule: '',
      notes: '',
    });
    setFormPsychProblems([]);
    setFormMedProblems([]);
    setFormGoals([]);
  }

  function loadEditForm(plan: TreatmentPlan) {
    setEditForm({
      dsm5Diagnosis: plan.dsm5Diagnosis || '',
      icdCode: plan.icdCode || '',
      diagnosisNotes: plan.diagnosisNotes || '',
      patientInvolved: plan.patientInvolved,
      familyInvolved: plan.familyInvolved,
      participationNotes: plan.participationNotes || '',
      reviewSchedule: plan.reviewSchedule || '',
      notes: plan.notes || '',
    });
    setEditPsychProblems(Array.isArray(plan.psychiatricProblems) ? [...plan.psychiatricProblems] : []);
    setEditMedProblems(Array.isArray(plan.medicalProblems) ? [...plan.medicalProblems] : []);
    setEditGoals(Array.isArray(plan.goals) ? plan.goals.map((g) => ({ ...g, interventions: [...(g.interventions || [])] })) : []);
  }

  function statusBadgeVariant(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'DISCONTINUED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-muted text-foreground';
    }
  }

  function goalStatusBadge(status: string): string {
    switch (status) {
      case 'NOT_STARTED':
        return 'bg-muted text-foreground';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'ACHIEVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'MODIFIED':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-muted text-foreground';
    }
  }

  function priorityBadge(priority: string): string {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'LOW':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-muted text-foreground';
    }
  }

  function trGoalStatus(status: string): string {
    switch (status) {
      case 'NOT_STARTED':
        return tr('لم يبدأ', 'Not Started');
      case 'IN_PROGRESS':
        return tr('قيد التنفيذ', 'In Progress');
      case 'ACHIEVED':
        return tr('تحقق', 'Achieved');
      case 'MODIFIED':
        return tr('معدّل', 'Modified');
      default:
        return status;
    }
  }

  function trInterventionType(t: string): string {
    const map: Record<string, [string, string]> = {
      CBT: ['العلاج المعرفي السلوكي', 'CBT'],
      DBT: ['العلاج الجدلي السلوكي', 'DBT'],
      PSYCHODYNAMIC: ['العلاج الديناميكي النفسي', 'Psychodynamic'],
      MEDICATION: ['العلاج الدوائي', 'Medication'],
      GROUP: ['العلاج الجماعي', 'Group Therapy'],
      MILIEU: ['العلاج البيئي', 'Milieu Therapy'],
      FAMILY: ['العلاج الأسري', 'Family Therapy'],
    };
    const pair = map[t];
    return pair ? tr(pair[0], pair[1]) : t;
  }

  function trPlanStatus(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return tr('نشط', 'Active');
      case 'COMPLETED':
        return tr('مكتمل', 'Completed');
      case 'DISCONTINUED':
        return tr('متوقف', 'Discontinued');
      default:
        return status;
    }
  }

  function fmtDate(d?: string | null): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  // ==========================================================================
  //  Handlers
  // ==========================================================================

  async function handleCreate() {
    if (!form.patientMasterId.trim()) {
      toast({ title: tr('معرف المريض مطلوب', 'Patient ID is required'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId: form.patientMasterId.trim(),
          dsm5Diagnosis: form.dsm5Diagnosis || null,
          icdCode: form.icdCode || null,
          diagnosisNotes: form.diagnosisNotes || null,
          psychiatricProblems: formPsychProblems.filter((p) => p.problem.trim()),
          medicalProblems: formMedProblems.filter((p) => p.problem.trim()),
          goals: formGoals.filter((g) => g.description.trim()),
          patientInvolved: form.patientInvolved,
          familyInvolved: form.familyInvolved,
          participationNotes: form.participationNotes || null,
          reviewSchedule: form.reviewSchedule || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم إنشاء خطة العلاج بنجاح', 'Treatment plan created successfully') });
      mutate();
      resetCreateForm();
      setShowCreateDialog(false);
    } catch (e: any) {
      toast({ title: tr('خطأ في الإنشاء', 'Error creating plan'), description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl, {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPlan.id,
          dsm5Diagnosis: editForm.dsm5Diagnosis || null,
          icdCode: editForm.icdCode || null,
          diagnosisNotes: editForm.diagnosisNotes || null,
          psychiatricProblems: editPsychProblems.filter((p) => p.problem.trim()),
          medicalProblems: editMedProblems.filter((p) => p.problem.trim()),
          goals: editGoals.filter((g) => g.description.trim()),
          patientInvolved: editForm.patientInvolved,
          familyInvolved: editForm.familyInvolved,
          participationNotes: editForm.participationNotes || null,
          reviewSchedule: editForm.reviewSchedule || null,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم تحديث الخطة بنجاح', 'Plan updated successfully') });
      mutate();
      setEditMode(false);
      setShowDetailDialog(false);
    } catch (e: any) {
      toast({ title: tr('خطأ في التحديث', 'Error updating plan'), description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddReview() {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl, {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPlan.id,
          addReview: {
            notes: reviewNotes,
            goalsUpdated: reviewGoalsUpdated,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تمت إضافة المراجعة بنجاح', 'Review added successfully') });
      mutate();
      setShowReviewDialog(false);
      setReviewNotes('');
      setReviewGoalsUpdated(false);
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange() {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl, {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPlan.id,
          status: statusAction,
          discontinuedReason: statusReason || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({
        title:
          statusAction === 'COMPLETED'
            ? tr('تم إكمال الخطة', 'Plan completed')
            : tr('تم إيقاف الخطة', 'Plan discontinued'),
      });
      mutate();
      setShowStatusDialog(false);
      setShowDetailDialog(false);
      setStatusReason('');
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================================================
  //  Problem list helpers
  // ==========================================================================

  function renderProblemEditor(
    items: ProblemItem[],
    setItems: (v: ProblemItem[]) => void,
    label: string,
  ) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">{label}</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setItems([...items, { ...EMPTY_PROBLEM }])}
          >
            <Plus className="h-3 w-3 me-1" />
            {tr('إضافة', 'Add')}
          </Button>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 rounded border p-2">
            <Input
              className="flex-1"
              placeholder={tr('المشكلة', 'Problem')}
              value={item.problem}
              onChange={(e) => {
                const copy = [...items];
                copy[idx] = { ...copy[idx], problem: e.target.value };
                setItems(copy);
              }}
            />
            <Select
              value={item.priority}
              onValueChange={(v) => {
                const copy = [...items];
                copy[idx] = { ...copy[idx], priority: v as ProblemItem['priority'] };
                setItems(copy);
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">{tr('عالي', 'High')}</SelectItem>
                <SelectItem value="MEDIUM">{tr('متوسط', 'Medium')}</SelectItem>
                <SelectItem value="LOW">{tr('منخفض', 'Low')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setItems(items.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  // ==========================================================================
  //  Goal editor helper
  // ==========================================================================

  function renderGoalEditor(goals: Goal[], setGoals: (v: Goal[]) => void) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">{tr('الأهداف', 'Goals')}</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setGoals([
                ...goals,
                { ...EMPTY_GOAL, id: `goal-${Date.now()}-${goals.length}` },
              ])
            }
          >
            <Target className="h-3 w-3 me-1" />
            {tr('إضافة هدف', 'Add Goal')}
          </Button>
        </div>
        {goals.map((goal, gIdx) => (
          <div key={gIdx} className="rounded-lg border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">
                {tr(`هدف ${gIdx + 1}`, `Goal ${gIdx + 1}`)}
              </span>
              <Select
                value={goal.type}
                onValueChange={(v) => {
                  const copy = [...goals];
                  copy[gIdx] = { ...copy[gIdx], type: v as Goal['type'] };
                  setGoals(copy);
                }}
              >
                <SelectTrigger className="w-36 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHORT_TERM">{tr('قصير المدى', 'Short Term')}</SelectItem>
                  <SelectItem value="LONG_TERM">{tr('طويل المدى', 'Long Term')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ms-auto"
                onClick={() => setGoals(goals.filter((_, i) => i !== gIdx))}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
            <Textarea
              placeholder={tr('وصف الهدف', 'Goal description')}
              value={goal.description}
              onChange={(e) => {
                const copy = [...goals];
                copy[gIdx] = { ...copy[gIdx], description: e.target.value };
                setGoals(copy);
              }}
              rows={2}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">{tr('التاريخ المستهدف', 'Target Date')}</Label>
                <Input
                  type="date"
                  value={goal.targetDate || ''}
                  onChange={(e) => {
                    const copy = [...goals];
                    copy[gIdx] = { ...copy[gIdx], targetDate: e.target.value || null };
                    setGoals(copy);
                  }}
                />
              </div>
            </div>

            {/* Interventions */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">{tr('التدخلات', 'Interventions')}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => {
                    const copy = [...goals];
                    copy[gIdx] = {
                      ...copy[gIdx],
                      interventions: [...copy[gIdx].interventions, { ...EMPTY_INTERVENTION }],
                    };
                    setGoals(copy);
                  }}
                >
                  <Plus className="h-3 w-3 me-1" />
                  {tr('تدخل', 'Intervention')}
                </Button>
              </div>
              {goal.interventions.map((iv, ivIdx) => (
                <div key={ivIdx} className="flex items-start gap-2 rounded border p-2 bg-background">
                  <Select
                    value={iv.type}
                    onValueChange={(v) => {
                      const copy = [...goals];
                      const ivs = [...copy[gIdx].interventions];
                      ivs[ivIdx] = { ...ivs[ivIdx], type: v };
                      copy[gIdx] = { ...copy[gIdx], interventions: ivs };
                      setGoals(copy);
                    }}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVENTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {trInterventionType(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1 h-8 text-xs"
                    placeholder={tr('التفاصيل', 'Detail')}
                    value={iv.detail}
                    onChange={(e) => {
                      const copy = [...goals];
                      const ivs = [...copy[gIdx].interventions];
                      ivs[ivIdx] = { ...ivs[ivIdx], detail: e.target.value };
                      copy[gIdx] = { ...copy[gIdx], interventions: ivs };
                      setGoals(copy);
                    }}
                  />
                  <Input
                    className="w-32 h-8 text-xs"
                    placeholder={tr('المسؤول', 'Clinician')}
                    value={iv.responsibleClinician}
                    onChange={(e) => {
                      const copy = [...goals];
                      const ivs = [...copy[gIdx].interventions];
                      ivs[ivIdx] = { ...ivs[ivIdx], responsibleClinician: e.target.value };
                      copy[gIdx] = { ...copy[gIdx], interventions: ivs };
                      setGoals(copy);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => {
                      const copy = [...goals];
                      copy[gIdx] = {
                        ...copy[gIdx],
                        interventions: copy[gIdx].interventions.filter((_, i) => i !== ivIdx),
                      };
                      setGoals(copy);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ==========================================================================
  //  RENDER
  // ==========================================================================

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 space-y-6 max-w-[1400px] mx-auto">
      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{tr('خطط العلاج النفسي', 'Psychiatric Treatment Plans')}</h1>
        </div>
        <Button onClick={() => { resetCreateForm(); setShowCreateDialog(true); }}>
          <Plus className="h-4 w-4 me-2" />
          {tr('خطة جديدة', 'New Plan')}
        </Button>
      </div>

      {/* ---------- KPI Cards ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('الخطط النشطة', 'Active Plans')}</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activePlans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('أهداف قيد التنفيذ', 'Goals In Progress')}</CardTitle>
            <Target className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{goalsInProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('مراجعات هذا الأسبوع', 'Reviews Due This Week')}</CardTitle>
            <Calendar className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{reviewsDueThisWeek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('خطط مكتملة', 'Completed Plans')}</CardTitle>
            <AlertCircle className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedPlans.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Filters ---------- */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={tr('بحث بالتشخيص، الكود، معرف المريض...', 'Search by diagnosis, code, patient ID...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={tr('الحالة', 'Status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
            <SelectItem value="ACTIVE">{tr('نشط', 'Active')}</SelectItem>
            <SelectItem value="COMPLETED">{tr('مكتمل', 'Completed')}</SelectItem>
            <SelectItem value="DISCONTINUED">{tr('متوقف', 'Discontinued')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ---------- Table ---------- */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {tr('لا توجد خطط علاج', 'No treatment plans found')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                    <th className="px-4 py-3 text-start font-medium">{tr('معرف المريض', 'Patient ID')}</th>
                    <th className="px-4 py-3 text-start font-medium">{tr('تشخيص DSM-5', 'DSM-5 Diagnosis')}</th>
                    <th className="px-4 py-3 text-center font-medium">{tr('الأهداف', 'Goals')}</th>
                    <th className="px-4 py-3 text-center font-medium">{tr('الحالة', 'Status')}</th>
                    <th className="px-4 py-3 text-start font-medium">{tr('موعد المراجعة', 'Review Due')}</th>
                    <th className="px-4 py-3 text-center font-medium">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => {
                    const goalsArr: Goal[] = Array.isArray(plan.goals) ? plan.goals : [];
                    return (
                      <tr key={plan.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">{fmtDate(plan.createdAt)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{plan.patientMasterId?.slice(0, 8)}...</td>
                        <td className="px-4 py-3">{plan.dsm5Diagnosis || '—'}</td>
                        <td className="px-4 py-3 text-center">{goalsArr.length}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeVariant(plan.status)}`}>
                            {trPlanStatus(plan.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {plan.nextReviewDate ? (
                            <span
                              className={
                                new Date(plan.nextReviewDate) < now
                                  ? 'text-red-600 font-medium'
                                  : ''
                              }
                            >
                              {fmtDate(plan.nextReviewDate)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedPlan(plan);
                              loadEditForm(plan);
                              setEditMode(false);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/*  CREATE DIALOG                                                       */}
      {/* ================================================================== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('إنشاء خطة علاج جديدة', 'Create New Treatment Plan')}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="diagnosis" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="diagnosis">{tr('التشخيص', 'Diagnosis')}</TabsTrigger>
              <TabsTrigger value="problems">{tr('المشاكل', 'Problems')}</TabsTrigger>
              <TabsTrigger value="goals">{tr('الأهداف', 'Goals')}</TabsTrigger>
              <TabsTrigger value="settings">{tr('إعدادات', 'Settings')}</TabsTrigger>
            </TabsList>

            {/* ---- Diagnosis Tab ---- */}
            <TabsContent value="diagnosis" className="space-y-4 pt-4">
              <div>
                <Label>{tr('معرف المريض', 'Patient ID')} *</Label>
                <Input
                  value={form.patientMasterId}
                  onChange={(e) => setForm({ ...form, patientMasterId: e.target.value })}
                  placeholder={tr('أدخل معرف المريض', 'Enter patient master ID')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{tr('تشخيص DSM-5', 'DSM-5 Diagnosis')}</Label>
                  <Input
                    value={form.dsm5Diagnosis}
                    onChange={(e) => setForm({ ...form, dsm5Diagnosis: e.target.value })}
                    placeholder={tr('مثال: اضطراب اكتئابي رئيسي', 'e.g. Major Depressive Disorder')}
                  />
                </div>
                <div>
                  <Label>{tr('كود ICD-10', 'ICD-10 Code')}</Label>
                  <Input
                    value={form.icdCode}
                    onChange={(e) => setForm({ ...form, icdCode: e.target.value })}
                    placeholder={tr('مثال: F32.1', 'e.g. F32.1')}
                  />
                </div>
              </div>
              <div>
                <Label>{tr('ملاحظات التشخيص', 'Diagnosis Notes')}</Label>
                <Textarea
                  value={form.diagnosisNotes}
                  onChange={(e) => setForm({ ...form, diagnosisNotes: e.target.value })}
                  rows={3}
                  placeholder={tr('ملاحظات إضافية حول التشخيص', 'Additional diagnostic notes')}
                />
              </div>
            </TabsContent>

            {/* ---- Problems Tab ---- */}
            <TabsContent value="problems" className="space-y-4 pt-4">
              {renderProblemEditor(
                formPsychProblems,
                setFormPsychProblems,
                tr('المشاكل النفسية', 'Psychiatric Problems'),
              )}
              <div className="border-t pt-4" />
              {renderProblemEditor(
                formMedProblems,
                setFormMedProblems,
                tr('المشاكل الطبية', 'Medical Problems'),
              )}
            </TabsContent>

            {/* ---- Goals Tab ---- */}
            <TabsContent value="goals" className="space-y-4 pt-4">
              {renderGoalEditor(formGoals, setFormGoals)}
            </TabsContent>

            {/* ---- Settings Tab ---- */}
            <TabsContent value="settings" className="space-y-4 pt-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-patient-involved"
                    checked={form.patientInvolved}
                    onCheckedChange={(v) => setForm({ ...form, patientInvolved: !!v })}
                  />
                  <Label htmlFor="create-patient-involved">{tr('المريض مشارك', 'Patient Involved')}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-family-involved"
                    checked={form.familyInvolved}
                    onCheckedChange={(v) => setForm({ ...form, familyInvolved: !!v })}
                  />
                  <Label htmlFor="create-family-involved">{tr('الأسرة مشاركة', 'Family Involved')}</Label>
                </div>
              </div>
              <div>
                <Label>{tr('ملاحظات المشاركة', 'Participation Notes')}</Label>
                <Textarea
                  value={form.participationNotes}
                  onChange={(e) => setForm({ ...form, participationNotes: e.target.value })}
                  rows={2}
                  placeholder={tr('تفاصيل المشاركة', 'Participation details')}
                />
              </div>
              <div>
                <Label>{tr('جدول المراجعة', 'Review Schedule')}</Label>
                <Select
                  value={form.reviewSchedule}
                  onValueChange={(v) => setForm({ ...form, reviewSchedule: v })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={tr('اختر الجدول', 'Select schedule')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">{tr('أسبوعي', 'Weekly')}</SelectItem>
                    <SelectItem value="BIWEEKLY">{tr('كل أسبوعين', 'Biweekly')}</SelectItem>
                    <SelectItem value="MONTHLY">{tr('شهري', 'Monthly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr('ملاحظات عامة', 'General Notes')}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder={tr('ملاحظات إضافية', 'Additional notes')}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء الخطة', 'Create Plan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/*  VIEW / EDIT DIALOG                                                  */}
      {/* ================================================================== */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => { setShowDetailDialog(open); if (!open) setEditMode(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedPlan && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>
                    {editMode
                      ? tr('تعديل خطة العلاج', 'Edit Treatment Plan')
                      : tr('تفاصيل خطة العلاج', 'Treatment Plan Details')}
                  </DialogTitle>
                  <div className="flex gap-2">
                    {selectedPlan.status === 'ACTIVE' && !editMode && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                          <Edit className="h-4 w-4 me-1" />
                          {tr('تعديل', 'Edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewNotes('');
                            setReviewGoalsUpdated(false);
                            setShowReviewDialog(true);
                          }}
                        >
                          <RotateCcw className="h-4 w-4 me-1" />
                          {tr('مراجعة', 'Review')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* --- View Mode --- */}
              {!editMode && (
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">{tr('نظرة عامة', 'Overview')}</TabsTrigger>
                    <TabsTrigger value="goals-view">{tr('الأهداف', 'Goals')}</TabsTrigger>
                    <TabsTrigger value="reviews">{tr('المراجعات', 'Reviews')}</TabsTrigger>
                    <TabsTrigger value="info">{tr('معلومات', 'Info')}</TabsTrigger>
                  </TabsList>

                  {/* -- Overview Tab -- */}
                  <TabsContent value="overview" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('الحالة', 'Status')}</Label>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeVariant(selectedPlan.status)}`}>
                            {trPlanStatus(selectedPlan.status)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('معرف المريض', 'Patient ID')}</Label>
                        <p className="mt-1 font-mono text-sm">{selectedPlan.patientMasterId}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('تشخيص DSM-5', 'DSM-5 Diagnosis')}</Label>
                        <p className="mt-1 text-sm">{selectedPlan.dsm5Diagnosis || '—'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('كود ICD-10', 'ICD-10 Code')}</Label>
                        <p className="mt-1 text-sm font-mono">{selectedPlan.icdCode || '—'}</p>
                      </div>
                    </div>
                    {selectedPlan.diagnosisNotes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('ملاحظات التشخيص', 'Diagnosis Notes')}</Label>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{selectedPlan.diagnosisNotes}</p>
                      </div>
                    )}

                    {/* Psychiatric Problems */}
                    {Array.isArray(selectedPlan.psychiatricProblems) && selectedPlan.psychiatricProblems.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('المشاكل النفسية', 'Psychiatric Problems')}</Label>
                        <div className="mt-1 space-y-1">
                          {selectedPlan.psychiatricProblems.map((p, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${priorityBadge(p.priority)}`}>
                                {p.priority}
                              </span>
                              <span className="text-sm">{p.problem}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Medical Problems */}
                    {Array.isArray(selectedPlan.medicalProblems) && selectedPlan.medicalProblems.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('المشاكل الطبية', 'Medical Problems')}</Label>
                        <div className="mt-1 space-y-1">
                          {selectedPlan.medicalProblems.map((p, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${priorityBadge(p.priority)}`}>
                                {p.priority}
                              </span>
                              <span className="text-sm">{p.problem}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Involvement */}
                    <div className="flex items-center gap-6 pt-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {tr('مشاركة المريض', 'Patient Involved')}:{' '}
                          <strong>{selectedPlan.patientInvolved ? tr('نعم', 'Yes') : tr('لا', 'No')}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {tr('مشاركة الأسرة', 'Family Involved')}:{' '}
                          <strong>{selectedPlan.familyInvolved ? tr('نعم', 'Yes') : tr('لا', 'No')}</strong>
                        </span>
                      </div>
                    </div>
                    {selectedPlan.participationNotes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('ملاحظات المشاركة', 'Participation Notes')}</Label>
                        <p className="mt-1 text-sm">{selectedPlan.participationNotes}</p>
                      </div>
                    )}

                    {/* Status change buttons */}
                    {selectedPlan.status === 'ACTIVE' && (
                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 border-blue-300"
                          onClick={() => {
                            setStatusAction('COMPLETED');
                            setStatusReason('');
                            setShowStatusDialog(true);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 me-1" />
                          {tr('إكمال الخطة', 'Complete Plan')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300"
                          onClick={() => {
                            setStatusAction('DISCONTINUED');
                            setStatusReason('');
                            setShowStatusDialog(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 me-1" />
                          {tr('إيقاف الخطة', 'Discontinue Plan')}
                        </Button>
                      </div>
                    )}

                    {selectedPlan.discontinuedReason && (
                      <div className="pt-2">
                        <Label className="text-xs text-muted-foreground">{tr('سبب الإيقاف', 'Discontinued Reason')}</Label>
                        <p className="mt-1 text-sm text-red-700">{selectedPlan.discontinuedReason}</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* -- Goals Tab (View) -- */}
                  <TabsContent value="goals-view" className="space-y-4 pt-4">
                    {(() => {
                      const goalsArr: Goal[] = Array.isArray(selectedPlan.goals) ? selectedPlan.goals : [];
                      if (goalsArr.length === 0) {
                        return (
                          <p className="text-center text-muted-foreground py-6">
                            {tr('لا توجد أهداف محددة', 'No goals defined')}
                          </p>
                        );
                      }
                      return goalsArr.map((goal, gIdx) => (
                        <div key={gIdx} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-sm">
                                {tr(`هدف ${gIdx + 1}`, `Goal ${gIdx + 1}`)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {goal.type === 'SHORT_TERM' ? tr('قصير المدى', 'Short Term') : tr('طويل المدى', 'Long Term')}
                              </Badge>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${goalStatusBadge(goal.status)}`}>
                              {trGoalStatus(goal.status)}
                            </span>
                          </div>
                          <p className="text-sm">{goal.description}</p>
                          {goal.targetDate && (
                            <p className="text-xs text-muted-foreground">
                              {tr('التاريخ المستهدف', 'Target Date')}: {fmtDate(goal.targetDate)}
                            </p>
                          )}
                          {goal.interventions.length > 0 && (
                            <div className="pt-2">
                              <Label className="text-xs text-muted-foreground">{tr('التدخلات', 'Interventions')}</Label>
                              <div className="mt-1 space-y-1">
                                {goal.interventions.map((iv, ivIdx) => (
                                  <div key={ivIdx} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {trInterventionType(iv.type)}
                                    </Badge>
                                    <span>{iv.detail}</span>
                                    {iv.responsibleClinician && (
                                      <span className="text-muted-foreground ms-auto">
                                        {tr('المسؤول', 'By')}: {iv.responsibleClinician}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </TabsContent>

                  {/* -- Reviews Tab -- */}
                  <TabsContent value="reviews" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('جدول المراجعة', 'Review Schedule')}</Label>
                        <p className="mt-1 text-sm">
                          {selectedPlan.reviewSchedule
                            ? selectedPlan.reviewSchedule === 'WEEKLY'
                              ? tr('أسبوعي', 'Weekly')
                              : selectedPlan.reviewSchedule === 'BIWEEKLY'
                              ? tr('كل أسبوعين', 'Biweekly')
                              : tr('شهري', 'Monthly')
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('المراجعة القادمة', 'Next Review')}</Label>
                        <p className="mt-1 text-sm">{fmtDate(selectedPlan.nextReviewDate)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('آخر مراجعة', 'Last Reviewed')}</Label>
                        <p className="mt-1 text-sm">{fmtDate(selectedPlan.lastReviewedAt)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('بواسطة', 'Reviewed By')}</Label>
                        <p className="mt-1 text-sm">{selectedPlan.lastReviewedBy || '—'}</p>
                      </div>
                    </div>

                    {(() => {
                      const history: ReviewEntry[] = Array.isArray(selectedPlan.reviewHistory) ? selectedPlan.reviewHistory : [];
                      if (history.length === 0) {
                        return (
                          <p className="text-center text-muted-foreground py-6">
                            {tr('لا توجد مراجعات سابقة', 'No review history')}
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-3">
                          {[...history].reverse().map((rev, i) => (
                            <div key={i} className="rounded border p-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{rev.reviewedBy}</span>
                                <span className="text-xs text-muted-foreground">{fmtDate(rev.reviewedAt)}</span>
                              </div>
                              <p className="text-sm">{rev.notes || tr('بدون ملاحظات', 'No notes')}</p>
                              {rev.goalsUpdated && (
                                <Badge variant="outline" className="text-xs">
                                  {tr('تم تحديث الأهداف', 'Goals Updated')}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </TabsContent>

                  {/* -- Info Tab -- */}
                  <TabsContent value="info" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('أنشئ بواسطة', 'Created By')}</Label>
                        <p className="mt-1 text-sm">{selectedPlan.createdByName || selectedPlan.createdByUserId}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('تاريخ الإنشاء', 'Created At')}</Label>
                        <p className="mt-1 text-sm">{fmtDate(selectedPlan.createdAt)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('آخر تحديث', 'Last Updated')}</Label>
                        <p className="mt-1 text-sm">{fmtDate(selectedPlan.updatedAt)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('معرف الخطة', 'Plan ID')}</Label>
                        <p className="mt-1 text-sm font-mono text-xs">{selectedPlan.id}</p>
                      </div>
                    </div>
                    {selectedPlan.notes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{tr('ملاحظات عامة', 'General Notes')}</Label>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{selectedPlan.notes}</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              {/* --- Edit Mode --- */}
              {editMode && (
                <>
                  <Tabs defaultValue="edit-diagnosis" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="edit-diagnosis">{tr('التشخيص', 'Diagnosis')}</TabsTrigger>
                      <TabsTrigger value="edit-problems">{tr('المشاكل', 'Problems')}</TabsTrigger>
                      <TabsTrigger value="edit-goals">{tr('الأهداف', 'Goals')}</TabsTrigger>
                      <TabsTrigger value="edit-settings">{tr('إعدادات', 'Settings')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="edit-diagnosis" className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{tr('تشخيص DSM-5', 'DSM-5 Diagnosis')}</Label>
                          <Input
                            value={editForm.dsm5Diagnosis}
                            onChange={(e) => setEditForm({ ...editForm, dsm5Diagnosis: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>{tr('كود ICD-10', 'ICD-10 Code')}</Label>
                          <Input
                            value={editForm.icdCode}
                            onChange={(e) => setEditForm({ ...editForm, icdCode: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>{tr('ملاحظات التشخيص', 'Diagnosis Notes')}</Label>
                        <Textarea
                          value={editForm.diagnosisNotes}
                          onChange={(e) => setEditForm({ ...editForm, diagnosisNotes: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="edit-problems" className="space-y-4 pt-4">
                      {renderProblemEditor(
                        editPsychProblems,
                        setEditPsychProblems,
                        tr('المشاكل النفسية', 'Psychiatric Problems'),
                      )}
                      <div className="border-t pt-4" />
                      {renderProblemEditor(
                        editMedProblems,
                        setEditMedProblems,
                        tr('المشاكل الطبية', 'Medical Problems'),
                      )}
                    </TabsContent>

                    <TabsContent value="edit-goals" className="space-y-4 pt-4">
                      {renderGoalEditor(editGoals, setEditGoals)}
                      {/* Goal status update section */}
                      {editGoals.length > 0 && (
                        <div className="border-t pt-4 space-y-2">
                          <Label className="text-sm font-semibold">{tr('تحديث حالة الأهداف', 'Update Goal Status')}</Label>
                          {editGoals.map((goal, gIdx) => (
                            <div key={gIdx} className="flex items-center gap-3 rounded border p-2">
                              <span className="text-sm flex-1 truncate">{goal.description || tr(`هدف ${gIdx + 1}`, `Goal ${gIdx + 1}`)}</span>
                              <Select
                                value={goal.status}
                                onValueChange={(v) => {
                                  const copy = [...editGoals];
                                  copy[gIdx] = { ...copy[gIdx], status: v as Goal['status'] };
                                  setEditGoals(copy);
                                }}
                              >
                                <SelectTrigger className="w-36 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GOAL_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {trGoalStatus(s)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="edit-settings" className="space-y-4 pt-4">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="edit-patient-involved"
                            checked={editForm.patientInvolved}
                            onCheckedChange={(v) => setEditForm({ ...editForm, patientInvolved: !!v })}
                          />
                          <Label htmlFor="edit-patient-involved">{tr('المريض مشارك', 'Patient Involved')}</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="edit-family-involved"
                            checked={editForm.familyInvolved}
                            onCheckedChange={(v) => setEditForm({ ...editForm, familyInvolved: !!v })}
                          />
                          <Label htmlFor="edit-family-involved">{tr('الأسرة مشاركة', 'Family Involved')}</Label>
                        </div>
                      </div>
                      <div>
                        <Label>{tr('ملاحظات المشاركة', 'Participation Notes')}</Label>
                        <Textarea
                          value={editForm.participationNotes}
                          onChange={(e) => setEditForm({ ...editForm, participationNotes: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label>{tr('جدول المراجعة', 'Review Schedule')}</Label>
                        <Select
                          value={editForm.reviewSchedule}
                          onValueChange={(v) => setEditForm({ ...editForm, reviewSchedule: v })}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder={tr('اختر الجدول', 'Select schedule')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WEEKLY">{tr('أسبوعي', 'Weekly')}</SelectItem>
                            <SelectItem value="BIWEEKLY">{tr('كل أسبوعين', 'Biweekly')}</SelectItem>
                            <SelectItem value="MONTHLY">{tr('شهري', 'Monthly')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{tr('ملاحظات عامة', 'General Notes')}</Label>
                        <Textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <DialogFooter className="pt-4">
                    <Button variant="outline" onClick={() => setEditMode(false)}>
                      {tr('إلغاء', 'Cancel')}
                    </Button>
                    <Button onClick={handleUpdate} disabled={submitting}>
                      {submitting ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التغييرات', 'Save Changes')}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/*  REVIEW DIALOG                                                       */}
      {/* ================================================================== */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('إضافة مراجعة', 'Add Review')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{tr('ملاحظات المراجعة', 'Review Notes')}</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
                placeholder={tr('أدخل ملاحظات المراجعة...', 'Enter review notes...')}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="review-goals-updated"
                checked={reviewGoalsUpdated}
                onCheckedChange={(v) => setReviewGoalsUpdated(!!v)}
              />
              <Label htmlFor="review-goals-updated">{tr('تم تحديث الأهداف', 'Goals were updated')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleAddReview} disabled={submitting}>
              {submitting ? tr('جاري الحفظ...', 'Saving...') : tr('إضافة المراجعة', 'Add Review')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/*  STATUS CHANGE DIALOG                                                */}
      {/* ================================================================== */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusAction === 'COMPLETED'
                ? tr('إكمال خطة العلاج', 'Complete Treatment Plan')
                : tr('إيقاف خطة العلاج', 'Discontinue Treatment Plan')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {statusAction === 'COMPLETED'
                ? tr(
                    'هل أنت متأكد من إكمال هذه الخطة؟ لن يمكن التراجع عن هذا الإجراء.',
                    'Are you sure you want to mark this plan as completed? This action cannot be undone.',
                  )
                : tr(
                    'هل أنت متأكد من إيقاف هذه الخطة؟ يرجى تقديم سبب الإيقاف.',
                    'Are you sure you want to discontinue this plan? Please provide a reason.',
                  )}
            </p>
            <div>
              <Label>
                {statusAction === 'COMPLETED'
                  ? tr('ملاحظات الإكمال (اختياري)', 'Completion notes (optional)')
                  : tr('سبب الإيقاف', 'Reason for discontinuation')}
              </Label>
              <Textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
                placeholder={
                  statusAction === 'COMPLETED'
                    ? tr('ملاحظات...', 'Notes...')
                    : tr('سبب الإيقاف...', 'Reason for discontinuation...')
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              variant={statusAction === 'DISCONTINUED' ? 'destructive' : 'default'}
              onClick={handleStatusChange}
              disabled={submitting || (statusAction === 'DISCONTINUED' && !statusReason.trim())}
            >
              {submitting
                ? tr('جاري التنفيذ...', 'Processing...')
                : statusAction === 'COMPLETED'
                ? tr('تأكيد الإكمال', 'Confirm Complete')
                : tr('تأكيد الإيقاف', 'Confirm Discontinue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
